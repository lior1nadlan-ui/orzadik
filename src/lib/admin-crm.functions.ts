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
import { sendOrderShippedEmail, sendOrderConfirmationEmails } from "@/lib/order-emails.server";
import { ORDER_ITEM_PRODUCT_JOIN } from "@/lib/order-item-photo";
import { isOpenFailedPayment, recoveredBy } from "@/lib/crm-digest";
import {
  actionKey,
  actionVisibility,
  daysOverdue,
  dueFollowUps,
  endOfIsraelDay,
  type ActionVisibility,
} from "@/lib/crm-tasks";

const PAGE_SIZE = 25;
// PostgREST caps unbounded selects at 1000 — the same silent cap that hid 79%
// of the catalog from the sitemap. Every full-table walk here pages explicitly.
const DB_PAGE = 1000;

/** Escape PostgREST .or()/.ilike reserved characters in user search input. */
function sanitizeTerm(raw: string): string {
  return raw
    .replace(/[,()%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    const key = String(o.customer_email ?? "")
      .trim()
      .toLowerCase();
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
// should take on REAL orders and carts, plus the reminders they set themselves.
// It derives from live order / abandoned-cart state and writes nothing.
//
// The owner's decisions about a row — handled for today, snoozed three days,
// not relevant — live in crm_action_state, keyed "<type>:<entity id>" (see
// crm-tasks.ts). Until 2026-09-25 they lived in the browser's localStorage, so
// the phone and the computer disagreed and a dismissal lasted one day. Every
// row comes back with its state; the client shows the open ones and lists the
// set-aside ones underneath with a "restore".
//
// Each order maps to AT MOST ONE action, so it never appears twice: a paid
// order is a "thank you" for its first day, then becomes "ready to ship"; an
// unpaid one is "stuck"; a shipped one eventually becomes a review nudge.

type ActionType =
  | "follow_up"
  | "thank_you"
  | "ready_to_ship"
  | "stuck_unpaid"
  | "recover_cart"
  | "review_request";

// Priority ordering (higher = surfaces first). A reminder the owner wrote
// themselves outranks everything the system infers; then delight a fresh
// paying customer, chase money left on the table, fulfilment, recovery,
// reviews.
const ACTION_PRIORITY: Record<ActionType, number> = {
  follow_up: 110,
  thank_you: 100,
  stuck_unpaid: 90,
  ready_to_ship: 80,
  recover_cart: 60,
  review_request: 40,
};

// Sanity cap on OPEN rows — never flood the UI.
const QUEUE_CAP = 40;
// Set-aside rows shown under the queue for "restore".
const HIDDEN_CAP = 30;

type ActionRow = {
  /** Stable, date-free: "<type>:<entity id>". For a follow-up, the entity is
   *  the crm_followups row. Also the key its decision is stored under. */
  id: string;
  type: ActionType;
  priority: number;
  state: ActionVisibility;
  /** When a snoozed row comes back. */
  snoozedUntil?: string;
  orderNumber?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  context: string;
  createdAt: string;
};

export const getActionQueue = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  const now = Date.now();
  const [orders, statesRes, followUpsRes] = await Promise.all([
    fetchAllOrders(
      "id, order_number, customer_name, customer_email, customer_phone, status, payment_status, created_at, paid_at, shipped_at, review_request_sent_at",
    ),
    supabaseAdmin
      .from("crm_action_state")
      .select("action_key, snoozed_until, dismissed_at")
      .limit(2000),
    supabaseAdmin
      .from("crm_followups")
      .select("id, customer_email, title, due_at, done_at, created_at")
      .is("done_at", null)
      .lt("due_at", new Date(endOfIsraelDay(now)).toISOString())
      .order("due_at", { ascending: true })
      .limit(100),
  ]);
  // Decisions and reminders are additions to the queue, not its core: if
  // either read fails, the queue still renders, everything shown as open.
  if (statesRes.error) console.error("[getActionQueue] action state:", statesRes.error);
  if (followUpsRes.error) console.error("[getActionQueue] follow-ups:", followUpsRes.error);
  const stateByKey = new Map((statesRes.data ?? []).map((r) => [r.action_key, r]));

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const rows: ActionRow[] = [];
  const paidAt = (o: any) => new Date(o.paid_at ?? o.created_at).getTime();
  const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / DAY);
  const recovered = recoveredBy(orders);
  const withState = (row: Omit<ActionRow, "state" | "snoozedUntil">): ActionRow => {
    const st = stateByKey.get(row.id);
    const state = actionVisibility(st, now);
    return {
      ...row,
      state,
      ...(state === "snoozed" && st?.snoozed_until ? { snoozedUntil: st.snoozed_until } : {}),
    };
  };

  // The owner's own reminders. Name and phone come from the customer's newest
  // order when there is one (orders arrive newest-first).
  const contactByEmail = new Map<string, { name: string; phone?: string }>();
  for (const o of orders) {
    const key = String(o.customer_email ?? "")
      .trim()
      .toLowerCase();
    if (key && !contactByEmail.has(key)) {
      contactByEmail.set(key, {
        name: o.customer_name || "",
        phone: o.customer_phone || undefined,
      });
    }
  }
  for (const f of dueFollowUps(followUpsRes.data ?? [], now)) {
    const who = contactByEmail.get(f.customer_email);
    const late = daysOverdue(f.due_at, now);
    rows.push(
      withState({
        id: actionKey("follow_up", f.id),
        type: "follow_up",
        priority: ACTION_PRIORITY.follow_up,
        customerName: who?.name || f.customer_email,
        customerEmail: f.customer_email,
        customerPhone: who?.phone,
        context:
          late > 0 ? `${f.title} · באיחור ${late === 1 ? "של יום" : `${late} ימים`}` : f.title,
        createdAt: f.due_at,
      }),
    );
  }

  for (const o of orders) {
    // Never nudge on a cancelled/refunded order.
    if (["cancelled", "refunded"].includes(o.status)) continue;

    const base = {
      orderNumber: o.order_number || undefined,
      customerName: o.customer_name || "לקוח",
      customerEmail: o.customer_email || undefined,
      customerPhone: o.customer_phone || undefined,
    };
    const rowFor = (type: ActionType, createdAt: string, context: string): ActionRow =>
      withState({
        ...base,
        id: actionKey(type, o.id),
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
        rows.push(rowFor("ready_to_ship", sinceIso, `שולם ומחכה לאריזה ומשלוח — כבר ${d} ימים 📦`));
      }
      continue;
    }

    // Unpaid / failed and still worth a call — the SAME rule the morning
    // briefing applies (crm-digest.ts): past the grace hour, within 30 days,
    // and not already fixed by the same customer paying again. Before this, a
    // two-month-old declined card came back every morning forever.
    if (isOpenFailedPayment(o, now, recovered)) {
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
        ...new Set(
          carts
            .map((c) =>
              String(c.email ?? "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
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
            const key = String(r.customer_email ?? "")
              .trim()
              .toLowerCase();
            if (key && r.customer_phone && !phoneByEmail.has(key)) {
              phoneByEmail.set(key, r.customer_phone);
            }
          }
        }
      }
      for (const c of carts) {
        const key = String(c.email ?? "")
          .trim()
          .toLowerCase();
        rows.push(
          withState({
            id: actionKey("recover_cart", c.id),
            type: "recover_cart",
            priority: ACTION_PRIORITY.recover_cart,
            customerName: c.name || "לקוח",
            customerEmail: c.email || undefined,
            customerPhone: phoneByEmail.get(key) || undefined,
            context: "עגלה נטושה עם פריטים — הזמנה בהמתנה, שווה תזכורת עדינה 🛒",
            createdAt: c.created_at,
          }),
        );
      }
    }
  } catch (e) {
    console.error("[getActionQueue] abandoned carts failed:", e);
  }

  // Order by priority; within a tier the longest-waiting action floats up.
  rows.sort(
    (a, b) =>
      b.priority - a.priority || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const open = rows.filter((r) => r.state === "open").slice(0, QUEUE_CAP);
  const setAside = rows.filter((r) => r.state !== "open").slice(0, HIDDEN_CAP);
  return [...open, ...setAside];
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
    // The product join is what lets the order drawer show a thumbnail per line.
    // The owner could not tell a ₪197 challah cover from a ₪243 one by name
    // alone on a thirteen-item order; ORDER_ITEM_PRODUCT_JOIN is shared with the
    // confirmation email so the two surfaces cannot show different pictures.
    let query = supabaseAdmin
      .from("orders")
      .select(`*, order_items(*, ${ORDER_ITEM_PRODUCT_JOIN})`, { count: "exact" });
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
      let query = supabaseAdmin.from("orders").select(
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
      "מספר הזמנה",
      "תאריך",
      "לקוח",
      "טלפון",
      "אימייל",
      "כתובת",
      "עיר",
      "ביניים",
      "משלוח",
      'סה"כ',
      "סטטוס",
      "תשלום",
      "מעקב",
      "חברת שילוח",
      "פריטים",
      "הערות",
      "מתנה",
      "הקדשה",
      "עטיפה",
    ];
    const lines = rows.map((o) =>
      [
        o.order_number,
        new Date(o.created_at).toLocaleString("he-IL"),
        o.customer_name,
        o.customer_phone,
        o.customer_email,
        o.customer_address,
        o.customer_city ?? "",
        o.subtotal,
        o.shipping,
        o.total,
        o.status,
        o.payment_status,
        o.tracking_number ?? "",
        o.shipping_carrier ?? "",
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
      ]
        .map(csvEsc)
        .join(","),
    );
    // BOM so Excel opens Hebrew UTF-8 correctly.
    return { csv: "﻿" + [header.join(","), ...lines].join("\r\n"), count: rows.length };
  });

// ---- Customers -------------------------------------------------------------

/**
 * A customer is DORMANT once this many days have passed since their last order.
 *
 * 120 days is a deliberate choice for THIS shop, not a CRM convention. The
 * catalogue is tashmishei kedusha and gift-ware: a tallit or a groom set is a
 * once-in-years purchase, so an e-commerce default of 30 or 60 days would mark
 * a perfectly happy customer as lapsed and turn the badge into noise nobody
 * reads. 120 days is long enough to clear the chagim gap (Pesach→Rosh Hashana
 * is ~150 days, so a customer who buys only at both chagim still shows dormant
 * between them, which is exactly when a "we're here" message is welcome).
 *
 * Change this number if the shop's rhythm turns out different — it is one
 * constant precisely so it can be argued with, and the tests pin the boundary.
 */
export const DORMANT_AFTER_DAYS = 120;

/**
 * Customer segments, derived rather than stored — every one is a fact already
 * present in the data, only named.
 *
 *   contact  no order at all: a club member, a newsletter subscriber or someone
 *            who left a cart. Until 2026-09-24 these people were not in the CRM
 *            at all — the list was built from orders only, so nine registered
 *            members and four cart-only shoppers were invisible to the owner.
 *   lead     ordered but never paid. Not a customer yet; usually an abandoned
 *            bank-transfer or a failed card. Worth a call more than anyone else
 *            on this list.
 *   new      exactly one paid order.
 *   repeat   two or more paid orders.
 *
 * DELIBERATELY ABSENT: a "VIP" tier. Every threshold I could pick (₪2,000?
 * top 10%?) would be invented rather than measured, and a badge that says VIP
 * on the strength of a number nobody chose is worse than no badge. Sort by
 * "סך קניות" already answers "who spends most" honestly. If the owner names a
 * number that means something to them, it belongs here as another segment.
 */
export type CustomerSegment = "contact" | "lead" | "new" | "repeat";

/** Segment labels, shared by the customers screen and the CSV export so the
 * spreadsheet and the table never disagree about what a row is called. */
export const SEGMENT_HE: Record<CustomerSegment, string> = {
  contact: "טרם הזמין",
  lead: "לא שילם",
  new: "לקוח חדש",
  repeat: "לקוח חוזר",
};

/**
 * What the customers list can be filtered to. Two filters cut ACROSS the
 * segments rather than being one of them:
 *   dormant  anyone whose last order is DORMANT_AFTER_DAYS old.
 *   optin    anyone who agreed to marketing (the profile consent box or an
 *            active newsletter subscription) — the only people a campaign may
 *            legally go to under Israel's anti-spam law (§30A), so "who can I
 *            write to" deserves a one-click answer.
 */
export type CustomerFilter = "all" | CustomerSegment | "dormant" | "optin";

/** Days between `iso` and `now`, floored. Negative clock skew clamps to 0. */
export function daysSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** The segment for one aggregated customer row. Pure — exported for tests.
 * `orders` is optional so a caller that only knows the paid count still gets
 * the paid-based answer; only an explicit 0 makes someone a "contact". */
export function customerSegment(c: { paidOrders: number; orders?: number }): CustomerSegment {
  if (c.orders === 0) return "contact";
  if (c.paidOrders === 0) return "lead";
  return c.paidOrders === 1 ? "new" : "repeat";
}

/** The filter predicate, in ONE place: the list, the counts and the CSV export
 * all route through it, so a row can never be counted under a heading it would
 * not appear under when clicked. */
export function matchesSegment(
  c: { segment: CustomerSegment; dormant: boolean; marketingConsent?: boolean },
  segment: CustomerFilter,
): boolean {
  if (segment === "all") return true;
  if (segment === "dormant") return c.dormant;
  if (segment === "optin") return !!c.marketingConsent;
  return c.segment === segment;
}

/** How many customers sit under each heading, for the chips above the table.
 * Counted AFTER the search term is applied, so the numbers describe the list
 * being looked at rather than the whole database. */
export function segmentCounts(
  rows: { segment: CustomerSegment; dormant: boolean; marketingConsent?: boolean }[],
): Record<CustomerFilter, number> {
  const count = (f: CustomerFilter) => rows.filter((c) => matchesSegment(c, f)).length;
  return {
    all: rows.length,
    contact: count("contact"),
    lead: count("lead"),
    new: count("new"),
    repeat: count("repeat"),
    dormant: count("dormant"),
    optin: count("optin"),
  };
}

const CustomersSchema = z.object({
  q: z.string().max(120).optional(),
  sort: z.enum(["ltv", "recent", "orders"]).default("ltv"),
  page: z.number().int().min(0).default(0),
  segment: z.enum(["all", "contact", "lead", "new", "repeat", "dormant", "optin"]).default("all"),
});

/** Column list every customer-aggregation caller fetches from orders. */
const CUSTOMER_ORDER_COLUMNS =
  "customer_email, customer_name, customer_phone, total, payment_status, created_at, contact_consent";

/**
 * The people who are known to the shop WITHOUT an order. Each source adds what
 * only it knows:
 *   profiles     club membership, a phone, and the marketing-consent box.
 *   subscribers  an active newsletter subscription (itself a marketing opt-in).
 *   carts        what they were about to buy, and for how much.
 */
export type ContactSources = {
  profiles?: {
    email: string | null;
    full_name: string | null;
    phone: string | null;
    is_member: boolean | null;
    member_since: string | null;
    marketing_consent: boolean | null;
    created_at: string | null;
  }[];
  subscribers?: {
    email: string | null;
    name: string | null;
    unsubscribed_at: string | null;
    created_at: string | null;
  }[];
  carts?: {
    email: string | null;
    name: string | null;
    subtotal: number | string | null;
    converted_order_id: string | null;
    unsubscribed: boolean | null;
    created_at: string | null;
    updated_at?: string | null;
  }[];
  /** Open reminders (crm_followups) — the row shows when the next one is due. */
  followUps?: { customer_email: string; due_at: string }[];
};

const emailKey = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

/** Fold the raw orders rows — and every non-order source of a contact — into
 * one row per email, then apply the same term-match, segment filter and sort
 * the customers screen shows.
 *
 * Exported for tests: it is the only place the numbers the owner acts on are
 * computed, and it is pure, so it is worth pinning directly rather than through
 * a server function that needs a database.
 *
 * PRECEDENCE: orders are folded first and win on name and phone — a checkout
 * form is the freshest, most deliberate place a person typed them. The other
 * sources only fill what is still empty. */
export function aggregateCustomers(
  orders: any[],
  q: string | undefined,
  sort: "ltv" | "recent" | "orders",
  segment: CustomerFilter = "all",
  now: number = Date.now(),
  sources: ContactSources = {},
) {
  const byEmail = new Map<string, any>();
  const rowFor = (raw: unknown) => {
    const key = emailKey(raw);
    if (!key) return null;
    let c = byEmail.get(key);
    if (!c) {
      c = {
        email: key,
        name: null as string | null,
        phone: null as string | null,
        orders: 0,
        paidOrders: 0,
        ltv: 0,
        lastOrderAt: null as string | null,
        contactConsent: false,
        isMember: false,
        memberSince: null as string | null,
        newsletter: false,
        marketingConsent: false,
        openCarts: 0,
        openCartValue: 0,
        nextFollowUpAt: null as string | null,
        firstSeenAt: null as string | null,
        lastActivityAt: null as string | null,
      };
      byEmail.set(key, c);
    }
    return c;
  };
  // First and last time this person did anything the shop can see.
  const touch = (c: any, iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return;
    if (!c.firstSeenAt || t < Date.parse(c.firstSeenAt)) c.firstSeenAt = iso;
    if (!c.lastActivityAt || t > Date.parse(c.lastActivityAt)) c.lastActivityAt = iso;
  };

  for (const o of orders) {
    const c = rowFor(o.customer_email);
    if (!c) continue;
    // orders arrive newest-first, so the first row per email carries the
    // freshest name/phone/last-order values — keep them.
    if (c.orders === 0) {
      c.name = o.customer_name;
      c.phone = o.customer_phone;
      c.lastOrderAt = o.created_at;
    }
    c.orders += 1;
    if (o.payment_status === "paid" || o.payment_status === "refunded") {
      c.paidOrders += 1;
      c.ltv += Number(o.total);
    }
    if (o.contact_consent) c.contactConsent = true;
    touch(c, o.created_at);
  }

  for (const p of sources.profiles ?? []) {
    const c = rowFor(p.email);
    if (!c) continue;
    c.name ||= p.full_name;
    c.phone ||= p.phone;
    if (p.is_member) {
      c.isMember = true;
      c.memberSince = p.member_since ?? p.created_at;
    }
    if (p.marketing_consent) c.marketingConsent = true;
    touch(c, p.created_at);
  }

  for (const s of sources.subscribers ?? []) {
    const c = rowFor(s.email);
    if (!c) continue;
    c.name ||= s.name;
    // Subscribing IS the opt-in; an unsubscribe withdraws it.
    if (!s.unsubscribed_at) {
      c.newsletter = true;
      c.marketingConsent = true;
    }
    touch(c, s.created_at);
  }

  for (const k of sources.carts ?? []) {
    const c = rowFor(k.email);
    if (!c) continue;
    c.name ||= k.name;
    if (!k.converted_order_id && !k.unsubscribed && Number(k.subtotal) > 0) {
      c.openCarts += 1;
      c.openCartValue += Number(k.subtotal);
    }
    touch(c, k.updated_at ?? k.created_at);
  }

  // A reminder only annotates someone already on the list — it never creates
  // a row on its own (it was written from a customer card in the first place).
  for (const f of sources.followUps ?? []) {
    const c = byEmail.get(emailKey(f.customer_email));
    if (!c) continue;
    if (!c.nextFollowUpAt || Date.parse(f.due_at) < Date.parse(c.nextFollowUpAt)) {
      c.nextFollowUpAt = f.due_at;
    }
  }

  let rows = [...byEmail.values()].map((c) => {
    const days = daysSince(c.lastOrderAt, now);
    return {
      ...c,
      daysSinceLastOrder: days,
      daysSinceActivity: daysSince(c.lastActivityAt, now),
      segment: customerSegment(c),
      // A lead has no paid order, so "gone quiet" is measured from the attempt
      // that never completed — which is the one worth chasing soonest. Someone
      // who never ordered cannot have gone quiet on an order.
      dormant: days !== null && days >= DORMANT_AFTER_DAYS,
    };
  });

  const term = sanitizeTerm(q ?? "").toLowerCase();
  if (term) {
    rows = rows.filter(
      (c) =>
        c.email.includes(term) ||
        String(c.name ?? "")
          .toLowerCase()
          .includes(term) ||
        String(c.phone ?? "").includes(term),
    );
  }
  if (segment !== "all") {
    rows = rows.filter((c) => matchesSegment(c, segment));
  }
  // Latest activity breaks every tie, so the ₪0 contacts under "סך קניות"
  // come out freshest-first instead of in Map order.
  const at = (iso: string | null) => (iso ? Date.parse(iso) : 0);
  const byActivity = (a: any, b: any) => at(b.lastActivityAt) - at(a.lastActivityAt);
  rows.sort(
    sort === "recent"
      ? byActivity
      : sort === "orders"
        ? (a, b) => b.orders - a.orders || byActivity(a, b)
        : (a, b) => b.ltv - a.ltv || byActivity(a, b),
  );
  return rows;
}

/** Walk a table past PostgREST's silent 1000-row cap. */
async function pageAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await fetchPage(from, from + DB_PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < DB_PAGE) return out;
  }
}

