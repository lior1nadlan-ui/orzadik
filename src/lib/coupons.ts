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

/** What a coupon applies to — mirrors coupons.scope. */
export type CouponScope = "all" | "categories" | "products";

/** What a code gives — all the checkout and placeOrder price with. */
export type CouponTerms = {
  code: string;
  discountType: CouponDiscountType;
  /** Percent (0-90) or shekels (0-5000). 0 only for a free-shipping coupon. */
  discountValue: number;
  freeShipping: boolean;
  /** Minimum items amount (before the member discount), or null. */
  minOrder: number | null;
  /** What the code applies to. Optional so terms saved by an older page still read. */
  scope?: CouponScope;
  /** Whether items already priced by a promotion count. Default true. */
  applyToSaleItems?: boolean;
  /**
   * Of the cart the code was checked against, the products it covers — set by
   * the server for a categories/products scope; null/absent = every product.
   */
  eligibleProductIds?: string[] | null;
  /** Percent coupons: the most shekels it takes off one order; absent = no cap. */
  maxDiscount?: number | null;
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
  scope?: string | null;
  category_ids?: string[] | null;
  product_ids?: string[] | null;
  apply_to_sale_items?: boolean | null;
  /** A personal coupon: only an order with this (lower-case) email can use it. */
  allowed_email?: string | null;
  /** The influencer's phone, for the WhatsApp kit. CRM only. */
  influencer_phone?: string | null;
  /** Percent coupons: the most shekels off one order, or null for no cap. */
  max_discount?: number | string | null;
  /** Only for a customer with no paid order yet (by email or phone). */
  new_customers_only?: boolean | null;
};

/** Hard caps (the table's CHECK). Above the HIGH marks the CRM asks to confirm. */
export const COUPON_PERCENT_MAX = 90;
export const COUPON_FIXED_MAX = 5000;
export const COUPON_PERCENT_HIGH = 50;
export const COUPON_FIXED_HIGH = 1000;
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

export function couponScopeOf(r: Pick<CouponRecord, "scope">): CouponScope {
  return r.scope === "categories" || r.scope === "products" ? r.scope : "all";
}

/**
 * The terms a record carries, for the checkout. Never includes the id, the
 * limits or the scope's own lists — only, when given, which of the cart's
 * products the code covers.
 */
export function couponTerms(r: CouponRecord, eligibleProductIds?: string[] | null): CouponTerms {
  const min = r.min_order == null ? null : Number(r.min_order);
  const scope = couponScopeOf(r);
  const cap = r.max_discount == null ? null : Number(r.max_discount);
  return {
    code: r.code,
    discountType: r.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: Number(r.discount_value) || 0,
    freeShipping: !!r.free_shipping,
    minOrder: min != null && Number.isFinite(min) && min > 0 ? min : null,
    scope,
    applyToSaleItems: r.apply_to_sale_items !== false,
    eligibleProductIds: scope === "all" ? null : (eligibleProductIds ?? []),
    // Only a percent coupon has a cap; absent rather than null keeps older
    // terms (and the strip's stored copy) the same shape.
    ...(r.discount_type !== "fixed" && cap != null && Number.isFinite(cap) && cap > 0
      ? { maxDiscount: cap }
      : {}),
  };
}

/** One cart line as the coupon sees it. `promoted` = a promotion lowered its price. */
export type CouponLine = { productId: string; lineTotal: number; promoted: boolean };

/**
 * The part of the items amount the coupon applies to: lines of products in its
 * scope, and — unless it applies to sale items — not priced by a promotion.
 */
export function couponEligibleTotal(
  lines: readonly CouponLine[],
  terms: Pick<CouponTerms, "eligibleProductIds" | "applyToSaleItems">,
): number {
  const ids = terms.eligibleProductIds ? new Set(terms.eligibleProductIds) : null;
  return lines.reduce((s, l) => {
    if (ids && !ids.has(l.productId)) return s;
    if (terms.applyToSaleItems === false && l.promoted) return s;
    return s + (Number(l.lineTotal) || 0);
  }, 0);
}

