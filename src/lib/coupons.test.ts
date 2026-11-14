import { describe, it, expect } from "vitest";
import {
  commissionOwed,
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
    expect(couponDiscount(100, pct(90))).toBe(50);
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
  };
  it("accepts a valid coupon (the code is normalised first)", () => {
    expect(couponInputErrors(valid)).toEqual([]);
  });
  it("rejects what the database would", () => {
    expect(couponInputErrors({ ...valid, code: "a!" })).toHaveLength(1);
    expect(couponInputErrors({ ...valid, discount_value: 60 })).toHaveLength(1);
    expect(
      couponInputErrors({ ...valid, discount_type: "fixed", discount_value: 2500 }),
    ).toHaveLength(1);
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
