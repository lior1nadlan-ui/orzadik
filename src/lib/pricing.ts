// Single source of truth for all price math — imported by BOTH the client
// (cart.tsx / product & cart UI) and the server (checkout.functions.ts).
// This module must stay free of any client- or server-only imports so it can
// run in either environment. Previously these constants/functions were
// duplicated across client and server with a "must match" comment — a real
// drift risk on money math. Keep them here only.

/** Site-wide discount applied to the catalog price. Final charged price = price * (1 - SITE_DISCOUNT). */
export const SITE_DISCOUNT = 0.3;

/** Extra discount for signed-in club members. */
export const MEMBER_DISCOUNT = 0.05;

/** Flat shipping fee always added at checkout — no free-shipping threshold. */
export const SHIPPING_FLAT = 37;
export const FREE_SHIPPING_THRESHOLD = Number.POSITIVE_INFINITY;

/** Effective price after the site-wide discount — what the customer actually pays. Rounded to whole ₪. */
export function getEffectivePrice(price: number): number {
  return Math.round(price * (1 - SITE_DISCOUNT));
}

/**
 * Struck-through "original" price shown next to the sale price.
 *
 * Consumer Protection Law §2 (no misleading): a "before" price must be a real
 * former price — never fabricated. We therefore use the product's recorded
 * `sale_price` (the genuine prior price) and show it ONLY when it is actually
 * higher than the current effective (paid) price. When there is no genuine
 * former price we return the effective price itself, so callers display no
 * discount rather than an invented one.
 */
export function getDisplayOriginal(price: number, salePrice?: number | null): number {
  const effective = getEffectivePrice(price);
  const original = salePrice != null ? Math.round(Number(salePrice)) : NaN;
  return Number.isFinite(original) && original > effective ? original : effective;
}

/** Real discount percentage vs. the recorded former price. 0 when none. */
export function getDiscountPct(price: number, salePrice?: number | null): number {
  const effective = getEffectivePrice(price);
  const original = getDisplayOriginal(price, salePrice);
  return original > effective ? Math.round((1 - effective / original) * 100) : 0;
}

/**
 * Whether a catalog price is a real, sellable price.
 *
 * A price of 0 is missing data, not an offer. `getEffectivePrice(0)` returns 0
 * by design — a "call for price" product — but nothing downstream of it treated
 * 0 as unsellable, so an active, in-stock row whose price was never filled in
 * produced a line total of 0. `getShipping` then saw a 0 subtotal and waived the
 * fee as well, and the order landed at ₪0 for everything including delivery.
 * Seven live rows were in exactly that state.
 *
 * NaN is rejected alongside it: `Number(null)` is 0, but `Number(undefined)` is
 * NaN, and a NaN unit price propagates into line totals without ever throwing.
 */
export function isSellablePrice(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

/** Apply the member discount to a subtotal (post-site-discount). Rounded to whole ₪. */
export function applyMemberDiscount(subtotal: number, isMember: boolean): number {
  if (!isMember) return subtotal;
  return Math.round(subtotal * (1 - MEMBER_DISCOUNT));
}

/** Shipping fee — flat rate charged whenever the cart has a positive subtotal. */
export function getShipping(subtotalAfterDiscount: number): number {
  if (subtotalAfterDiscount <= 0) return 0;
  return SHIPPING_FLAT;
}