/**
 * Everyone known to the shop without an order — see ContactSources.
 *
 * The shop's own admin accounts are left out: the owner signing up to test the
 * checkout is not a customer, and a "טרם הזמין" row with their own name would
 * be the first thing they saw.
 *
 * NEVER FATAL. If any of these reads fails, the list degrades to the order
 * customers it always showed, with a log line — a broken newsletter table must
 * not blank the CRM.
 */
async function fetchContactSources(): Promise<ContactSources> {
  try {
    const [profiles, subscribers, carts, admins, followUps] = await Promise.all([
      pageAll((a, b) =>
        supabaseAdmin
          .from("profiles")
          .select(
            "id, email, full_name, phone, is_member, member_since, marketing_consent, created_at",
          )
          .order("created_at")
          .range(a, b),
      ),
      pageAll((a, b) =>
        supabaseAdmin
          .from("newsletter_subscribers")
          .select("email, name, unsubscribed_at, created_at")
          .order("created_at")
          .range(a, b),
      ),
      pageAll((a, b) =>
        supabaseAdmin
          .from("abandoned_carts")
          .select("email, name, subtotal, converted_order_id, unsubscribed, created_at, updated_at")
          .order("created_at")
          .range(a, b),
      ),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin
        .from("crm_followups")
        .select("customer_email, due_at")
        .is("done_at", null)
        .limit(1000),
    ]);
    if (followUps.error) console.error("[customers] follow-ups:", followUps.error);
    if (admins.error) throw admins.error;
    const adminIds = new Set((admins.data ?? []).map((r) => r.user_id));
    const adminEmails = new Set(
      profiles.filter((p) => adminIds.has(p.id)).map((p) => emailKey(p.email)),
    );
    const notAdmin = (e: unknown) => !adminEmails.has(emailKey(e));
    return {
      profiles: profiles.filter((p) => !adminIds.has(p.id)),
      subscribers: subscribers.filter((s) => notAdmin(s.email)),
      carts: carts.filter((c) => notAdmin(c.email)),
      followUps: followUps.data ?? [],
    };
  } catch (e) {
    console.error("[customers] contact sources failed — listing order customers only:", e);
    return {};
  }
}

