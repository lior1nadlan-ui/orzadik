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
import {
  sendOrderShippedEmail,
  sendOrderConfirmationEmails,
} from "@/lib/order-emails.server";

const PAGE_SIZE = 25;
// PostgREST caps unbounded selects at 1000 — the same silent cap that hid 79%
// of the catalog from the sitemap. Every full-table walk here pages explicitly.
const DB_PAGE = 1000;

/** Escape PostgREST .or()/.ilike reserved characters in user search input. */
function sanitizeTerm(raw: string): string {
  return raw.replace(/[,()%\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** CSV field escaping shared by the export functions. */
const csvEsc = (v: unknown) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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
    "id, order_number, customer_name, customer_email, total, status, payment_status, created_at, paid_at, shipped_at",
  );

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const paid = orders.filter((o) => o.payment_status === "paid" || o.payment_status === "refunded");
  const paidAt = (o: any) => new Date(o.paid_at ?? o.created_at).getTime();
  const revenueBetween = (since: number, until: number) =>
    paid
      .filter((o) => paidAt(o) >= since && paidAt(o) < until)
      .reduce((s, o) => s + Number(o.total), 0);
  const countBetween = (since: number, until: number) =>
    paid.filter((o) => paidAt(o) >= since && paidAt(o) < until).length;
  const revenueIn = (since: number) => revenueBetween(since, Infinity);
  const countIn = (since: number) => countBetween(since, Infinity);

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

  // Paid orders the owner still has to pack: not yet shipped, oldest first so
  // the customers who have waited longest float to the top of the queue.
  const readyToShip = orders
    .filter(
      (o) =>
        o.payment_status === "paid" &&
        ["pending", "processing"].includes(o.status) &&
        !o.shipped_at,
    )
    .sort((a, b) => paidAt(a) - paidAt(b));

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

  // Open abandoned carts — recoverable revenue at a glance. The cleanup cron
  // (cleanup_old_abandoned_carts) keeps the table small; cap defensively. On
  // error fall back to zeros rather than failing the whole dashboard.
  const { data: openCarts, error: acErr } = await supabaseAdmin
    .from("abandoned_carts")
    .select("subtotal")
    .is("converted_order_id", null)
    .eq("unsubscribed", false)
    .limit(1000);
  if (acErr) console.error("[getDashboardStats] abandoned carts:", acErr);

  // Catalog health — head-count queries only. This fn refetches every 60s and
  // already walks the orders table; across 4,672 SKUs these must stay
  // `count: "exact", head: true` (near-zero cost), never a row walk. The .or()
  // also counts empty-string thumbnails — the manual product form can save "".
  const [{ count: noImageCount, error: niErr }, { count: oosCount, error: oosErr }] =
    await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .or("thumbnail_url.is.null,thumbnail_url.eq."),
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("stock_status", "outofstock"),
    ]);
  if (niErr || oosErr) console.error("[getDashboardStats] catalog health:", niErr ?? oosErr);

  // Low stock — only products that actually opted into tracking, so the 4,672
  // untracked supplier SKUs (stock_qty 0 and meaningless) never show up here.
  const { data: lowStock, error: lsErr } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, stock_qty")
    .eq("track_stock", true)
    .eq("is_active", true)
    .lte("stock_qty", 3)
    .order("stock_qty", { ascending: true })
    .limit(8);
  if (lsErr) console.error("[getDashboardStats] low stock:", lsErr);

  // Repeat-customer analytics, keyed on the lowercased email (guest checkout
  // means most customers have no auth.users row). Emails stay server-side —
  // only names and amounts are returned to the widget.
  const byCustomer = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const o of paid) {
    const key = String(o.customer_email ?? "").trim().toLowerCase();
    if (!key) continue;
    const cur = byCustomer.get(key) ?? { name: o.customer_name, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total);
    byCustomer.set(key, cur);
  }
  const customers = [...byCustomer.values()];
  const returning = customers.filter((c) => c.orders > 1);
  const returningRevenue = returning.reduce((s, c) => s + c.revenue, 0);
  const repeat = {
    totalCustomers: customers.length,
    returningCustomers: returning.length,
    repeatRate: customers.length ? Math.round((returning.length / customers.length) * 100) : 0,
    returningRevenue,
    newRevenue: revenueTotal - returningRevenue,
    topCustomers: [...customers]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((c) => ({ name: c.name, orders: c.orders, revenue: c.revenue })),
  };

  return {
    lowStock: (lowStock ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      qty: p.stock_qty ?? 0,
    })),
    repeat,
    revenue: {
      today: revenueIn(startOfToday.getTime()),
      last7: revenueIn(now - 7 * DAY),
      last30: revenueIn(now - 30 * DAY),
      // Same windows, shifted one period back — the dashboard renders deltas.
      prevToday: revenueBetween(startOfToday.getTime() - DAY, startOfToday.getTime()),
      prev7: revenueBetween(now - 14 * DAY, now - 7 * DAY),
      prev30: revenueBetween(now - 60 * DAY, now - 30 * DAY),
      total: revenueTotal,
    },
    orders: {
      today: countIn(startOfToday.getTime()),
      last7: countIn(now - 7 * DAY),
      last30: countIn(now - 30 * DAY),
      prevToday: countBetween(startOfToday.getTime() - DAY, startOfToday.getTime()),
      prev7: countBetween(now - 14 * DAY, now - 7 * DAY),
      prev30: countBetween(now - 60 * DAY, now - 30 * DAY),
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
    readyToShip: {
      count: readyToShip.length,
      items: readyToShip.slice(0, 5).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        total: Number(o.total),
        paid_at: o.paid_at ?? o.created_at,
      })),
    },
    abandoned: {
      openCount: acErr ? 0 : (openCarts ?? []).length,
      recoverable: acErr ? 0 : (openCarts ?? []).reduce((s, c) => s + Number(c.subtotal ?? 0), 0),
    },
    catalogHealth: { noImage: noImageCount ?? 0, outOfStock: oosCount ?? 0 },
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

