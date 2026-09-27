import { describe, it, expect } from "vitest";
import {
  buildPromoIndex,
  promoFor,
  promoPrice,
  priceView,
  formatPromoEnd,
  promoEndDate,
  compactPromoRows,
  indexFromPayload,
  EMPTY_PROMO_INDEX,
  type PromoRow,
} from "./promotions";
import { getEffectivePrice } from "./pricing";

const END = "2026-12-20T21:59:00Z";
const row = (p: Partial<PromoRow>): PromoRow => ({
  product_id: "prod-1",
  promotion_id: "promo-1",
  percent_off: 20,
  badge_label: null,
  ends_at: END,
  ...p,
});

describe("buildPromoIndex", () => {
  it("files store-wide and per-product rows apart", () => {
    const idx = buildPromoIndex([
      row({ product_id: null, promotion_id: "all", percent_off: "5.00" }),
      row({
        product_id: "a",
        promotion_id: "cat",
        percent_off: "10.00",
        badge_label: "מבצע חנוכה",
      }),
    ]);
    expect(idx.all).toEqual({ id: "all", percentOff: 5, label: null, endsAt: END });
    expect(idx.byProduct.a).toEqual({
      id: "cat",
      percentOff: 10,
      label: "מבצע חנוכה",
      endsAt: END,
    });
  });

  it("drops rows the schema would never produce, instead of trusting them", () => {
    const idx = buildPromoIndex([
      row({ product_id: "a", percent_off: 0 }),
      row({ product_id: "b", percent_off: 95 }),
      row({ product_id: "c", percent_off: "abc" }),
    ]);
    expect(idx).toEqual(EMPTY_PROMO_INDEX);
    expect(buildPromoIndex(null)).toEqual(EMPTY_PROMO_INDEX);
  });
});

describe("promoFor — promotions never stack", () => {
  const idx = buildPromoIndex([
    row({ product_id: null, promotion_id: "all", percent_off: 10 }),
    row({ product_id: "kippa", promotion_id: "kipot", percent_off: 25 }),
    row({ product_id: "cup", promotion_id: "cups", percent_off: 5 }),
  ]);

  it("takes the higher of the product's own and the store-wide promotion", () => {
    expect(promoFor(idx, "kippa")?.id).toBe("kipot");
    expect(promoFor(idx, "cup")?.id).toBe("all");
  });

  it("falls back to the store-wide promotion, and to nothing", () => {
    expect(promoFor(idx, "other")?.id).toBe("all");
    expect(promoFor(EMPTY_PROMO_INDEX, "kippa")).toBeNull();
    expect(promoFor(EMPTY_PROMO_INDEX, undefined)).toBeNull();
  });
});

describe("promoPrice", () => {
  const promo = { id: "p", percentOff: 20, label: null, endsAt: END };

  it("takes the percentage off the charged price, rounded to whole ₪", () => {
    expect(promoPrice(100, promo)).toBe(80);
    expect(promoPrice(99, promo)).toBe(79); // 79.2
  });

  it("never touches a call-for-price (0) product, and never reaches 0", () => {
    expect(promoPrice(0, promo)).toBe(0);
    expect(promoPrice(1, { ...promo, percentOff: 70 })).toBe(1);
  });

  it("is the identity without a promotion", () => {
    expect(promoPrice(123, null)).toBe(123);
  });
});

describe("priceView — the numbers a shopper sees", () => {
  const promo = { id: "p", percentOff: 20, label: "מבצע", endsAt: END };

  it("is exactly today's price when there is no promotion", () => {
    for (const price of [0, 10, 99, 1286, 1572]) {
      const v = priceView(price, null);
      expect(v).toEqual({
        pays: getEffectivePrice(price),
        regular: getEffectivePrice(price),
        promo: null,
        pct: 0,
      });
    }
  });

  it("shows the regular price as the honest 'before', and the percent from the rounded numbers", () => {
    const v = priceView(200, promo); // regular 140 → pays 112
    expect(v).toMatchObject({ regular: 140, pays: 112, pct: 20 });
    // 15% of a ₪23 price rounds to ₪20 — that is 13% off, and 13% is what shows.
    const small = priceView(33, { ...promo, percentOff: 15 }); // regular 23
    expect(small).toMatchObject({ regular: 23, pays: 20, pct: 13 });
  });

  it("drops the promotion when rounding leaves nothing off", () => {
    const v = priceView(4, { ...promo, percentOff: 5 }); // regular 3 → 2.85 → 3
    expect(v).toEqual({ pays: 3, regular: 3, promo: null, pct: 0 });
  });

  it("leaves a call-for-price product alone", () => {
    expect(priceView(0, promo)).toEqual({ pays: 0, regular: 0, promo: null, pct: 0 });
  });
});

describe("end dates", () => {
  it("formats in Israel time", () => {
    // 21:59 UTC on the 20th is 23:59 on the 20th in Israel (winter, UTC+2).
    expect(formatPromoEnd(END)).toBe("20.12");
    expect(promoEndDate(END)).toBe("2026-12-20");
    // 22:30 UTC on the 20th is already the 21st in Israel.
    expect(promoEndDate("2026-12-20T22:30:00Z")).toBe("2026-12-21");
  });

  it("returns an empty string for a bad date rather than 'Invalid Date'", () => {
    expect(formatPromoEnd("nope")).toBe("");
    expect(promoEndDate("nope")).toBe("");
  });
});

describe("the SSR payload", () => {
  it("round-trips to the same index, one id per product", () => {
    const rows = [
      row({ product_id: null, promotion_id: "all", percent_off: 5 }),
      row({ product_id: "a", promotion_id: "cat", percent_off: 10, badge_label: "חנוכה" }),
      row({ product_id: "b", promotion_id: "cat", percent_off: 10, badge_label: "חנוכה" }),
      row({ product_id: "c", promotion_id: "one", percent_off: 25 }),
    ];
    const payload = compactPromoRows(rows);
    expect(payload.promos).toHaveLength(3);
    expect(payload.promos.find((p) => p.id === "cat")?.productIds).toEqual(["a", "b"]);
    expect(payload.promos.find((p) => p.id === "all")?.productIds).toBeNull();
    expect(indexFromPayload(payload)).toEqual(buildPromoIndex(rows));
    expect(indexFromPayload(null)).toEqual(EMPTY_PROMO_INDEX);
  });
});
