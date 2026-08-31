// Cross-sell map: when a product belongs to one of these category slugs,
// suggest products from the listed related-category slugs.
// Slugs match `categories.slug` in the database (Hebrew slugs are URL-encoded there).
//
// Read by src/routes/product.$slug.tsx ("משלימים את הקנייה") and by
// src/components/cart/CartCrossSell.tsx ("מומלץ להשלמה"). Both consumers build
// the union of targets for the item's categories, delete the categories the item
// is ALREADY in, and fall back to DEFAULT_CROSS_SELL_CATEGORY when nothing is
// left. Two rules follow from that, and every entry below obeys both.
//
// RULE 1 — a KEY must be a slug that active products actually carry.
//   A key that only survives in a legacy import matches nothing, so the product
//   silently lands on the fallback, which is "עוד יודאיקה" and not a companion
//   at all. Measured against prod on 2026-08-01: the previous key set matched no
//   category on 1,775 of 4,648 active products (38%). The whole `talit-tefilin`
//   tree (465), the `gviei-kidush` tree (200), `netilat-yadaim` (267), `shabbat`
//   (357) and `brachot-chamsot-segulot` (301) were all absent, while their tiny
//   ASCII import twins were keys: `metal-kiddush-cups` (12), `washing-cups` (17),
//   `crystal-ceramic-kiddush-cups` (10). Those three are KEPT as keys — real
//   products still carry them — but are never used as TARGETS.
//   `talitot` (55) is NOT one of them: it is a real standalone shelf holding the
//   garment rather than the bag, and personalization.ts records the live-catalogue
//   check showing `talit-tefilin` holds ZERO garments. So `talitot` is correctly
//   used as a target on the חתן and חתונה keys below — a groom needs the tallit
//   itself, not another bag.
//   With the key set below the fallback fires on 0 of 4,648 active products.
//
// RULE 2 — a TARGET must hold stock the strip can actually render.
//   The product page discards any candidate priced under max(₪60, 12% of the main
//   price) out of an unordered 40-row sample, so a target needs a healthy tail
//   above ₪60 or it contributes nothing. Dropped from every target list for that
//   reason: `study-books` (0 active products — that slot rendered literally
//   nothing, and the slug is gone from this file entirely), `bencher-stands` (1),
//   `atara` and `pvc-bags` (the SAME 7 products, only 4 above ₪60) and
//   `talit-clips` (4 products, 2 above ₪60). The last four keep their KEYS, since
//   products still carry them, and each was repointed at a shelf that can
//   actually fill a strip: `talit-clips` -> `machzikei-talit-atarot` (58
//   products, ₪15-227, the live shelf holding the עטרות, clips and nylon
//   sleeves); `atara` and `pvc-bags` -> the tallit-bag shelves; `bencher-stands`
//   -> סידורים / ברכונים / בית כנסת. (Stated per slug on purpose: an earlier
//   draft here claimed all four now point at `machzikei-talit-atarot`, which was
//   true of only one of them — and this file's whole value is that its comments
//   are the measured justification for each entry.)
//
// The active-product counts in the comments below were measured on prod on
// 2026-08-01 and are the reason each target was picked; re-measure before adding
// a key or a target.
//
// What this map CANNOT fix: the product page sorts its 40-row candidate sample
// price-DESCENDING and keeps the top 4, so the lead tile is the priciest row that
// happened to come back, not the best companion. On a ₪29 mezuzah case the lead
// measured ₪240 with the old targets and ₪463 with these ones — the map changes
// which shelves are sampled, not which end of the sample gets shown. 1,286 of
// 4,648 active products are priced under the flat ₪60 floor, so for them every
// suggestion is an upsell by construction. The ordering lives in
// src/routes/product.$slug.tsx and is tracked separately.

