// Single source of truth for product personalization (embroidery / רקמה +
// laser engraving / חריטה) — the store's one real differentiator.
//
// This module is pure data + pure functions. It has NO React and NO browser
// globals (window / document / canvas), so it is safe to import from the
// server (SSR / loaders) as well as from client components and browse
// surfaces (badges, filters, cards).
//
// Extracted verbatim from src/routes/product.$slug.tsx so the PDP and every
// browse surface derive "is this personalizable, and how?" from ONE place.
// Behaviour here reproduces the PDP's previous inline logic EXACTLY.

/**
 * Explicit "personalization" categories — the base list that gated the PDP's
 * `showEmbroidery` flag. A product whose category slugs intersect this set is
 * offered personalization. Moved verbatim from product.$slug.tsx.
 *
 * Mirrors rikmat.com's personalized lineup.
 */
const BASE_PERSONALIZATION_CATEGORY_SLUGS = new Set<string>([
  "talit-tefillin-sets",          // כיסויים/סטים לטלית ותפילין (covers merged in, 2026-07 dedupe)
  "tefillin-cases",               // תיקי תפילין
  "pvc-bags",                     // תיקי PVC
  "chalaka-set",                  // סט חלאקה
  "atara",                        // עטרה
  "challah-covers",               // כיסויי חלה
  "bencher-stands",               // מעמדי בנצ'ר (חריטת לייזר)
  "wedding",                      // חתונה
  "sidurim",                                                                       // סידורים
  "marazim-chatanim",   // מארזים לחתנים ובר מצווה
  "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f",                                       // סט טלית תפילין (התיק)
]);

/**
 * Categories where personalization is offered as embroidery only
 * (no laser engraving option shown). Moved verbatim from product.$slug.tsx.
 */
export const EMBROIDERY_ONLY_CATEGORY_SLUGS = new Set<string>([
  "talit-tefillin-sets",
  "tefillin-cases",
  "pvc-bags",
  "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f",
]);

/**
 * Categories where the "embroidery" option is presented as "הטבעה" (print /
 * stamp) instead of actual embroidery. Used for siddurim / tehillim where we
 * offer laser engraving or printing — not embroidery.
 * Moved verbatim from product.$slug.tsx.
 */
export const PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS = new Set<string>([
  "sidurim", // סידורים (כולל תהילים)
]);

/**
 * Specific product slugs where personalization is disabled even if their
 * category normally supports it. Moved verbatim from product.$slug.tsx.
 *
 * This is a per-PRODUCT override, not a category rule, so it is NOT part of
 * `isPersonalizable(categorySlugs)`. Use `isPersonalizableProduct(slug, ...)`
 * (or check this set yourself) to reproduce the PDP's exact `showEmbroidery`
 * gate.
 */
export const NO_PERSONALIZATION_PRODUCT_SLUGS = new Set<string>([
  "בד-דמוי-עור-pu-טלית-2336-סמ-עם-ידית-שחור-עם-או",
  "artj-uk44978",
  "artj-uk67109",
  "artj-uk67722",
  "artj-uk67721",
  "artj-uk53706",
]);

/**
 * The union of every category slug that makes a product personalizable:
 * "explicitly personalizable OR embroidery-only OR print-instead".
 *
 * The PDP's `showEmbroidery` gate keyed off the explicit base list, and both
 * EMBROIDERY_ONLY and PRINT_INSTEAD are subsets of that base today, so this
 * union is byte-for-byte identical to the previous gate — today's behaviour
 * is reproduced EXACTLY. Building it as a union (rather than aliasing the
 * base) keeps this the robust single source of truth: any slug added to the
 * embroidery-only or print-instead sets stays personalizable automatically.
 */
export const PERSONALIZABLE_CATEGORY_SLUGS = new Set<string>([
  ...BASE_PERSONALIZATION_CATEGORY_SLUGS,
  ...EMBROIDERY_ONLY_CATEGORY_SLUGS,
  ...PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS,
]);

/** How a personalizable product's name is applied. */
export type PersonalizationMethod = "embroidery" | "print" | "both";

/** The Hebrew label shown for the (non-laser) personalization method. */
export type EmbroideryLabel = "רקמה" | "הטבעה";

/**
 * Whether a product with these category slugs is personalizable at the
 * CATEGORY level — i.e. any slug is in {@link PERSONALIZABLE_CATEGORY_SLUGS}.
 *
 * This reproduces the PDP's category-level gate exactly. The per-product
 * `NO_PERSONALIZATION_PRODUCT_SLUGS` exclusion is intentionally NOT applied
 * here (this takes only category slugs); use {@link isPersonalizableProduct}
 * for the full `showEmbroidery` gate.
 */
export function isPersonalizable(categorySlugs: string[]): boolean {
  return categorySlugs.some((s) => PERSONALIZABLE_CATEGORY_SLUGS.has(s));
}

/**
 * The full PDP gate: personalizable by category AND not excluded by product
 * slug. Reproduces the previous `showEmbroidery` derivation exactly:
 *   !NO_PERSONALIZATION_PRODUCT_SLUGS.has(slug) &&
 *   categorySlugs.some((s) => PERSONALIZATION_CATEGORY_SLUGS.has(s))
 */
export function isPersonalizableProduct(
  slug: string,
  categorySlugs: string[],
): boolean {
  return !NO_PERSONALIZATION_PRODUCT_SLUGS.has(slug) && isPersonalizable(categorySlugs);
}

/**
 * Which personalization method(s) apply to these category slugs:
 *  - "print"      → print / "הטבעה" categories (siddurim); a laser option is
 *                   also offered. Matches the previous `printInsteadOfEmbroidery`.
 *  - "embroidery" → embroidery-only categories; no laser toggle shown. Matches
 *                   the previous `embroideryOnly` (when not also print).
 *  - "both"       → default: embroidery ("רקמה") plus laser engraving.
 *
 * Precedence (print → embroidery-only → both) mirrors the PDP's description
 * copy, which tested `printInsteadOfEmbroidery` before `embroideryOnly`.
 */
export function personalizationMethod(categorySlugs: string[]): PersonalizationMethod {
  const printInstead = categorySlugs.some((s) =>
    PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS.has(s),
  );
  if (printInstead) return "print";
  const embroideryOnly = categorySlugs.some((s) =>
    EMBROIDERY_ONLY_CATEGORY_SLUGS.has(s),
  );
  if (embroideryOnly) return "embroidery";
  return "both";
}

/**
 * The Hebrew label for the (non-laser) personalization method: "הטבעה" for
 * print/siddurim categories, otherwise "רקמה".
 *
 * Reproduces the previous derivation exactly:
 *   embroideryLabel = printInsteadOfEmbroidery ? "הטבעה" : "רקמה"
 */
export function embroideryLabel(categorySlugs: string[]): EmbroideryLabel {
  return categorySlugs.some((s) => PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS.has(s))
    ? "הטבעה"
    : "רקמה";
}
