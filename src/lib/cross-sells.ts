// Cross-sell map: when a product belongs to one of these category slugs,
// suggest products from the listed related-category slugs.
// Slugs match `categories.slug` in the database (Hebrew slugs are URL-encoded there).

const SIDDURIM = "%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d";
const TALITOT = "%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa";
const KIPOT = "%d7%9b%d7%99%d7%a4%d7%95%d7%aa";
const HATAN = "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94";
const YEHUDAIKA = "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%99%d7%95%d7%93%d7%90%d7%99%d7%a7%d7%94";
const HAGIM = "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%92%d7%99%d7%9d";
const SET_TALIT_TEFILIN = "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f";

export const CROSS_SELL_MAP: Record<string, string[]> = {
  [SIDDURIM]: [TALITOT, "plastic", KIPOT, SET_TALIT_TEFILIN],
  [HATAN]: [SIDDURIM, TALITOT, KIPOT, SET_TALIT_TEFILIN, "tefillin-cases"],
  wedding: [SIDDURIM, TALITOT, KIPOT, "candlesticks"],
  [TALITOT]: [SET_TALIT_TEFILIN, "tefillin-cases", "talit-tefillin-covers", "talit-clips", "atara"],
  plastic: [SIDDURIM, KIPOT, "blessings"],
  [KIPOT]: [SIDDURIM, TALITOT, "talit-clips"],
  hanukkah: [HAGIM, "metal-kiddush-cups", "candlesticks"],
  passover: ["metal-kiddush-cups", "maim-achronim", "washing-cups", "wine-dividers"],
  "rosh-hashana": [HAGIM, "metal-kiddush-cups", "challah-covers"],
  purim: [HAGIM, "blessings"],
  "metal-kiddush-cups": ["wine-dividers", "washing-cups", "challah-covers", "candlesticks"],
  "crystal-ceramic-kiddush-cups": ["wine-dividers", "washing-cups", "challah-covers"],
  "challah-covers": ["metal-kiddush-cups", "washing-cups", "candlesticks", "bencher-stands"],
  [SET_TALIT_TEFILIN]: [TALITOT, "tefillin-cases", "talit-tefillin-covers", "atara"],
  "tefillin-cases": [TALITOT, "talit-tefillin-covers", SET_TALIT_TEFILIN, "pvc-bags"],
  "talit-tefillin-covers": [TALITOT, "tefillin-cases", SET_TALIT_TEFILIN],
  "bencher-stands": [SIDDURIM, "study-books", "challah-covers"],
  "study-books": [SIDDURIM, "bencher-stands"],
  candlesticks: ["metal-kiddush-cups", "challah-covers", "wine-dividers"],
  "washing-cups": ["maim-achronim", "challah-covers", "metal-kiddush-cups"],
  "maim-achronim": ["washing-cups", "metal-kiddush-cups"],
  havdalah: ["metal-kiddush-cups", "candlesticks", "wine-dividers"],
  mirrors: [YEHUDAIKA, "blessings"],
  blessings: [SIDDURIM, "challah-covers", "candlesticks"],
  "chalaka-set": [SIDDURIM, KIPOT, TALITOT],
  atara: [TALITOT, SET_TALIT_TEFILIN],
};

export const DEFAULT_CROSS_SELL_CATEGORY = YEHUDAIKA;