const SIDDURIM = "sidurim"; // 79 products, ₪130-186
const TALITOT = "talitot"; // 55 טליתות, ₪336-1,572 (the garment, not the bag)
// Canonical kippot slug is the ASCII 'kipot' (742+ products). The percent-encoded
// twin that used to live here was a 14-product import artifact merged into 'kipot'
// in the 2026-07 dedupe — pointing cross-sells at it meant kippot suggestions were
// drawn from the tiny twin (and, after the merge, from a deleted category).
const KIPOT = "kipot"; // 743 products
const HATAN = "marazim-chatanim"; // 11 (only 4 have a thumbnail — key only, never a target)
const YEHUDAIKA = "yehudaika"; // 107 products, ₪61-472
// Live slugs. The three constants here used to point at categories holding ZERO
// active products (the percent-encoded חגים and סט-טלית-תפילין import twins, and
// `wine-dividers`), so those cross-sell slots silently rendered nothing on every
// matching product page. Repointed to the stocked equivalents.
const HAGIM = "chagim"; // 523 products
const WINE_SETS = "machlekei-yain-setim"; // 40 products
const SET_TALIT_TEFILIN = "setim-talit-tefilin"; // 229 products

// Live shelves added in the 2026-08 pass, each holding stock the previous map
// could not reach. Parent/child overlaps were measured, so none of these is a
// target of a shelf it is contained in (that target would just be deleted again
// by the consumer's "don't suggest a category the item is already in" step).
const TALIT_TEFILIN = "talit-tefilin"; // 465 — parent of every tallit/tefillin shelf
const TIKEI_TALIT = "tikei-talit"; // 138 תיקי טלית, ₪81-400
const TIK_TEFILIN = "tik-tefilin"; // 25 תיקי תפילין, ₪325-455
const ATAROT = "machzikei-talit-atarot"; // 58 עטרות/מחזיקים, ₪15-227
const KIDUSH = "gviei-kidush"; // 200 — parent of every kiddush-cup shelf
const NETILAT = "netilat-yadaim"; // 267 נטלות ומים אחרונים, ₪13-538
const CHALLAH = "challah-covers"; // 128 כיסויי חלה, ₪52-521
const CHALLAH_BOARDS = "karshei-chala-sakinim"; // 79 קרשי חלה, מפיונים, ₪43-955
const CANDLES = "candlesticks"; // 263 פמוטים, ₪11-1,091
const BLESSINGS = "blessings"; // 235 ברכות, ₪27-502 (plus 2 outliers at ₪1,737)
const CHAMSOT = "chamsot"; // 52 חמסות, ₪39-367
const TZEDAKA = "kupot-tzedaka"; // 68 קופות צדקה, ₪27-613
const BENCHERS = "birchonim"; // 91 ברכונים, ₪23-504
const SHUL = "beit-knesset-shtenderim"; // 64 שטנדרים ומוצרי בית כנסת, ₪30-1,109
const MEZUZA_CASES = "plastic"; // 383 נרתיקי מזוזה — parent of every mezuzah shelf