// ---- Action queue ----------------------------------------------------------
//
// "מה לעשות היום" — a prioritized list of concrete, human actions the owner
// should take on REAL orders and carts. Read-only: it derives entirely from
// live order / abandoned-cart state and writes nothing. The per-row "handled"
// state lives in the browser (localStorage), not here — so this fn always
// returns the full candidate set and the client hides what's already dealt
// with. Reuses the dashboard's own stuck-unpaid / ready-to-ship / abandoned
// logic (thresholds kept in sync with getDashboardStats above).
//
// Each order maps to AT MOST ONE action, so it never appears twice: a paid
// order is a "thank you" for its first day, then becomes "ready to ship"; an
// unpaid one is "stuck"; a shipped one eventually becomes a review nudge.

type ActionType =
  | "thank_you"
  | "ready_to_ship"
  | "stuck_unpaid"
  | "recover_cart"
  | "review_request";

// Priority ordering (higher = surfaces first): delight a fresh paying customer,
// then chase money left on the table, then fulfilment, recovery, and reviews.
const ACTION_PRIORITY: Record<ActionType, number> = {
  thank_you: 100,
  stuck_unpaid: 90,
  ready_to_ship: 80,
  recover_cart: 60,
  review_request: 40,
};

// Sanity cap — at ~1 order the queue is tiny, but never flood the UI.
const QUEUE_CAP = 40;

type ActionRow = {
  id: string;
  type: ActionType;
  priority: number;
  orderNumber?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  context: string;
  createdAt: string;
};

