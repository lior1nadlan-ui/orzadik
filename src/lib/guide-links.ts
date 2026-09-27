// Guide ↔ shop linking.
//
// Until now the five guides under /articles were reachable only from the header,
// the mobile drawer and the footer — a grep for "articles" across index.tsx,
// category.$slug.tsx, product.$slug.tsx, shop.tsx, categories.tsx and
// collection.$slug.tsx returned ZERO hits. So ~4,600 product pages and ~105
// category pages, the bulk of the site's crawlable surface, pointed at the
// editorial content not at all, and the guides sat at ~3 internal links each.
//
// This is plain config in the shape of cross-sells.ts / collections.ts: no React,
// no browser globals, no DB round-trip. That matters because it is consumed on
// the two hottest SSR paths (every category page, every PDP) — the links render
// into the server HTML by construction, which is the only version a crawler sees.
//
// `articles.category_id` is a single FK, so one guide can attach to exactly one
// category in the DB. The linking that is actually useful is many-to-many (the
// tallit guide belongs on the sets, the bags AND the tallitot categories), which
// is why the mapping lives here rather than in a query.

import { OCCASION_COLLECTIONS } from "@/lib/collections";

export type GuideRef = {
  slug: string;
  /** Shown as the link label. Kept short — the DB title_he is a full headline. */
  title: string;
  /** One line of "why you'd click this", used by the card variant. */
  blurb: string;
};

