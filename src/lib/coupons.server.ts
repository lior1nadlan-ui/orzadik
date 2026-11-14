// Server side of coupons: finding a code and counting its paid uses. Pure math
// and messages live in coupons.ts; this file only talks to the database.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  couponRejection,
  couponRejectionMessage,
  couponTerms,
  isValidCouponCode,
  latinFromHebrewKeyboard,
  normalizeCouponCode,
  type CouponRecord,
  type CouponTerms,
} from "@/lib/coupons";

const COUPON_COLUMNS =
  "id, code, influencer_name, notes, discount_type, discount_value, free_shipping, min_order, starts_at, ends_at, max_uses, once_per_customer, is_active";

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
  const record = await findCoupon(raw);
  const usage = record
    ? await couponUsage(record, customer.email, customer.phone)
    : { totalUses: 0, customerUses: 0 };
  const rejection = couponRejection(record, usage);
  if (rejection || !record) {
    throw new Error(couponRejectionMessage(rejection ?? "not_found"));
  }
  return { record, terms: couponTerms(record) };
}