export const getActionQueue = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  const orders = await fetchAllOrders(
    "id, order_number, customer_name, customer_email, customer_phone, status, payment_status, created_at, paid_at, shipped_at, review_request_sent_at",
  );

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  // Date component of the stable, per-day row id: dismissing an action clears it
  // for today; a still-open action resurfaces tomorrow — right for a daily queue.
  const today = new Date().toISOString().slice(0, 10);

  const rows: ActionRow[] = [];
  const paidAt = (o: any) => new Date(o.paid_at ?? o.created_at).getTime();
  const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / DAY);

  for (const o of orders) {
    // Never nudge on a cancelled/refunded order.
    if (["cancelled", "refunded"].includes(o.status)) continue;

    const base = {
      priority: 0,
      orderNumber: o.order_number || undefined,
      customerName: o.customer_name || "לקוח",
      customerEmail: o.customer_email || undefined,
      customerPhone: o.customer_phone || undefined,
    };
    const rowFor = (type: ActionType, createdAt: string, context: string): ActionRow => ({
      ...base,
      id: `${type}:${o.id}:${today}`,
      type,
      priority: ACTION_PRIORITY[type],
      createdAt,
      context,
    });

    // Paid, not yet shipped → greet for the first 24h, then it's a packing job.
    if (
      o.payment_status === "paid" &&
      !o.shipped_at &&
      ["pending", "processing"].includes(o.status)
    ) {
      const since = paidAt(o);
      const sinceIso = new Date(since).toISOString();
      if (now - since <= DAY) {
        rows.push(
          rowFor("thank_you", sinceIso, "הזמנה חדשה ששולמה — שלחו תודה אישית ואשרו שקיבלתם 🙏"),
        );
      } else {
        const d = Math.floor((now - since) / DAY);
        rows.push(
          rowFor("ready_to_ship", sinceIso, `שולם ומחכה לאריזה ומשלוח — כבר ${d} ימים 📦`),
        );
      }
      continue;
    }

    // Unpaid / failed for over an hour (younger ones may still be mid-checkout;
    // 'failed' = a declined card the owner most wants to catch) → warm follow-up.
    if (
      ["unpaid", "failed"].includes(o.payment_status) &&
      now - new Date(o.created_at).getTime() > HOUR
    ) {
      rows.push(
        rowFor("stuck_unpaid", o.created_at, "התחילה הזמנה אך התשלום לא הושלם — שווה פנייה חמה 💬"),
      );
      continue;
    }

    // Shipped ~5+ days ago and never nudged for feedback → personal review ask.
    // "no review" is approximated by review_request_sent_at IS NULL — the only
    // per-order signal available without a schema change.
    if (
      o.payment_status === "paid" &&
      ["shipped", "completed"].includes(o.status) &&
      o.shipped_at &&
      !o.review_request_sent_at &&
      now - new Date(o.shipped_at).getTime() >= 5 * DAY
    ) {
      rows.push(
        rowFor(
          "review_request",
          o.shipped_at,
          `נשלחה לפני ${daysSince(o.shipped_at)} ימים — שאלו איך היה ובקשו חוות דעת ⭐`,
        ),
      );
      continue;
    }
  }

  // Recoverable abandoned carts — open, not opted out, with real value, aged
  // past the mid-checkout window but still fresh enough for a personal nudge.
  // Isolated in try/catch so a carts failure never fails the whole queue.
  try {
    const { data: carts, error: cErr } = await supabaseAdmin
      .from("abandoned_carts")
      .select("id, email, name, subtotal, created_at")
      .is("converted_order_id", null)
      .eq("unsubscribed", false)
      .gt("subtotal", 0)
      .gte("created_at", new Date(now - 14 * DAY).toISOString())
      .lte("created_at", new Date(now - HOUR).toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    if (cErr) {
      console.error("[getActionQueue] abandoned carts:", cErr);
    } else if (carts && carts.length > 0) {
      // abandoned_carts stores no phone — borrow the freshest one from orders
      // (one query for the whole batch), mirroring listAbandonedCarts.
      const emails = [
        ...new Set(carts.map((c) => String(c.email ?? "").trim().toLowerCase()).filter(Boolean)),
      ];
      const phoneByEmail = new Map<string, string>();
      if (emails.length > 0) {
        const { data: orderRows, error: pErr } = await supabaseAdmin
          .from("orders")
          .select("customer_email, customer_phone")
          .in("customer_email", emails)
          .order("created_at", { ascending: false });
        if (pErr) {
          console.error("[getActionQueue] cart phones:", pErr);
        } else {
          for (const r of orderRows ?? []) {
            const key = String(r.customer_email ?? "").trim().toLowerCase();
            if (key && r.customer_phone && !phoneByEmail.has(key)) {
              phoneByEmail.set(key, r.customer_phone);
            }
          }
        }
      }
      for (const c of carts) {
        const key = String(c.email ?? "").trim().toLowerCase();
        rows.push({
          id: `recover_cart:${c.id}:${today}`,
          type: "recover_cart",
          priority: ACTION_PRIORITY.recover_cart,
          customerName: c.name || "לקוח",
          customerEmail: c.email || undefined,
          customerPhone: phoneByEmail.get(key) || undefined,
          context: "עגלה נטושה עם פריטים — הזמנה בהמתנה, שווה תזכורת עדינה 🛒",
          createdAt: c.created_at,
        });
      }
    }
  } catch (e) {
    console.error("[getActionQueue] abandoned carts failed:", e);
  }

  // Order by priority; within a tier the longest-waiting action floats up.
  rows.sort(
    (a, b) =>
      b.priority - a.priority ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return rows.slice(0, QUEUE_CAP);
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
          // variant_label + custom_text are in the select because the CSV is the
          // sheet the owner packs and engraves from. Without them the export said
          // "טלית x1" for a line whose whole value is the size and the wording —
          // the two fields that make the order non-returnable once produced.
          "order_number, created_at, customer_name, customer_phone, customer_email, customer_address, customer_city, subtotal, shipping, total, status, payment_status, tracking_number, shipping_carrier, notes, is_gift, gift_note, gift_wrap, order_items(product_name, quantity, line_total, variant_label, custom_text)",
        );
      query = applyOrderFilters(query, f);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, from + DB_PAGE - 1);
      if (error) throw new Error("שגיאה בייצוא.");
      rows.push(...(data ?? []));
      if ((data ?? []).length < DB_PAGE) break;
    }

    const header = [
      "מספר הזמנה", "תאריך", "לקוח", "טלפון", "אימייל", "כתובת", "עיר",
      "ביניים", "משלוח", 'סה"כ', "סטטוס", "תשלום", "מעקב", "חברת שילוח", "פריטים", "הערות",
      "מתנה", "הקדשה", "עטיפה",
    ];
    const lines = rows.map((o) =>
      [
        o.order_number,
        new Date(o.created_at).toLocaleString("he-IL"),
        o.customer_name, o.customer_phone, o.customer_email,
        o.customer_address, o.customer_city ?? "",
        o.subtotal, o.shipping, o.total, o.status, o.payment_status,
        o.tracking_number ?? "", o.shipping_carrier ?? "",
        (o.order_items ?? [])
          .map((it: any) =>
            [
              `${it.product_name} x${it.quantity}`,
              it.variant_label ? `גודל: ${it.variant_label}` : "",
              it.custom_text ? `כיתוב: ${it.custom_text}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          )
          .join(" | "),
        o.notes ?? "",
        o.is_gift ? "כן" : "לא",
        o.gift_note ?? "",
        o.gift_wrap ? "כן" : "לא",
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

/** Column list every customer-aggregation caller fetches from orders. */
const CUSTOMER_ORDER_COLUMNS =
  "customer_email, customer_name, customer_phone, total, payment_status, created_at, contact_consent";

/** Fold the raw orders rows into one aggregated row per customer email, then
 * apply the same term-match and sort the customers screen shows. */
function aggregateCustomers(
  orders: any[],
  q: string | undefined,
  sort: "ltv" | "recent" | "orders",
) {
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
  const term = sanitizeTerm(q ?? "").toLowerCase();
  if (term) {
    rows = rows.filter(
      (c) =>
        c.email.includes(term) ||
        String(c.name ?? "").toLowerCase().includes(term) ||
        String(c.phone ?? "").includes(term),
    );
  }
  rows.sort(
    sort === "recent"
      ? (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
      : sort === "orders"
        ? (a, b) => b.orders - a.orders
        : (a, b) => b.ltv - a.ltv,
  );
  return rows;
}

export const listCustomers = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CustomersSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    const orders = await fetchAllOrders(CUSTOMER_ORDER_COLUMNS);
    const rows = aggregateCustomers(orders, f.q, f.sort);
    const total = rows.length;
    const from = f.page * PAGE_SIZE;
    return { rows: rows.slice(from, from + PAGE_SIZE), total, pageSize: PAGE_SIZE };
  });

export const exportCustomersCsv = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CustomersSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    const orders = await fetchAllOrders(CUSTOMER_ORDER_COLUMNS);
    const rows = aggregateCustomers(orders, f.q, f.sort);

    const header = [
      "שם", "אימייל", "טלפון", "הזמנות", "הזמנות ששולמו", "סך קניות", "הזמנה אחרונה", "אישר יצירת קשר",
    ];
    const lines = rows.map((c) =>
      [
        c.name, c.email, c.phone,
        c.orders, c.paidOrders, c.ltv,
        new Date(c.lastOrderAt).toLocaleString("he-IL"),
        c.contactConsent ? "כן" : "לא",
      ].map(csvEsc).join(","),
    );
    // BOM so Excel opens Hebrew UTF-8 correctly.
    return { csv: "﻿" + [header.join(","), ...lines].join("\r\n"), count: rows.length };
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

/** Notes-only fetch for the order-details dialog — avoids getCustomerDetail
 * dragging 200 orders + order_items on every dialog open. */
export const listCustomerNotes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    // Notes are stored lowercased and matched with .eq — normalize or we miss them.
    const email = data.email.trim().toLowerCase();
    const { data: notes, error } = await supabaseAdmin
      .from("crm_customer_notes")
      .select("id, note, created_at")
      .eq("customer_email", email)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listCustomerNotes]:", error);
      throw new Error("שגיאה בטעינת ההערות.");
    }
    return notes ?? [];
  });

// ---- Abandoned carts -------------------------------------------------------

export const listAbandonedCarts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        show: z.enum(["open", "converted", "all"]).default("open"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    // No admin RLS read path exists for abandoned_carts on the browser client —
    // this server fn (service role + requireAdmin) is the sanctioned access.
    let q = supabaseAdmin
      .from("abandoned_carts")
      .select(
        "id, email, name, items, subtotal, reminder_1_sent_at, reminder_2_sent_at, converted_order_id, unsubscribed, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (data.show === "open") q = q.is("converted_order_id", null);
    if (data.show === "converted") q = q.not("converted_order_id", "is", null);
    const { data: rows, error, count } = await q;
    if (error) {
      console.error("[listAbandonedCarts]:", error);
      throw new Error("שגיאה בטעינת העגלות הנטושות.");
    }

    // abandoned_carts stores no phone — borrow the freshest one from orders
    // (one query for the whole page) so the UI can offer a WhatsApp action.
    const emails = [...new Set((rows ?? []).map((r) => String(r.email).toLowerCase()))];
    const phoneByEmail = new Map<string, string>();
    if (emails.length > 0) {
      const { data: orderRows, error: pErr } = await supabaseAdmin
        .from("orders")
        .select("customer_email, customer_phone")
        .in("customer_email", emails)
        .order("created_at", { ascending: false });
      if (pErr) {
        // Non-fatal: rows simply render without a WhatsApp button.
        console.error("[listAbandonedCarts] phones:", pErr);
      } else {
        for (const o of orderRows ?? []) {
          const key = String(o.customer_email ?? "").trim().toLowerCase();
          if (key && o.customer_phone && !phoneByEmail.has(key)) {
            phoneByEmail.set(key, o.customer_phone);
          }
        }
      }
    }

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        phone: phoneByEmail.get(String(r.email).toLowerCase()) ?? null,
      })),
      total: count ?? 0,
      pageSize: PAGE_SIZE,
    };
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
      .select("id, order_number, shipped_at")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("הזמנה לא נמצאה.");

    // The shipped_at null→now() transition is the idempotency latch for the
    // customer email. shipping_notified_at CANNOT gate it: notifyShippingCompany
    // stamps that column on EVERY paid order at payment time (from the CardCom
    // webhook), so it is already set here and the old guard never fired — the
    // customer never got the shipped+tracking email. Read shipped_at BEFORE the
    // update, then send exactly once, on the first mark-shipped.
    const wasAlreadyShipped = !!order.shipped_at;

    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "shipped",
        shipping_status: "shipped",
        // Set shipped_at only on the FIRST mark-shipped: re-marking (e.g. to add
        // a tracking number later) must not drift the original ship date, which
        // the admin screen shows to the owner.
        ...(wasAlreadyShipped ? {} : { shipped_at: new Date().toISOString() }),
        tracking_number: data.tracking_number || null,
        shipping_carrier: data.carrier || null,
      })
      .eq("id", order.id);
    if (uErr) {
      console.error("[markOrderShipped] update:", uErr);
      throw new Error("שגיאה בעדכון ההזמנה.");
    }

    // Send the shipped + tracking email only on the first transition to shipped.
    // Wrapped so an email failure never fails the mark-shipped action.
    let emailSent = false;
    if (!wasAlreadyShipped) {
      try {
        emailSent = await sendOrderShippedEmail(order.id);
      } catch (e) {
        console.error("[markOrderShipped] email failed (order still marked shipped):", e);
      }
    }
    return { ok: true, emailSent };
  });

/**
 * Move a paid order into "בהכנה".
 *
 * orders.shipping_status has always carried a 'preparing' value that NOTHING
 * could write: markOrderShipped jumps straight from the 'pending' default to
 * 'shipped'. So every paid buyer read "ממתין לטיפול" on /account and an
 * unlit step on /track for the entire fulfilment window — the store looked
 * asleep while the owner was actually making the thing. This is the write that
 * was missing; the value itself needs no migration (shipping_status is plain
 * text with a 'pending' default and no CHECK constraint).
 *
 * Deliberately does NOT touch `status`, `shipped_at` or send any email: it is a
 * progress signal, not a fulfilment milestone, and markOrderShipped stays the
 * one place that decides an order has left the building.
 */
export const markOrderPreparing = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ order_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, shipping_status, shipped_at")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("הזמנה לא נמצאה.");
    // Never walk an order backwards: once it has shipped, "בהכנה" is a lie the
    // customer can see on /track.
    if (order.shipped_at || order.shipping_status === "shipped") {
      throw new Error("ההזמנה כבר סומנה כנשלחה — לא ניתן להחזיר אותה למצב בהכנה.");
    }
    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({ shipping_status: "preparing" })
      .eq("id", order.id);
    if (uErr) {
      console.error("[markOrderPreparing]:", uErr);
      throw new Error("שגיאה בעדכון מצב ההכנה.");
    }
    return { ok: true };
  });

/**
 * Manually re-send the paid-order confirmation (the §14ג(ב) written
 * confirmation) for one order.
 *
 * This is the human escape hatch behind the confirmation_email_sent_at latch in
 * cardcom-settle.server.ts. That latch now releases on a transport failure, so
 * the sweep can re-claim it — but the sweep only revisits orders inside its
 * 72-hour lookback, and Resend can fail for reasons no retry fixes (a bounced
 * address the customer then corrects by phone). Without a manual path the owner's
 * only option was to have no receipt at all.
 *
 * Idempotency is intentionally NOT enforced here: the whole point is to send a
 * receipt the customer says they never got, and a duplicate receipt is harmless
 * where a missing one is a legal defect. The stamp is refreshed only on success,
 * so the admin dialog keeps showing the truth.
 */
export const resendOrderConfirmation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ order_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, payment_status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("הזמנה לא נמצאה.");
    // The template says "קיבלנו את התשלום" — sending it for an unpaid order
    // would tell the customer money moved when it did not.
    if (order.payment_status !== "paid") {
      throw new Error("אישור הזמנה נשלח רק להזמנה ששולמה.");
    }

    const sent = await sendOrderConfirmationEmails(order.id);
    if (!sent) {
      // Leave the stamp exactly as it was: reporting a send that did not happen
      // is the failure mode this whole change exists to remove.
      throw new Error(
        "שליחת האישור נכשלה. בדקו שכתובת הדוא\"ל של הלקוח תקינה ושהגדרות הדוא\"ל של האתר פעילות.",
      );
    }
    const { error: stampErr } = await supabaseAdmin
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", order.id);
    if (stampErr) {
      // The mail went out; only the bookkeeping failed. Say so rather than
      // implying the customer got nothing.
      console.error("[resendOrderConfirmation] stamp failed for order:", order.id, stampErr);
    }
    return { ok: true, sentAt: new Date().toISOString() };
  });

// ---- Stock restore on refund / cancel -------------------------------------

// Terminal order states that release reserved inventory back to stock.
const TERMINAL_STATUSES = ["cancelled", "refunded"] as const;

/**
 * Return stock to inventory — the reverse of the decrement_order_stock RPC.
 * Called from BOTH the refund path (refundCardcomOrder) and the manual cancel
 * path (updateOrderStatus). Additive and self-idempotent, so it is safe to call
 * from any terminal-transition path.
 *
 * `orders.stock_decremented_at` is BOTH the correctness guard and the latch:
 *   • It is non-null only for orders whose stock was actually decremented (the
 *     decrement RPC stamps it on paid orders). Clearing it here means we never
 *     inflate stock for an order that never decremented — e.g. an unpaid order
 *     that gets cancelled.
 *   • Flipping it (non-null → NULL) atomically and checking the affected rows
 *     means exactly one caller wins: a replay, or a second terminal transition,
 *     restores nothing. This mirrors the decrement RPC's own claim-first latch,
 *     in reverse — no new column or DB function required.
 *
 * Mirrors decrement_order_stock's selection: one row per product (sum quantity
 * across lines), track_stock=true only, untracked SKUs (stock_qty null) left
 * untouched. Best-effort: every failure is logged with the order id only (no
 * customer PII in Worker logs — CWE-532) and never rethrown past this function.
 */
export async function restoreOrderStock(orderId: string): Promise<void> {
  // Atomically claim the restore. Only orders that were decremented and not yet
  // restored have a non-null stamp; clearing it is the idempotency latch.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("orders")
    .update({ stock_decremented_at: null })
    .eq("id", orderId)
    .not("stock_decremented_at", "is", null)
    .select("id");
  if (claimErr) {
    console.error("[restoreOrderStock] claim failed for order:", orderId, claimErr);
    return;
  }
  // Nothing to restore: stock was never decremented, or another caller already
  // restored it. Never restore twice.
  if (!claimed || claimed.length === 0) return;

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  if (itemsErr) {
    console.error("[restoreOrderStock] load items failed for order:", orderId, itemsErr);
    return;
  }

  // One row per product even when it appears on several lines — mirrors the
  // decrement RPC's GROUP BY product_id.
  const qtyByProduct = new Map<string, number>();
  for (const it of items ?? []) {
    if (!it.product_id) continue;
    qtyByProduct.set(it.product_id, (qtyByProduct.get(it.product_id) ?? 0) + Number(it.quantity));
  }
  if (qtyByProduct.size === 0) return;

  const { data: products, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, track_stock, stock_qty, stock_status")
    .in("id", [...qtyByProduct.keys()]);
  if (prodErr) {
    console.error("[restoreOrderStock] load products failed for order:", orderId, prodErr);
    return;
  }

  for (const p of products ?? []) {
    // Only products that opted into tracking with a real quantity — untracked
    // supplier SKUs (stock_qty null) are left untouched, same as the decrement.
    if (p.track_stock !== true || p.stock_qty == null) continue;
    const restored = Number(p.stock_qty) + (qtyByProduct.get(p.id) ?? 0);
    const patch: { stock_qty: number; stock_status?: string } = { stock_qty: restored };
    // Coming back from zero flips the badge back to in-stock; a still-zero (or
    // negative, clamped historically) product stays out-of-stock.
    if (restored > 0) patch.stock_status = "instock";
    const { error: upErr } = await supabaseAdmin.from("products").update(patch).eq("id", p.id);
    if (upErr) console.error("[restoreOrderStock] update product failed for order:", orderId, upErr);
  }
}

/**
 * Admin order-status change. Replaces the browser-client update the orders
 * screen used to run inline: routing through the service role lets us restore
 * reserved stock server-side when an order first enters a terminal state.
 */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        status: z.enum([
          "pending",
          "processing",
          "shipped",
          "completed",
          "cancelled",
          "refunded",
        ]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireAdmin();

    // Read the pre-update status so we can distinguish a FIRST transition into a
    // terminal (cancelled/refunded) state from a no-op or terminal→terminal move.
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("הזמנה לא נמצאה.");

    const wasTerminal = (TERMINAL_STATUSES as readonly string[]).includes(order.status);

    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.order_id);
    if (uErr) {
      console.error("[updateOrderStatus]:", uErr);
      throw new Error("שגיאה בעדכון הסטטוס.");
    }

    // Data-integrity: return reserved stock the first time an order enters a
    // terminal state. Additive and wrapped — a restore failure must never fail
    // the status update. restoreOrderStock is itself idempotent, so this is
    // belt-and-braces against ever restoring twice.
    if (!wasTerminal && (TERMINAL_STATUSES as readonly string[]).includes(data.status)) {
      try {
        await restoreOrderStock(data.order_id);
      } catch (e) {
        console.error(
          "[updateOrderStatus] stock restore failed (status still updated) for order:",
          data.order_id,
          e,
        );
      }
    }

    return { ok: true };
  });