/** The published guides. Titles are inlined so no hot path needs a DB read. */
export const GUIDES: Record<string, GuideRef> = {
  "bechira-talit": {
    slug: "bechira-talit",
    title: "איך בוחרים טלית",
    blurb: "סוגי צמר, מידות, עטרה ומנהגי עדות — כל מה שכדאי לדעת לפני שקונים.",
  },
  "tefillin-guide": {
    slug: "tefillin-guide",
    title: "מדריך תפילין ואביזרים",
    blurb: "בתים, רצועות, תיקים ומראות — ואיך שומרים עליהם לאורך שנים.",
  },
  "mezuza-guide": {
    slug: "mezuza-guide",
    title: "מזוזות: בחירה והנחה",
    blurb: "חומרים, מידות, איפה מניחים — ומה ההבדל בין הנרתיק לקלף.",
  },
  "kiddush-cup-guide": {
    slug: "kiddush-cup-guide",
    title: "בחירת גביע קידוש",
    blurb: "כסף, קריסטל או זכוכית, שיעור רביעית וטיפול נכון.",
  },
  "hanukkia-guide": {
    slug: "hanukkia-guide",
    title: "איך בוחרים חנוכיה",
    blurb: "שמן או נרות, חומרים, גדלים ומיקום ההנחה.",
  },
  "kippa-guide": {
    slug: "kippa-guide",
    title: "איך בוחרים כיפה",
    blurb: "קטיפה, סרוגה, DMC או פריק — ההבדלים, המידות והטיפול.",
  },
  "natla-guide": {
    slug: "natla-guide",
    title: "איך בוחרים נטלה",
    blurb: "מה נדרש מהכלי, איזה חומר וגודל, ומה זה מים אחרונים.",
  },
  "birchon-guide": {
    slug: "birchon-guide",
    title: "איך בוחרים ברכון",
    blurb: "איזה נוסח, מעמד או לוח, כמה ברכונים צריך ואיך שומרים עליהם.",
  },
  "pamotim-guide": {
    slug: "pamotim-guide",
    title: "איך בוחרים פמוטים",
    blurb: "זוג או רב-קני, קריסטל או מתכת, איזה גובה ואיזה נר — ואיך מסירים שעווה.",
  },
  "challah-guide": {
    slug: "challah-guide",
    title: "כיסוי חלה ומגש לחלה",
    blurb: "איזה גודל מכסה שתי חלות, דמוי עור או בד, זכוכית או עץ — ולמה מלח.",
  },
  "havdalah-guide": {
    slug: "havdalah-guide",
    title: "איך בוחרים סט הבדלה",
    blurb: "מה יש בסט, איזה נר ואילו בשמים, ולמה צריך מגש.",
  },
  "personalization-guide": {
    slug: "personalization-guide",
    title: "שם אישי: רקמה, הטבעה או חריטה",
    blurb: "על אילו מוצרים, מה לכתוב, איך בודקים את האיות — ומה קורה אחרי ההזמנה.",
  },
  "birkat-habait-guide": {
    slug: "birkat-habait-guide",
    title: "ברכת הבית ועוד ברכות לבית",
    blurb: "איזה טקסט לאיזה מקום, אשר יצר בנוסח שלכם, חומרים, מידות — ואיפה תולים.",
  },
  // The three below were published 2026-09-01 and linked from nowhere until
  // 2026-09-27; their bodies were corrected against the shelves the same day
  // (20260927090000_orphan_guides_honesty.sql).
  "mechir-talit-bar-mitzva": {
    slug: "mechir-talit-bar-mitzva",
    title: "כמה עולה טלית לבר מצווה",
    blurb: "מה קובע את המחיר — חומר, גודל, ציציות ועטרה — ומה לוודא לפני שמשווים.",
  },
  "set-chalaka-madrich": {
    slug: "set-chalaka-madrich",
    title: "סט חלאקה: מה יש בו ומתי להזמין",
    blurb: 'מה יש בסטים, איך משווים ביניהם, שם הילד — ולמה כדאי להקדים לפני ל"ג בעומר.',
  },
  "karit-labrit-madrich": {
    slug: "karit-labrit-madrich",
    title: "כרית לברית: איך בוחרים",
    blurb: "דמוי עור או סאטן, איזה גודל, מה כתוב עליה — ולמה מזמינים עוד לפני הלידה.",
  },
  "kupat-tzedaka-guide": {
    slug: "kupat-tzedaka-guide",
    title: "איך בוחרים קופת צדקה",
    blurb: "לבית, לעסק, לבית הכנסת או לילד — חומר, מנעול, חריץ, ומתי נוהגים לתת.",
  },
  "machzikei-maftechot-guide": {
    slug: "machzikei-maftechot-guide",
    title: "מחזיק מפתחות עם משמעות",
    blurb: "חמסה, תהילים קטן, תפילת הדרך או מזכרת מישראל — ומה עושים כשהוא מתבלה.",
  },
  "shtender-guide": {
    slug: "shtender-guide",
    title: "איך בוחרים שטנדר",
    blurb: "עץ, במבוק או אקריליק, לשולחן או לבית הכנסת — ורימונים ויד לספר תורה.",
  },
  "tachshitim-guide": {
    slug: "tachshitim-guide",
    title: "תכשיטים יהודיים: איך בוחרים",
    blurb: "כסף 925, נירוסטה או ציפוי — איזה סמל, איזה אורך, ואיך שומרים על התכשיט.",
  },
};

/**
 * category slug → guides. Only the levels worth naming are listed; everything
 * below them resolves through the parent walk-up in guidesForCategory(), so a
 * handful of entries covers most of the ~105 categories (e.g. `kipot-ktifa`
 * finds nothing directly, climbs to `kipot`, and would inherit its guide).
 */
