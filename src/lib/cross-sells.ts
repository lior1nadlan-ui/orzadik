// Cross-sell map: when a product belongs to one of these category slugs,
// suggest products from the listed related-category slugs.
// Slugs match `categories.slug` in the database (Hebrew slugs are URL-encoded there).

const SIDDURIM = "sidurim";
const TALITOT = "talitot";
// Canonical kippot slug is the ASCII 'kipot' (742+ products). The percent-encoded
// twin that used to live here was a 14-product import artifact merged into 'kipot'
// in the 2026-07 dedupe — pointing cross-sells at it meant kippot suggestions were
// drawn from the tiny twin (and, after the merge, from a deleted category).
const KIPOT = "kipot";
const HATAN = "marazim-chatanim";
const YEHUDAIKA = "yehudaika";
// Live slugs. The three constants here used to point at categories holding ZERO
// active products (the percent-encoded חגים and סט-טלית-תפילין import twins, and
// `wine-dividers`), so those cross-sell slots silently rendered nothing on every
// matching product page. Repointed to the stocked equivalents.
const HAGIM = "chagim";                       // 523 products
const WINE_SETS = "machlekei-yain-setim";     // 40 products
const SET_TALIT_TEFILIN = "setim-talit-tefilin"; // 229 products

export const CROSS_SELL_MAP: Record<string, string[]> = {
  [SIDDURIM]: [TALITOT, "plastic", KIPOT, SET_TALIT_TEFILIN],
  [HATAN]: [SIDDURIM, TALITOT, KIPOT, SET_TALIT_TEFILIN, "tefillin-cases"],
  wedding: [SIDDURIM, TALITOT, KIPOT, "candlesticks"],
  [TALITOT]: [SET_TALIT_TEFILIN, "tefillin-cases", "talit-tefillin-sets", "talit-clips", "atara"],
  plastic: [SIDDURIM, KIPOT, "blessings"],
  [KIPOT]: [SIDDURIM, TALITOT, "talit-clips"],
  hanukkah: [HAGIM, "metal-kiddush-cups", "candlesticks"],
  passover: ["metal-kiddush-cups", "maim-achronim", "washing-cups", WINE_SETS],
  "rosh-hashana": [HAGIM, "metal-kiddush-cups", "challah-covers"],
  purim: [HAGIM, "blessings"],
  "metal-kiddush-cups": [WINE_SETS, "washing-cups", "challah-covers", "candlesticks"],
  "crystal-ceramic-kiddush-cups": [WINE_SETS, "washing-cups", "challah-covers"],
  "challah-covers": ["metal-kiddush-cups", "washing-cups", "candlesticks", "bencher-stands"],
  [SET_TALIT_TEFILIN]: [TALITOT, "tefillin-cases", "talit-tefillin-sets", "atara"],
  "tefillin-cases": [TALITOT, "talit-tefillin-sets", SET_TALIT_TEFILIN, "pvc-bags"],
  "talit-tefillin-sets": [TALITOT, "tefillin-cases", SET_TALIT_TEFILIN],
  "bencher-stands": [SIDDURIM, "study-books", "challah-covers"],
  "study-books": [SIDDURIM, "bencher-stands"],
  candlesticks: ["metal-kiddush-cups", "challah-covers", WINE_SETS],
  "washing-cups": ["maim-achronim", "challah-covers", "metal-kiddush-cups"],
  "maim-achronim": ["washing-cups", "metal-kiddush-cups"],
  havdalah: ["metal-kiddush-cups", "candlesticks", WINE_SETS],
  mirrors: [YEHUDAIKA, "blessings"],
  blessings: [SIDDURIM, "challah-covers", "candlesticks"],
  "chalaka-set": [SIDDURIM, KIPOT, TALITOT],
  atara: [TALITOT, SET_TALIT_TEFILIN],
};

export const DEFAULT_CROSS_SELL_CATEGORY = YEHUDAIKA;
