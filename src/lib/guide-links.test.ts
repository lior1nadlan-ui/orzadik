import { describe, it, expect } from "vitest";
import {
  GUIDES,
  CATEGORY_GUIDES,
  GUIDE_CATEGORIES,
  GUIDE_CLUSTERS,
  GUIDE_OCCASIONS,
  GUIDES_WITHOUT_OCCASION,
  relatedGuides,
  orderByTopic,
  occasionsForGuide,
  guidesForCategory,
  guidesForCategories,
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
      if (!GUIDES_WITHOUT_OCCASION.has(slug))
        expect(occasionsForGuide(slug).length, slug).toBeGreaterThan(0);
      expect(guideFaq(slug)?.length ?? 0, slug).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("guides without an occasion", () => {
  it("are real guides that really have none", () => {
    for (const slug of GUIDES_WITHOUT_OCCASION) {
      expect(GUIDES[slug], slug).toBeDefined();
      expect(occasionsForGuide(slug), slug).toEqual([]);
    }
  });
});

describe("the guides linked 2026-09-27", () => {
  it("reach their shelves from the category pages", () => {
    expect(guidesForCategory("chalaka-set")[0]?.slug).toBe("set-chalaka-madrich");
    expect(guidesForCategory("karit-labrit")[0]?.slug).toBe("karit-labrit-madrich");
    expect(guidesForCategory("talitot").map((g) => g.slug)).toContain("mechir-talit-bar-mitzva");
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

describe("the blessings shelf", () => {
  // 301 products under one parent, with no guide until 2026-09-27. The parent
  // entry has to reach the children on both paths: the category page climbs
  // parent_slug, the PDP reads the product's own slugs (the parent included).
  it("reaches ברכות and חמסות from the parent entry", () => {
    for (const child of ["blessings", "chamsot", "segulot"]) {
      expect(guidesForCategory(child, "brachot-chamsot-segulot")[0]?.slug, child).toBe(
        "birkat-habait-guide",
      );
    }
    expect(guidesForCategories(["blessings", "brachot-chamsot-segulot"])[0]?.slug).toBe(
      "birkat-habait-guide",
    );
  });
});
