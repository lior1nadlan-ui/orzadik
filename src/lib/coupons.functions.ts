// The checkout's "החלה" button: is this code good right now, and what does it
// give? Public (no sign-in at checkout) but rate limited per IP, and it returns
// only the code's terms — never the coupon list, the influencer, or its limits.
// placeOrder checks the code again on its own when the order is placed.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { checkCouponRateLimitByIp, getClientIp } from "@/lib/rate-limit.server";
import {
  couponRejection,
  couponRejectionMessage,
  couponTerms,
  type CouponTerms,
} from "@/lib/coupons";
import { couponUsage, findCoupon } from "@/lib/coupons.server";

const CheckSchema = z.object({
  code: z.string().trim().min(1).max(60),
  // Optional: known only once the shopper typed them. With them, a
  // one-per-customer code already used is refused here instead of at payment.
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
});

export type CouponCheckResult = { ok: true; terms: CouponTerms } | { ok: false; message: string };

export const checkCoupon = createServerFn({ method: "POST" })
  .validator((input: unknown) => CheckSchema.parse(input))
  .handler(async ({ data }): Promise<CouponCheckResult> => {
    const { limited } = await checkCouponRateLimitByIp(getClientIp(getRequest()));
    if (limited) {
      return { ok: false, message: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." };
    }
    const record = await findCoupon(data.code);
    const usage = record
      ? await couponUsage(record, data.email, data.phone)
      : { totalUses: 0, customerUses: 0 };
    const rejection = couponRejection(record, usage);
    if (rejection || !record) {
      return { ok: false, message: couponRejectionMessage(rejection ?? "not_found") };
    }
    return { ok: true, terms: couponTerms(record) };
  });
