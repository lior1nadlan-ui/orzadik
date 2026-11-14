// Coupon codes ("קופונים") — the one place coupon math lives, imported by the
// checkout page (the amount a shopper sees), placeOrder and the CRM phone order
// (the charge), the receipts and the CRM. Like pricing.ts and promotions.ts it
// must stay free of client- or server-only imports so it runs in both.
//
// The model (supabase/migrations/20261114120000_coupons.sql): a coupon takes a
// percentage or a fixed number of shekels off the items amount — after
// promotions and after the club member's 5%, never off shipping — and may also
// waive shipping. It can require a minimum items amount, have dates, a limit on
// paid uses, and be limited to one use per customer.
import { applyMemberDiscount, getShipping, type Fulfillment } from "@/lib/pricing";

export type CouponDiscountType = "percent" | "fixed";

/** What a code gives — all the checkout and placeOrder price with. */
export type CouponTerms = {
  code: string;
  discountType: CouponDiscountType;
  /** Percent (0-50) or shekels (0-2000). 0 only for a free-shipping coupon. */
  discountValue: number;
  freeShipping: boolean;
  /** Minimum items amount (before the member discount), or null. */
  minOrder: number | null;
};

/** A row of public.coupons, as the server reads it. */
export type CouponRecord = {
  id: string;
  code: string;
  influencer_name: string | null;
  notes: string | null;
  discount_type: string;
  discount_value: number | string;
  free_shipping: boolean;
  min_order: number | string | null;
  starts_at: string;
  ends_at: string | null;
  max_uses: number | null;
  once_per_customer: boolean;
  is_active: boolean;
  /** Share of the coupon's sales owed to the person behind it, or null. Reporting only. */
  commission_percent?: number | string | null;
};

export const COUPON_PERCENT_MAX = 50;
export const COUPON_FIXED_MAX = 2000;
/** Mirrors the CHECK on coupons.code: capital Latin, Hebrew letters, digits, - and _. */
export const COUPON_CODE_RE = /^[A-Z0-9א-ת_-]{3,30}$/;

/**
 * "  dana 10 " → "DANA10". Spaces are dropped (a code read off an Instagram
 * story is often typed with one), and so are the invisible direction marks a
 * Hebrew keyboard can slip into a Latin word.
 */
export function normalizeCouponCode(raw: string): string {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(/[\s‎‏‪-‮⁦-⁩]/g, "")
    .toUpperCase();
}

export function isValidCouponCode(code: string): boolean {
  return COUPON_CODE_RE.test(code);
}

// The Israeli keyboard (SI-1452): the Hebrew letter on each Latin key.
const HEBREW_KEY_TO_LATIN: Record<string, string> = {
  ק: "E",
  ר: "R",
  א: "T",
  ט: "Y",
  ו: "U",
  ן: "I",
  ם: "O",
  פ: "P",
  ש: "A",
  ד: "S",
  ג: "D",
  כ: "F",
  ע: "G",
  י: "H",
  ח: "J",
  ל: "K",
  ך: "L",
  ז: "Z",
  ס: "X",
  ב: "C",
  ה: "V",
  נ: "B",
  מ: "N",
  צ: "M",
};

/**
 * The Latin code a shopper meant when they typed it with the keyboard still in
 * Hebrew ("גשמש10" → "DANA10"), or null when the text has no Hebrew letter or
 * a key with no letter behind it. The server tries it only after the code as
 * typed was not found, so a real Hebrew code always wins.
 */
export function latinFromHebrewKeyboard(code: string): string | null {
  if (!/[א-ת]/.test(code)) return null;
  let out = "";
  for (const ch of code) {
    if (/[א-ת]/.test(ch)) {
      const latin = HEBREW_KEY_TO_LATIN[ch];
      if (!latin) return null;
      out += latin;
    } else out += ch;
  }
  return isValidCouponCode(out) ? out : null;
}

/** The terms a record carries, for the checkout. Never includes the id or limits. */
export function couponTerms(r: CouponRecord): CouponTerms {
  const min = r.min_order == null ? null : Number(r.min_order);
  return {
    code: r.code,
    discountType: r.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: Number(r.discount_value) || 0,
    freeShipping: !!r.free_shipping,
    minOrder: min != null && Number.isFinite(min) && min > 0 ? min : null,
  };
}

/** Why a code cannot be used now (min order is decided against the cart, below). */
export type CouponRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "used_up"
  | "already_used";

export function couponRejection(
  r: CouponRecord | null,
  ctx: { now?: Date; totalUses?: number; customerUses?: number } = {},
): CouponRejection | null {
  if (!r) return "not_found";
  if (!r.is_active) return "inactive";
  const now = (ctx.now ?? new Date()).getTime();
  if (new Date(r.starts_at).getTime() > now) return "not_started";
  if (r.ends_at && new Date(r.ends_at).getTime() <= now) return "expired";
  if (r.max_uses != null && (ctx.totalUses ?? 0) >= r.max_uses) return "used_up";
  if (r.once_per_customer && (ctx.customerUses ?? 0) > 0) return "already_used";
  return null;
}

