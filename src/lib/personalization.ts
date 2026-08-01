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
  // The ART Judaica import created a second, larger set of slugs for the SAME
  // bag families that were already listed above, and only the small originals
  // were ever gated — so 355 tallit/tefillin bags, the most obviously
  // embroiderable SKUs in the catalogue, showed no personalization at all.
  // (`setim-talit-tefilin` is the same family as `talit-tefillin-sets`;
  // `tik-tefilin` the same as `tefillin-cases`.) cross-sells.ts:14-20 records
  // this exact class of bug being fixed there in the 2026-07 dedupe; this file
  // was missed in that pass.
  "setim-talit-tefilin",          // סטים טלית ותפילין (229 active)
  "tikei-talit",                  // תיקי טלית (138 active)
  "tik-tefilin",                  // תיק- תפ (25 active)
  // Deliberately NOT added, verified against the live catalogue:
  //  • `talit-tefilin` — the PARENT of the three above. Holds no tallit
  //    garments (0 found), but does hold 26 metal clips and nylon sleeves.
  //  • `machzikei-talit-atarot` — mixed: עטרות are embroiderable, but the same
  //    category holds קליפסים and ניילונים. The `atara` slug above already
  //    covers the עטרות, so nothing embroiderable is lost.
  // The dead `%d7%a1%d7%98-…` percent-encoded import twin was removed: it
  // resolves to a real category row holding ZERO active products.
]);

/**
 * Categories where personalization is offered as embroidery only
 * (no laser engraving option shown). Moved verbatim from product.$slug.tsx.
 */
export const EMBROIDERY_ONLY_CATEGORY_SLUGS = new Set<string>([
  "talit-tefillin-sets",
  "tefillin-cases",
  "pvc-bags",
  // Same three import twins as above. These are fabric and faux-leather bags,
  // so they belong with their originals here rather than being offered laser
  // engraving — matching how `talit-tefillin-sets` / `tefillin-cases` behave.
  "setim-talit-tefilin",
  "tikei-talit",
  "tik-tefilin",
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
