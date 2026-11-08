// The site's category menu: nine departments, each category exactly once.
//
// WHY THIS EXISTS (owner, 8.11.2026: "יש המון קטגוריות כפולות והכל לא יפה")
// The menus were built from three overlapping lists: seven hand-picked shortcuts
// with frozen counts (כיפות 743, while 260 are active today), the same shortcuts
// again as chips in the phone drawer, and then every TOP-LEVEL row of the
// categories table. The supplier import left many subcategories at the top level
// beside their real parents, so the drawer read like a list of near-repeats:
// "טלית ותפילין", "כיסויים לטלית ותפילין", "טליתות", "תיקי תפילין"; "נטילת
// ידיים ומים אחרונים", "נטלות", "מים אחרונים"; "נרתיקי מזוזה", "פולירזין ואבן",
// "אלומיניום"; "סידורים", "סידורים ברכונים ותהילים", "ברכונים"; and so on.
//
// So the menu no longer mirrors the table. This file IS the menu: the desktop
// dropdowns, the phone accordion and the search shortcuts all read it. A
// category is reachable from exactly one place, the tests enforce that no slug
// repeats, and the shelves the owner removed from the menu (עטים, סכינים,
// מזכרות ארץ ישראל ומנורות, video 15.10.2026) are simply not in it. Their pages
// still exist.
//
// Not listed on purpose: top-level rows that duplicate a listed shelf
// (tefillin-cases, atara, talit-clips, washing-cups, maim-achronim,
// metal-kiddush-cups, crystal-ceramic-kiddush-cups, polyrasin-stone, aluminum,
// wedding), the catch-all yehudaika (it 301s to /shop), and shelves with one or
// no active product. Counts were measured on 8.11.2026. The header still drops
// any entry whose live count is zero (pruneEmptyNav), so a shelf that empties
// out later cannot become a dead end.
//
// Labels are written for the menu, not copied from the table: the category
// page keeps the full database name in its own h1.

export type NavCategory = { slug: string; label: string };

export type NavDepartment = {
  label: string;
  /** The department's own page, linked as "לכל …" at the top of its panel.
   *  Omitted for a department that is a grouping only. */
  slug?: string;
  /** Text for that link, e.g. "לכל הכיפות". */
  allLabel?: string;
  children: NavCategory[];
};

