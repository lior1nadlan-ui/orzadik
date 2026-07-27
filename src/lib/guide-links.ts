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
  talitot: ["bechira-talit"],
  atara: ["bechira-talit"],
  "talit-clips": ["bechira-talit"],
  "setim-talit-tefilin": ["bechira-talit", "tefillin-guide"],
  "tikei-talit": ["bechira-talit", "tefillin-guide"],
  "tefillin-cases": ["tefillin-guide"],
  "batei-tefilin-marot": ["tefillin-guide"],
  "talit-tefillin-sets": ["tefillin-guide", "bechira-talit"],
  // מזוזות — parent of the polyresin/plastic/aluminium children.
  plastic: ["mezuza-guide"],
  // גביעי קידוש — parent of the crystal/metal children.
  "gviei-kidush": ["kiddush-cup-guide"],
  "metal-kiddush-cups": ["kiddush-cup-guide"],
  "crystal-ceramic-kiddush-cups": ["kiddush-cup-guide"],
  // שבת — the kiddush cup is the decision most shoppers here are making.
  shabbat: ["kiddush-cup-guide"],
  havdalah: ["kiddush-cup-guide"],
  candlesticks: ["kiddush-cup-guide"],
  // חנוכה sits under chagim; chagim itself stays unmapped because it also holds
  // Pesach and Rosh Hashana, for which no guide exists yet.
  hanukkah: ["hanukkia-guide"],
};

/** Reverse: guide → the categories worth sending a reader to. */
export const GUIDE_CATEGORIES: Record<string, string[]> = {
  "bechira-talit": ["talitot", "setim-talit-tefilin", "tikei-talit"],
  // NOT batei-tefilin-marot alone: that category holds 15 products, so the
  // guide's own DB-driven rail is thin. These are the stocked shelves.
  "tefillin-guide": ["tikei-talit", "setim-talit-tefilin", "talit-tefillin-sets"],
  "mezuza-guide": ["plastic", "mezuzot-polyresin-even", "mezuzot-plastik"],
  "kiddush-cup-guide": ["gviei-kidush", "gviei-kidush-crystal-keramika", "candlesticks"],
  "hanukkia-guide": ["hanukkah", "chagim"],
};

/** Topically related guides, for the "מאמרים נוספים" block. */
export const GUIDE_CLUSTERS: string[][] = [
  ["bechira-talit", "tefillin-guide"],
  ["kiddush-cup-guide", "hanukkia-guide"],
  ["mezuza-guide"],
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
    cur = hops === 0 && parentSlug !== undefined
      ? parentSlug
      : allCats?.find((c) => c.slug === cur)?.parent_slug ?? null;
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

/** Sibling guides in the same topical cluster, excluding the current one. */
export function relatedGuides(guideSlug: string): GuideRef[] {
  const cluster = GUIDE_CLUSTERS.find((c) => c.includes(guideSlug)) ?? [];
  return cluster.filter((g) => g !== guideSlug).map((g) => GUIDES[g]).filter(Boolean);
}
