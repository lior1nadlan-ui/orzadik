// Shelf facets that can actually change a result set.
//
// WHAT WAS THERE BEFORE
//
// /category/$slug shipped two controls. Measured live on 2026-08-06 through the
// anon REST API with count=exact:
//
//   • "במלאי בלבד" — 0 of 4,648 active products carry stock_status
//     'outofstock', and track_stock is false. The checkbox could not change a
//     result set on any page of the site. It is removed by this change (the
//     tile badge and the out-of-stock sink stay: they cost nothing and stay
//     correct if inventory is ever tracked).
//   • three GLOBAL price buckets — עד ₪100 / ₪100-300 / ₪300+. On
//     /category/kipot all 671 collapsed cards land in the first one (the shelf
//     runs ₪4-88), so the control offered three chips of which one selected
//     everything and two selected nothing.
//
// WHAT REPLACES THEM
//
//   • a price ladder derived from THE SHELF'S OWN quartiles, so every rung
//     holds roughly a quarter of the shelf and is labelled with real numbers;
//   • material / colour / size, parsed out of the ' | חומר: … | צבע: … |
//     מידות: … ' tail the supplier already writes into short_description.
//     2,383 of the 4,648 active products carry that tail (51%).
//
// THE CONTIGUITY RULE, PRESERVED FROM THE OLD PRICE_BUCKETS
//
// Bounds are the price the customer actually pays — getEffectivePrice(price) —
// so the labels match the numbers on every card, and the rungs are contiguous
// and non-overlapping: (-inf,c1] (c1,c2] (c2,c3] (c3,inf). Every card lands in
// exactly one rung, so the four counts always sum to the shelf. Pure filtering:
// the rungs carry no sale or discount language, only the paid price.
//
// RTL: labels are built with an ASCII hyphen, NEVER U+2013. An en dash is bidi
// class ON, so UAX#9 N1 reverses it inside RTL text and "₪14-24" would paint as
// "₪24-14". This bug has been reintroduced three times on this site.

import { getEffectivePrice } from "@/lib/pricing";

/* ------------------------------ price ladder ------------------------------ */

export type PriceRung = {
  /** URL id built from the BOUNDS. `lo` is exclusive, `hi` inclusive. */
  id: string;
  label: string;
  lo: number;
  hi: number;
  count: number;
};

/**
 * Stable, drift-proof id: the bounds, not the quartile that produced them.
 *
 * The open end is spelled "*" and NOT left empty. An empty low bound produced
 * ids like "-33", and TanStack Router's search parser reads a numeric-looking
 * value as a NUMBER — so `?price=-33` arrived as -33, failed the
 * `typeof === "string"` guard in validateSearch, and the lowest rung on every
 * ladder silently did nothing while the other three worked. Caught on /shop on
 * 2026-08-06 (count stayed 3,540 with the rung visibly active). "*" can never
 * be read as a number.
 */
const rungId = (lo: number, hi: number) =>
  `${Number.isFinite(lo) ? lo : "*"}-${Number.isFinite(hi) ? hi : "*"}`;

const rungLabel = (lo: number, hi: number) =>
  !Number.isFinite(lo) ? `עד ₪${hi}` : !Number.isFinite(hi) ? `₪${lo}+` : `₪${lo}-${hi}`;

/**
 * Parse a `?price=` value back into bounds.
 *
 * Deliberately parsed from the URL rather than matched against the CURRENT
 * ladder: a shared link keeps meaning the same range after the next supplier
 * import moves the shelf's quartiles. An unparseable value narrows to no
 * filter, the same way the route already treats "?sort=garbage".
 */
export function parsePriceRung(v: unknown): { lo: number; hi: number } | null {
  if (typeof v !== "string") return null;
  // "" is still accepted on either side so links shared before the "*" form
  // existed keep working.
  const m = /^(\d*|\*)-(\d*|\*)$/.exec(v.trim());
  if (!m) return null;
  const open = (s: string) => s === "" || s === "*";
  const lo = open(m[1]) ? Number.NEGATIVE_INFINITY : Number(m[1]);
  const hi = open(m[2]) ? Number.POSITIVE_INFINITY : Number(m[2]);
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return null;
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo >= hi) return null;
  return { lo, hi };
}

export const inPriceRung = (price: number, r: { lo: number; hi: number }) => {
  const eff = getEffectivePrice(price);
  return eff > r.lo && eff <= r.hi;
};

/**
 * Four rungs cut at the shelf's own quartiles.
 *
 * Rungs whose count is 0 are dropped — a chip that cannot change a result set
 * is the defect this file exists to remove, and quartiles collapse into each
 * other on a shelf where most items share one price. A ladder that ends up with
 * fewer than two live rungs is dropped entirely for the same reason: one chip
 * that selects everything is not a filter.
 */