export const CROSS_SELL_MAP: Record<string, string[]> = {
  // --- טלית ותפילין -------------------------------------------------------
  // The bag shelves are mutually disjoint (tikei-talit ∩ setim-talit-tefilin = 0,
  // tikei-talit ∩ machzikei-talit-atarot = 0), so they genuinely complete each
  // other: a tallit bag suggests the matching tefillin bag and an עטרה, not
  // another ₪1,286 tallit.
  [TALIT_TEFILIN]: [ATAROT, KIPOT, SIDDURIM, "gufiya-tzitzit"],
  [TIKEI_TALIT]: [TIK_TEFILIN, ATAROT, KIPOT, SIDDURIM],
  [TIK_TEFILIN]: [TIKEI_TALIT, ATAROT, KIPOT, SIDDURIM],
  [SET_TALIT_TEFILIN]: [ATAROT, KIPOT, SIDDURIM, "gufiya-tzitzit"],
  [ATAROT]: [TIKEI_TALIT, SET_TALIT_TEFILIN, KIPOT, SIDDURIM],
  // A tallit itself is the one place the bag IS the completion of the purchase.
  [TALITOT]: [TIKEI_TALIT, ATAROT, KIPOT, "gufiya-tzitzit"],
  "talit-tefillin-sets": [ATAROT, TIKEI_TALIT, KIPOT, SIDDURIM],
  "tefillin-cases": [TIKEI_TALIT, TIK_TEFILIN, ATAROT, KIPOT],
  // `mirrors` is NOT decorative mirrors — all 4 products are plastic tefillin
  // boxes / a tefillin stand with a mirror, so they belong to this family and
  // not to the יודאיקה shelf they used to point at.
  mirrors: [TIK_TEFILIN, TIKEI_TALIT, ATAROT, KIPOT],
  "batei-tefilin-marot": [TIK_TEFILIN, TIKEI_TALIT, ATAROT, KIPOT],
  atara: [TIKEI_TALIT, SET_TALIT_TEFILIN, KIPOT],
  "pvc-bags": [TIKEI_TALIT, SET_TALIT_TEFILIN, KIPOT],
  "talit-clips": [ATAROT, TIKEI_TALIT, KIPOT],
  "gufiya-tzitzit-kitelim": [KIPOT, TALIT_TEFILIN, SIDDURIM],
  "gufiya-tzitzit": [KIPOT, TALIT_TEFILIN, SIDDURIM],

  // --- כיפות ---------------------------------------------------------------
  // Kippot are bought by the event (bar mitzvah, wedding), which is why the
  // bencher is a better companion than the ₪1,286 tallit this used to suggest.
  [KIPOT]: [SIDDURIM, BENCHERS, SET_TALIT_TEFILIN],

  // --- מזוזות --------------------------------------------------------------
  // A mezuzah case is bought while furnishing a home: ברכת הבית, חמסה, קופת צדקה.
  // All the mezuzot-* shelves are children of `plastic`, so this one key covers
  // the whole 383-product tree.
  [MEZUZA_CASES]: [CHAMSOT, BLESSINGS, TZEDAKA],

  // --- שולחן שבת ------------------------------------------------------------
  // `challah-covers`, `karshei-chala-sakinim` and `mapot-shulchan-runner` are
  // children of `shabbat`; `candlesticks` and `netilat-yadaim` are NOT (measured
  // intersection 0), which is what makes them valid companions rather than more
  // of the same shelf.
  shabbat: [CANDLES, KIDUSH, NETILAT, CHALLAH_BOARDS],
  [CHALLAH]: [CANDLES, KIDUSH, NETILAT, CHALLAH_BOARDS],
  "shabbat-shonot": [CANDLES, KIDUSH, CHALLAH, CHALLAH_BOARDS],
  [CHALLAH_BOARDS]: [CHALLAH, CANDLES, KIDUSH, "mapot-shulchan-runner"],
  "mapot-shulchan-runner": [CHALLAH, CHALLAH_BOARDS, CANDLES, "kisuyim-lapalta"],
  "kisuyim-lapalta": [CHALLAH, "mapot-shulchan-runner", CHALLAH_BOARDS, CANDLES],
  sakinim: [CHALLAH_BOARDS, CHALLAH, CANDLES],
  [CANDLES]: [CHALLAH, KIDUSH, NETILAT, CHALLAH_BOARDS],

  // --- קידוש ויין ------------------------------------------------------------
  // `gviei-kidush` is the parent; the four child shelves plus the two legacy
  // twins all point at the same Shabbat-table companions. The twins are what the
  // map used to be keyed on: `metal-kiddush-cups` holds 12 products (7 of them
  // also in `gviei-kidush-matechet`, 25) and `crystal-ceramic-kiddush-cups` holds
  // 10 that are a strict subset of `gviei-kidush-crystal-keramika` (130).
  [KIDUSH]: [CHALLAH, CANDLES, NETILAT, CHALLAH_BOARDS],
  "gviei-kidush-crystal-keramika": [CHALLAH, CANDLES, NETILAT, CHALLAH_BOARDS],
  "gviei-kidush-matechet": [CHALLAH, CANDLES, NETILAT, CHALLAH_BOARDS],
  "gviei-kidush-polymer": [CHALLAH, CANDLES, NETILAT, CHALLAH_BOARDS],
  "metal-kiddush-cups": [WINE_SETS, CHALLAH, CANDLES, NETILAT],
  "crystal-ceramic-kiddush-cups": [WINE_SETS, CHALLAH, CANDLES, NETILAT],
  [WINE_SETS]: [CHALLAH, CANDLES, CHALLAH_BOARDS, "havdalah"],
  "liqueur-sets": [WINE_SETS, CHALLAH_BOARDS, CANDLES],
  havdalah: [KIDUSH, CANDLES, WINE_SETS],

  // --- נטילת ידיים -----------------------------------------------------------
  // `washing-cups` (17) and `maim-achronim` (8) are the legacy twins of
  // `netilat-yadaim` (267); 13 and 5 of their products respectively sit in the
  // big shelf too, so they keep their own keys but suggest the Shabbat table.
  [NETILAT]: [CHALLAH, KIDUSH, CANDLES, CHALLAH_BOARDS],
  "washing-cups": [CHALLAH, KIDUSH, CANDLES],
  "maim-achronim": [CHALLAH, KIDUSH, CANDLES],

  // --- סידורים, ברכונים ובית כנסת --------------------------------------------
  // `sidurim` (79), `birchonim` (91) and `sidurim-tehilim` (43) are three
  // disjoint shelves despite the overlapping names, so each is a real companion
  // to the others. `sidurim-utehilim` holds the same 43 products as its parent.
  // `study-books` is gone from this section entirely: 0 active products.
  [SIDDURIM]: [KIPOT, BENCHERS, TALIT_TEFILIN, SHUL],
  [BENCHERS]: [SIDDURIM, KIPOT, "sidurim-tehilim", SHUL],
  "sidurim-tehilim": [KIPOT, BENCHERS, TALIT_TEFILIN, SHUL],
  "sidurim-utehilim": [KIPOT, BENCHERS, TALIT_TEFILIN, SHUL],
  [SHUL]: [SIDDURIM, BENCHERS, TZEDAKA, TALIT_TEFILIN],
  "bencher-stands": [SIDDURIM, BENCHERS, SHUL],

  // --- ברכות, חמסות וסגולות ---------------------------------------------------
  // `blessings` (235), `chamsot` (52) and `segulot` (14) are all children of
  // `brachot-chamsot-segulot` (301) and mutually disjoint. These are gift/home
  // items, so they complete each other and the mezuzah shelf.
  "brachot-chamsot-segulot": [TZEDAKA, MEZUZA_CASES, YEHUDAIKA],
  [BLESSINGS]: [CHAMSOT, MEZUZA_CASES, TZEDAKA, YEHUDAIKA],
  [CHAMSOT]: [BLESSINGS, MEZUZA_CASES, TZEDAKA, YEHUDAIKA],
  segulot: [CHAMSOT, BLESSINGS, TZEDAKA],

  // --- חגים -------------------------------------------------------------------
  // Every holiday shelf is a child of `chagim`, so the parent key fires as well
  // and widens the pool. `metal-kiddush-cups` (12) was the old target here and is
  // replaced by the 200-product `gviei-kidush`.
  // CHALLAH is deliberately NOT on the `chagim` parent, and CHALLAH_BOARDS is
  // deliberately NOT on `passover`. Every holiday shelf is a child of `chagim`,
  // so whatever sits on the parent also renders on the Pesach pages — and
  // recommending כיסויי חלה or קרשי חלה וסכינים to someone shopping for Pesach
  // is a chametz error, not merely an irrelevant tile. In a religious-goods
  // store that is the kind of mistake a customer does not forgive. Challah
  // stays reachable where it belongs: it is named explicitly on rosh-hashana
  // and sukot, both of which use it.
  // CANDLES replaces it in both places: yom tov candles are lit on every
  // festival including Pesach, so the slot stays useful without the error.
  [HAGIM]: [YEHUDAIKA, KIDUSH, CANDLES, BLESSINGS],
  hanukkah: [CANDLES, KIDUSH, YEHUDAIKA, "mazkarot-eretz-israel"],
  passover: [KIDUSH, NETILAT, WINE_SETS, CANDLES],
  "rosh-hashana": [KIDUSH, CHALLAH, CANDLES, YEHUDAIKA],
  purim: [YEHUDAIKA, WINE_SETS, TZEDAKA, BLESSINGS],
  sukot: [YEHUDAIKA, BLESSINGS, SHUL, CHALLAH],

  // --- יודאיקה, מתנות ומזכרות --------------------------------------------------
  // The keychain/magnet shelf (198 products, median ₪27) is here for coverage:
  // the consumer's ₪60 floor filters almost all of its own stock out, so its
  // shoppers are sent to the gift shelves instead.
  // `mazkarot-eretz-israel` is the thinnest target in this file — 12 products, 7
  // of them above ₪60 — so it never stands alone: it appears only next to three
  // fuller shelves, and it earns its place on חנוכה because it holds the מנורות.
  [YEHUDAIKA]: [BLESSINGS, CHAMSOT, TZEDAKA, "chasidim-tzivoniim"],
  "chasidim-tzivoniim": [YEHUDAIKA, "polyrasin-stone", "mazkarot-eretz-israel", BLESSINGS],
  "mazkarot-eretz-israel": [YEHUDAIKA, CHAMSOT, BLESSINGS],
  "polyrasin-stone": [YEHUDAIKA, "chasidim-tzivoniim", BLESSINGS],
  "wall-art": [BLESSINGS, YEHUDAIKA, CHAMSOT],
  [TZEDAKA]: [BLESSINGS, CHAMSOT, YEHUDAIKA, MEZUZA_CASES],
  "machzikei-maftechot-magnetim": [CHAMSOT, BLESSINGS, TZEDAKA, YEHUDAIKA],
  "machzikei-maftechot": [CHAMSOT, BLESSINGS, TZEDAKA, YEHUDAIKA],
  magnetim: [CHAMSOT, BLESSINGS, TZEDAKA, YEHUDAIKA],
  etim: [YEHUDAIKA, BLESSINGS, TZEDAKA],
  "avizarei-tetzuga": [YEHUDAIKA, BLESSINGS],

  // --- תכשיטים -----------------------------------------------------------------
  // The three tachshitim children are subsets of the parent, so one key covers
  // them. `esh-sheli-gold` is disjoint and all 7 of its rows are priced 0, which
  // is why it is a key but never a target.
  tachshitim: [CHAMSOT, BLESSINGS, YEHUDAIKA],
  "esh-sheli-gold": [CHAMSOT, "tachshitim", YEHUDAIKA],

  // --- אירועים ומחזור החיים ------------------------------------------------------
  [HATAN]: [TALITOT, TIKEI_TALIT, KIPOT, SIDDURIM],
  "chatan-kala": [TALIT_TEFILIN, KIPOT, SIDDURIM, CANDLES],
  wedding: [TALITOT, TIKEI_TALIT, KIPOT, CANDLES],
  "chalaka-set": [KIPOT, SIDDURIM, TALIT_TEFILIN],
  "karit-labrit": [KIPOT, YEHUDAIKA, SIDDURIM],
  yeladim: [KIPOT, YEHUDAIKA, HAGIM],
};

// Last resort only. With the key set above every one of the 4,648 active
// products matches at least one key AND keeps at least one target after the
// consumer deletes its own categories, so this no longer decides the strip on
// 38% of the catalogue. It is still the shelf EmptyCartSuggestions.tsx browses
// for an empty cart, where a general יודאיקה pool is the right answer.
export const DEFAULT_CROSS_SELL_CATEGORY = YEHUDAIKA;