export const NAV_DEPARTMENTS: NavDepartment[] = [
  {
    label: "כיפות",
    slug: "kipot",
    allLabel: "לכל הכיפות",
    children: [
      { slug: "kipot-ktifa", label: "כיפות קטיפה" },
      { slug: "kipot-meyuchadot", label: "כיפות מיוחדות" },
      { slug: "kipot-satan-trilin", label: "כיפות סטן וטרילין" },
      { slug: "kipot-srugot-rikma", label: "כיפות סרוגות עם רקמה" },
      { slug: "kipot-or", label: "כיפות עור" },
    ],
  },
  {
    label: "טלית ותפילין",
    slug: "talit-tefilin",
    allLabel: "לכל הטלית והתפילין",
    children: [
      { slug: "talitot", label: "טליתות" },
      { slug: "setim-talit-tefilin", label: "סטים לטלית ותפילין" },
      { slug: "tikei-talit", label: "תיקי טלית" },
      { slug: "talit-tefillin-covers", label: "כיסויים לטלית ותפילין" },
      { slug: "tik-tefilin", label: "תיקי תפילין" },
      { slug: "machzikei-talit-atarot", label: "מחזיקי טלית ועטרות" },
      { slug: "batei-tefilin-marot", label: "בתי תפילין ומראות" },
      { slug: "gufiya-tzitzit-kitelim", label: "גופיות ציצית וקיטלים" },
    ],
  },
  {
    label: "סידורים",
    slug: "sidurim",
    allLabel: "לכל הסידורים",
    children: [
      { slug: "birchonim", label: "ברכונים" },
      { slug: "sidurim-tehilim", label: "סידורים ותהילים" },
      { slug: "beit-knesset-shtenderim", label: "בית כנסת ושטנדרים" },
    ],
  },
  {
    label: "שבת",
    slug: "shabbat",
    allLabel: "לכל מוצרי השבת",
    children: [
      { slug: "candlesticks", label: "פמוטים" },
      { slug: "gviei-kidush", label: "גביעי קידוש וסטים ליין" },
      { slug: "challah-covers", label: "כיסויי חלה" },
      { slug: "karshei-chala-sakinim", label: "קרשי חלה וסכינים" },
      { slug: "havdalah", label: "הבדלה" },
      { slug: "netilat-yadaim", label: "נטלות ומים אחרונים" },
      { slug: "mapot-shulchan-runner", label: "מפות שולחן ורנרים" },
      { slug: "kisuyim-lapalta", label: "כיסויים לפלטה" },
      { slug: "shabbat-shonot", label: "עוד לשבת" },
    ],
  },
  {
    label: "חגים",
    slug: "chagim",
    allLabel: "לכל מוצרי החגים",
    children: [
      { slug: "rosh-hashana", label: "ראש השנה" },
      { slug: "sukot", label: "סוכות" },
      { slug: "hanukkah", label: "חנוכה" },
      { slug: "purim", label: "פורים" },
      { slug: "passover", label: "פסח" },
    ],
  },
  {
    label: "נרתיקי מזוזה",
    slug: "plastic",
    allLabel: "לכל נרתיקי המזוזה",
    children: [
      { slug: "mezuzot-polyresin-even", label: "פולירזין ואבן" },
      { slug: "mezuzot-plastik", label: "פלסטיק" },
      { slug: "mezuzot-aluminium", label: "אלומיניום" },
      { slug: "mezuzot-zchuchit", label: "זכוכית" },
      { slug: "mezuzot-matechet", label: "מתכת" },
      { slug: "mezuzot-etz", label: "עץ" },
    ],
  },
  {
    label: "חתן, כלה ושמחות",
    slug: "chatan-kala",
    allLabel: "לכל מוצרי החתן והכלה",
    children: [
      { slug: "marazim-chatanim", label: "מארזים לחתנים" },
      { slug: "chatan-kala-sets", label: "סטים לחתן וכלה" },
      { slug: "chatan-kala-gifts", label: "מתנות לחתן ולכלה" },
      { slug: "chalaka-set", label: "סטים לחלאקה" },
      { slug: "karit-labrit", label: "כריות לברית" },
    ],
  },
  {
    label: "תכשיטים",
    slug: "tachshitim",
    allLabel: "לכל התכשיטים",
    children: [
      { slug: "tachshitei-kesef-tahor", label: "תכשיטי כסף טהור" },
      { slug: "tachshitei-nirosta-rodium", label: "תכשיטי נירוסטה ורודיום" },
      { slug: "tzmidim-tabaot-agilim", label: "צמידים, טבעות ועגילים" },
      { slug: "esh-sheli-gold", label: "האש שלי - תכשיטי זהב" },
    ],
  },
  {
    // A grouping, not a shelf: no single page holds all of these.
    label: "לבית ולמתנה",
    children: [
      { slug: "blessings", label: "ברכות לבית" },
      { slug: "chamsot", label: "חמסות" },
      { slug: "segulot", label: "סגולות" },
      { slug: "kupot-tzedaka", label: "קופות צדקה" },
      { slug: "wall-art", label: "ציורי קיר" },
      { slug: "machzikei-maftechot-magnetim", label: "מחזיקי מפתחות ומגנטים" },
      { slug: "chasidim-tzivoniim", label: "חסידים צבעוניים" },
      { slug: "yeladim", label: "לילדים" },
    ],
  },
];

/** Every slug the menu links to, departments first. */
export function navSlugs(departments: NavDepartment[] = NAV_DEPARTMENTS): string[] {
  const out: string[] = [];
  for (const d of departments) {
    if (d.slug) out.push(d.slug);
    for (const c of d.children) out.push(c.slug);
  }
  return out;
}

/**
 * Drop entries that have no active products, so a shelf that empties out later
 * cannot become a dead end. `listable` is the set of category slugs that
 * currently hold products (from the header's live query). Until that query has
 * answered (`listable` undefined: the server render and the first client paint)
 * the full map is shown, so the server HTML is stable. A department loses its
 * "לכל …" link if its own page is empty, and disappears when nothing is left.
 */
export function pruneEmptyNav(
  departments: NavDepartment[],
  listable: ReadonlySet<string> | undefined,
): NavDepartment[] {
  if (!listable) return departments;
  const out: NavDepartment[] = [];
  for (const d of departments) {
    const children = d.children.filter((c) => listable.has(c.slug));
    const slug = d.slug && listable.has(d.slug) ? d.slug : undefined;
    if (!slug && children.length === 0) continue;
    out.push({ ...d, slug, allLabel: slug ? d.allLabel : undefined, children });
  }
  return out;
}
