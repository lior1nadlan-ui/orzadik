// "חבר מביא חבר" for the order page and the CRM (rules in referral.ts).
//
// The two public calls take an order id, which is the same unguessable link
// the order page itself lives at, and return no personal detail: only the
// customer's own code, the program's percentages and the link to share.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { checkOrderRateLimitByIp, getClientIp } from "@/lib/rate-limit.server";
import {
  FRIEND_CODE_PREFIX,
  REFERRAL_KEY,
  referralErrors,
  referralLink,
  referralShareText,
  THANKS_CODE_PREFIX,
} from "@/lib/referral";
import {
  getOrCreateFriendCode,
  liveReferralOffer,
  readReferralSettings,
  syncFriendCodes,
} from "@/lib/referral.server";

const ORIGIN = process.env.APP_URL || "https://orzadik.com";

export type OrderReferral = {
  code: string;
  friendPercent: number;
  rewardPercent: number;
  rewardDays: number;
  link: string;
  shareText: string;
  notify: boolean;
};

async function paidOrderEmail(orderId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("customer_email, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!data || data.payment_status !== "paid") return null;
  const email = String(data.customer_email ?? "")
    .trim()
    .toLowerCase();
  return email || null;
}

/** The customer's code to share, for a paid order, while the program is on; else null. */
export const getOrderReferral = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<OrderReferral | null> => {
    try {
      const { limited } = await checkOrderRateLimitByIp(
        getClientIp(getRequest()),
        60,
        60 * 60,
        "referral",
      );
      if (limited) return null;
      const offer = await liveReferralOffer();
      if (!offer) return null;
      const email = await paidOrderEmail(data.orderId);
      if (!email) return null;
      const friend = await getOrCreateFriendCode(email, offer);
      if (!friend) return null;
      const link = referralLink(ORIGIN, friend.code);
      return {
        code: friend.code,
        friendPercent: offer.friendPercent,
        rewardPercent: offer.rewardPercent,
        rewardDays: offer.rewardDays,
        link,
        shareText: referralShareText(friend.code, offer.friendPercent, link),
        notify: friend.notify,
      };
    } catch (e) {
      console.error("[referral] order:", e);
      return null;
    }
  });

/** The customer's choice to get the thank-you coupon by email (an offer, so opt-in). */
export const setReferralNotify = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ orderId: z.string().uuid(), notify: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { limited } = await checkOrderRateLimitByIp(
      getClientIp(getRequest()),
      60,
      60 * 60,
      "referral",
    );
    if (limited) throw new Error("יותר מדי בקשות. נסו שוב בעוד כמה דקות.");
    const email = await paidOrderEmail(data.orderId);
    if (!email) throw new Error("לא ניתן לעדכן את ההגדרה להזמנה הזו.");
    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ referrer_notify: data.notify })
      .eq("referrer_email", email)
      .like("code", `${FRIEND_CODE_PREFIX}-%`);
    if (error) throw new Error("לא ניתן לשמור את הבחירה כרגע.");
    return { notify: data.notify };
  });

/** The CRM card: the setting and what the program has done. */
export const getReferralAdmin = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const [settings, codes, friendOrders, rewards, rewardsUsed] = await Promise.all([
    readReferralSettings(),
    supabaseAdmin
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .like("code", `${FRIEND_CODE_PREFIX}-%`)
      .not("referrer_email", "is", null),
    supabaseAdmin
      .from("orders")
      .select("total")
      .eq("payment_status", "paid")
      .like("coupon_code", `${FRIEND_CODE_PREFIX}-%`),
    supabaseAdmin
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .like("code", `${THANKS_CODE_PREFIX}-%`),
    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .like("coupon_code", `${THANKS_CODE_PREFIX}-%`),
  ]);
  const friendRows = (friendOrders.data ?? []) as { total: number | string | null }[];
  return {
    ...settings,
    codes: codes.count ?? 0,
    friendOrders: friendRows.length,
    friendRevenue: friendRows.reduce((s, r) => s + (Number(r.total) || 0), 0),
    rewards: rewards.count ?? 0,
    rewardsUsed: rewardsUsed.count ?? 0,
  };
});

/** Turn the program on or off and size it; every shared code follows (syncFriendCodes). */
export const setReferralProgram = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        friendPercent: z.number(),
        rewardPercent: z.number(),
        rewardDays: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const errors = referralErrors(data);
    if (errors.length) throw new Error(errors.join(" "));
    const value = {
      enabled: data.enabled,
      friendPercent: data.friendPercent,
      rewardPercent: data.rewardPercent,
      rewardDays: data.rewardDays,
    };
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: REFERRAL_KEY,
      value,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });
    if (error) {
      console.error("[referral] settings write:", error);
      throw new Error("לא ניתן לשמור את ההגדרה.");
    }
    await syncFriendCodes(value);
    return value;
  });