/** Why a code cannot be used now (min order is decided against the cart, below). */
export type CouponRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "used_up"
  | "already_used"
  | "needs_email"
  | "not_for_you"
  | "not_new_customer";

export function couponRejection(
  r: CouponRecord | null,
  ctx: {
    now?: Date;
    totalUses?: number;
    customerUses?: number;
    email?: string | null;
    /** Paid orders this customer already has (customer_paid_orders), for a
     *  new-customers-only code. Unknown (no email or phone yet) = 0. */
    previousPaidOrders?: number;
  } = {},
): CouponRejection | null {
  if (!r) return "not_found";
  if (!r.is_active) return "inactive";
  const now = (ctx.now ?? new Date()).getTime();
  if (new Date(r.starts_at).getTime() > now) return "not_started";
  if (r.ends_at && new Date(r.ends_at).getTime() <= now) return "expired";
  if (r.allowed_email) {
    const email = String(ctx.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) return "needs_email";
    if (email !== r.allowed_email) return "not_for_you";
  }
  if (r.max_uses != null && (ctx.totalUses ?? 0) >= r.max_uses) return "used_up";
  if (r.once_per_customer && (ctx.customerUses ?? 0) > 0) return "already_used";
  if (r.new_customers_only && (ctx.previousPaidOrders ?? 0) > 0) return "not_new_customer";
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

/** The CRM switch "קופונים באתר" is off (site_settings.coupons_enabled). */
export const COUPONS_DISABLED_MESSAGE = "הקופונים אינם פעילים באתר כרגע.";

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
    case "needs_email":
      return "הקופון הזה אישי — מלאו קודם את כתובת האימייל בטופס, ואז החילו אותו.";
    case "not_for_you":
      return "הקופון הזה אישי ומיועד לכתובת אימייל אחרת.";
    case "not_new_customer":
      return "הקופון הזה מיועד ללקוחות חדשים בלבד, בהזמנה הראשונה.";
  }
}

/** Why checkCoupon refused a code: a rejection, the CRM switch, or the per-IP cap. */
export type CouponCheckFailure = CouponRejection | "disabled" | "rate_limited";

/**
 * A refused code that waits only on the shopper's email: a personal coupon
 * checked before the email was typed, or against another address. The checkout
 * keeps it in the box and tries it again by itself when the email changes.
 */
export function couponWaitsForEmail(reason: CouponCheckFailure | undefined): boolean {
  return reason === "needs_email" || reason === "not_for_you";
}

/**
 * Whether a refused code stays with the tab: one waiting on the email, or one
 * refused only by the per-IP cap, which passes. Any other refusal is final and
 * the code is dropped, so it stops coming back by itself.
 */
export function keepRefusedCoupon(reason: CouponCheckFailure | undefined): boolean {
  return couponWaitsForEmail(reason) || reason === "rate_limited";
}

/**
 * The checkout's line under a personal code waiting on the email (the code
 * itself is in the box above, so the line leaves it out). Null otherwise.
 */
