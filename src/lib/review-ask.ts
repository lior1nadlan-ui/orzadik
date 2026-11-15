// When the CRM's action queue asks a customer, in person on WhatsApp, to review
// their order, and what the queue row says. Pure: getActionQueue feeds it the
// order and whether that order already has a review.
//
// Why a personal ask: 8 review-request emails went out by 3.11.2026 and not
// one review came back. A message from the shop's own phone, with the order's
// signed review link in it, is the second channel. It goes to orders that were
// never emailed, and to emailed orders that stayed silent for five days.

const DAY = 24 * 60 * 60 * 1000;

/** Days after delivery (and after the email) before the queue asks. */
export const REVIEW_ASK_AFTER_DAYS = 5;
/** Past this many days since delivery, asking reads as odd; the row drops. */
export const REVIEW_ASK_WINDOW_DAYS = 60;

export type ReviewAskOrder = {
  payment_status: string | null;
  status: string | null;
  shipped_at: string | null;
  review_request_sent_at: string | null;
  review_whatsapp_at?: string | null;
};

const daysBetween = (fromIso: string, now: number) => Math.floor((now - Date.parse(fromIso)) / DAY);

/**
 * The queue row's line for this order, or null when no ask is due: unpaid,
 * not delivered, already reviewed, already asked on WhatsApp, too fresh, too
 * old, or emailed less than five days ago (the email gets its chance first).
 */
export function reviewAskContext(
  o: ReviewAskOrder,
  hasReview: boolean,
  now: number,
): string | null {
  if (hasReview || o.review_whatsapp_at) return null;
  if (o.payment_status !== "paid") return null;
  if (!["shipped", "completed"].includes(String(o.status))) return null;
  if (!o.shipped_at || Number.isNaN(Date.parse(o.shipped_at))) return null;
  const sinceDelivery = now - Date.parse(o.shipped_at);
  if (sinceDelivery < REVIEW_ASK_AFTER_DAYS * DAY) return null;
  if (sinceDelivery > REVIEW_ASK_WINDOW_DAYS * DAY) return null;
  if (o.review_request_sent_at) {
    const sinceEmail = now - Date.parse(o.review_request_sent_at);
    if (Number.isNaN(sinceEmail) || sinceEmail < REVIEW_ASK_AFTER_DAYS * DAY) return null;
    return `קיבלו בקשה במייל לפני ${daysBetween(o.review_request_sent_at, now)} ימים ולא כתבו. הודעה אישית עם קישור לחוות הדעת ⭐`;
  }
  return `נמסרה לפני ${daysBetween(o.shipped_at, now)} ימים. שאלו איך היה ובקשו חוות דעת ⭐`;
}