/**
 * sessionStorage key for a code that should come back by itself at checkout:
 * one from an influencer's link (any page, ?coupon=DANA10) or one the shopper
 * applied earlier in this tab. Session-scoped on purpose — a code must not
 * re-apply itself weeks later for a returning customer.
 */
export const COUPON_STORAGE_KEY = "oz-coupon";

/** Every coupon message starts with "הקופון" — the checkout keys on it to drop a dead code. */
export const COUPON_MESSAGE_PREFIX = "הקופון";

export function couponRejectionMessage(reason: CouponRejection): string {
  switch (reason) {
    case "not_found":
      return "הקופון לא נמצא. כדאי לבדוק את האיות.";
    case "inactive":
      return "הקופון הזה אינו פעיל.";
    case "not_started":
      return "הקופון עדיין לא בתוקף.";
    case "expired":
      return "הקופון הזה כבר לא בתוקף.";
    case "used_up":
      return "הקופון הגיע למספר השימושים המרבי.";
    case "already_used":
      return "הקופון כבר נוצל עם הפרטים האלה. הוא מיועד לשימוש אחד לכל לקוח.";
  }
}

/** Whether the items amount reaches the coupon's minimum. */
export function meetsCouponMinimum(itemsTotal: number, terms: CouponTerms): boolean {
  return terms.minOrder == null || itemsTotal >= terms.minOrder;
}

/**
 * The shekels a coupon takes off an items amount (after promotions and the
 * member discount). Whole shekels, like every price on the site, and never so
 * much that less than ₪1 is left to pay for the items — a fixed coupon larger
 * than a small cart would otherwise send CardCom a zero amount on a pickup.
 */
export function couponDiscount(
  itemsAfterMember: number,
  terms: Pick<CouponTerms, "discountType" | "discountValue">,
): number {
  if (!Number.isFinite(itemsAfterMember) || itemsAfterMember <= 1) return 0;
  const value = Number(terms.discountValue);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const raw =
    terms.discountType === "fixed"
      ? Math.round(value)
      : Math.round((itemsAfterMember * Math.min(value, COUPON_PERCENT_MAX)) / 100);
  return Math.max(0, Math.min(raw, itemsAfterMember - 1));
}

/** The order's money, the way placeOrder charges it and the checkout shows it. */
export type OrderTotals = {
  /** Items after promotions — "סכום פריטים". */
  itemsTotal: number;
  /** The club member's 5%, in shekels. */
  memberBenefit: number;
  /** Shekels the coupon took off the items. */
  couponDiscount: number;
  /** True when a coupon was given and reaches its minimum — it is then recorded on the order. */
  couponApplied: boolean;
  /** The shipping fee the coupon waived (0 when none). */
  shippingWaived: number;
  /** orders.subtotal: items after every discount. */
  subtotal: number;
  shipping: number;
  total: number;
};