async function loadCustomerUniverse() {
  const [orders, sources] = await Promise.all([
    fetchAllOrders(CUSTOMER_ORDER_COLUMNS),
    fetchContactSources(),
  ]);
  return { orders, sources };
}

export const listCustomers = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CustomersSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    const { orders, sources } = await loadCustomerUniverse();
    // Aggregate once with the search applied but the segment left open: the
    // chips need to say how many sit under EVERY heading, including the ones
    // currently filtered out. Filtering afterwards costs one array pass and
    // saves a second full walk of the orders table.
    const matched = aggregateCustomers(orders, f.q, f.sort, "all", Date.now(), sources);
    const counts = segmentCounts(matched);
    const rows = matched.filter((c) => matchesSegment(c, f.segment));
    const total = rows.length;
    const from = f.page * PAGE_SIZE;
    return { rows: rows.slice(from, from + PAGE_SIZE), total, pageSize: PAGE_SIZE, counts };
  });

export const exportCustomersCsv = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CustomersSchema.parse(i))
  .handler(async ({ data: f }) => {
    await requireAdmin();
    const { orders, sources } = await loadCustomerUniverse();
    const rows = aggregateCustomers(orders, f.q, f.sort, f.segment, Date.now(), sources);
    const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("he-IL") : "");

    const header = [
      "שם",
      "אימייל",
      "טלפון",
      "הזמנות",
      "הזמנות ששולמו",
      "סך קניות",
      "הזמנה אחרונה",
      "ימים מההזמנה האחרונה",
      "סוג",
      "רדום",
      "אישר יצירת קשר",
      "חבר מועדון",
      "מאשר דיוור",
      "מנוי ניוזלטר",
      "עגלה פתוחה",
      "פעילות אחרונה",
      "לקוח מאז",
      "תזכורת פתוחה",
    ];
    const yes = (b: boolean) => (b ? "כן" : "לא");
    const lines = rows.map((c) =>
      [
        c.name,
        c.email,
        c.phone,
        c.orders,
        c.paidOrders,
        c.ltv,
        date(c.lastOrderAt),
        c.daysSinceLastOrder ?? "",
        SEGMENT_HE[c.segment as CustomerSegment],
        yes(c.dormant),
        yes(c.contactConsent),
        yes(c.isMember),
        yes(c.marketingConsent),
        yes(c.newsletter),
        c.openCartValue || "",
        date(c.lastActivityAt),
        date(c.firstSeenAt),
        date(c.nextFollowUpAt),
      ]
        .map(csvEsc)
        .join(","),
    );
    // BOM so Excel opens Hebrew UTF-8 correctly.
    return { csv: "﻿" + [header.join(","), ...lines].join("\r\n"), count: rows.length };
  });

