import { describe, it, expect } from "vitest";
import {
  commissionOwed,
  couponEligibleTotal,
  couponScopeText,
  isHighCouponDiscount,
  noEligibleHint,
  hebrewMonth,
  monthKey,
  partnerMonths,
  payoutBalance,
  computeOrderTotals,
  couponDiscount,
  couponInputErrors,
  couponRejection,
  couponRejectionMessage,
  couponStatus,
  couponTerms,
  describeCoupon,
  isValidCouponCode,
  latinFromHebrewKeyboard,
  minimumHint,
  normalizeCouponCode,
  orderBreakdown,
  COUPON_MESSAGE_PREFIX,
  type CouponInput,
  type CouponRecord,
  type CouponTerms,
} from "@/lib/coupons";
import { applyMemberDiscount, getShipping, SHIPPING_FLAT } from "@/lib/pricing";

const NOW = new Date("2026-11-14T12:00:00Z");

const record = (over: Partial<CouponRecord> = {}): CouponRecord => ({
  id: "c1",
  code: "DANA10",
  influencer_name: "דנה",
  notes: null,
  discount_type: "percent",
  discount_value: "10.00",
  free_shipping: false,
  min_order: null,
  starts_at: "2026-11-01T00:00:00Z",
  ends_at: null,
  max_uses: null,
  once_per_customer: false,
  is_active: true,
  ...over,
});

const pct = (v: number, over: Partial<CouponTerms> = {}): CouponTerms => ({
  code: "X",
  discountType: "percent",
  discountValue: v,
  freeShipping: false,
  minOrder: null,
  ...over,
});

describe("normalizeCouponCode / isValidCouponCode", () => {
  it("upper-cases and drops spaces and direction marks", () => {
    expect(normalizeCouponCode("  dana 10 ")).toBe("DANA10");
    expect(normalizeCouponCode("‏dana10‎")).toBe("DANA10");
  });
  it("accepts Latin, Hebrew, digits, dash and underscore, 3-30 long", () => {
    expect(isValidCouponCode("DANA10")).toBe(true);
    expect(isValidCouponCode("דנה10")).toBe(true);
    expect(isValidCouponCode("VIP_2026-A")).toBe(true);
    expect(isValidCouponCode("AB")).toBe(false);
    expect(isValidCouponCode("A".repeat(31))).toBe(false);
    expect(isValidCouponCode("DANA!")).toBe(false);
    expect(isValidCouponCode("dana10")).toBe(false);
  });
});

describe("latinFromHebrewKeyboard", () => {
  it("reads a Latin code typed on a Hebrew keyboard", () => {
    expect(latinFromHebrewKeyboard("גשמש10")).toBe("DANA10");
  });
  it("is null for Latin text or a key with no Latin letter", () => {
    expect(latinFromHebrewKeyboard("DANA10")).toBeNull();
    expect(latinFromHebrewKeyboard("שףף")).toBeNull();
  });
});

describe("couponTerms", () => {
  it("parses numerics and hides nothing it needs", () => {
    expect(couponTerms(record({ min_order: "200.00" }))).toEqual({
      code: "DANA10",
      discountType: "percent",
      discountValue: 10,
      freeShipping: false,
      minOrder: 200,
      scope: "all",
      applyToSaleItems: true,
      eligibleProductIds: null,
    });
  });
  it("treats an unknown type as percent and a 0 minimum as none", () => {
    const t = couponTerms(record({ discount_type: "weird", min_order: 0 }));
    expect(t.discountType).toBe("percent");
    expect(t.minOrder).toBeNull();
  });
});

describe("couponRejection", () => {
  it("passes a live coupon", () => {
    expect(couponRejection(record(), { now: NOW })).toBeNull();
  });
  it("names each reason", () => {
    expect(couponRejection(null)).toBe("not_found");
    expect(couponRejection(record({ is_active: false }), { now: NOW })).toBe("inactive");
    expect(couponRejection(record({ starts_at: "2026-12-01T00:00:00Z" }), { now: NOW })).toBe(
      "not_started",
    );
    expect(couponRejection(record({ ends_at: "2026-11-14T11:59:00Z" }), { now: NOW })).toBe(
      "expired",
    );
    expect(couponRejection(record({ max_uses: 3 }), { now: NOW, totalUses: 3 })).toBe("used_up");
    expect(couponRejection(record({ max_uses: 3 }), { now: NOW, totalUses: 2 })).toBeNull();
    expect(
      couponRejection(record({ once_per_customer: true }), { now: NOW, customerUses: 1 }),
    ).toBe("already_used");
  });
  it("every message starts with the prefix the checkout keys on", () => {
    for (const r of [
      "not_found",
      "inactive",
      "not_started",
      "expired",
      "used_up",
      "already_used",
    ] as const) {
      expect(couponRejectionMessage(r).startsWith(COUPON_MESSAGE_PREFIX)).toBe(true);
    }
    expect(minimumHint(pct(10, { minOrder: 200 })).startsWith(COUPON_MESSAGE_PREFIX)).toBe(true);
  });
});

