// Server side of coupons: finding a code and counting its paid uses. Pure math
// and messages live in coupons.ts; this file only talks to the database.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  COUPONS_DISABLED_MESSAGE,
  couponEligibleTotal,
  couponScopeOf,
  couponRejection,
  couponRejectionMessage,
  couponTerms,
  isValidCouponCode,
  latinFromHebrewKeyboard,
  normalizeCouponCode,
  offerText,
  type CouponRecord,
  type CouponTerms,
} from "@/lib/coupons";

const COUPON_COLUMNS =
  "id, code, influencer_name, notes, discount_type, discount_value, free_shipping, min_order, starts_at, ends_at, max_uses, once_per_customer, is_active, scope, category_ids, product_ids, apply_to_sale_items, allowed_email";

/**
 * The CRM switch "קופונים באתר" (site_settings.coupons_enabled). On unless the
 * owner turned it off; a failed read counts as on, so a hiccup never blocks a
 * code the owner meant to honour (each code is still checked on its own).
 */
export async function couponsEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "coupons_enabled")
    .maybeSingle();
  if (error) {
    console.error("[coupons] settings:", error);
    return true;
  }
  return data?.value !== false;
}

/**
 * Of these products, the ones the coupon covers — null for a whole-shop
 * coupon (every product). Walks categories the way promotions do
 * (coupon_eligible_products in 20261115120000_coupon_control.sql).
 */
export async function couponEligibleProducts(
  r: CouponRecord,
  productIds: readonly string[],
): Promise<string[] | null> {
  if (couponScopeOf(r) === "all") return null;
  if (productIds.length === 0) return [];
  const { data, error } = await supabaseAdmin.rpc("coupon_eligible_products", {
    p_coupon_id: r.id,
    p_product_ids: [...new Set(productIds)],
  });
  if (error) {
    console.error("[coupons] eligible:", error);
    throw new Error("לא ניתן לבדוק את הקופון כרגע. נסו שוב בעוד רגע.");
  }
  return ((data ?? []) as unknown[]).map(String);
}

/**
 * The items amount a coupon applies to on a priced order: lines of covered
 * products and — unless the coupon applies to sale items — not priced by a
 * promotion (priceOrderLines stamps promotion_id only when one lowered it).
 */
export async function orderEligibleTotal(
  r: CouponRecord,
  terms: CouponTerms,
  lines: readonly { product_id: string; line_total: number; promotion_id: string | null }[],
): Promise<number> {
  const eligible = await couponEligibleProducts(
    r,
    lines.map((l) => l.product_id),
  );
  return couponEligibleTotal(
    lines.map((l) => ({
      productId: l.product_id,
      lineTotal: l.line_total,
      promoted: !!l.promotion_id,
    })),
    { eligibleProductIds: eligible, applyToSaleItems: terms.applyToSaleItems },
  );
}

/**
 * The coupon a shopper's text names, or null. The code as typed wins; only
 * when it does not exist is it read as a Latin code typed on a Hebrew keyboard.
 */
export async function findCoupon(raw: string): Promise<CouponRecord | null> {
  const code = normalizeCouponCode(raw);
  const candidates = [code, latinFromHebrewKeyboard(code)].filter(
    (c): c is string => !!c && isValidCouponCode(c),
  );
  if (candidates.length === 0) return null;
  const { data, error } = await supabaseAdmin
    .from("coupons")
    .select(COUPON_COLUMNS)
    .in("code", candidates);
  if (error) {
    console.error("[coupons] find:", error);
    throw new Error("לא ניתן לבדוק את הקופון כרגע. נסו שוב בעוד רגע.");
  }
  const rows = (data ?? []) as CouponRecord[];
  return rows.find((r) => r.code === code) ?? rows[0] ?? null;
}

/**
 * Paid uses of a coupon, in total and by this customer. Skipped (zeros) when
 * the coupon has no limit that needs them. A failed read throws rather than
 * guessing: an unlimited guess would let a capped code run over.
 */
export async function couponUsage(
  r: CouponRecord,
  email: string | null | undefined,
  phone: string | null | undefined,
): Promise<{ totalUses: number; customerUses: number }> {
  if (r.max_uses == null && !r.once_per_customer) return { totalUses: 0, customerUses: 0 };
  const { data, error } = await supabaseAdmin.rpc("coupon_usage", {
    p_coupon_id: r.id,
    p_email: email ?? "",
    p_phone: phone ?? "",
  });
  if (error) {
    console.error("[coupons] usage:", error);
    throw new Error("לא ניתן לבדוק את הקופון כרגע. נסו שוב בעוד רגע.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalUses: Number(row?.total_uses ?? 0),
    customerUses: Number(row?.customer_uses ?? 0),
  };
}

/**
 * The coupon for a new order, checked now — or a thrown Hebrew error that
 * starts with "הקופון", which the checkout shows and uses to drop the code so
 * the shopper sees the amount without it before paying.
 */
export async function resolveOrderCoupon(
  raw: string,
  customer: { email?: string | null; phone?: string | null },
): Promise<{ record: CouponRecord; terms: CouponTerms }> {
  if (!(await couponsEnabled())) throw new Error(COUPONS_DISABLED_MESSAGE);
  const record = await findCoupon(raw);
  const usage = record
    ? await couponUsage(record, customer.email, customer.phone)
    : { totalUses: 0, customerUses: 0 };
  // The email decides a personal coupon (coupons.allowed_email).
  const rejection = couponRejection(record, { ...usage, email: customer.email });
  if (rejection || !record) {
    throw new Error(couponRejectionMessage(rejection ?? "not_found"));
  }
  return { record, terms: couponTerms(record) };
}

/**
 * For abandoned-cart reminders: of the carts that carried a coupon, the ones
 * whose code still works for that shopper right now (switch on, dates, limits,
 * a personal coupon's email) — keyed by cart id, with the offer to name. Never
 * throws: a code that cannot be checked is simply not mentioned, so a reminder
 * never promises a code the checkout would then refuse.
 */
export async function liveCouponsForCarts(
  carts: readonly { id: string; email: string; coupon_code?: string | null }[],
): Promise<Map<string, { code: string; offer: string }>> {
  const out = new Map<string, { code: string; offer: string }>();
  const withCode = carts.filter((c) => c.coupon_code);
  if (withCode.length === 0) return out;
  try {
    if (!(await couponsEnabled())) return out;
  } catch {
    return out;
  }
  const records = new Map<string, CouponRecord | null>();
  for (const cart of withCode) {
    try {
      const key = normalizeCouponCode(cart.coupon_code ?? "");
      if (!records.has(key)) records.set(key, await findCoupon(key));
      const record = records.get(key) ?? null;
      if (!record) continue;
      const usage = await couponUsage(record, cart.email, null);
      if (couponRejection(record, { ...usage, email: cart.email })) continue;
      out.set(cart.id, { code: record.code, offer: offerText(couponTerms(record)) });
    } catch {
      /* leave this cart's code out of its reminder */
    }
  }
  return out;
}
