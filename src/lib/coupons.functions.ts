// The checkout's "החלה" button: is this code good right now, and what does it
// give? Public (no sign-in at checkout) but rate limited per IP, and it returns
// only the code's terms — never the coupon list, the influencer, or its limits.
// placeOrder checks the code again on its own when the order is placed.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  checkCouponRateLimitByIp,
  checkCouponVisitRateLimitByIp,
  getClientIp,
} from "@/lib/rate-limit.server";
import {
  COUPONS_DISABLED_MESSAGE,
  couponRejection,
  couponRejectionMessage,
  couponTerms,
  type CouponCheckFailure,
  type CouponTerms,
} from "@/lib/coupons";
import {
  couponEligibleProducts,
  couponsEnabled,
  couponUsage,
  customerPaidOrders,
  findCoupon,
} from "@/lib/coupons.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CheckSchema = z.object({
  code: z.string().trim().min(1).max(60),
  // Optional: known only once the shopper typed them. With them, a
  // one-per-customer code already used is refused here instead of at payment.
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  // The cart's products: for a coupon limited to categories or products the
  // answer says which of them it covers (never the coupon's whole list).
  product_ids: z.array(z.string().uuid()).max(100).optional(),
});

// `reason` lets the site tell a final "no" (dropped) from a code that only
// waits on the shopper's email or on the per-IP cap (kept): keepRefusedCoupon.
export type CouponCheckResult =
  | { ok: true; terms: CouponTerms }
  | { ok: false; message: string; reason: CouponCheckFailure };

export const checkCoupon = createServerFn({ method: "POST" })
  .validator((input: unknown) => CheckSchema.parse(input))
  .handler(async ({ data }): Promise<CouponCheckResult> => {
    const { limited } = await checkCouponRateLimitByIp(getClientIp(getRequest()));
    if (limited) {
      return {
        ok: false,
        message: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
        reason: "rate_limited",
      };
    }
    if (!(await couponsEnabled())) {
      return { ok: false, message: COUPONS_DISABLED_MESSAGE, reason: "disabled" };
    }
    const record = await findCoupon(data.code);
    const usage = record
      ? await couponUsage(record, data.email, data.phone)
      : { totalUses: 0, customerUses: 0 };
    // A new-customers-only code is checked against the email or phone when the
    // shopper has typed one; placeOrder checks again in any case.
    const previousPaidOrders = record?.new_customers_only
      ? await customerPaidOrders(data.email, data.phone)
      : 0;
    // Without the email yet, a personal coupon asks for it first.
    const rejection = couponRejection(record, {
      ...usage,
      email: data.email,
      previousPaidOrders,
    });
    if (rejection || !record) {
      const reason = rejection ?? "not_found";
      return { ok: false, message: couponRejectionMessage(reason), reason };
    }
    const eligible = await couponEligibleProducts(record, data.product_ids ?? []);
    return { ok: true, terms: couponTerms(record, eligible) };
  });

/**
 * Whether the checkout should offer its "יש לך קוד קופון?" box: coupons are
 * switched on in the CRM and at least one is live. With no code anywhere to
 * be had, an empty code box only sends shoppers away to hunt for one. A
 * failed read shows the box — an unneeded box is the lesser harm.
 */
export const couponBoxVisible = createServerFn({ method: "POST" }).handler(
  async (): Promise<boolean> => {
    const { data, error } = await supabaseAdmin.rpc("coupon_box_visible");
    if (error) {
      console.error("[coupons] box visible:", error);
      return true;
    }
    return data !== false;
  },
);

/**
 * One visit that arrived through a coupon link (?coupon=CODE), for the CRM's
 * and the influencer's "כניסות" count. The site calls it once per browser tab
 * per code. Counts only a live code, answers the same either way, and keeps no
 * IP or person: one number per coupon per day (coupon_visits).
 */
export const logCouponVisit = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ code: z.string().trim().min(1).max(60) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { limited } = await checkCouponVisitRateLimitByIp(getClientIp(getRequest()));
      if (limited) return { ok: true as const };
      const record = await findCoupon(data.code);
      if (record?.is_active) {
        const { error } = await supabaseAdmin.rpc("increment_coupon_visit", {
          p_coupon_id: record.id,
        });
        if (error) console.error("[coupons] visit:", error);
      }
    } catch (e) {
      console.error("[coupons] visit:", e);
    }
    return { ok: true as const };
  });
