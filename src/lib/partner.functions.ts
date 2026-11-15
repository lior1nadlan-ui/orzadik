// The influencer's own report (/partner/<token>): how their code is doing.
// Public — the influencer has no account — and found only by the 128-bit
// secret in the link the owner sends them (coupons.partner_token, created and
// revoked from /admin/coupons). It returns aggregates of the code's PAID
// orders and the commission payments, and nothing that identifies a customer:
// no name, phone, email, address, or order number.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkPartnerRateLimitByIp, getClientIp } from "@/lib/rate-limit.server";
import { BUSINESS } from "@/lib/business";
import {
  commissionOwed,
  couponStatus,
  couponTerms,
  offerText,
  partnerMonths,
  payoutBalance,
  PARTNER_TOKEN_RE,
  type CouponRecord,
  type CouponStatus,
  type PartnerMonth,
} from "@/lib/coupons";

export type PartnerReport = {
  code: string;
  influencerName: string | null;
  /** "10% הנחה + משלוח חינם". */
  offer: string;
  minOrder: number | null;
  endsAt: string | null;
  status: CouponStatus;
  paidOrders: number;
  sales: number;
  discountGiven: number;
  commissionPercent: number | null;
  commission: number;
  paidOut: number;
  balance: number;
  months: PartnerMonth[];
  payouts: { paidAt: string; amount: number }[];
  /** The link that applies the code, for the influencer to share. */
  shopLink: string;
};

export const getPartnerReport = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ token: z.string().regex(PARTNER_TOKEN_RE) }).parse(input),
  )
  .handler(async ({ data }): Promise<PartnerReport | null> => {
    const { limited } = await checkPartnerRateLimitByIp(getClientIp(getRequest()));
    if (limited) throw new Error("יותר מדי בקשות. נסו שוב בעוד כמה דקות.");

    const { data: c, error } = await supabaseAdmin
      .from("coupons")
      .select(
        "id, code, influencer_name, notes, discount_type, discount_value, free_shipping, min_order, starts_at, ends_at, max_uses, once_per_customer, is_active, commission_percent",
      )
      .eq("partner_token", data.token)
      .maybeSingle();
    if (error) {
      console.error("[partner] coupon:", error);
      throw new Error("לא ניתן לטעון את הדוח כרגע.");
    }
    if (!c) return null;

    const [{ data: orders, error: oErr }, { data: payouts, error: pErr }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("created_at, subtotal, coupon_discount")
        .eq("coupon_id", c.id)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("coupon_payouts")
        .select("amount, paid_at")
        .eq("coupon_id", c.id)
        .order("paid_at", { ascending: false })
        .limit(500),
    ]);
    if (oErr || pErr) {
      console.error("[partner] data:", oErr ?? pErr);
      throw new Error("לא ניתן לטעון את הדוח כרגע.");
    }

    const rows = orders ?? [];
    const sales = rows.reduce((s, o) => s + Number(o.subtotal), 0);
    const commission = commissionOwed(sales, c.commission_percent);
    const paidOut = (payouts ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const terms = couponTerms(c as CouponRecord);
    return {
      code: c.code,
      influencerName: c.influencer_name,
      offer: offerText(terms),
      minOrder: terms.minOrder,
      endsAt: c.ends_at,
      status: couponStatus(c, rows.length),
      paidOrders: rows.length,
      sales,
      discountGiven: rows.reduce((s, o) => s + Number(o.coupon_discount), 0),
      commissionPercent: c.commission_percent == null ? null : Number(c.commission_percent),
      commission,
      paidOut: Math.round(paidOut * 100) / 100,
      balance: payoutBalance(commission, paidOut),
      months: partnerMonths(rows, c.commission_percent),
      payouts: (payouts ?? []).map((p) => ({ paidAt: p.paid_at, amount: Number(p.amount) })),
      shopLink: `${BUSINESS.site}/?coupon=${encodeURIComponent(c.code)}`,
    };
  });