export function waitingCouponNote(reason: CouponCheckFailure | undefined): string | null {
  if (reason === "needs_email") {
    return "זה קוד אישי. הוא יוחל מעצמו אחרי שתמלאו את כתובת האימייל שלכם.";
  }
  if (reason === "not_for_you") {
    return "זה קוד אישי שמיועד לכתובת אימייל אחרת. כדאי לבדוק את כתובת האימייל בטופס — עם הכתובת הנכונה הוא יוחל מעצמו.";
  }
  return null;
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
  terms: Pick<CouponTerms, "discountType" | "discountValue"> &
    Partial<Pick<CouponTerms, "maxDiscount">>,
  /** The amount the coupon applies to, when it is not the whole items amount. */
  base: number = itemsAfterMember,
): number {
  if (!Number.isFinite(itemsAfterMember) || itemsAfterMember <= 1) return 0;
  const b = Math.min(Number.isFinite(base) ? base : 0, itemsAfterMember);
  if (b <= 0) return 0;
  const value = Number(terms.discountValue);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const raw =
    terms.discountType === "fixed"
      ? Math.round(value)
      : Math.round((b * Math.min(value, COUPON_PERCENT_MAX)) / 100);
  // A percent coupon's cap per order ("עד ₪100"): 20% of a ₪2,500 tallit is
  // still ₪100 when the owner capped it there.
  const cap = Number(terms.maxDiscount);
  const capped =
    terms.discountType !== "fixed" && Number.isFinite(cap) && cap > 0
      ? Math.min(raw, Math.round(cap))
      : raw;
  return Math.max(0, Math.min(capped, b, itemsAfterMember - 1));
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
  /** Why a given coupon does not apply, for the checkout's hint. */
  couponIssue: "min_order" | "no_eligible_items" | null;
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
  /** The items amount the coupon applies to (couponEligibleTotal). Default: all of it. */
  eligibleTotal?: number;
}): OrderTotals {
  const { itemsTotal, isMember, fulfillment, coupon } = input;
  const memberSubtotal = applyMemberDiscount(itemsTotal, isMember);
  const eligible = Math.max(0, Math.min(input.eligibleTotal ?? itemsTotal, itemsTotal));
  const meetsMin = !!coupon && meetsCouponMinimum(itemsTotal, coupon);
  const couponIssue: OrderTotals["couponIssue"] =
    !coupon || itemsTotal <= 0
      ? null
      : !meetsMin
        ? "min_order"
        : eligible <= 0 && !coupon.freeShipping
          ? "no_eligible_items"
          : null;
  const couponApplied = !!coupon && itemsTotal > 0 && meetsMin && couponIssue === null;
  // The member's 5% applies to the eligible part too, so the coupon is worked
  // out on what those items actually cost this shopper.
  const base = applyMemberDiscount(eligible, isMember);
  const cDiscount = couponApplied && coupon ? couponDiscount(memberSubtotal, coupon, base) : 0;
  const subtotal = memberSubtotal - cDiscount;
  const fee = getShipping(subtotal, fulfillment);
  const shippingWaived = couponApplied && coupon?.freeShipping ? fee : 0;
  const shipping = fee - shippingWaived;
  return {
    itemsTotal,
    memberBenefit: itemsTotal - memberSubtotal,
    couponDiscount: cDiscount,
    couponApplied,
    couponIssue,
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
  t: Pick<CouponTerms, "discountType" | "discountValue" | "freeShipping"> &
    Partial<Pick<CouponTerms, "maxDiscount">>,
): string {
  const parts: string[] = [];
  if (t.discountValue > 0) {
    const cap = Number(t.maxDiscount);
    parts.push(
      t.discountType === "fixed"
        ? `${shekels(t.discountValue)} הנחה`
        : `${Number(t.discountValue.toFixed(2))}% הנחה` +
            (Number.isFinite(cap) && cap > 0 ? ` (עד ${shekels(cap)})` : ""),
    );
  }
  if (t.freeShipping) parts.push("משלוח חינם");
  return parts.join(" + ");
}

/**
 * The offer as a shopper reads it: "10% הנחה על מוצרים נבחרים" — the scope is
 * named only when it is not the whole shop, and sale items only when excluded.
 */
export function offerText(
  t: Pick<CouponTerms, "discountType" | "discountValue" | "freeShipping"> &
    Partial<Pick<CouponTerms, "scope" | "applyToSaleItems" | "maxDiscount">>,
): string {
  let text = describeCoupon(t);
  if (t.scope && t.scope !== "all") text += " על מוצרים נבחרים";
  if (t.applyToSaleItems === false) text += " (לא על מוצרים במבצע)";
  return text;
}

/** "הקופון חל בקנייה של ₪200 ומעלה" — the hint under a code the cart does not reach yet. */
export function minimumHint(terms: CouponTerms): string {
  return terms.minOrder == null
    ? ""
    : `${COUPON_MESSAGE_PREFIX} חל בקנייה של ${shekels(terms.minOrder)} ומעלה.`;
}

/** The hint for a code that covers none of the cart's items. */
export function noEligibleHint(terms: Pick<CouponTerms, "scope" | "applyToSaleItems">): string {
  return terms.scope && terms.scope !== "all"
    ? `${COUPON_MESSAGE_PREFIX} חל על מוצרים נבחרים, ואף אחד מהם אינו בעגלה.`
    : `${COUPON_MESSAGE_PREFIX} אינו חל על מוצרים שכבר במבצע.`;
}

/** "על כל האתר" / "על קטגוריות נבחרות" / "על מוצרים נבחרים" (+ "· לא על מוצרים במבצע"). */
export function couponScopeText(
  t: { scope?: CouponScope | string | null; applyToSaleItems?: boolean | null },
  counts?: { categories?: number; products?: number },
): string {
  const scope = t.scope === "categories" || t.scope === "products" ? t.scope : "all";
  const what =
    scope === "categories"
      ? counts?.categories
        ? `על ${counts.categories === 1 ? "קטגוריה אחת" : `${counts.categories} קטגוריות`}`
        : "על קטגוריות נבחרות"
      : scope === "products"
        ? counts?.products
          ? `על ${counts.products === 1 ? "מוצר אחד" : `${counts.products} מוצרים`}`
          : "על מוצרים נבחרים"
        : "על כל האתר";
  return t.applyToSaleItems === false ? `${what} · לא על מוצרים במבצע` : what;
}

// ---- CRM ------------------------------------------------------------------

/** Characters a generated code uses: no 0/O, 1/I/L — easy to read off a message. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * A random code, e.g. "GIFT-K7P3QX" or "M4TQ9R". `random` is injectable for
 * tests; in the app it is crypto-strong where available.
 */
export function generateCouponCode(
  prefix = "",
  length = 6,
  random: () => number = () => {
    const c = globalThis.crypto;
    if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    return Math.random();
  },
): string {
  let body = "";
  for (let i = 0; i < length; i++) {
    body += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  }
  const p = normalizeCouponCode(prefix).replace(/[^A-Z0-9\u05D0-\u05EA_-]/g, "");
  return (p ? `${p}-${body}` : body).slice(0, 30);
}

/** The WhatsApp/email text for a customer's personal coupon. */
export function personalCouponMessage(o: {
  name: string;
  code: string;
  offer: string;
  until: string | null;
  shopLink: string;
}): string {
  const first = o.name.trim().split(/\s+/)[0] || "";
  return [
    `שלום${first ? ` ${first}` : ""}, כאן אור זרוע לצדיק 🙏`,
    `הכנו עבורך קופון אישי: ${o.offer}.`,
    `הקוד: ${o.code}${o.until ? ` (בתוקף עד ${o.until})` : ""}`,
    `הקוד מוחל אוטומטית דרך הקישור: ${o.shopLink}`,
    "הקופון אישי ותקף לרכישה אחת עם כתובת האימייל שלך.",
  ].join("\n");
}

/** The WhatsApp kit an influencer gets: their code, shopping link and report. */
export function influencerKitMessage(o: {
  name: string | null;
  code: string;
  offer: string;
  shopLink: string;
  reportLink: string | null;
}): string {
  const first = (o.name ?? "").trim().split(/\s+/)[0] || "";
  return [
    `היי${first ? ` ${first}` : ""}! כאן אור זרוע לצדיק 🙏`,
    `הקוד האישי שלך: ${o.code} — ${o.offer} לעוקבים שלך.`,
    `קישור לשיתוף (הקוד מוחל לבד בקופה): ${o.shopLink}`,
    ...(o.reportLink ? [`הדוח שלך — הזמנות, מכירות ועמלה: ${o.reportLink}`] : []),
    "תודה על שיתוף הפעולה!",
  ].join("\n");
}

/** wa.me link with a prefilled message; with no phone, WhatsApp lets you pick a chat. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

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
  scope: CouponScope;
  category_ids: string[];
  product_ids: string[];
  apply_to_sale_items: boolean;
  /** The owner ticked "I mean it" for a discount above the HIGH marks. */
  confirm_high: boolean;
  /** A personal coupon's customer email, or null. */
  allowed_email?: string | null;
  influencer_phone?: string | null;
  /** Percent coupons: the most shekels off one order, or null for no cap. */
  max_discount?: number | null;
  /** Only for customers with no paid order yet. */
  new_customers_only?: boolean;
};