describe("couponDiscount", () => {
  it("rounds a percentage to whole shekels", () => {
    expect(couponDiscount(333, pct(10))).toBe(33);
    expect(couponDiscount(335, pct(10))).toBe(34);
  });
  it("takes a fixed amount, leaving at least ₪1 to pay", () => {
    expect(couponDiscount(300, { discountType: "fixed", discountValue: 50 })).toBe(50);
    expect(couponDiscount(40, { discountType: "fixed", discountValue: 50 })).toBe(39);
  });
  it("gives nothing on an empty cart or a zero value, and caps a percent at 50", () => {
    expect(couponDiscount(0, pct(10))).toBe(0);
    expect(couponDiscount(1, pct(10))).toBe(0);
    expect(couponDiscount(100, pct(0))).toBe(0);
    expect(couponDiscount(100, pct(95))).toBe(90);
  });
});

describe("computeOrderTotals", () => {
  it("without a coupon is exactly the old math", () => {
    for (const isMember of [false, true]) {
      for (const fulfillment of ["delivery", "pickup"] as const) {
        const t = computeOrderTotals({ itemsTotal: 437, isMember, fulfillment, coupon: null });
        const sub = applyMemberDiscount(437, isMember);
        expect(t.subtotal).toBe(sub);
        expect(t.shipping).toBe(getShipping(sub, fulfillment));
        expect(t.total).toBe(sub + getShipping(sub, fulfillment));
        expect(t.couponApplied).toBe(false);
        expect(t.couponDiscount).toBe(0);
      }
    }
  });
  it("takes the coupon off after the member discount, never off shipping", () => {
    const t = computeOrderTotals({
      itemsTotal: 400,
      isMember: true,
      fulfillment: "delivery",
      coupon: pct(10),
    });
    expect(t.memberBenefit).toBe(20); // 400 → 380
    expect(t.couponDiscount).toBe(38); // 10% of 380
    expect(t.subtotal).toBe(342);
    expect(t.shipping).toBe(SHIPPING_FLAT);
    expect(t.total).toBe(342 + SHIPPING_FLAT);
    expect(t.couponApplied).toBe(true);
  });
  it("does not apply below the minimum", () => {
    const t = computeOrderTotals({
      itemsTotal: 150,
      isMember: false,
      fulfillment: "delivery",
      coupon: pct(10, { minOrder: 200 }),
    });
    expect(t.couponApplied).toBe(false);
    expect(t.couponDiscount).toBe(0);
    expect(t.total).toBe(150 + SHIPPING_FLAT);
  });
  it("waives delivery for a free-shipping coupon, and has nothing to waive on pickup", () => {
    const free = pct(0, { freeShipping: true });
    const d = computeOrderTotals({
      itemsTotal: 200,
      isMember: false,
      fulfillment: "delivery",
      coupon: free,
    });
    expect(d.shipping).toBe(0);
    expect(d.shippingWaived).toBe(SHIPPING_FLAT);
    expect(d.total).toBe(200);
    const p = computeOrderTotals({
      itemsTotal: 200,
      isMember: false,
      fulfillment: "pickup",
      coupon: free,
    });
    expect(p.shippingWaived).toBe(0);
    expect(p.couponApplied).toBe(true);
  });
  it("never applies to an empty cart", () => {
    const t = computeOrderTotals({
      itemsTotal: 0,
      isMember: false,
      fulfillment: "delivery",
      coupon: pct(10),
    });
    expect(t.couponApplied).toBe(false);
    expect(t.total).toBe(0);
  });
});

describe("orderBreakdown", () => {
  const items = [{ line_total: 300 }, { line_total: "100" }];
  it("splits the member's benefit from the coupon's shekels", () => {
    // 400 → member 380 → coupon 38 → subtotal 342
    const b = orderBreakdown(
      { subtotal: 342, shipping: 37, total: 379, coupon_discount: "38", coupon_code: "DANA10" },
      items,
    );
    expect(b).toEqual({
      itemsSum: 400,
      memberBenefit: 20,
      couponDiscount: 38,
      couponCode: "DANA10",
      shipping: 37,
      total: 379,
    });
    expect(b.itemsSum - b.memberBenefit - b.couponDiscount + b.shipping).toBe(b.total);
  });
  it("reads an order from before coupons", () => {
    const b = orderBreakdown({ subtotal: 380, shipping: 37, total: 417 }, items);
    expect(b.memberBenefit).toBe(20);
    expect(b.couponDiscount).toBe(0);
    expect(b.couponCode).toBeNull();
  });
});