/**
 * Everything the shop knows about one person, for the customer card: orders,
 * internal notes, and — from the other sources — club membership, marketing
 * consent, newsletter status and the carts they left.
 *
 * Only orders and notes are fatal. The rest is context: a failed read there
 * leaves its section empty rather than failing the card the owner opened to
 * write a note on.
 */
export const getCustomerDetail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const email = data.email.trim().toLowerCase();
    const [
      { data: orders, error: oErr },
      { data: notes, error: nErr },
      profile,
      subscriber,
      carts,
      followUps,
      campaigns,
    ] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select(
          "id, order_number, total, status, payment_status, created_at, paid_at, shipped_at, shipping_carrier, tracking_number, review_request_sent_at, order_items(product_name, quantity, line_total)",
        )
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("crm_customer_notes")
        .select("id, note, created_at")
        .eq("customer_email", email)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("profiles")
        .select(
          "full_name, phone, is_member, member_since, marketing_consent, marketing_consent_at, marketing_consent_source, created_at",
        )
        .ilike("email", email)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("newsletter_subscribers")
        .select("source, consented_at, unsubscribed_at, created_at")
        .ilike("email", email)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("abandoned_carts")
        .select(
          "id, items, subtotal, converted_order_id, unsubscribed, reminder_1_sent_at, reminder_2_sent_at, created_at, updated_at",
        )
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("crm_followups")
        .select("title, created_at, due_at, done_at")
        .eq("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("campaign_recipients")
        .select("status, sent_at, campaigns(subject)")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (oErr || nErr) {
      console.error("[getCustomerDetail]:", oErr ?? nErr);
      throw new Error("שגיאה בטעינת פרטי הלקוח.");
    }
    for (const [label, r] of [
      ["profile", profile],
      ["newsletter", subscriber],
      ["carts", carts],
      ["follow-ups", followUps],
      ["campaigns", campaigns],
    ] as const) {
      if (r.error) console.error(`[getCustomerDetail] ${label}:`, r.error);
    }

    // Reviews hang off this customer's orders — there is no email on them.
    const orderIds = (orders ?? []).map((o) => o.id);
    let reviews: { rating: number; created_at: string }[] = [];
    if (orderIds.length > 0) {
      const r = await supabaseAdmin
        .from("reviews")
        .select("rating, created_at")
        .in("order_id", orderIds)
        .limit(50);
      if (r.error) console.error("[getCustomerDetail] reviews:", r.error);
      reviews = r.data ?? [];
    }
    return {
      orders: orders ?? [],
      notes: notes ?? [],
      profile: profile.data ?? null,
      newsletter: subscriber.data ?? null,
      carts: carts.data ?? [],
      followUps: followUps.data ?? [],
      reviews,
      campaigns: (campaigns.data ?? []).map((c) => ({
        status: c.status,
        sent_at: c.sent_at,
        subject: (c.campaigns as { subject: string | null } | null)?.subject ?? null,
      })),
    };
  });

