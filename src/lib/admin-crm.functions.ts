// Admin CRM server functions: dashboard stats, paged/filtered orders, CSV
// export, customer aggregation and internal notes, and mark-as-shipped.
//
// All handlers gate on requireAdmin() (shared with reviews moderation) and use
// the service-role client — RLS on the underlying tables stays admin-only for
// the REST surface, these functions are the sanctioned path.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { sendOrderShippedEmail } from "@/lib/order-emails.server";

const PAGE_SIZE = 25;
// PostgREST caps unbounded selects at 1000 — the same silent cap that hid 79%
// of the catalog from the sitemap. Every full-table walk here pages explicitly.
const DB_PAGE = 1000;

/** Escape PostgREST .or()/.ilike reserved characters in user search input. */
function sanitizeTerm(raw: string): string {
  return raw.replace(/[,()%\\]/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchAllOrders(columns: string) {
  const out: any[] = [];
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(columns)
      .order("created_at", { ascending: false })
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < DB_PAGE) return out;
  }
}

// ---- Dashboard -------------------------------------------------------------

export const getDashboardStats = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  const orders = await fetchAllOrders(
    "id, order_number, customer_name, total, status, payment_status, created_at, paid_at",
  );

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const paid = orders.filter((o) => o.payment_status === "paid" || o.payment_status === "refunded");
  const revenueIn = (since: number) =>
    paid
      .filter((o) => new Date(o.paid_at ?? o.created_at).getTime() >= since)
      .reduce((s, o) => s + Number(o.total), 0);
  const countIn = (since: number) =>
    paid.filter((o) => new Date(o.paid_at ?? o.created_at).getTime() >= since).length;

  const revenueTotal = paid.reduce((s, o) => s + Number(o.total), 0);

  // Orders created but never paid, older than an hour (younger ones may still
  // be mid-checkout). 'failed' is included — the CardCom webhook marks declined
  // cards that way, and a customer whose card bounced is exactly who the owner
  // wants to call.
  const stuckUnpaid = orders.filter(
    (o) =>
      ["unpaid", "failed"].includes(o.payment_status) &&
      now - new Date(o.created_at).getTime() > 60 * 60 * 1000 &&
      !["cancelled", "refunded"].includes(o.status),
  );

  // Revenue per day, last 30 days (paid orders, keyed by paid_at date).
  const series: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * DAY);
    series.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
  }
  const byDate = new Map(series.map((s) => [s.date, s]));
  for (const o of paid) {
    const key = new Date(o.paid_at ?? o.created_at).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) {
      bucket.revenue += Number(o.total);
      bucket.orders += 1;
    }
  }

  const statusCounts: Record<string, number> = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  // Top products by revenue across paid orders.
  const itemRows: any[] = [];
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select("product_name, quantity, line_total, orders!inner(payment_status)")
      .in("orders.payment_status", ["paid", "refunded"])
      .range(from, from + DB_PAGE - 1);
    if (error) throw error;
    itemRows.push(...(data ?? []));
    if ((data ?? []).length < DB_PAGE) break;
  }
  const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of itemRows) {
    const cur = byProduct.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 };
    cur.qty += Number(it.quantity);
    cur.revenue += Number(it.line_total);
    byProduct.set(it.product_name, cur);
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  return {
    revenue: {
      today: revenueIn(startOfToday.getTime()),
      last7: revenueIn(now - 7 * DAY),
      last30: revenueIn(now - 30 * DAY),
      total: revenueTotal,
    },
    orders: {
      today: countIn(startOfToday.getTime()),
      last7: countIn(now - 7 * DAY),
      last30: countIn(now - 30 * DAY),
      totalPaid: paid.length,
      totalAll: orders.length,
      avgOrderValue: paid.length ? Math.round(revenueTotal / paid.length) : 0,
    },
    stuckUnpaid: stuckUnpaid.slice(0, 10).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      total: Number(o.total),
      created_at: o.created_at,
    })),
    stuckUnpaidCount: stuckUnpaid.length,
    series,
    statusCounts,
    topProducts,
    recentOrders: orders.slice(0, 8).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      total: Number(o.total),
      status: o.status,
      payment_status: o.payment_status,
      created_at: o.created_at,
    })),
  };
});