/**
 * Paid orders per 100 visits that came through the coupon's link, in whole
 * percent. Null with no visits yet, or when more orders than visits came in:
 * the code was also typed by hand, and the ratio would mislead.
 */
export function visitConversion(paidOrders: number, visits: number): number | null {
  if (!(visits > 0) || !(paidOrders >= 0) || paidOrders > visits) return null;
  return Math.round((paidOrders / visits) * 100);
}

/** Whether a discount is high enough to ask the owner to confirm it. */
export function isHighCouponDiscount(
  i: Pick<CouponInput, "discount_type" | "discount_value">,
): boolean {
  const v = Number(i.discount_value);
  return i.discount_type === "fixed" ? v > COUPON_FIXED_HIGH : v > COUPON_PERCENT_HIGH;
}

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
  else if (isHighCouponDiscount(i) && !i.confirm_high)
    errors.push(
      i.discount_type === "fixed"
        ? `הנחה של יותר מ-${shekels(COUPON_FIXED_HIGH)} — סמנו את האישור כדי לשמור.`
        : `הנחה של יותר מ-${COUPON_PERCENT_HIGH}% — סמנו את האישור כדי לשמור.`,
    );
  if (i.discount_type === "percent" && i.max_discount != null) {
    const cap = Number(i.max_discount);
    if (!Number.isFinite(cap) || cap < 1 || cap > COUPON_FIXED_MAX)
      errors.push(`הנחה מרבית להזמנה: בין ₪1 ל-${shekels(COUPON_FIXED_MAX)}.`);
  }
  if (i.scope === "categories" && i.category_ids.length === 0)
    errors.push("בחרו לפחות קטגוריה אחת, או החילו את הקופון על כל האתר.");
  if (i.scope === "products" && i.product_ids.length === 0)
    errors.push("בחרו לפחות מוצר אחד, או החילו את הקופון על כל האתר.");
  if (i.category_ids.length > 200 || i.product_ids.length > 500)
    errors.push("יותר מדי קטגוריות או מוצרים בקופון אחד.");
  if (i.allowed_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.allowed_email.trim()))
    errors.push("כתובת האימייל של הלקוח אינה תקינה.");
  if (
    i.influencer_phone &&
    (i.influencer_phone.trim().length < 3 || i.influencer_phone.trim().length > 30)
  )
    errors.push("מספר הטלפון אינו תקין.");
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

