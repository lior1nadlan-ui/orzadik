import { describe, it, expect } from "vitest";
import {
  SITE_DISCOUNT,
  MEMBER_DISCOUNT,
  SHIPPING_FLAT,
  getEffectivePrice,
  getDisplayOriginal,
  getDiscountPct,
  applyMemberDiscount,
  getShipping,
  isSellablePrice,
} from "./pricing";

describe("getEffectivePrice", () => {
  it("applies the 30% site discount and rounds to whole ₪", () => {
    expect(getEffectivePrice(100)).toBe(70);
    expect(getEffectivePrice(199)).toBe(Math.round(199 * 0.7)); // 139
    expect(getEffectivePrice(49.9)).toBe(Math.round(49.9 * 0.7)); // 35
  });

  it("returns 0 for a 0 (call-for-price) product", () => {
    expect(getEffectivePrice(0)).toBe(0);
  });

  it("never returns a fractional value", () => {
    for (const p of [17, 33, 88, 123, 777]) {
      expect(Number.isInteger(getEffectivePrice(p))).toBe(true);
    }
  });
});

describe("isSellablePrice — a 0 price is missing data, not an offer", () => {
  it("rejects 0, which is what made ₪0 orders possible", () => {
    // Seven active, in-stock rows carried price 0.00. Every other guard in the
    // checkout passed them, the line total came to 0, and because getShipping
    // waives the fee on a 0 subtotal the whole order — delivery included — came
    // to nothing.
    expect(isSellablePrice(0)).toBe(false);
    expect(getEffectivePrice(0)).toBe(0);
    expect(getShipping(0)).toBe(0);
  });

  it("rejects negatives and non-finite values", () => {
    // Number(null) is 0 but Number(undefined) is NaN, and NaN spreads through
    // line totals without ever throwing.
    expect(isSellablePrice(-1)).toBe(false);
    expect(isSellablePrice(NaN)).toBe(false);
    expect(isSellablePrice(Infinity)).toBe(false);
  });

  it("accepts every real catalog price", () => {
    for (const p of [1, 37, 188, 1150, 2000]) {
      expect(isSellablePrice(p)).toBe(true);
    }
  });
});

describe("getDisplayOriginal — honest strike-through (no fabricated 'before' price)", () => {
  it("shows the recorded former price ONLY when it is above the paid price", () => {
    // sale_price 120 is a genuine former price above effective 70 -> shown
    expect(getDisplayOriginal(100, 120)).toBe(120);
  });

  it("shows NO discount when there is no recorded former price", () => {
    // no sale_price -> returns the effective price itself (callers hide strike)
    expect(getDisplayOriginal(100)).toBe(getEffectivePrice(100)); // 70
    expect(getDisplayOriginal(100, null)).toBe(getEffectivePrice(100));
  });

  it("ignores a former price that is not actually higher than what's paid", () => {
    // sale_price 50 < effective 70 -> not a real discount, no strike
    expect(getDisplayOriginal(100, 50)).toBe(getEffectivePrice(100));
  });
});

describe("getDiscountPct", () => {
  it("computes the real percentage vs. the recorded former price", () => {
    // paid 70 vs former 120 -> 1 - 70/120 = 41.7% -> 42
    expect(getDiscountPct(100, 120)).toBe(42);
  });
  it("is 0 when there is no genuine former price", () => {
    expect(getDiscountPct(100)).toBe(0);
    expect(getDiscountPct(100, 50)).toBe(0);
  });
});

describe("applyMemberDiscount", () => {
  it("takes an extra 5% for members and rounds", () => {
    expect(applyMemberDiscount(100, true)).toBe(95);
    expect(applyMemberDiscount(199, true)).toBe(Math.round(199 * 0.95)); // 189
  });

  it("leaves non-members untouched", () => {
    expect(applyMemberDiscount(100, false)).toBe(100);
    expect(applyMemberDiscount(0, false)).toBe(0);
  });
});

describe("getShipping", () => {
  it("charges a flat fee for a non-empty cart", () => {
    expect(getShipping(70)).toBe(SHIPPING_FLAT);
    expect(getShipping(1)).toBe(SHIPPING_FLAT);
  });

  it("charges nothing for an empty/zero cart", () => {
    expect(getShipping(0)).toBe(0);
    expect(getShipping(-5)).toBe(0);
  });
});

describe("constants sanity", () => {
  it("holds the agreed business values", () => {
    expect(SITE_DISCOUNT).toBe(0.3);
    expect(MEMBER_DISCOUNT).toBe(0.05);
    expect(SHIPPING_FLAT).toBe(37);
  });
});

/**
 * Guards the core invariant this shared module exists to protect: the client
 * cart total and the server order total MUST agree for identical inputs, since
 * both now compute from this one module. This mirrors the server math in
 * placeOrder (checkout.functions.ts) and the client math in cart.tsx.
 */
describe("client/server total agreement", () => {
  function computeOrderTotal(
    items: { price: number; quantity: number }[],
    isMember: boolean,
  ) {
    const rawSubtotal = items.reduce(
      (s, i) => s + getEffectivePrice(i.price) * i.quantity,
      0,
    );
    const subtotal = applyMemberDiscount(rawSubtotal, isMember);
    const shipping = getShipping(subtotal);
    return { subtotal, shipping, total: subtotal + shipping };
  }

  it("matches a two-line guest order", () => {
    const items = [
      { price: 100, quantity: 2 }, // 70*2 = 140
      { price: 199, quantity: 1 }, // 139
    ];
    const r = computeOrderTotal(items, false);
    expect(r.subtotal).toBe(140 + 139); // 279
    expect(r.shipping).toBe(37);
    expect(r.total).toBe(316);
  });

  it("applies member discount then shipping", () => {
    const items = [{ price: 100, quantity: 1 }]; // effective 70
    const r = computeOrderTotal(items, true);
    expect(r.subtotal).toBe(applyMemberDiscount(70, true)); // 67 (round(70*0.95)=67)
    expect(r.total).toBe(r.subtotal + 37);
  });

  it("charges no shipping for an empty cart", () => {
    const r = computeOrderTotal([], false);
    expect(r).toEqual({ subtotal: 0, shipping: 0, total: 0 });
  });
});