export function derivePriceRungs(prices: number[]): PriceRung[] {
  if (prices.length < 8) return [];
  const sorted = prices.map((p) => getEffectivePrice(p)).sort((a, b) => a - b);
  const at = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  const cuts = [at(0.25), at(0.5), at(0.75)];

  const bounds: Array<[number, number]> = [];
  let lo = Number.NEGATIVE_INFINITY;
  for (const c of cuts) {
    if (c > lo) {
      bounds.push([lo, c]);
      lo = c;
    }
  }
  bounds.push([lo, Number.POSITIVE_INFINITY]);

  const rungs = bounds
    .map(([l, h]) => ({
      id: rungId(l, h),
      label: rungLabel(l, h),
      lo: l,
      hi: h,
      count: sorted.filter((v) => v > l && v <= h).length,
    }))
    .filter((r) => r.count > 0);

  return rungs.length >= 2 ? rungs : [];
}

/* --------------------- material / colour / size facets -------------------- */

export type ProductAttributes = {
  /** material */ m?: string;
  /** colours — the supplier writes compounds like 'לבן,כסף' */ c?: string[];
  /** size */ s?: string;
};

export type FacetKey = "m" | "c" | "s";

export type FacetBucket = { value: string; count: number };
export type FacetGroup = { key: FacetKey; label: string; buckets: FacetBucket[] };

export const FACET_LABELS: Record<FacetKey, string> = {
  m: "חומר",
  c: "צבע",
  s: "מידה",
};

/**
 * Spelling variants the supplier actually shipped, measured across all 4,648
 * active products on 2026-08-06. Folding them is the difference between a
 * usable facet and a list of one-item buckets.
 *
 * NOTE the two folds that are deliberately ABSENT: 'עור' (15 products) is NOT
 * folded into 'דמוי עור' (432) and 'כסף' is NOT folded into 'כסף טהור' (23).
 * They are different materials at different prices, and a substring fold would
 * tell a shopper that faux leather is leather. Materials get exact-match
 * aliases only.
 */
const MATERIAL_ALIASES: Record<string, string> = {
  פרפסקס: "פרספקס", // 11 → joins 145
  פוליריזן: "פולירזין", // 20 → joins 41
  פולירזן: "פולירזין", // 1
};

/**
 * Colour bases. A supplier value folds to the first base it CONTAINS, which is
 * what turns 'גימור זהב' (40) into זהב, 'גימור ניקל' (56) into ניקל and
 * 'כחול כהה' (2) into כחול. Longer bases are listed before the shorter ones
 * they contain so the first match is the most specific.
 */
const COLOR_BASES = [
  "רוז גולד",
  "כחול",
  "תכלת",
  "טורקיז",
  "שחור",
  "לבן",
  "אפור",
  "כסף",
  "ניקל",
  "זהב",
  "טבעי",
  "צבעוני",
  "שקוף",
  "חום",
  "קרם",
  "ירוק",
  "ורוד",
  "סגול",
  "אדום",
  "צהוב",
  "פיוטר",
  "בורדו",
  "כתום",
];

/** Values that name nothing a shopper can choose. */
const MEANINGLESS = new Set(["אחר", "שונים", "שונות", "לא צוין", "-"]);