describe("describeCoupon", () => {
  it("says what the code gives", () => {
    expect(describeCoupon(pct(10))).toBe("10% הנחה");
    expect(describeCoupon(pct(12.5, { freeShipping: true }))).toBe("12.5% הנחה + משלוח חינם");
    expect(describeCoupon(pct(0, { freeShipping: true }))).toBe("משלוח חינם");
    expect(
      describeCoupon({ discountType: "fixed", discountValue: 50, freeShipping: false }),
    ).toMatch(/50.*הנחה/);
  });
});

describe("couponStatus", () => {
  it("orders the states the CRM shows", () => {
    expect(couponStatus(record(), 0, NOW)).toBe("active");
    expect(couponStatus(record({ is_active: false }), 0, NOW)).toBe("disabled");
    expect(couponStatus(record({ ends_at: "2026-11-01T01:00:00Z" }), 0, NOW)).toBe("expired");
    expect(couponStatus(record({ max_uses: 2 }), 2, NOW)).toBe("used_up");
    expect(couponStatus(record({ starts_at: "2026-12-01T00:00:00Z" }), 0, NOW)).toBe("scheduled");
  });
});

describe("commissionOwed", () => {
  it("is the agreed share of the paid sales, in whole shekels", () => {
    expect(commissionOwed(2450, 10)).toBe(245);
    expect(commissionOwed(999, "12.5")).toBe(125);
  });
  it("is 0 without a commission or sales", () => {
    expect(commissionOwed(2450, null)).toBe(0);
    expect(commissionOwed(0, 10)).toBe(0);
    expect(commissionOwed(100, 0)).toBe(0);
  });
});

describe("couponInputErrors", () => {
  const valid: CouponInput = {
    code: "dana10",
    influencer_name: "דנה",
    notes: null,
    discount_type: "percent",
    discount_value: 10,
    free_shipping: false,
    min_order: null,
    starts_at: null,
    ends_at: null,
    max_uses: null,
    once_per_customer: false,
    commission_percent: null,
    scope: "all",
    category_ids: [],
    product_ids: [],
    apply_to_sale_items: true,
    confirm_high: false,
  };
  it("accepts a valid coupon (the code is normalised first)", () => {
    expect(couponInputErrors(valid)).toEqual([]);
  });
  it("rejects what the database would", () => {
    expect(couponInputErrors({ ...valid, code: "a!" })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, discount_value: 95 })).toHaveLength(1);
    // Above 50% only with the explicit confirmation.
    expect(couponInputErrors({ ...valid, discount_value: 60 })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, discount_value: 60, confirm_high: true })).toEqual([]);
    expect(couponInputErrors({ ...valid, scope: "categories" })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, scope: "products", product_ids: ["p1"] })).toEqual([]);
    expect(
      couponInputErrors({ ...valid, discount_type: "fixed", discount_value: 6000 }),
    ).toHaveLength(1);
    expect(
      couponInputErrors({
        ...valid,
        discount_type: "fixed",
        discount_value: 2500,
        confirm_high: true,
      }),
    ).toEqual([]);
    expect(couponInputErrors({ ...valid, discount_value: 0 })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, discount_value: 0, free_shipping: true })).toEqual([]);
    expect(couponInputErrors({ ...valid, min_order: 0 })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, max_uses: 1.5 })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, commission_percent: 0 })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, commission_percent: 120 })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, commission_percent: 12.5 })).toEqual([]);
    expect(
      couponInputErrors({
        ...valid,
        starts_at: "2026-12-01T00:00:00Z",
        ends_at: "2026-11-01T00:00:00Z",
      }),
    ).toHaveLength(1);
  });
});

describe("influencer report helpers", () => {
  it("files an order under its Israel-time month", () => {
    // 22:30 UTC on 31 Oct is already 1 Nov in Israel (UTC+2).
    expect(monthKey("2026-10-31T22:30:00Z")).toBe("2026-11");
    expect(monthKey("2026-10-31T21:30:00Z")).toBe("2026-10");
    expect(monthKey("not a date")).toBeNull();
  });
  it("groups paid orders by month, newest first, with the commission", () => {
    const months = partnerMonths(
      [
        { created_at: "2026-10-05T10:00:00Z", subtotal: 100 },
        { created_at: "2026-11-02T10:00:00Z", subtotal: "250" },
        { created_at: "2026-11-20T10:00:00Z", subtotal: 150 },
      ],
      10,
    );
    expect(months).toEqual([
      { month: "2026-11", orders: 2, sales: 400, commission: 40 },
      { month: "2026-10", orders: 1, sales: 100, commission: 10 },
    ]);
    expect(partnerMonths([], 10)).toEqual([]);
  });
  it("names the month in Hebrew", () => {
    expect(hebrewMonth("2026-11")).toMatch(/נובמבר.*2026/);
  });
  it("works out the balance to the agora", () => {
    expect(payoutBalance(245, 200)).toBe(45);
    expect(payoutBalance(245, 300)).toBe(-55);
    expect(payoutBalance(34.2, 0.1)).toBe(34.1);
  });
});

