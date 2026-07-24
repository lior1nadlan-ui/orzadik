// Pre-filled Hebrew WhatsApp deep-links for the CRM action queue.
//
// The admin already opens bare wa.me links (see waLink() in admin.orders.tsx);
// these helpers upgrade that into warm, honest, ready-to-send messages so the
// solo owner can give every order white-glove treatment in one tap.
//
// Pure + SSR-safe: no React, no window/localStorage, no side effects. Every
// helper accepts a loose order/cart-shaped object and reads both the snake_case
// order rows (admin.orders.tsx) and the camelCase action-queue rows
// (getActionQueue) so the same template works from either caller.
//
// Tone rules (deliberate): reference the customer's name and order number,
// stay warm and human, and NEVER use a discount or an urgency/scarcity push.

type Recordish = Record<string, unknown>;

/** First non-empty value among the given keys, as a trimmed string. */
function pick(o: Recordish | null | undefined, ...keys: string[]): string {
  if (!o) return "";
  for (const k of keys) {
    const v = o[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Israeli local number -> wa.me international format. Mirrors waLink() in
 *  admin.orders.tsx: strip non-digits, then 0XXXXXXXXX -> 972XXXXXXXXX. */
function normalizePhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? "972" + digits.slice(1) : digits;
}

/** Generic builder: a wa.me link with a pre-filled message, or null when there
 *  is no usable phone number. Exported for callers that need an ad-hoc message. */
export function waMessage(phone: string | null | undefined, text: string): string | null {
  const intl = normalizePhone(String(phone ?? ""));
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

const SHOP = "אור זרוע לצדיק";

/** "שלום דוד" / "שלום" — greet by name when we have one. */
function greet(name: string): string {
  return name ? `שלום ${name}` : "שלום";
}

/** "(מס׳ 1234) " — order-number clause, or empty when unknown. */
function orderRef(orderNumber: string): string {
  return orderNumber ? ` (מס׳ ${orderNumber})` : "";
}

/** Brand-new paid order: acknowledge it landed and thank them personally. */
export function waThankYou(o: Recordish): string | null {
  const name = pick(o, "customerName", "customer_name", "name");
  const orderNumber = pick(o, "orderNumber", "order_number");
  const text =
    `${greet(name)}! 🙏\n` +
    `תודה רבה על ההזמנה שלך${orderRef(orderNumber)} בחנות "${SHOP}". ` +
    `שמחנו מאוד לקבל אותה ואנחנו כבר מכינים אותה עבורך באהבה. ` +
    `נעדכן אותך ברגע שהיא יוצאת לדרך — ואם יש בקשה מיוחדת, פשוט השיבו כאן. 💛`;
  return waMessage(pick(o, "customerPhone", "customer_phone", "phone"), text);
}

/** Order shipped: reassure it's on the way, with tracking if we have it. */
export function waShipped(o: Recordish, tracking?: string): string | null {
  const name = pick(o, "customerName", "customer_name", "name");
  const orderNumber = pick(o, "orderNumber", "order_number");
  const trackingNo = String(tracking ?? "").trim() || pick(o, "tracking", "tracking_number");
  const carrier = pick(o, "carrier", "shipping_carrier");
  const trackingLine = trackingNo
    ? `\nמספר מעקב: ${trackingNo}${carrier ? ` (${carrier})` : ""}`
    : "";
  const text =
    `${greet(name)}! 📦\n` +
    `ההזמנה שלך${orderRef(orderNumber)} יצאה לדרך ובקרוב תגיע אליך.` +
    `${trackingLine}\n` +
    `תודה שבחרת ב"${SHOP}" — נשמח לדעת שהכול הגיע בשלום. 💛`;
  return waMessage(pick(o, "customerPhone", "customer_phone", "phone"), text);
}

/** Order started but payment never completed: a gentle, helpful nudge —
 *  no discount, no urgency, just an offer to help finish. */
export function waFollowUpUnpaid(o: Recordish): string | null {
  const name = pick(o, "customerName", "customer_name", "name");
  const orderNumber = pick(o, "orderNumber", "order_number");
  const text =
    `${greet(name)},\n` +
    `ראינו שהתחלת הזמנה${orderRef(orderNumber)} באתר "${SHOP}", אך נראה שהתשלום עדיין לא הושלם. ` +
    `אם נתקלת בקושי כלשהו או שיש שאלה — נשמח לעזור לך להשלים אותה בכל דרך שנוחה לך. 🙏`;
  return waMessage(pick(o, "customerPhone", "customer_phone", "phone"), text);
}

/** Post-delivery: ask how it went and invite a review. */
export function waReviewRequest(o: Recordish): string | null {
  const name = pick(o, "customerName", "customer_name", "name");
  const orderNumber = pick(o, "orderNumber", "order_number");
  const text =
    `${greet(name)}! 😊\n` +
    `מקווים שההזמנה${orderRef(orderNumber)} הגיעה אליך בשלום ושאתה נהנה ממנה. ` +
    `נשמח מאוד לשמוע איך היה — חוות דעת קטנה שלך עוזרת לנו ולקונים הבאים המון. ` +
    `תודה שאתה חלק מהמשפחה של "${SHOP}". 💛`;
  return waMessage(pick(o, "customerPhone", "customer_phone", "phone"), text);
}

/** Recoverable abandoned cart: a soft reminder, framed as an offer to help. */
export function waAbandonedCart(row: Recordish): string | null {
  const name = pick(row, "customerName", "customer_name", "name");
  const text =
    `${greet(name)}! 🛒\n` +
    `שמנו לב שהשארת כמה פריטים יפים בעגלה שלך באתר "${SHOP}". ` +
    `אם נשאר משהו לא ברור או שנוכל לעזור בהשלמת ההזמנה — אנחנו כאן בשבילך. 💛`;
  return waMessage(pick(row, "customerPhone", "customer_phone", "phone"), text);
}
