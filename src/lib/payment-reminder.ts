// "Your order is waiting for payment" — who gets it, and when. The pure half;
// sending lives in payment-reminder.server.ts.
//
// WHY IT EXISTS. A customer who filled the whole checkout form, reached the
// CardCom page and left (or had a card declined) heard nothing, unless they had
// also ticked the optional marketing box: cart reminders are marketing and need
// it. Of the shop's first three failed payments, two were exactly that — a
// payment page opened and never completed (₪385, ₪1,437).
//
// WHY IT MAY GO OUT. It is a service message about an order the customer placed:
// one email, about that order only, with no offer, no discount and no other
// product. It rides on orders.contact_consent — the REQUIRED checkout consent,
// worded "לצורך טיפול בהזמנה — אישור, תיאום משלוח ובירורים" — the same basis the
// post-delivery review request already uses. It still honours the global
// suppression list: someone who told us to stop hears nothing.
//
// WHEN IT MUST NOT GO OUT. Every rule below is a way the email would be wrong:
//   • money already moved (a captured CardCom transaction on a "failed" order
//     needs a human, and a "pay again" link there invites a double charge);
//   • the customer already fixed it (paid on a later order);
//   • a cart reminder reached them recently (two emails about one basket);
//   • too soon (they may still be on the payment page) or too late (stale).

import { isOpenFailedPayment, type RecoveryOrder } from "@/lib/crm-digest";

const HOUR = 60 * 60 * 1000;

/** Past CardCom's own settle window (webhook + the 15-minute reconcile grace),
 *  and long enough that nobody is still on the payment page. */
export const REMIND_AFTER_MS = 2 * HOUR;
/** After three days the moment has passed; the owner's queue still lists it. */
export const REMIND_WINDOW_MS = 72 * HOUR;

export type ReminderOrder = RecoveryOrder & {
  id: string;
  contact_consent: boolean | null;
  payment_reminder_sent_at: string | null;
  cardcom_tranzaction_id: number | string | null;
};

export type ReminderDecision =
  | "send"
  | "already-sent"
  | "no-consent"
  | "not-open"
  | "too-soon"
  | "too-late"
  | "money-captured"
  | "suppressed"
  | "recent-cart-reminder";

/**
 * Decide for one order. `manual` is the owner pressing the button in the order
 * dialog: it lifts only the timing and the one-per-order rules — the owner has
 * decided this customer should hear from them — never the safety ones.
 */
export function paymentReminderDecision(
  o: ReminderOrder,
  ctx: {
    now: number;
    recovered: (o: RecoveryOrder) => boolean;
    suppressed: Set<string>;
    recentlyCartReminded: Set<string>;
    manual?: boolean;
  },
): ReminderDecision {
  const email = String(o.customer_email ?? "")
    .trim()
    .toLowerCase();
  if (Number(o.cardcom_tranzaction_id) > 0) return "money-captured";
  if (!["unpaid", "failed"].includes(o.payment_status)) return "not-open";
  if (["cancelled", "refunded"].includes(String(o.status ?? ""))) return "not-open";
  if (!o.contact_consent) return "no-consent";
  if (!email || ctx.suppressed.has(email)) return "suppressed";
  if (ctx.recovered(o)) return "not-open";

  if (!ctx.manual) {
    if (o.payment_reminder_sent_at) return "already-sent";
    const age = ctx.now - Date.parse(o.created_at);
    if (!(age >= REMIND_AFTER_MS)) return "too-soon";
    if (age > REMIND_WINDOW_MS) return "too-late";
    if (ctx.recentlyCartReminded.has(email)) return "recent-cart-reminder";
    // Same open-payment rule as the queue and the briefing, so the three can
    // never disagree about whether this order is still worth chasing.
    if (!isOpenFailedPayment(o, ctx.now, ctx.recovered)) return "not-open";
  }
  return "send";
}