const tidy = (s: string) =>
  s
    .replace(/[׳״‘’“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/[.,;]+$/, "")
    .trim();

function foldColor(raw: string): string | null {
  const v = tidy(raw);
  if (!v || MEANINGLESS.has(v)) return null;
  for (const base of COLOR_BASES) if (v.includes(base)) return base;
  return v;
}

function foldMaterial(raw: string): string | null {
  const v = tidy(raw);
  if (!v || MEANINGLESS.has(v)) return null;
  return MATERIAL_ALIASES[v] ?? v;
}

/**
 * Sizes stay as the supplier's own Hebrew phrase ('אורך 19 ס"מ', or
 * 'אורך 36 ס"מ, רוחב 29 ס"מ' when there are two dimensions) — normalised for
 * whitespace and the quote family only.
 *
 * Rewriting a two-dimension size into a compact 36x29 form was rejected: both
 * U+00D7 and a bare ASCII 'x' sit between digits inside an RTL run, which is
 * exactly the bidi hazard the house rule bans. The Hebrew words separate the
 * numbers and paint correctly with no override characters.
 */
function foldSize(raw: string): string | null {
  const v = tidy(raw);
  if (!v || MEANINGLESS.has(v)) return null;
  return v;
}

/** The supplier tail: 'חומר: קטיפה | צבע: שחור | מידות: אורך 19 ס"מ'. */
const TAIL_PATTERN = /(חומר|צבע|מידות|מידה)\s*:\s*([^|\n]+)/g;

/**
 * Pull the attribute tail out of a product's short_description. Colour is
 * sometimes a comma-joined compound ('לבן,כסף'), which is split so a shopper
 * filtering לבן finds it.
 */
export function parseAttributeTail(text: string | null | undefined): ProductAttributes | undefined {
  if (!text) return undefined;
  const attrs: ProductAttributes = {};
  for (const match of text.matchAll(TAIL_PATTERN)) {
    const [, key, value] = match;
    if (key === "חומר") {
      const v = foldMaterial(value.split(",")[0]);
      if (v) attrs.m = v;
    } else if (key === "צבע") {
      const list = value
        .split(",")
        .map(foldColor)
        .filter((v): v is string => !!v);
      if (list.length) attrs.c = [...new Set(list)];
    } else {
      const v = foldSize(value);
      if (v) attrs.s = v;
    }
  }
  return attrs.m || attrs.c || attrs.s ? attrs : undefined;
}

/** A bucket must be worth tapping AND must leave something out. */
const MIN_BUCKET = 2;
const MAX_BUCKETS = 10;

/**
 * Build the facet groups for ONE shelf, from that shelf's own rows.
 *
 * Three rules, all of them the same rule: never render a control that cannot
 * change the result set.
 *   1. a bucket needs at least MIN_BUCKET rows — an unnormalised parse produces
 *      one-item buckets, which is worse than no facet at all;
 *   2. a bucket that holds the WHOLE shelf is dropped: tapping it changes
 *      nothing;
 *   3. a group with fewer than two surviving buckets is dropped entirely.
 * A chip whose count is 0 can therefore never be emitted.
 */
export function buildFacetGroups(rows: Array<{ attrs?: ProductAttributes }>): FacetGroup[] {
  const total = rows.length;
  const tally: Record<FacetKey, Map<string, number>> = { m: new Map(), c: new Map(), s: new Map() };
  const bump = (k: FacetKey, v: string) => tally[k].set(v, (tally[k].get(v) ?? 0) + 1);

  for (const row of rows) {
    const a = row.attrs;
    if (!a) continue;
    if (a.m) bump("m", a.m);
    if (a.s) bump("s", a.s);
    for (const c of a.c ?? []) bump("c", c);
  }

  return (["m", "c", "s"] as FacetKey[])
    .map((key) => ({
      key,
      label: FACET_LABELS[key],
      buckets: [...tally[key].entries()]
        .filter(([, n]) => n >= MIN_BUCKET && n < total)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he"))
        .slice(0, MAX_BUCKETS)
        .map(([value, count]) => ({ value, count })),
    }))
    .filter((g) => g.buckets.length >= 2);
}

export type SelectedFacets = Record<FacetKey, string[]>;

export const EMPTY_FACETS: SelectedFacets = { m: [], c: [], s: [] };

/**
 * Read a comma-joined `?m=` / `?c=` / `?s=` value, keeping only values this
 * shelf actually offers.
 *
 * Dropping unknown values is what keeps a stale shared link from rendering an
 * empty grid: an unrecognised value is ignored rather than matching nothing —
 * the same "unknown value narrows to no filter" contract the route already
 * applies to ?sort=.
 */
export function parseFacetParam(raw: unknown, offered: FacetBucket[]): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const allowed = new Set(offered.map((b) => b.value));
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => allowed.has(s)),
    ),
  ];
}

/** Multi-select is OR inside a group and AND across groups. */
export function matchesFacets(attrs: ProductAttributes | undefined, sel: SelectedFacets): boolean {
  if (sel.m.length && !(attrs?.m && sel.m.includes(attrs.m))) return false;
  if (sel.s.length && !(attrs?.s && sel.s.includes(attrs.s))) return false;
  if (sel.c.length && !(attrs?.c ?? []).some((c) => sel.c.includes(c))) return false;
  return true;
}

export const countSelected = (sel: SelectedFacets) => sel.m.length + sel.c.length + sel.s.length;

/**
 * Said once, in the facet sheet: the tail is supplier data and half the
 * catalogue does not carry it, so a material/colour/size filter shows only the
 * items that are tagged. Measured 2026-08-06: 2,383 of 4,648. Stating it is the
 * difference between an honest filter and one that implies the shop has no
 * velvet kippot when it has 149 tagged and more untagged.
 */
export const FACET_COVERAGE_NOTE =
  "לא לכל הפריטים מסומנים חומר, צבע ומידה. סינון לפי מאפיין יציג את הפריטים שסומנו בלבד.";
