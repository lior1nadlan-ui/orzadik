// Which of the owner's Telegram alerts did not arrive for an order, if any.
// sendOrderTelegramAlert stamps telegram_{created,paid}_alert_sent_at on a
// successful send (src/lib/telegram.server.ts); this decides when a missing
// stamp means a missed alert worth a warning in /admin/orders.

/** The stamps started on this date. Older orders were never stamped, so a NULL
 *  there says nothing — they must not all light up as "not sent". */
export const TELEGRAM_LATCH_SINCE = "2026-10-03T00:00:00+03:00";

/** The alert goes out a moment after the order is created or paid; give it
 *  this long before calling it missing. */
const GRACE_MS = 3 * 60_000;

export const PHONE_ORDER_TAG = "[הזמנה טלפונית מה-CRM]";

export type LatchOrder = {
  created_at: string;
  paid_at?: string | null;
  status: string;
  payment_status: string;
  payment_provider?: string | null;
  notes?: string | null;
  telegram_created_alert_sent_at?: string | null;
  telegram_paid_alert_sent_at?: string | null;
};

export function missingTelegramAlert(o: LatchOrder, now = Date.now()): "created" | "paid" | null {
  if (Date.parse(o.created_at) < Date.parse(TELEGRAM_LATCH_SINCE)) return null;
  if (o.status === "cancelled" || o.status === "refunded") return null;
  if (o.payment_status === "paid") {
    // Marked paid at the counter — no payment webhook, so no alert was due.
    if (o.payment_provider === "offline") return null;
    const at = Date.parse(o.paid_at ?? o.created_at);
    if (now - at < GRACE_MS) return null;
    return o.telegram_paid_alert_sent_at ? null : "paid";
  }
  // Opened by the owner from the CRM: nobody needs to be told about it.
  if ((o.notes ?? "").includes(PHONE_ORDER_TAG)) return null;
  if (now - Date.parse(o.created_at) < GRACE_MS) return null;
  return o.telegram_created_alert_sent_at ? null : "created";
}