export const addCustomerNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().email(),
        note: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .transform((v) => v.replace(/<[^>]*>/g, "")),
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
          const key = String(o.customer_email ?? "")
            .trim()
            .toLowerCase();
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
 * Everything the packing slip prints for one order — the sheet the owner packs
 * from. No prices are fetched at all: a slip that travels in a gift parcel
 * must not be able to show what the gift cost, and one that cannot load a
 * price cannot print one by mistake.
 */
export const getPackingSlip = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, created_at, paid_at, payment_status, status, customer_name, customer_phone, customer_email, customer_address, customer_city, notes, is_gift, gift_note, gift_wrap, shipping_carrier, tracking_number, cardcom_document_number, order_items(id, product_name, product_sku, quantity, variant_label, custom_text, products(slug, thumbnail_url))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      console.error("[getPackingSlip]:", error);
      throw new Error("שגיאה בטעינת ההזמנה.");
    }
    if (!order) throw new Error("ההזמנה לא נמצאה.");
    return order;
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
        'שליחת האישור נכשלה. בדקו שכתובת הדוא"ל של הלקוח תקינה ושהגדרות הדוא"ל של האתר פעילות.',
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
    if (upErr)
      console.error("[restoreOrderStock] update product failed for order:", orderId, upErr);
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
        status: z.enum(["pending", "processing", "shipped", "completed", "cancelled", "refunded"]),
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