export const CATEGORY_GUIDES: Record<string, string[]> = {
  // טלית ותפילין — the parent covers סטים, תיקים and the rest of the branch.
  "talit-tefilin": ["bechira-talit", "tefillin-guide"],
  talitot: ["bechira-talit", "mechir-talit-bar-mitzva"],
  atara: ["bechira-talit", "personalization-guide"],
  "talit-clips": ["bechira-talit"],
  // The personalization guide rides third on the two bag shelves: the category
  // page lists every entry, while the PDP (capped at 2) already links it from
  // the name box itself.
  "setim-talit-tefilin": ["bechira-talit", "tefillin-guide", "personalization-guide"],
  "tikei-talit": ["bechira-talit", "tefillin-guide", "personalization-guide"],
  "tefillin-cases": ["tefillin-guide", "personalization-guide"],
  "batei-tefilin-marot": ["tefillin-guide"],
  "talit-tefillin-covers": ["tefillin-guide", "personalization-guide", "bechira-talit"],
  // מזוזות — parent of the polyresin/plastic/aluminium children.
  plastic: ["mezuza-guide"],
  // גביעי קידוש — parent of the crystal/metal children.
  "gviei-kidush": ["kiddush-cup-guide"],
  "metal-kiddush-cups": ["kiddush-cup-guide"],
  "crystal-ceramic-kiddush-cups": ["kiddush-cup-guide"],
  // שבת — the kiddush cup and the candlesticks are the two decisions most
  // shoppers here are making.
  shabbat: ["kiddush-cup-guide", "pamotim-guide"],
  // הבדלה — 111 products; borrowed the kiddush-cup guide until its own existed.
  havdalah: ["havdalah-guide", "kiddush-cup-guide"],
  // פמוטים — 263 products; borrowed the kiddush-cup guide until its own existed.
  candlesticks: ["pamotim-guide", "kiddush-cup-guide"],
  // Children of `shabbat`, which until now sent them to the kiddush-cup guide:
  // כיסויי חלה (128) and מגשי חלה, מפיונים ותחתיות (79).
  "challah-covers": ["challah-guide", "personalization-guide"],
  "karshei-chala-sakinim": ["challah-guide"],
  // חנוכה sits under chagim; chagim itself stays unmapped because it also holds
  // Pesach and Rosh Hashana, for which no guide exists yet.
  hanukkah: ["hanukkia-guide"],
  // כיפות — all nine sub-categories (קטיפה, סרוגות, DMC, פריק, סטן וטרילין,
  // עור, מיוחדות, סרוגות עם רקמה, סיכות) have parent_slug 'kipot', so this one
  // entry reaches the store's largest line: 743 products, previously no guide.
  kipot: ["kippa-guide"],
  // נטילת ידיים ומים אחרונים — 267 products, a flat category (no children).
  "netilat-yadaim": ["natla-guide"],
  // ברכונים — 91 products, a flat top-level category (no parent, no children).
  birchonim: ["birchon-guide"],
  // Shelves whose main buying question is the name on the item: סידורים (79,
  // הטבעה or laser; no siddur guide yet — see the backlog), סטים לחלאקה (40)
  // and מארזים לחתן (11).
  sidurim: ["personalization-guide"],
  // ברכות חמסות וסגולות — 301 products, the largest shelf without a guide
  // until 2026-09-27. The parent entry reaches its three children (ברכות 235,
  // חמסות 52, סגולות 14) by the parent walk.
  "brachot-chamsot-segulot": ["birkat-habait-guide"],
  "chalaka-set": ["set-chalaka-madrich", "personalization-guide"],
  // כרית לברית — pillows and baby gowns for the brit; a flat category.
  "karit-labrit": ["karit-labrit-madrich"],
  // קופות צדקה — 68 products, a flat top-level category; no guide until
  // 2026-09-27.
  "kupot-tzedaka": ["kupat-tzedaka-guide"],
  // מחזיקי מפתחות ומגנטים — 198 products, the largest guide-less shelf until
  // 2026-09-27. The parent reaches its two children (מחזיק מפתחות, מגנטים)
  // by the parent walk.
  "machzikei-maftechot-magnetim": ["machzikei-maftechot-guide"],
  // מוצרי בית כנסת ושטנדרים — 64 products, a flat top-level category; no
  // guide until 2026-09-27.
  "beit-knesset-shtenderim": ["shtender-guide"],
  // תכשיטים — 64 products; the parent reaches its three children (כסף טהור,
  // נרוסטה ורודיום, צמידים טבעות ועגילים) by the parent walk.
  tachshitim: ["tachshitim-guide"],
  "marazim-chatanim": ["personalization-guide"],
};