export function computeOrderTotals(input: {
  itemsTotal: number;
  isMember: boolean;
  fulfillment: Fulfillment;
  coupon: CouponTerms | null;
}): OrderTotals {
  const { itemsTotal, isMember, fulfillment, coupon } = input;
  const memberSubtotal = applyMemberDiscount(itemsTotal, isMember);
  const couponApplied = !!coupon && itemsTotal > 0 && meetsCouponMinimum(itemsTotal, coupon);
  const cDiscount = couponApplied && coupon ? couponDiscount(memberSubtotal, coupon) : 0;
  const subtotal = memberSubtotal - cDiscount;
  const fee = getShipping(subtotal, fulfillment);
  const shippingWaived = couponApplied && coupon?.freeShipping ? fee : 0;
  const shipping = fee - shippingWaived;
  return {
    itemsTotal,
    memberBenefit: itemsTotal - memberSubtotal,
    couponDiscount: cDiscount,
    couponApplied,
    shippingWaived,
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

/**
 * A stored order's money, for the receipts (order page, emails, CardCom
 * invoice, packing slip). orders.subtotal is stored after the member discount
 * AND the coupon while order_items keep their pre-discount line totals, so the
 * member's benefit is what is left after the coupon's recorded shekels:
 *   itemsSum − memberBenefit − couponDiscount + shipping = total.
 */
export function orderBreakdown(
  order: {
    subtotal: number | string;
    shipping: number | string;
    total: number | string;
    coupon_discount?: number | string | null;
    coupon_code?: string | null;
  },
  items: readonly { line_total: number | string | null }[],
): {
  itemsSum: number;
  memberBenefit: number;
  couponDiscount: number;
  couponCode: string | null;
  shipping: number;
  total: number;
} {
  const itemsSum = items.reduce((s, it) => s + Number(it.line_total ?? 0), 0);
  const cd = Number(order.coupon_discount ?? 0);
  const couponDiscount = Number.isFinite(cd) && cd > 0 ? cd : 0;
  const member = itemsSum - Number(order.subtotal) - couponDiscount;
  return {
    itemsSum,
    memberBenefit: Number.isFinite(member) && member > 0 ? member : 0,
    couponDiscount,
    couponCode: order.coupon_code || null,
    shipping: Number(order.shipping),
    total: Number(order.total),
  };
}

const shekels = (n: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);

/** "10% הנחה", "₪50 הנחה", "10% הנחה + משלוח חינם", "משלוח חינם". */
export function describeCoupon(
  t: Pick<CouponTerms, "discountType" | "discountValue" | "freeShipping">,
): string {
  const parts: string[] = [];
  if (t.discountValue > 0) {
    parts.push(
      t.discountType === "fixed"
        ? `${shekels(t.discountValue)} הנחה`
        : `${Number(t.discountValue.toFixed(2))}% הנחה`,
    );
  }
  if (t.freeShipping) parts.push("משלוח חינם");
  return parts.join(" + ");
}

/** "הקופון חל בקנייה של ₪200 ומעלה" — the hint under a code the cart does not reach yet. */
export function minimumHint(terms: CouponTerms): string {
  return terms.minOrder == null
    ? ""
    : `${COUPON_MESSAGE_PREFIX} חל בקנייה של ${shekels(terms.minOrder)} ומעלה.`;
}

// ---- CRM ------------------------------------------------------------------

export type CouponStatus = "active" | "scheduled" | "expired" | "used_up" | "disabled";

export const COUPON_STATUS_HE: Record<CouponStatus, string> = {
  active: "פעיל",
  scheduled: "מתוזמן",
  expired: "הסתיים",
  used_up: "נוצל במלואו",
  disabled: "כבוי",
};

export function couponStatus(
  r: Pick<CouponRecord, "is_active" | "starts_at" | "ends_at" | "max_uses">,
  paidUses = 0,
  now: Date = new Date(),
): CouponStatus {
  if (!r.is_active) return "disabled";
  if (r.ends_at && new Date(r.ends_at).getTime() <= now.getTime()) return "expired";
  if (r.max_uses != null && paidUses >= r.max_uses) return "used_up";
  if (new Date(r.starts_at).getTime() > now.getTime()) return "scheduled";
  return "active";
}

/** What the CRM form sends. Dates are ISO strings or null. */
export type CouponInput = {
  code: string;
  influencer_name: string | null;
  notes: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  free_shipping: boolean;
  min_order: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  once_per_customer: boolean;
  commission_percent: number | null;
};

/**
 * What the shop owes the person behind a coupon: their percentage of the
 * coupon's paid sales (items after every discount, without shipping), in whole
 * shekels. 0 when no commission was agreed.
 */
export function commissionOwed(sales: number, percent: number | string | null | undefined): number {
  const pct = Number(percent);
  if (!Number.isFinite(sales) || sales <= 0 || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round((sales * Math.min(pct, 100)) / 100);
}

/** The form's errors in Hebrew — the same rules as the table's CHECKs. Empty = valid. */
export function couponInputErrors(i: CouponInput): string[] {
  const errors: string[] = [];
  const code = normalizeCouponCode(i.code);
  if (!isValidCouponCode(code)) {
    errors.push("קוד הקופון: 3-30 תווים — אותיות באנגלית או בעברית, ספרות, מקף או קו תחתון.");
  }
  if ((i.influencer_name ?? "").trim().length > 120) errors.push("השם ארוך מדי (עד 120 תווים).");
  if ((i.notes ?? "").length > 1000) errors.push("ההערות ארוכות מדי (עד 1000 תווים).");
  const v = Number(i.discount_value);
  if (!Number.isFinite(v) || v < 0) errors.push("גובה ההנחה חייב להיות מספר חיובי.");
  else if (i.discount_type === "percent" && v > COUPON_PERCENT_MAX)
    errors.push(`הנחה באחוזים עד ${COUPON_PERCENT_MAX}%.`);
  else if (i.discount_type === "fixed" && v > COUPON_FIXED_MAX)
    errors.push(`הנחה בשקלים עד ${shekels(COUPON_FIXED_MAX)}.`);
  else if (v === 0 && !i.free_shipping)
    errors.push("קופון צריך לתת משהו: הנחה, משלוח חינם, או שניהם.");
  if (i.min_order != null && (!Number.isFinite(i.min_order) || i.min_order <= 0))
    errors.push("סכום מינימום חייב להיות גדול מ-0, או להישאר ריק.");
  if (
    i.commission_percent != null &&
    (!Number.isFinite(i.commission_percent) ||
      i.commission_percent <= 0 ||
      i.commission_percent > 100)
  )
    errors.push("עמלה באחוזים: בין 0 ל-100, או להשאיר ריק.");
  if (
    i.max_uses != null &&
    (!Number.isInteger(i.max_uses) || i.max_uses <= 0 || i.max_uses > 1_000_000)
  )
    errors.push("מספר שימושים מרבי חייב להיות מספר שלם חיובי, או להישאר ריק.");
  const starts = i.starts_at ? new Date(i.starts_at) : null;
  const ends = i.ends_at ? new Date(i.ends_at) : null;
  if (starts && Number.isNaN(starts.getTime())) errors.push("תאריך ההתחלה לא תקין.");
  if (ends && Number.isNaN(ends.getTime())) errors.push("תאריך הסיום לא תקין.");
  if (starts && ends && ends.getTime() <= starts.getTime())
    errors.push("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.");
  return errors;
}
