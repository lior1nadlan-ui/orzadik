import { describe, it, expect } from "vitest";
import {
  GUIDES,
  CATEGORY_GUIDES,
  GUIDE_CATEGORIES,
  GUIDE_CLUSTERS,
  GUIDE_OCCASIONS,
  relatedGuides,
  orderByTopic,
  occasionsForGuide,
} from "./guide-links";
import { guideFaq } from "./guide-faq";

describe("guide registry", () => {
  it("puts every guide in exactly one cluster", () => {
    for (const slug of Object.keys(GUIDES)) {
      const n = GUIDE_CLUSTERS.filter((c) => c.includes(slug)).length;
      expect(n, slug).toBe(1);
    }
  });

  it("only links to guides that exist", () => {
    for (const list of Object.values(CATEGORY_GUIDES)) {
      for (const g of list) expect(GUIDES[g], g).toBeDefined();
    }
    for (const g of [...Object.keys(GUIDE_CATEGORIES), ...Object.keys(GUIDE_OCCASIONS)]) {
      expect(GUIDES[g], g).toBeDefined();
    }
  });

  it("gives every guide a shelf, an occasion that resolves, and an FAQ", () => {
    for (const slug of Object.keys(GUIDES)) {
      expect(GUIDE_CATEGORIES[slug]?.length ?? 0, slug).toBeGreaterThan(0);
      expect(occasionsForGuide(slug).length, slug).toBeGreaterThan(0);
      expect(guideFaq(slug)?.length ?? 0, slug).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("related guides", () => {
  it("offers the nearest topics first", () => {
    expect(
      relatedGuides("kiddush-cup-guide")
        .map((g) => g.slug)
        .slice(0, 2),
    ).toEqual(["havdalah-guide", "pamotim-guide"]);
    expect(
      relatedGuides("challah-guide")
        .map((g) => g.slug)
        .slice(0, 2),
    ).toEqual(["pamotim-guide", "birchon-guide"]);
  });

  it("orders 'more articles' by topic, then keeps the given (newest-first) order", () => {
    const newestFirst = [
      { slug: "kippa-guide" },
      { slug: "natla-guide" },
      { slug: "pamotim-guide" },
      { slug: "kiddush-cup-guide" },
    ];
    expect(orderByTopic("havdalah-guide", newestFirst).map((a) => a.slug)).toEqual([
      "kiddush-cup-guide",
      "pamotim-guide",
      "kippa-guide",
      "natla-guide",
    ]);
    // An article outside every cluster keeps the order it was given.
    expect(orderByTopic("some-news-post", newestFirst)).toEqual(newestFirst);
  });
});