/** Reverse: guide → the categories worth sending a reader to. */
export const GUIDE_CATEGORIES: Record<string, string[]> = {
  "bechira-talit": ["talitot", "setim-talit-tefilin", "tikei-talit"],
  // NOT batei-tefilin-marot alone: that category holds 15 products, so the
  // guide's own DB-driven rail is thin. These are the stocked shelves.
  "tefillin-guide": ["tikei-talit", "setim-talit-tefilin", "talit-tefillin-covers"],
  "mezuza-guide": ["plastic", "mezuzot-polyresin-even", "mezuzot-plastik"],
  "kiddush-cup-guide": ["gviei-kidush", "gviei-kidush-crystal-keramika", "candlesticks"],
  "hanukkia-guide": ["hanukkah", "chagim"],
  // The three shelves the guide spends most words on.
  "kippa-guide": ["kipot-srugot", "kipot-ktifa", "kipot-dmc-avodat-yad"],
  "natla-guide": ["netilat-yadaim"],
  "birchon-guide": ["birchonim"],
  "pamotim-guide": ["candlesticks"],
  "challah-guide": ["challah-covers", "karshei-chala-sakinim"],
  "havdalah-guide": ["havdalah"],
  // The three shelves the guide names first, then the siddurim it explains.
  "personalization-guide": ["setim-talit-tefilin", "tikei-talit", "challah-covers", "sidurim"],
  "birkat-habait-guide": ["blessings", "chamsot"],
  "mechir-talit-bar-mitzva": ["talitot", "setim-talit-tefilin"],
  "set-chalaka-madrich": ["chalaka-set"],
  "karit-labrit-madrich": ["karit-labrit"],
  "kupat-tzedaka-guide": ["kupot-tzedaka"],
  "machzikei-maftechot-guide": ["machzikei-maftechot-magnetim"],
  "shtender-guide": ["beit-knesset-shtenderim"],
  // Not tzmidim-tabaot-agilim: 9 of its 13 are retail display stands whose
  // prices are with the owner (docs/improvement-workflow.md).
  "tachshitim-guide": ["tachshitei-kesef-tahor", "tachshitei-nirosta-rodium"],
};

/**
 * guide → OCCASION HUB(S). The third edge in this file, and the one that was
 * missing.
 *
 * GUIDE_CATEGORIES above sends a reader to a CATEGORY — the right destination
 * for "I now know what to look for, show me the shelf". It is the wrong
 * destination for the paragraph every one of these guides ends on. Measured on
 * the live bodies 2026-08-09, all five carry an "as a gift" <h2> of their own:
 *
 *   bechira-talit      "טלית כמתנה"
 *   tefillin-guide     "תפילין כמתנה לבר מצווה"
 *   mezuza-guide       "מזוזה כמתנה"
 *   kiddush-cup-guide  "גביע קידוש כמתנה"
 *   hanukkia-guide     "חנוכיה כמתנה"
 *
 * A reader in that paragraph is not shopping a shelf, they are shopping an
 * OCCASION — and /collection/<slug> is the surface this site already built for
 * exactly that (7 curated hubs, each unioning several real categories). Before
 * this mapping the five guides emitted ZERO /collection/ links between them,
 * while sitting at Search Console positions 12-26, i.e. the site's best-ranking
 * pages passed nothing to its most commercial landing pages.
 *
 * The pairing is the guide's own sentence, not a guess:
 *   tefillin-guide / bechira-talit  → bar-mitzva   (the tefillin guide's gift
 *                                     heading literally says לבר מצווה, and the
 *                                     tallit guide's gift section is the same
 *                                     occasion)
 *   mezuza-guide                    → bait-chadash (a mezuza is the housewarming
 *                                     gift; that hub leads on מזוזות)
 *   kiddush-cup-guide               → bait-chadash + chatan-kala (its own gift
 *                                     paragraph names "חנוכת בית" and "חתונה")
 *   hanukkia-guide                  → matanot-hanukkah
 *
 * Slugs are resolved against OCCASION_COLLECTIONS at read time by
 * occasionsForGuide(), so a typo here renders NOTHING rather than a dead link.
 */