// ---- Influencer report (/partner/<token>) and commission payments ---------

/** A paid order as the influencer's report sees it: money and time, no customer. */
export type PartnerOrder = {
  created_at: string;
  subtotal: number | string;
};

export type PartnerMonth = { month: string; orders: number; sales: number; commission: number };

const monthKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
});

/** "2026-11" — the Israel-time month an order belongs to. */
export function monthKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = monthKeyFmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return y && m ? `${y}-${m}` : null;
}

/** Paid orders by Israel-time month, newest first, with each month's commission. */
export function partnerMonths(
  orders: readonly PartnerOrder[],
  commissionPercent: number | string | null | undefined,
  limit = 12,
): PartnerMonth[] {
  const by = new Map<string, { orders: number; sales: number }>();
  for (const o of orders) {
    const key = monthKey(o.created_at);
    if (!key) continue;
    const cur = by.get(key) ?? { orders: 0, sales: 0 };
    cur.orders += 1;
    cur.sales += Number(o.subtotal) || 0;
    by.set(key, cur);
  }
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .slice(0, limit)
    .map(([month, v]) => ({
      month,
      orders: v.orders,
      sales: v.sales,
      commission: commissionOwed(v.sales, commissionPercent),
    }));
}

/** "2026-11" → "נובמבר 2026". */
export function hebrewMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}

/** Commission still owed (negative = paid in advance), to the agora. */
export function payoutBalance(commission: number, paidOut: number): number {
  return Math.round((commission - paidOut) * 100) / 100;
}

/** Shape of a partner link's secret: 32 lowercase hex characters (128 bits). */
export const PARTNER_TOKEN_RE = /^[a-f0-9]{32}$/;
