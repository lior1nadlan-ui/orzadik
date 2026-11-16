// Server side of "חבר מביא חבר" (rules and the why in referral.ts): reading
// the CRM setting, a customer's FRIEND- code, and the THANKS- coupon a
// friend's settled order earns. Never throws to a caller: the program is a
// bonus on top of an order that has already succeeded.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateCouponCode } from "@/lib/coupons";
import { couponsEnabled } from "@/lib/coupons.server";
import {
  emailButton,
  emailShell,
  esc,
  isEmailConfigured,
  listUnsubscribeHeaders,
  sendEmail,
  unsubscribeToken,
  unsubscribeUrl,
} from "@/lib/email.server";
import { BUSINESS, sellerIdentityLine } from "@/lib/business";
import {
  FRIEND_CODE_PREFIX,
  hebrewDate,
  parseReferralSettings,
  REFERRAL_KEY,
  rewardDecision,
  THANKS_CODE_PREFIX,
  type ReferralSettings,
  type RewardOrder,
} from "@/lib/referral";

const DAY = 24 * 60 * 60 * 1000;
const ORIGIN = process.env.APP_URL || "https://orzadik.com";
/** How far back the reward job looks; a referral older than this was handled or lost. */
const REWARD_LOOKBACK_MS = 60 * DAY;

/** The CRM setting. A failed read counts as off: no code is ever minted blind. */
export async function readReferralSettings(): Promise<ReferralSettings> {
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", REFERRAL_KEY)
    .maybeSingle();
  if (error) {
    console.error("[referral] settings:", error);
    return parseReferralSettings(null);
  }
  return parseReferralSettings(data?.value);
}

/** The program as the shop may offer it now, or null (off, or coupons off site-wide). */
export async function liveReferralOffer(): Promise<ReferralSettings | null> {
  const s = await readReferralSettings();
  if (!s.enabled) return null;
  if (!(await couponsEnabled())) return null;
  return s;
}

export type FriendCode = { code: string; notify: boolean };

/**
 * The customer's FRIEND- code, minted on first request. One per address,
 * enforced by a unique index, so two tabs asking at once still get the same
 * code. Null on any failure.
 */
export async function getOrCreateFriendCode(
  email: string,
  offer: ReferralSettings,
): Promise<FriendCode | null> {
  const address = email.trim().toLowerCase();
  if (!address) return null;
  try {
    const find = async () => {
      const { data } = await supabaseAdmin
        .from("coupons")
        .select("code, referrer_notify")
        // eq, never ilike: "_" in an address is a LIKE wildcard, and would
        // hand one customer another's code. Addresses are stored lower-case.
        .eq("referrer_email", address)
        .like("code", `${FRIEND_CODE_PREFIX}-%`)
        .limit(1)
        .maybeSingle();
      return data ? { code: data.code, notify: !!data.referrer_notify } : null;
    };
    const had = await find();
    if (had) return had;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCouponCode(FRIEND_CODE_PREFIX);
      const { error } = await supabaseAdmin.from("coupons").insert({
        code,
        influencer_name: null,
        notes: "חבר מביא חבר",
        discount_type: "percent",
        discount_value: offer.friendPercent,
        free_shipping: false,
        min_order: null,
        starts_at: new Date().toISOString(),
        ends_at: null,
        max_uses: null,
        // Each friend once, and only on their first order: the shop pays for
        // a new customer, not for a returning one or for the sharer themself.
        once_per_customer: true,
        new_customers_only: true,
        commission_percent: null,
        scope: "all",
        category_ids: [],
        product_ids: [],
        apply_to_sale_items: false,
        allowed_email: null,
        referrer_email: address,
        is_active: true,
      });
      if (!error) return { code, notify: false };
      if (error.code !== "23505") {
        console.error("[referral] insert:", error);
        return null;
      }
      // 23505: either the random code collided (try another) or another
      // request just created this customer's code (take it).
      const raced = await find();
      if (raced) return raced;
    }
    return null;
  } catch (e) {
    console.error("[referral] code:", e);
    return null;
  }
}

/**
 * The owner changed the program: keep every shared code in step, so a link
 * already sent shows what the order page now promises, and stops working the
 * moment the program is off. Rewards already issued are personal and keep
 * their terms.
 */
export async function syncFriendCodes(s: ReferralSettings): Promise<void> {
  const { error } = await supabaseAdmin
    .from("coupons")
    .update({ is_active: s.enabled, discount_value: s.friendPercent })
    .like("code", `${FRIEND_CODE_PREFIX}-%`)
    .not("referrer_email", "is", null);
  if (error) console.error("[referral] sync codes:", error);
}

async function issueThanksCoupon(
  referrerEmail: string,
  friendOrderNumber: string,
  s: ReferralSettings,
): Promise<{ id: string; code: string; endsAt: string } | null> {
  const endsAt = new Date(Date.now() + s.rewardDays * DAY).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCouponCode(THANKS_CODE_PREFIX);
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .insert({
        code,
        influencer_name: null,
        notes: `תודה על חבר מביא חבר (${friendOrderNumber})`,
        discount_type: "percent",
        discount_value: s.rewardPercent,
        free_shipping: false,
        min_order: null,
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        max_uses: 1,
        once_per_customer: true,
        commission_percent: null,
        scope: "all",
        category_ids: [],
        product_ids: [],
        apply_to_sale_items: false,
        allowed_email: referrerEmail,
        is_active: true,
      })
      .select("id")
      .single();
    if (!error && data) return { id: data.id, code, endsAt };
    if (error && error.code !== "23505") {
      console.error("[referral] thanks insert:", error);
      return null;
    }
  }
  return null;
}

