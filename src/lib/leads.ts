// Leads — everyone who started buying and has not paid, as ONE list.
//
// Two sources, until now on two screens: an abandoned cart (typed an email at
// checkout, never placed the order) and an unpaid/failed order (placed it, the
// card never went through). The owner thinks in people, not rows, so a person
// with both shows once, with the order — the stronger intent — in front.
//
// A lead stops being one when the same person paid afterwards (same email or
// phone, at or after the attempt), when it is cancelled, or when it is older
// than the window. Pure; the rows come from listLeads (admin-crm.functions.ts).

export const LEAD_WINDOW_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type LeadCartRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  items: unknown;
  subtotal: number | string | null;
  converted_order_id: string | null;
  unsubscribed: boolean | null;
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  created_at: string;
};

export type LeadOrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total: number | string | null;
  status: string | null;
  payment_status: string;
  payment_reminder_sent_at: string | null;
  cardcom_description?: string | null;
  created_at: string;
};

export type Lead = {
  /** Lower-cased email — one lead per person. */
  key: string;
  name: string;
  email: string;
  phone: string | null;
  kind: "unpaid_order" | "cart";
  /** ₪ the person was about to spend (order total, else cart subtotal). */
  value: number;
  /** Product names, for "מה רצה". */
  items: string[];
  /** Newest activity across the person's attempts. */
  at: string;
  orderId: string | null;
  orderNumber: string | null;
  /** Why the payment did not go through, when CardCom said. */
  reason: string | null;
  /** Did the customer already get an automatic reminder email? */
  customerReminded: boolean;
  /** Also left a cart (when the lead is an order). */
  alsoCart: boolean;
  /** The abandoned_carts row, when the lead is a cart. */
  cartId: string | null;
  /** The key its "טופל / לא רלוונטי" decision is stored under — the SAME key
   *  the action queue uses, so a decision in either place applies to both. */
  actionKey: string;
};

const lc = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();
const digits = (v: unknown) =>
  String(v ?? "")
    .replace(/\D/g, "")
    .replace(/^972/, "0");
const t = (iso: string) => new Date(iso).getTime();

function cartItemNames(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => String((i as { name?: unknown })?.name ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

const isPaid = (o: LeadOrderRow) => o.payment_status === "paid";
const isClosed = (o: LeadOrderRow) =>
  ["cancelled", "refunded"].includes(String(o.status ?? "")) || o.payment_status === "refunded";

/**
 * Build the lead list. `orders` should cover every order in the window (paid
 * ones included — they are what clears a lead), `itemsByOrder` the product
 * names per unpaid order.
 */
export function buildLeads(
  carts: LeadCartRow[],
  orders: LeadOrderRow[],
  itemsByOrder: Map<string, string[]>,
  now: number,
): Lead[] {
  const since = now - LEAD_WINDOW_DAYS * DAY;

  // When did each email / phone last pay?
  const paidTimesByEmail = new Map<string, number[]>();
  const paidTimesByPhone = new Map<string, number[]>();
  for (const o of orders) {
    if (!isPaid(o)) continue;
    const at = t(o.created_at);
    const e = lc(o.customer_email);
    const p = digits(o.customer_phone);
    if (e) paidTimesByEmail.set(e, [...(paidTimesByEmail.get(e) ?? []), at]);
    if (p.length >= 9) paidTimesByPhone.set(p, [...(paidTimesByPhone.get(p) ?? []), at]);
  }
  const paidAfter = (email: string, phone: string | null, at: number) =>
    (paidTimesByEmail.get(email) ?? []).some((x) => x >= at) ||
    (!!phone &&
      digits(phone).length >= 9 &&
      (paidTimesByPhone.get(digits(phone)) ?? []).some((x) => x >= at));

  const leads = new Map<string, Lead>();

  for (const o of orders) {
    if (isPaid(o) || isClosed(o)) continue;
    if (!["unpaid", "failed"].includes(o.payment_status)) continue;
    const at = t(o.created_at);
    if (at < since) continue;
    const email = lc(o.customer_email);
    if (!email || paidAfter(email, o.customer_phone, at)) continue;
    const prev = leads.get(email);
    if (prev && t(prev.at) >= at) continue; // keep the newest attempt
    leads.set(email, {
      key: email,
      name: (o.customer_name ?? "").trim() || email,
      email,
      phone: o.customer_phone || prev?.phone || null,
      kind: "unpaid_order",
      value: Number(o.total) || 0,
      items: itemsByOrder.get(o.id) ?? [],
      at: o.created_at,
      orderId: o.id,
      orderNumber: o.order_number,
      reason: o.cardcom_description ?? null,
      customerReminded: !!o.payment_reminder_sent_at,
      alsoCart: false,
      cartId: null,
      actionKey: `stuck_unpaid:${o.id}`,
    });
  }

  for (const c of carts) {
    if (c.converted_order_id) continue;
    const at = t(c.created_at);
    if (at < since) continue;
    const email = lc(c.email);
    if (!email || paidAfter(email, c.phone, at)) continue;
    const existing = leads.get(email);
    if (existing) {
      // The person also placed an unpaid order: one row, the order in front.
      existing.alsoCart = true;
      if (!existing.phone && c.phone) existing.phone = c.phone;
      if (t(existing.at) < at && existing.kind === "cart") existing.at = c.created_at;
      continue;
    }
    leads.set(email, {
      key: email,
      name: (c.name ?? "").trim() || email,
      email,
      phone: c.phone || null,
      kind: "cart",
      value: Number(c.subtotal) || 0,
      items: cartItemNames(c.items),
      at: c.created_at,
      orderId: null,
      orderNumber: null,
      reason: null,
      customerReminded: !!(c.reminder_1_sent_at || c.reminder_2_sent_at),
      alsoCart: false,
      cartId: c.id,
      actionKey: `recover_cart:${c.id}`,
    });
  }

  return [...leads.values()].sort((a, b) => t(b.at) - t(a.at));
}