describe("coupon scope", () => {
  const lines = [
    { productId: "tallit", lineTotal: 300, promoted: false },
    { productId: "kippa", lineTotal: 100, promoted: true },
    { productId: "siddur", lineTotal: 50, promoted: false },
  ];
  it("adds up the lines the coupon covers", () => {
    expect(couponEligibleTotal(lines, { eligibleProductIds: null, applyToSaleItems: true })).toBe(
      450,
    );
    expect(couponEligibleTotal(lines, { eligibleProductIds: null, applyToSaleItems: false })).toBe(
      350,
    );
    expect(
      couponEligibleTotal(lines, {
        eligibleProductIds: ["tallit", "kippa"],
        applyToSaleItems: true,
      }),
    ).toBe(400);
    expect(
      couponEligibleTotal(lines, { eligibleProductIds: ["kippa"], applyToSaleItems: false }),
    ).toBe(0);
  });
  it("takes the coupon off the eligible part only", () => {
    const t = computeOrderTotals({
      itemsTotal: 450,
      eligibleTotal: 300,
      isMember: false,
      fulfillment: "delivery",
      coupon: pct(10),
    });
    expect(t.couponDiscount).toBe(30);
    expect(t.subtotal).toBe(420);
    expect(t.couponIssue).toBeNull();
  });
  it("applies the member's 5% to the eligible part before the coupon", () => {
    const t = computeOrderTotals({
      itemsTotal: 400,
      eligibleTotal: 200,
      isMember: true,
      fulfillment: "pickup",
      coupon: pct(10),
    });
    // member: 400 → 380; eligible 200 → 190; 10% of 190 = 19
    expect(t.couponDiscount).toBe(19);
    expect(t.subtotal).toBe(361);
  });
  it("caps a fixed coupon at the eligible part", () => {
    const t = computeOrderTotals({
      itemsTotal: 500,
      eligibleTotal: 40,
      isMember: false,
      fulfillment: "pickup",
      coupon: { ...pct(0), discountType: "fixed", discountValue: 100 },
    });
    expect(t.couponDiscount).toBe(40);
  });
  it("says why a coupon with nothing to cover does not apply", () => {
    const t = computeOrderTotals({
      itemsTotal: 450,
      eligibleTotal: 0,
      isMember: false,
      fulfillment: "delivery",
      coupon: pct(10, { scope: "products" }),
    });
    expect(t.couponApplied).toBe(false);
    expect(t.couponIssue).toBe("no_eligible_items");
    expect(noEligibleHint({ scope: "products" }).startsWith(COUPON_MESSAGE_PREFIX)).toBe(true);
    // A free-shipping coupon still gives its free shipping.
    const free = computeOrderTotals({
      itemsTotal: 450,
      eligibleTotal: 0,
      isMember: false,
      fulfillment: "delivery",
      coupon: pct(0, { freeShipping: true, scope: "products" }),
    });
    expect(free.couponApplied).toBe(true);
    expect(free.shipping).toBe(0);
  });
  it("reports the minimum before anything else", () => {
    const t = computeOrderTotals({
      itemsTotal: 100,
      eligibleTotal: 0,
      isMember: false,
      fulfillment: "delivery",
      coupon: pct(10, { minOrder: 200 }),
    });
    expect(t.couponIssue).toBe("min_order");
  });
  it("describes the scope", () => {
    expect(couponScopeText({ scope: "all" })).toBe("על כל האתר");
    expect(couponScopeText({ scope: "categories" }, { categories: 3 })).toBe("על 3 קטגוריות");
    expect(couponScopeText({ scope: "products", applyToSaleItems: false }, { products: 1 })).toBe(
      "על מוצר אחד · לא על מוצרים במבצע",
    );
  });
  it("flags high discounts for confirmation", () => {
    expect(isHighCouponDiscount({ discount_type: "percent", discount_value: 50 })).toBe(false);
    expect(isHighCouponDiscount({ discount_type: "percent", discount_value: 51 })).toBe(true);
    expect(isHighCouponDiscount({ discount_type: "fixed", discount_value: 1001 })).toBe(true);
  });
  it("couponTerms exposes only the cart's covered products", () => {
    const t = couponTerms(
      record({ scope: "categories", category_ids: ["c1"], apply_to_sale_items: false }),
      ["p1"],
    );
    expect(t.scope).toBe("categories");
    expect(t.applyToSaleItems).toBe(false);
    expect(t.eligibleProductIds).toEqual(["p1"]);
    expect(couponTerms(record()).eligibleProductIds).toBeNull();
  });
});
