// The sales funnel on the admin dashboard: of the people who started checkout,
// how many placed an order, and how many of those paid — and, for the ones who
// did not pay, WHY, in CardCom's own words.
//
// It exists because the answer was surprising. The obvious reading of "3 of 6
// orders failed" is "cards are being declined". CardCom's response codes said
// otherwise: two of the three had opened the payment page and simply left
// (5119 "not completed", 5118 "24H time out"); only one was a real decline.
// Those are different problems with different fixes — a payment reminder for
// the first, a phone call for the second — and the dashboard now says which.
//
// PEOPLE, NOT ROWS. Every step counts distinct email addresses. The cart table
// can hold four rows for one shopper typing their address (they were written
// seconds apart), and a customer who failed once and paid on the retry is one
// paying customer, not a failure plus a sale.

import { recoveredBy, type RecoveryOrder } from "@/lib/crm-digest";

const DAY = 24 * 60 * 60 * 1000;

/** CardCom codes that mean the shopper never finished the payment page, as
 *  opposed to the card company saying no. */
const LEFT_PAGE_CODES = new Set(["5118", "5119"]);

export type FunnelOrder = RecoveryOrder & {
  total: number | string | null;
  cardcom_response_code?: string | number | null;
};

export type FunnelCart = { email: string | null; created_at: string };

export type Funnel = {
  windowDays: number;
  started: number;
  placed: number;
  paid: number;
  /** Unpaid orders nobody later paid for, split by what CardCom said. */
  leftPaymentPage: { count: number; value: number };
  declined: { count: number; value: number };
};

const key = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

export function buildFunnel(
  carts: FunnelCart[],
  orders: FunnelOrder[],
  now: number,
  windowDays = 90,
): Funnel {
  const since = now - windowDays * DAY;
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= since && t <= now;
  };

  const recentOrders = orders.filter((o) => inWindow(o.created_at));
  const placed = new Set(recentOrders.map((o) => key(o.customer_email)).filter(Boolean));
  const paid = new Set(
    recentOrders
      .filter((o) => o.payment_status === "paid" || o.payment_status === "refunded")
      .map((o) => key(o.customer_email))
      .filter(Boolean),
  );
  // Anyone who placed an order necessarily started checkout, including those
  // from before the cart snapshot existed — so "started" is the union.
  const started = new Set([
    ...carts.filter((c) => inWindow(c.created_at)).map((c) => key(c.email)),
    ...placed,
  ]);
  started.delete("");

  const recovered = recoveredBy(orders);
  const leftPaymentPage = { count: 0, value: 0 };
  const declined = { count: 0, value: 0 };
  for (const o of recentOrders) {
    if (!["unpaid", "failed"].includes(o.payment_status)) continue;
    if (["cancelled", "refunded"].includes(String(o.status ?? ""))) continue;
    if (recovered(o)) continue;
    const code = String(o.cardcom_response_code ?? "").trim();
    const bucket =
      o.payment_status === "unpaid" || !code || LEFT_PAGE_CODES.has(code)
        ? leftPaymentPage
        : declined;
    bucket.count += 1;
    bucket.value += Number(o.total) || 0;
  }

  return {
    windowDays,
    started: started.size,
    placed: placed.size,
    paid: paid.size,
    leftPaymentPage,
    declined,
  };
}

/** Whole-percent share, "—" when there is nothing to divide by. */
export function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}
