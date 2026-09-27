import { describe, it, expect } from "vitest";
import { MERGED_CATEGORY_REDIRECTS } from "./category-redirects";
import {
  PERSONALIZABLE_CATEGORY_SLUGS,
  EMBROIDERY_ONLY_CATEGORY_SLUGS,
  PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS,
} from "./personalization";
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "./cross-sells";
import { CATEGORY_GUIDES, GUIDE_CATEGORIES } from "./guide-links";
import { OCCASION_COLLECTIONS } from "./collections";

/**
 * A category rename keeps its old URL alive with a 301, so the storefront shows
 * nothing wrong — but every piece of config that matches on the OLD slug stops
 * matching, silently. The 2026-09 `talit-tefillin-sets` → `talit-tefillin-covers`
 * rename did exactly that to three files at once: 21 covers lost the
 * personalization box, the covers page lost its cross-sells and its guide
 * links, and the tefillin guide sent readers through a redirect.
 *
 * So: no config may name a slug that only exists as a redirect source.
 */
describe("category config never names a renamed slug", () => {
  const retired = new Set(Object.keys(MERGED_CATEGORY_REDIRECTS));
  const stale = (slugs: Iterable<string>) => [...slugs].filter((s) => retired.has(s));

  it("personalization gate", () => {
    expect(stale(PERSONALIZABLE_CATEGORY_SLUGS)).toEqual([]);
    expect(stale(EMBROIDERY_ONLY_CATEGORY_SLUGS)).toEqual([]);
    expect(stale(PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS)).toEqual([]);
  });

  it("cross-sells", () => {
    expect(stale(Object.keys(CROSS_SELL_MAP))).toEqual([]);
    expect(stale(Object.values(CROSS_SELL_MAP).flat())).toEqual([]);
    expect(stale([DEFAULT_CROSS_SELL_CATEGORY])).toEqual([]);
  });

  it("guide links", () => {
    expect(stale(Object.keys(CATEGORY_GUIDES))).toEqual([]);
    expect(stale(Object.values(GUIDE_CATEGORIES).flat())).toEqual([]);
  });

  it("occasion collections", () => {
    expect(stale(OCCASION_COLLECTIONS.flatMap((c) => c.categorySlugs))).toEqual([]);
  });

  it("every redirect targets a slug that is not itself retired", () => {
    expect(stale(Object.values(MERGED_CATEGORY_REDIRECTS))).toEqual([]);
  });
});
