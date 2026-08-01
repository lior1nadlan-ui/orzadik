import { describe, it, expect } from "vitest";
import {
  PERSONALIZABLE_CATEGORY_SLUGS,
  EMBROIDERY_ONLY_CATEGORY_SLUGS,
  PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS,
  isPersonalizable,
  isPersonalizableProduct,
  personalizationMethod,
  embroideryLabel,
} from "./personalization";

/**
 * These sets are the gate for the store's one real differentiator. They have
 * already silently broken once: the ART Judaica import created larger twin
 * slugs for bag families that were already listed, only the small originals
 * were gated, and 355 tallit/tefillin bags — the most obviously embroiderable
 * SKUs in the catalogue — showed no personalization option at all. The same
 * class of bug had been fixed in cross-sells.ts and missed here.
 *
 * These tests pin the invariants that would have caught it. They are pure —
 * no DB access — so they run in CI with no credentials.
 */
describe("personalization category gate", () => {
  const ALL_SETS = {
    PERSONALIZABLE: PERSONALIZABLE_CATEGORY_SLUGS,
    EMBROIDERY_ONLY: EMBROIDERY_ONLY_CATEGORY_SLUGS,
    PRINT_INSTEAD: PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS,
  };

  it("contains no percent-encoded import-twin slugs", () => {
    // The dead `%d7%a1%d7%98-…` slug resolved to a category with ZERO active
    // products. A percent sign in a slug is the signature of that import bug.
    for (const [name, set] of Object.entries(ALL_SETS)) {
      const encoded = [...set].filter((s) => s.includes("%"));
      expect(encoded, `${name} must not contain percent-encoded slugs`).toEqual([]);
    }
  });

  it("keeps every slug lowercase and URL-clean", () => {
    for (const [name, set] of Object.entries(ALL_SETS)) {
      for (const slug of set) {
        expect(slug, `${name}: "${slug}"`).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it("treats the embroidery-only and print sets as subsets of the gate", () => {
    // PERSONALIZABLE is built as a union, so a slug can never be embroidery-only
    // (or print-instead) while being invisible to the gate itself.
    for (const slug of EMBROIDERY_ONLY_CATEGORY_SLUGS) {
      expect(PERSONALIZABLE_CATEGORY_SLUGS.has(slug), slug).toBe(true);
    }
    for (const slug of PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS) {
      expect(PERSONALIZABLE_CATEGORY_SLUGS.has(slug), slug).toBe(true);
    }
  });

  it("gates both halves of every split bag family", () => {
    // Each pair is ONE product family that the import split across two slugs.
    // Gating only one half is exactly the bug this file exists to prevent.
    const SPLIT_FAMILIES: [string, string][] = [
      ["talit-tefillin-sets", "setim-talit-tefilin"], // סטים לטלית ותפילין
      ["tefillin-cases", "tik-tefilin"], // תיקי תפילין
    ];
    for (const [a, b] of SPLIT_FAMILIES) {
      expect(PERSONALIZABLE_CATEGORY_SLUGS.has(a), a).toBe(true);
      expect(PERSONALIZABLE_CATEGORY_SLUGS.has(b), b).toBe(true);
    }
    expect(PERSONALIZABLE_CATEGORY_SLUGS.has("tikei-talit")).toBe(true);
  });

  it("does not gate the mixed parent or the clips category", () => {
    // `talit-tefilin` is the parent of the three bag categories and also holds
    // 26 metal clips / nylon sleeves; `machzikei-talit-atarot` mixes עטרות with
    // clips. Neither may be gated wholesale — `atara` covers the עטרות.
    expect(PERSONALIZABLE_CATEGORY_SLUGS.has("talit-tefilin")).toBe(false);
    expect(PERSONALIZABLE_CATEGORY_SLUGS.has("machzikei-talit-atarot")).toBe(false);
    expect(PERSONALIZABLE_CATEGORY_SLUGS.has("atara")).toBe(true);
  });
});

describe("personalization gate functions", () => {
  it("personalizes a tallit bag and leaves an unrelated product alone", () => {
    expect(isPersonalizable(["tikei-talit"])).toBe(true);
    expect(isPersonalizable(["kipot"])).toBe(false);
    expect(isPersonalizable([])).toBe(false);
  });

  it("still honours the per-product opt-out", () => {
    expect(isPersonalizableProduct("artj-uk44978", ["tikei-talit"])).toBe(false);
    expect(isPersonalizableProduct("some-other-bag", ["tikei-talit"])).toBe(true);
  });

  it("offers embroidery only — not laser — on the newly gated bag families", () => {
    for (const slug of ["setim-talit-tefilin", "tikei-talit", "tik-tefilin"]) {
      expect(personalizationMethod([slug]), slug).toBe("embroidery");
      expect(embroideryLabel([slug]), slug).toBe("רקמה");
    }
  });

  it("keeps siddurim on הטבעה rather than embroidery", () => {
    expect(embroideryLabel(["sidurim"])).toBe("הטבעה");
  });
});