// ---- Orders: paged list + CSV export --------------------------------------

const OrdersFilterSchema = z.object({
  q: z.string().max(120).optional(),
  status: z.string().max(20).optional(),
  payment: z.string().max(20).optional(),
  days: z.number().int().min(0).max(3650).optional(), // 0/undefined = all time
  page: z.number().int().min(0).default(0),
});

function applyOrderFilters(query: any, f: z.infer<typeof OrdersFilterSchema>) {
  if (f.status) query = query.eq("status", f.status);
  if (f.payment) query = query.eq("payment_status", f.payment);
  if (f.days) query = query.gte("created_at", new Date(Date.now() - f.days * 864e5).toISOString());
  const term = sanitizeTerm(f.q ?? "");
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      `order_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like},customer_email.ilike.${like}`,
    );
  }
  return query;
}

export const listOrdersPaged = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => OrdersFilterSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    let query = supabaseAdmin.from("orders").select("*, order_items(*)", { count: "exact" });
    query = applyOrderFilters(query, f);
    const from = f.page * PAGE_SIZE;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[listOrdersPaged]:", error);
      throw new Error("שגיאה בטעינת ההזמנות.");
    }
    return { rows: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
  });

export const exportOrdersCsv = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => OrdersFilterSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    const rows: any[] = [];
    for (let from = 0; ; from += DB_PAGE) {
      let query = supabaseAdmin
        .from("orders")
        .select(
          "order_number, created_at, customer_name, customer_phone, customer_email, customer_address, customer_city, subtotal, shipping, total, status, payment_status, tracking_number, shipping_carrier, notes, order_items(product_name, quantity, line_total)",
        );
      query = applyOrderFilters(query, f);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, from + DB_PAGE - 1);
      if (error) throw new Error("שגיאה בייצוא.");
      rows.push(...(data ?? []));
      if ((data ?? []).length < DB_PAGE) break;
    }

    const csvEsc = (v: unknown) => {
      const s = String(v ?? "").replace(/\r?\n/g, " ");
      return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "מספר הזמנה", "תאריך", "לקוח", "טלפון", "אימייל", "כתובת", "עיר",
      "ביניים", "משלוח", 'סה"כ', "סטטוס", "תשלום", "מעקב", "חברת שילוח", "פריטים", "הערות",
    ];
    const lines = rows.map((o) =>
      [
        o.order_number,
        new Date(o.created_at).toLocaleString("he-IL"),
        o.customer_name, o.customer_phone, o.customer_email,
        o.customer_address, o.customer_city ?? "",
        o.subtotal, o.shipping, o.total, o.status, o.payment_status,
        o.tracking_number ?? "", o.shipping_carrier ?? "",
        (o.order_items ?? []).map((it: any) => `${it.product_name} x${it.quantity}`).join(" | "),
        o.notes ?? "",
      ].map(csvEsc).join(","),
    );
    // BOM so Excel opens Hebrew UTF-8 correctly.
    return { csv: "﻿" + [header.join(","), ...lines].join("\r\n"), count: rows.length };
  });

// ---- Customers -------------------------------------------------------------

const CustomersSchema = z.object({
  q: z.string().max(120).optional(),
  sort: z.enum(["ltv", "recent", "orders"]).default("ltv"),
  page: z.number().int().min(0).default(0),
});