export const GUIDE_OCCASIONS: Record<string, string[]> = {
  "tefillin-guide": ["bar-mitzva"],
  "bechira-talit": ["bar-mitzva"],
  "mezuza-guide": ["bait-chadash"],
  "kiddush-cup-guide": ["bait-chadash", "chatan-kala"],
  "hanukkia-guide": ["matanot-hanukkah"],
  // Its own "כיפה לאירוע" section names בר מצווה and חתונה.
  "kippa-guide": ["bar-mitzva", "chatan-kala"],
  // Its own gift line names חתונה and חנוכת בית.
  "natla-guide": ["bait-chadash", "chatan-kala"],
  // Its own gift section names חתונה and חנוכת בית; chatan-kala already
  // carries birchonim as the guests' keepsake.
  "birchon-guide": ["chatan-kala", "bait-chadash"],
  // Its own gift section names the bride and חנוכת בית; bait-chadash stocks
  // candlesticks directly.
  "pamotim-guide": ["chatan-kala", "bait-chadash"],
  // Its gift section names חתונה and חנוכת בית; bait-chadash stocks
  // challah-covers directly.
  "challah-guide": ["bait-chadash", "chatan-kala"],
  // Its gift section names חנוכת בית and a young couple.
  "havdalah-guide": ["bait-chadash", "chatan-kala"],
  // Its "מה לכתוב" section is organised by these three events.
  "personalization-guide": ["bar-mitzva", "chatan-kala", "chalaka"],
  // Its gift section names חנוכת בית first, then the young couple.
  "birkat-habait-guide": ["bait-chadash", "chatan-kala"],
  // The price of a tallit for exactly this occasion.
  "mechir-talit-bar-mitzva": ["bar-mitzva"],
  "set-chalaka-madrich": ["chalaka"],
  // Its gift section names חנוכת בית first, then בר מצווה.
  "kupat-tzedaka-guide": ["bait-chadash", "bar-mitzva"],
  // Its gift section names guests at a בר מצווה or a wedding.
  "machzikei-maftechot-guide": ["bar-mitzva", "chatan-kala"],
  // Its gift section leads with בר מצווה.
  "shtender-guide": ["bar-mitzva"],
  // Its gift section names the bride ("אני לדודי"). No bat-mitzva hub exists,
  // and bar-mitzva stocks tallit and tefillin, not jewelry.
  "tachshitim-guide": ["chatan-kala"],
  // karit-labrit-madrich: no brit hub exists, and no other occasion fits —
  // see GUIDES_WITHOUT_OCCASION.
};

/**
 * Guides with no occasion hub to send a reader to, on purpose. A brit has no
 * /collection/ page, and pointing the pillow guide at "bar-mitzva" or
 * "chalaka" to satisfy the registry test would be a link that answers a
 * different question.
 */
export const GUIDES_WITHOUT_OCCASION = new Set<string>(["karit-labrit-madrich"]);

/** What a guide's occasion CTA needs to render one link. */
export type OccasionRef = { slug: string; title: string; eyebrow: string };

/**
 * Occasion hubs for one guide, resolved to real collections.
 *
 * Pure: OCCASION_COLLECTIONS is plain data with no React and no browser
 * globals, so this stays safe on the Cloudflare Workers SSR path — which is the
 * whole point, since an anchor a crawler never sees passes no authority.
 */
export function occasionsForGuide(guideSlug: string): OccasionRef[] {
  return (GUIDE_OCCASIONS[guideSlug] ?? [])
    .map((slug) => OCCASION_COLLECTIONS.find((c) => c.slug === slug))
    .filter((c): c is (typeof OCCASION_COLLECTIONS)[number] => !!c)
    .map((c) => ({ slug: c.slug, title: c.title, eyebrow: c.eyebrow }));
}

