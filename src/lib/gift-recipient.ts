// Who receives a gift parcel when it is not the buyer: a name, and a phone the
// courier calls instead of the buyer's. Optional, and kept only on a gift that
// is delivered (a pickup is collected by the buyer). Pure; shared by the
// checkout, placeOrder and everything that prints or sends the order.

export const RECIPIENT_NAME_MAX = 120;
export const RECIPIENT_PHONE_MAX = 30;

/**
 * The same permissive check as the buyer's phone at checkout: at least 9
 * digits (every Israeli number has them), no format rules that could refuse a
 * real number.
 */
export function isRecipientPhone(phone: string | null | undefined): boolean {
  return String(phone ?? "").replace(/\D/g, "").length >= 9;
}

export type GiftRecipient = { recipient_name: string | null; recipient_phone: string | null };

/**
 * What to store on the order: trimmed values or null, and nothing at all
 * unless the order is a gift that is delivered. A phone that fails the check
 * is not stored (the checkout refuses it before this).
 */
export function giftRecipientFor(input: {
  isGift: boolean;
  fulfillment: "delivery" | "pickup";
  name?: string | null;
  phone?: string | null;
}): GiftRecipient {
  if (!input.isGift || input.fulfillment !== "delivery") {
    return { recipient_name: null, recipient_phone: null };
  }
  const name = (input.name ?? "").trim().slice(0, RECIPIENT_NAME_MAX);
  const phone = (input.phone ?? "").trim().slice(0, RECIPIENT_PHONE_MAX);
  return {
    recipient_name: name || null,
    recipient_phone: phone && isRecipientPhone(phone) ? phone : null,
  };
}

/** "רחל כהן · 050-1234567", for the CRM, the slip and the alerts; null when empty. */
export function recipientLine(o: {
  recipient_name?: string | null;
  recipient_phone?: string | null;
}): string | null {
  const parts = [o.recipient_name?.trim(), o.recipient_phone?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