export const listCustomers = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CustomersSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    const orders = await fetchAllOrders(
      "customer_email, customer_name, customer_phone, total, payment_status, created_at, contact_consent",
    );

    const byEmail = new Map<string, any>();
    for (const o of orders) {
      const key = String(o.customer_email ?? "").trim().toLowerCase();
      if (!key) continue;
      const cur = byEmail.get(key) ?? {
        email: key, name: o.customer_name, phone: o.customer_phone,
        orders: 0, paidOrders: 0, ltv: 0, lastOrderAt: o.created_at,
        contactConsent: false,
      };
      cur.orders += 1;
      if (o.payment_status === "paid" || o.payment_status === "refunded") {
        cur.paidOrders += 1;
        cur.ltv += Number(o.total);
      }
      // orders arrive newest-first, so the first row per email carries the
      // freshest name/phone/last-order values — keep them.
      if (o.contact_consent) cur.contactConsent = true;
      byEmail.set(key, cur);
    }

    let rows = [...byEmail.values()];
    const term = sanitizeTerm(f.q ?? "").toLowerCase();
    if (term) {
      rows = rows.filter(
        (c) =>
          c.email.includes(term) ||
          String(c.name ?? "").toLowerCase().includes(term) ||
          String(c.phone ?? "").includes(term),
      );
    }
    rows.sort(
      f.sort === "recent"
        ? (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
        : f.sort === "orders"
          ? (a, b) => b.orders - a.orders
          : (a, b) => b.ltv - a.ltv,
    );
    const total = rows.length;
    const from = f.page * PAGE_SIZE;
    return { rows: rows.slice(from, from + PAGE_SIZE), total, pageSize: PAGE_SIZE };
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const email = data.email.trim().toLowerCase();
    const [{ data: orders, error: oErr }, { data: notes, error: nErr }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select(
          "id, order_number, total, status, payment_status, created_at, tracking_number, order_items(product_name, quantity, line_total)",
        )
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("crm_customer_notes")
        .select("id, note, created_at")
        .eq("customer_email", email)
        .order("created_at", { ascending: false }),
    ]);
    if (oErr || nErr) {
      console.error("[getCustomerDetail]:", oErr ?? nErr);
      throw new Error("שגיאה בטעינת פרטי הלקוח.");
    }
    return { orders: orders ?? [], notes: notes ?? [] };
  });

export const addCustomerNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().email(),
        note: z.string().trim().min(1).max(2000).transform((v) => v.replace(/<[^>]*>/g, "")),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { error } = await supabaseAdmin.from("crm_customer_notes").insert({
      customer_email: data.email.trim().toLowerCase(),
      note: data.note,
      created_by: adminId,
    });
    if (error) {
      console.error("[addCustomerNote]:", error);
      throw new Error("שגיאה בשמירת ההערה.");
    }
    return { ok: true };
  });

export const deleteCustomerNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("crm_customer_notes").delete().eq("id", data.id);
    if (error) throw new Error("שגיאה במחיקת ההערה.");
    return { ok: true };
  });

// ---- Shipping --------------------------------------------------------------

export const markOrderShipped = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        tracking_number: z.string().trim().max(60).optional(),
        carrier: z.string().trim().max(60).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, shipping_notified_at")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("הזמנה לא נמצאה.");

    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "shipped",
        shipping_status: "shipped",
        shipped_at: new Date().toISOString(),
        tracking_number: data.tracking_number || null,
        shipping_carrier: data.carrier || null,
      })
      .eq("id", order.id);
    if (uErr) {
      console.error("[markOrderShipped] update:", uErr);
      throw new Error("שגיאה בעדכון ההזמנה.");
    }

    // Email once per order: guarded by shipping_notified_at.
    let emailSent = false;
    if (!order.shipping_notified_at) {
      try {
        emailSent = await sendOrderShippedEmail(order.id);
        if (emailSent) {
          await supabaseAdmin
            .from("orders")
            .update({ shipping_notified_at: new Date().toISOString() })
            .eq("id", order.id);
        }
      } catch (e) {
        console.error("[markOrderShipped] email failed (order still marked shipped):", e);
      }
    }
    return { ok: true, emailSent };
  });