/** Topically related guides, for the "מאמרים נוספים" block. */
export const GUIDE_CLUSTERS: string[][] = [
  // The bar-mitzva set: tallit, tefillin and kippa are bought together.
  // The name guide sits after tefillin: it is mostly about the bags.
  // The tallit-price guide sits next to the tallit guide it builds on, and the
  // shtender closes it: the bar-mitzva boy's desk for learning.
  [
    "bechira-talit",
    "mechir-talit-bar-mitzva",
    "tefillin-guide",
    "personalization-guide",
    "kippa-guide",
    "shtender-guide",
  ],
  // The child's milestones before the bar mitzva: the brit, then the chalaka.
  ["karit-labrit-madrich", "set-chalaka-madrich"],
  // The table, in an order where neighbours are the closest topics — see
  // relatedGuides(): kiddush sits between havdalah (the other cup) and the
  // candlesticks, the challah between the candlesticks and the birchonim.
  [
    "hanukkia-guide",
    "havdalah-guide",
    "kiddush-cup-guide",
    "pamotim-guide",
    "challah-guide",
    "birchon-guide",
  ],
  // The home: the doorpost, the walls, the sink — the blessings sit between the
  // other two, since אשר יצר hangs by the bathroom, a step from the natla.
  // The tzedakah box closes it: it stands in the same rooms, often by the
  // candlesticks. The key-chain guide sits by the blessings: hamsa, Shema and
  // אם אשכחך are the same texts, carried instead of hung.
  [
    "mezuza-guide",
    "tachshitim-guide",
    "machzikei-maftechot-guide",
    "birkat-habait-guide",
    "natla-guide",
    "kupat-tzedaka-guide",
  ],
];

type CatNode = { slug: string; parent_slug?: string | null };

/**
 * Guides for one category, climbing `parent_slug` until something matches.
 * `allCats` is optional — the category route already has the full list in its
 * loader, so the walk costs nothing there; callers without it just get the
 * direct hit plus one explicit parent level.
 */
export function guidesForCategory(
  slug: string | undefined,
  parentSlug?: string | null,
  allCats?: CatNode[],
): GuideRef[] {
  if (!slug) return [];
  const seen = new Set<string>();
  let cur: string | null | undefined = slug;
  // Bounded: the tree is two levels today, the cap just makes a cyclic
  // parent_slug (bad data) impossible to hang on.
  for (let hops = 0; cur && hops < 5; hops++) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const hit = CATEGORY_GUIDES[cur];
    if (hit) return hit.map((g) => GUIDES[g]).filter(Boolean);
    cur =
      hops === 0 && parentSlug !== undefined
        ? parentSlug
        : (allCats?.find((c) => c.slug === cur)?.parent_slug ?? null);
  }
  return [];
}

/**
 * Guides for a product, from all of its category slugs. Deduped and capped at 2
 * so the PDP reads as a contextual pointer rather than a boilerplate link block
 * repeated across 4,600 pages.
 */
export function guidesForCategories(slugs: string[], cap = 2): GuideRef[] {
  const out: GuideRef[] = [];
  const seen = new Set<string>();
  for (const s of slugs) {
    for (const g of CATEGORY_GUIDES[s] ?? []) {
      if (seen.has(g) || !GUIDES[g]) continue;
      seen.add(g);
      out.push(GUIDES[g]);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

/** Categories to send a guide's reader to. Empty ⇒ caller keeps its own CTA. */
export function categoriesForGuide(guideSlug: string): string[] {
  return GUIDE_CATEGORIES[guideSlug] ?? [];
}

/**
 * Sibling guides in the same topical cluster, excluding the current one,
 * nearest first: clusters are written so that neighbours are the closest
 * topics, and ties keep the written order.
 */
export function relatedGuides(guideSlug: string): GuideRef[] {
  const cluster = GUIDE_CLUSTERS.find((c) => c.includes(guideSlug)) ?? [];
  const at = cluster.indexOf(guideSlug);
  return cluster
    .map((g, i) => ({ g, d: Math.abs(i - at), i }))
    .filter(({ g }) => g !== guideSlug)
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ g }) => GUIDES[g])
    .filter(Boolean);
}

/**
 * The order for a guide's "מאמרים נוספים": its topical siblings first
 * (relatedGuides), then every other article in the order given — the article
 * route passes them newest first. Until this, GUIDE_CLUSTERS was not read
 * anywhere and the block showed the two most recent articles whatever the
 * topic, so a reader of the havdalah guide was offered kippot.
 */
export function orderByTopic<T extends { slug: string }>(guideSlug: string, articles: T[]): T[] {
  const siblings = relatedGuides(guideSlug).map((g) => g.slug);
  const rank = (slug: string) => {
    const r = siblings.indexOf(slug);
    return r === -1 ? siblings.length : r;
  };
  return articles
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a.slug) - rank(y.a.slug) || x.i - y.i)
    .map(({ a }) => a);
}
