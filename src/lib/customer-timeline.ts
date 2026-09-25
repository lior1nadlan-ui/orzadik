// One customer's history as a single, newest-first list of dated events — the
// "ציר זמן" tab of the customer card.
//
// Every fact already exists somewhere: an order's paid_at and shipped_at, a
// cart's reminder stamps, a note, a reminder, the newsletter row, a campaign
// send. Spread over five tabs and three screens, nobody reads them together;
// in one column the story of a customer is obvious at a glance ("left a cart,
// got a reminder, bought two days later, never got the review request").
//
// PURE and client-safe: the card already has the rows (getCustomerDetail), so
// this only arranges them. Pinned by customer-timeline.test.ts.

export type TimelineKind =
  | "order"
  | "paid"
  | "shipped"
  | "review_request"
  | "review"
  | "cart"
  | "cart_reminder"
  | "note"
  | "followup"
  | "followup_done"
  | "member"
  | "consent"
  | "newsletter"
  | "newsletter_off"
  | "campaign";

export type TimelineEvent = {
  at: string;
  kind: TimelineKind;
  text: string;
  /** The order number, when the event belongs to an order — the card links it. */
  orderNumber?: string;
};

export type TimelineInput = {
  orders?: {
    order_number: string | null;
    total: number | string | null;
    payment_status: string;
    status?: string | null;
    created_at: string;
    paid_at?: string | null;
    shipped_at?: string | null;
    shipping_carrier?: string | null;
    tracking_number?: string | null;
    review_request_sent_at?: string | null;
  }[];
  carts?: {
    created_at: string;
    subtotal: number | string | null;
    converted_order_id?: string | null;
    reminder_1_sent_at?: string | null;
    reminder_2_sent_at?: string | null;
  }[];
  notes?: { note: string; created_at: string }[];
  followUps?: { title: string; created_at: string; due_at: string; done_at: string | null }[];
  profile?: {
    created_at?: string | null;
    is_member?: boolean | null;
    member_since?: string | null;
    marketing_consent?: boolean | null;
    marketing_consent_at?: string | null;
  } | null;
  newsletter?: {
    created_at?: string | null;
    consented_at?: string | null;
    unsubscribed_at?: string | null;
  } | null;
  reviews?: { rating: number; created_at: string }[];
  campaigns?: { sent_at: string | null; status: string; subject: string | null }[];
};

const shekels = (v: unknown) => `₪${Math.round(Number(v) || 0).toLocaleString("en-US")}`;
const dateHe = (iso: string) => new Date(iso).toLocaleDateString("he-IL");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildCustomerTimeline(input: TimelineInput, limit = 100): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const push = (
    at: string | null | undefined,
    kind: TimelineKind,
    text: string,
    orderNumber?: string,
  ) => {
    if (!at || !Number.isFinite(Date.parse(at))) return;
    out.push({ at, kind, text, ...(orderNumber ? { orderNumber } : {}) });
  };

  for (const o of input.orders ?? []) {
    const num = o.order_number ?? "";
    const unpaid = o.payment_status === "failed" || o.payment_status === "unpaid";
    push(
      o.created_at,
      "order",
      `הזמנה ${num} · ${shekels(o.total)}${
        o.payment_status === "failed" ? " · התשלום נכשל" : unpaid ? " · לא שולמה" : ""
      }${o.status === "cancelled" ? " · בוטלה" : ""}`,
      num,
    );
    if (o.paid_at && !unpaid) push(o.paid_at, "paid", `שולם ${shekels(o.total)}`, num);
    if (o.shipped_at) {
      const via = o.shipping_carrier ? ` ב${o.shipping_carrier}` : "";
      const track = o.tracking_number ? ` · מעקב ${o.tracking_number}` : "";
      push(o.shipped_at, "shipped", `נשלחה${via}${track}`, num);
    }
    push(o.review_request_sent_at, "review_request", "נשלחה בקשה לחוות דעת", num);
  }

  for (const c of input.carts ?? []) {
    push(
      c.created_at,
      "cart",
      `השאיר/ה עגלה · ${shekels(c.subtotal)}${c.converted_order_id ? " · הפכה להזמנה" : ""}`,
    );
    push(c.reminder_1_sent_at, "cart_reminder", "נשלחה תזכורת על העגלה");
    push(c.reminder_2_sent_at, "cart_reminder", "נשלחה תזכורת שנייה על העגלה");
  }

  for (const n of input.notes ?? []) push(n.created_at, "note", `הערה: ${clip(n.note, 140)}`);

  for (const f of input.followUps ?? []) {
    push(f.created_at, "followup", `נקבעה תזכורת ל-${dateHe(f.due_at)}: ${clip(f.title, 120)}`);
    push(f.done_at, "followup_done", `בוצעה תזכורת: ${clip(f.title, 120)}`);
  }

  const p = input.profile;
  if (p?.is_member) push(p.member_since ?? p.created_at, "member", "הצטרף/ה למועדון");
  if (p?.marketing_consent) push(p.marketing_consent_at, "consent", "אישר/ה קבלת דיוור");

  const nl = input.newsletter;
  if (nl) {
    push(nl.consented_at ?? nl.created_at, "newsletter", "נרשם/ה לניוזלטר");
    push(nl.unsubscribed_at, "newsletter_off", "הוסר/ה מהניוזלטר");
  }

  for (const r of input.reviews ?? []) {
    const stars = Math.max(1, Math.min(5, Math.round(r.rating)));
    push(r.created_at, "review", `כתב/ה חוות דעת · ${"★".repeat(stars)}`);
  }

  // Only a delivered send is part of the customer's history; a queued or
  // failed one never reached them.
  for (const c of input.campaigns ?? []) {
    if (c.status !== "sent") continue;
    push(c.sent_at, "campaign", `קיבל/ה דיוור: ${clip(c.subject ?? "", 100)}`);
  }

  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
