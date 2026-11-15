import { describe, expect, it } from "vitest";
import { budgetByKey, filterGifts, giftOccasions, GIFT_BUDGETS } from "@/lib/gift-finder";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
import { PERSONALIZABLE_CATEGORY_SLUGS } from "@/lib/personalization";

describe("giftOccasions", () => {
  it("offers every occasion collection, once", () => {
    const all = giftOccasions(Date.parse("2026-07-01T12:00:00Z"));
    expect(all).toHaveLength(OCCASION_COLLECTIONS.length);
    expect(new Set(all.map((o) => o.collection.slug)).size).toBe(OCCASION_COLLECTIONS.length);
    expect(all.every((o) => o.label.length > 0)).toBe(true);
  });

  it("puts the coming holiday first, with its season label", () => {
    // Hanukkah 2026 starts on the evening of 4.12.
    const [first] = giftOccasions(Date.parse("2026-11-15T12:00:00Z"));
    expect(first.collection.slug).toBe("matanot-hanukkah");
    expect(first.label).toBe("חנוכה");
    expect(first.seasonLabel).toBeTruthy();
  });
});

describe("budgets", () => {
  it("falls back to 'any' for an unknown key", () => {
    expect(budgetByKey("nope").key).toBe("any");
    expect(budgetByKey(undefined).key).toBe("any");
    expect(budgetByKey("150-300").lo).toBe(150);
  });

  it("writes ranges with an ASCII hyphen (an en dash flips in RTL)", () => {
    expect(GIFT_BUDGETS.some((b) => /–/.test(b.label))).toBe(false);
  });
});

describe("filterGifts", () => {
  const nameShelf = [...PERSONALIZABLE_CATEGORY_SLUGS][0];
  // Catalog prices; the shopper pays 70% (SITE_DISCOUNT): 140, 280, 700, none.
  const rows = [
    { slug: "a", price: 200, family: "other-shelf" },
    { slug: "b", price: 400, family: nameShelf },
    { slug: "c", price: 1000, family: "other-shelf" },
    { slug: "d", price: 0, family: nameShelf },
  ];

  it("filters by the price the shopper pays", () => {
    expect(filterGifts(rows, budgetByKey("u150"), false).map((r) => r.slug)).toEqual(["a"]);
    expect(filterGifts(rows, budgetByKey("150-300"), false).map((r) => r.slug)).toEqual(["b"]);
    expect(filterGifts(rows, budgetByKey("600+"), false).map((r) => r.slug)).toEqual(["c"]);
  });

  it("keeps a product without a price only when the budget does not matter", () => {
    expect(filterGifts(rows, budgetByKey("any"), false)).toHaveLength(4);
    expect(filterGifts(rows, budgetByKey("u150"), false).some((r) => r.slug === "d")).toBe(false);
  });

  it("keeps only shelves that take a name, when a name is wanted", () => {
    expect(filterGifts(rows, budgetByKey("any"), true).map((r) => r.slug)).toEqual(["b", "d"]);
  });
});
