// "חבר מביא חבר": every customer who has paid gets a code to share. A friend
// who orders with it for the first time gets a discount, and once that order
// is paid and settled, the customer who shared it gets a personal thank-you
// coupon for their next order. Built on the coupon system: the shared code is
// a FRIEND- coupon (new customers only, once each), the thank-you a personal
// THANKS- coupon (one use, one address, an end date).
//
// Why: Judaica is bought for events people talk about (a bar mitzvah, a
// wedding, a new home), and a buyer's family and community are the best next
// buyers there are. By 16.11.2026 the shop had 11 paying customers, none had
// come back, and nothing invited them to bring anyone.
//
// Off until the owner turns it on in the CRM (/admin/coupons → "חבר מביא
// חבר"), sized there. Pure; the server side is referral.server.ts.

/** site_settings key: {enabled, friendPercent, rewardPercent, rewardDays}. No row = off. */
export const REFERRAL_KEY = "referral_program";
/** The code a customer shares. One per address (coupons.referrer_email is unique). */
export const FRIEND_CODE_PREFIX = "FRIEND";
/** The referrer's thank-you: personal, one use. */
export const THANKS_CODE_PREFIX = "THANKS";
export const REFERRAL_PERCENT_MAX = 30;
export const REWARD_DAYS_MIN = 7;
export const REWARD_DAYS_MAX = 365;
/** A friend's order earns the thank-you once it has stood this long uncancelled. */
export const REWARD_AFTER_MS = 48 * 60 * 60 * 1000;

export type ReferralSettings = {
  enabled: boolean;
  friendPercent: number;
  rewardPercent: number;
  rewardDays: number;
};

export const REFERRAL_DEFAULTS: ReferralSettings = {
  enabled: false,
  friendPercent: 10,
  rewardPercent: 10,
  rewardDays: 90,
};

const wholeIn = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/**
 * The stored setting, read tolerantly: anything missing or out of range falls
 * back to the default, and only a literal `true` turns the program on, so a
 * damaged row can never start handing out codes by itself.
 */
export function parseReferralSettings(v: unknown): ReferralSettings {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    enabled: o.enabled === true,
    friendPercent:
      wholeIn(o.friendPercent, 1, REFERRAL_PERCENT_MAX) ?? REFERRAL_DEFAULTS.friendPercent,
    rewardPercent:
      wholeIn(o.rewardPercent, 1, REFERRAL_PERCENT_MAX) ?? REFERRAL_DEFAULTS.rewardPercent,
    rewardDays:
      wholeIn(o.rewardDays, REWARD_DAYS_MIN, REWARD_DAYS_MAX) ?? REFERRAL_DEFAULTS.rewardDays,
  };
}

/** Hebrew errors for the CRM form; empty when the values can be saved. */
export function referralErrors(s: {
  friendPercent: number;
  rewardPercent: number;
  rewardDays: number;
}): string[] {
  const errors: string[] = [];
  if (wholeIn(s.friendPercent, 1, REFERRAL_PERCENT_MAX) == null) {
    errors.push(`ההנחה לחבר צריכה להיות מספר שלם בין 1 ל-${REFERRAL_PERCENT_MAX}.`);
  }
  if (wholeIn(s.rewardPercent, 1, REFERRAL_PERCENT_MAX) == null) {
    errors.push(`קופון התודה צריך להיות מספר שלם בין 1 ל-${REFERRAL_PERCENT_MAX}.`);
  }
  if (wholeIn(s.rewardDays, REWARD_DAYS_MIN, REWARD_DAYS_MAX) == null) {
    errors.push(`תוקף קופון התודה צריך להיות בין ${REWARD_DAYS_MIN} ל-${REWARD_DAYS_MAX} ימים.`);
  }
  return errors;
}

const hasPrefix = (code: string | null | undefined, prefix: string) =>
  String(code ?? "")
    .toUpperCase()
    .startsWith(`${prefix}-`);

export const isFriendCode = (code: string | null | undefined) =>
  hasPrefix(code, FRIEND_CODE_PREFIX);
export const isThanksCode = (code: string | null | undefined) =>
  hasPrefix(code, THANKS_CODE_PREFIX);

/** The link a friend opens: the home page with the code applied (?coupon=). */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/?coupon=${encodeURIComponent(code)}`;
}

/** The message the customer sends their friends, in their own voice. */
export function referralShareText(code: string, friendPercent: number, link: string): string {
  return (
    `מצאתי חנות יפה לתשמישי קדושה ומתנות, "אור זרוע לצדיק". ` +
    `עם הקוד שלי ${code} מקבלים ${friendPercent}% הנחה על ההזמנה הראשונה: ${link}`
  );
}

export type RewardOrder = {
  payment_status: string;
  status: string | null;
  paid_at: string | null;
  created_at: string;
  coupon_code: string | null;
  customer_email: string | null;
  referral_reward_coupon_id: string | null;
};

export type RewardDecision =
  | "issue"
  | "not-referral"
  | "not-paid"
  | "closed"
  | "already"
  | "self"
  | "too-soon";

/**
 * Whether a friend's order has earned its referrer the thank-you yet. Paid,
 * not cancelled or refunded, standing for REWARD_AFTER_MS, rewarded once, and
 * never to the referrer for their own order.
 */
export function rewardDecision(
  o: RewardOrder,
  referrerEmail: string | null | undefined,
  now: number,
): RewardDecision {
  const referrer = String(referrerEmail ?? "")
    .trim()
    .toLowerCase();
  if (!isFriendCode(o.coupon_code) || !referrer) return "not-referral";
  if (o.payment_status !== "paid") return "not-paid";
  if (["cancelled", "refunded"].includes(String(o.status ?? ""))) return "closed";
  if (o.referral_reward_coupon_id) return "already";
  const friend = String(o.customer_email ?? "")
    .trim()
    .toLowerCase();
  if (friend && friend === referrer) return "self";
  const paidAt = Date.parse(o.paid_at ?? o.created_at);
  if (!(now - paidAt >= REWARD_AFTER_MS)) return "too-soon";
  return "issue";
}

/** "עד 14.2.2027" for a coupon's end date, in Israel's calendar. */
export function hebrewDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