async function sendThanksEmail(
  to: string,
  thanks: { code: string; endsAt: string },
  percent: number,
): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const token = await unsubscribeToken(to);
  if (!token) return false; // no compliant unsubscribe → no advertising email
  const unsub = unsubscribeUrl(to, token);
  const shopHref = `${ORIGIN}/shop?coupon=${encodeURIComponent(thanks.code)}`;
  return sendEmail({
    to,
    subject: "פרסומת: חבר הזמין בזכותכם, והנה תודה קטנה ✨",
    html: emailShell(
      `
      <p class="oz-muted" style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
      <h1 style="font-size:20px;margin:0 0 8px;">תודה שהבאתם חבר ✨</h1>
      <p class="oz-muted" style="font-size:14px;color:#555;margin:0 0 16px;">
        מישהו שקיבל מכם את הקוד שלכם הזמין עכשיו באור זרוע לצדיק. כתודה, הנה הנחה להזמנה הבאה שלכם.
      </p>
      <div style="margin:0 0 16px;padding:14px 12px;border:1px dashed #A8862A;border-radius:10px;background:#FBF7EC;text-align:center;">
        <div style="font-size:14px;color:#1F1915;">${percent}% הנחה על ההזמנה הבאה</div>
        <div dir="ltr" style="font-size:22px;font-weight:700;letter-spacing:1px;margin:6px 0;color:#1F1915;">${esc(thanks.code)}</div>
        <div class="oz-muted" style="font-size:12px;color:#777;line-height:1.6;">בתוקף עד ${esc(hebrewDate(thanks.endsAt))}, לשימוש אחד עם כתובת האימייל הזו. לא חל על מוצרים שכבר במבצע.</div>
      </div>
      ${emailButton(shopHref, "לחנות, עם הקוד")}
      <div class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
        <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
        <div style="margin-top:6px;">
          <a class="oz-gold" href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
        </div>
      </div>`,
      `${percent}% הנחה על ההזמנה הבאה, תודה שהבאתם חבר.`,
    ),
    replyTo: process.env.SHOP_OWNER_EMAIL,
    headers: listUnsubscribeHeaders(unsub),
  });
}

/**
 * The hourly job: thank the referrer of every friend's order that has paid and
 * stood REWARD_AFTER_MS uncancelled. The coupon is always issued; it is
 * emailed only to a referrer who asked for it on their order page or is an
 * active newsletter subscriber, and never to a suppressed address. Runs even
 * while the program is off, so a friend who ordered while it was on is still
 * honoured.
 */
export async function runReferralRewards(): Promise<{ issued: number; emailed: number }> {
  const now = Date.now();
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, payment_status, status, paid_at, created_at, coupon_code, coupon_id, customer_email, referral_reward_coupon_id",
    )
    .eq("payment_status", "paid")
    .like("coupon_code", `${FRIEND_CODE_PREFIX}-%`)
    .is("referral_reward_coupon_id", null)
    .gte("created_at", new Date(now - REWARD_LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) {
    console.error("[referral] rewards load:", error);
    return { issued: 0, emailed: 0 };
  }
  if (!orders?.length) return { issued: 0, emailed: 0 };

  const settings = await readReferralSettings();
  const codes = [...new Set(orders.map((o) => String(o.coupon_code).toUpperCase()))];
  const { data: friendCoupons } = await supabaseAdmin
    .from("coupons")
    .select("code, referrer_email, referrer_notify")
    .in("code", codes);
  const byCode = new Map(
    (friendCoupons ?? []).map((c) => [String(c.code).toUpperCase(), c] as const),
  );

  let issued = 0;
  let emailed = 0;
  for (const o of orders) {
    const fc = byCode.get(String(o.coupon_code).toUpperCase());
    const referrer = String(fc?.referrer_email ?? "").toLowerCase();
    const decision = rewardDecision(o as RewardOrder, referrer, now);
    if (decision !== "issue") continue;

    const thanks = await issueThanksCoupon(referrer, o.order_number, settings);
    if (!thanks) continue;
    const { data: stamped } = await supabaseAdmin
      .from("orders")
      .update({ referral_reward_coupon_id: thanks.id })
      .eq("id", o.id)
      .is("referral_reward_coupon_id", null)
      .select("id");
    if (!stamped?.length) {
      // Another run stamped it first: retire this duplicate coupon.
      await supabaseAdmin.from("coupons").update({ is_active: false }).eq("id", thanks.id);
      continue;
    }
    issued += 1;

    const [{ data: sub }, { data: suppressed }] = await Promise.all([
      supabaseAdmin
        .from("newsletter_subscribers")
        .select("id")
        .eq("email", referrer)
        .is("unsubscribed_at", null)
        .limit(1),
      supabaseAdmin.from("email_suppressions").select("email").eq("email", referrer).limit(1),
    ]);
    const mayEmail = (fc?.referrer_notify || (sub ?? []).length > 0) && !(suppressed ?? []).length;
    if (mayEmail && (await sendThanksEmail(referrer, thanks, settings.rewardPercent))) emailed += 1;
  }
  return { issued, emailed };
}
