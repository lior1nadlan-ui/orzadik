// THE ordering of a shelf — one function, shared by the THREE client-ordered
// listings: /category/$slug, /collection/$slug and /collection/personalized.
//
// /shop IS NOT A CALLER, deliberately. It is server-paged: list_products_collapsed
// returns 24 rows at a time with its own total, so calling orderShelf there could
// only reshuffle the 24 rows already fetched — page 1 would look shaped while the
// shelf underneath stayed price-DESC, which is worse than an honestly wrong order
// because it hides itself. Fixing /shop means a new sort branch inside the RPC,
// not a client-side call, and it is out of scope here. Two consequences follow
// and neither is a bug to be surprised by later: /shop cannot be pinned through
// SHELF_ORDER_PINS, and /shop still opens on the catalogue's ceiling.
//
// WHY THIS FILE EXISTS AT ALL
//
// Every listing on this site defaulted to price DESC. /category/$slug sorted
// `b.price - a.price`; /collection/$slug and /collection/personalized sorted
// `b.price - a.price` under a comment describing it as "premium … for a
// gift-guide feel"; /shop's RPC ends its "recommended" branch on `r.price DESC`
// once the constant in-stock / has-photo / has-copy keys fall through — and that
// last one is still true, see above.
//
// Measured against the live catalogue on 2026-08-06 (anon REST, count=exact),
// that is the wrong default for THIS shop:
//
//   /category/kipot   671 collapsed cards, effective prices ₪4-88, median ₪24.
//                     Page 1 under price DESC opened
//                     88 88 88 83 83 83 71 71 71 69 69 67 67 57 57 57 57 57 53…
//                     — every tile in the top 8% of the shelf.
//   /category/chagim  357 cards, median ₪118. Page 1 opened 958 840 756 756 756…
//   /category/shabbat 242 cards, median ₪152. Page 1 opened 669 486 426 426 426…
//
// A stranger who arrives from Google for a ₪24 kippah is shown the ceiling of
// the shelf she asked for. That is the ₪756-homepage failure reproduced one
// route deeper.
//
// WHAT REPLACES IT, AND WHY NOT CHEAPEST-FIRST
//
// Ascending is the other wrong answer: the kipot floor is ₪4 and eight products
// sit at ₪4-6, so price ASC opens on a wall of them and prices the shop as
// tat. The rule is SHAPE, not floor — open every shelf on the items that are
// typical of it, and let the first screen show the real spread.
//
// So: partition the shelf into its own sub-families, order each family OUTWARD
// FROM ITS OWN MEDIAN by recursive bisection (median, then the two quartiles,
// then the eighths…), and round-robin across the families. The median leads, so
// nothing opens on its ceiling or its floor; the bisection means consecutive
// picks from one family are maximally far apart in price, which is what stops
// the visible run of near-identical numbers a naive ±1 walk produces.
//
// Measured page 1 after the change (effective ₪, same shelves as above):
//   kipot   24 33 13 19 10 53 19 19 5 43 6 29 12 19 4 48 15 19 5 43 29 43 14 19
//           → median ₪19, range ₪4-53, 10 of the 9 sub-families represented
//   chagim  218 76 84 235 134 67 46 37 20 118 336 92 151 336 168 27 29 22 17 34…
//           → median ₪84, range ₪17-336
//   shabbat 106 182 182 152 213 82 137 76 106 122 152 213 365 274 243 61 61 39…
//           → median ₪137, range ₪39-365
//
// KNOWN LIMIT, RECORDED HONESTLY: this is taste replacing the file's previous
// taste. It is defensible from the distribution above but has never been A/B'd
// against real orders (there are none yet). SHELF_ORDER_PINS below exists so a
// shelf that reads badly can be pinned to an explicit sort from one config line
// rather than a code change.

import { getEffectivePrice } from "@/lib/pricing";

/**
 * The minimum a row must carry to be ordered. Every listing row on this site is
 * a superset of this: /category and /collection read the same product columns.
 *
 * `family` is the sub-shelf a row belongs to — a child category slug on
 * /category, the source collection slug on /collection. Null/absent is fine:
 * a shelf with fewer than two distinct families falls back to price-quartile
 * bands (see orderShelf) so single-family shelves still get a spread.
 */
export type ShelfRow = {
  id: string;
  name: string;
  price: number;
  thumbnail_url?: string | null;
  stock_status?: string | null;
  created_at?: string | null;
  family?: string | null;
};

/** The default ("shape") plus the explicit sorts a shopper can choose. */
export type CatalogSort = "shape" | "price-asc" | "price-desc" | "newest" | "oldest" | "name";

/**
 * Per-shelf escape hatch. Value is the sort that shelf opens on instead of
 * "shape". Empty on purpose — it exists so pinning a shelf is a one-line config
 * edit with a reason attached, not a refactor. Only consulted when the shopper
 * has NOT chosen a sort of their own.
 *
 * KEY FORMAT, fixed here so the three callers cannot each invent their own:
 * the route family, a slash, the slug —
 *
 *     "category/kipot"            /category/kipot
 *     "collection/bar-mitzvah"    /collection/bar-mitzvah
 *     "collection/personalized"   /collection/personalized
 *
 * Namespaced rather than bare, because a category slug and a collection slug
 * live in different tables and nothing stops them colliding: pinning "shabbat"
 * would otherwise silently pin both the 242-card category and any collection
 * that ever takes that slug. Add an entry WITH A COMMENT saying what was read
 * on the shelf that justified it.
 */
export const SHELF_ORDER_PINS: Record<string, CatalogSort> = {};

/** Effective (paid) price, with "call for price" rows (price<=0) normalised. */
const effOf = (row: ShelfRow) => getEffectivePrice(row.price);

/**
 * Recursive-bisection visit order over the indices of an ascending list:
 * middle first, then the middle of each half, then of each quarter…
 *
 * This is what makes "outward from the median" survive contact with the real
 * catalogue. A naive ±1 walk out from the median picks neighbours in the sorted
 * list, and thousands of rows here share a price — /category/netilat-yadaim
 * produced 24 tiles carrying only 5 distinct prices that way. Bisection puts
 * the widest-apart items next to each other, and the same shelf then shows 13.
 */
function bisectionOrder(n: number): number[] {
  const out: number[] = [];
  const queue: Array<[number, number]> = [[0, n - 1]];
  while (queue.length) {
    const [lo, hi] = queue.shift()!;
    if (lo > hi) continue;
    const mid = (lo + hi) >> 1;
    out.push(mid);
    if (lo <= mid - 1) queue.push([lo, mid - 1]);
    if (mid + 1 <= hi) queue.push([mid + 1, hi]);
  }
  return out;
}

/**
 * Fallback families for a shelf that has none of its own (e.g.
 * /category/netilat-yadaim: 267 products, zero subcategories). Four bands cut
 * at the shelf's own price quartiles, so the round-robin still alternates
 * cheap / mid / dear instead of walking one long list.
 */
function quartileBands(rows: ShelfRow[]): string[] {
  const sorted = rows.map(effOf).sort((a, b) => a - b);
  const at = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  const [c1, c2, c3] = [at(0.25), at(0.5), at(0.75)];
  return rows.map((r) => {
    const v = effOf(r);
    return v <= c1 ? "q1" : v <= c2 ? "q2" : v <= c3 ? "q3" : "q4";
  });
}

/**
 * Codepoint name order — NOT localeCompare(name, "he").
 *
 * Every sort in this file feeds an SSR render AND the client grid, and the two
 * must agree exactly or head()'s ItemList drifts from the rendered anchors. The
 * hazard is recorded in categories.tsx:117-122: Hebrew collation depends on the
 * ICU data the runtime ships, and the Cloudflare Workers SSR pass and the
 * browser do not ship the same ICU. A locale-aware key is therefore a hydration
 * bug wherever it is the primary order, and the tie branch here is exercised
 * constantly — thousands of these rows share a price.
 *
 * Plain < / > compares UTF-16 code units, which is identical on every runtime.
 * For this catalogue it is also the right answer: the Hebrew alphabet occupies
 * U+05D0-U+05EA in alphabetical order, so codepoint order IS א-ב order for
 * Hebrew names, and non-Hebrew names sort consistently rather than correctly —
 * which is the trade this file needs. The id key after it makes the comparator
 * total, so the result is a strict order with no runtime-dependent branch.
 */
function byNameThenId(a: ShelfRow, b: ShelfRow): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The shape order. Pure and deterministic — the SSR loader, head()'s ItemList
 * and the client grid all call it on the same rows and get the same list, which
 * is the property that keeps the structured data and the rendered anchors from
 * drifting apart (see the ItemList comment in category.$slug.tsx).
 */
export function orderShelf<T extends ShelfRow>(rows: T[]): T[] {
  if (rows.length < 2) return [...rows];

  let keys = rows.map((r) => r.family ?? "");
  if (new Set(keys).size < 2) keys = quartileBands(rows);

  const families = new Map<string, T[]>();
  rows.forEach((row, i) => {
    const k = keys[i];
    if (!families.has(k)) families.set(k, []);
    families.get(k)!.push(row);
  });

  // Biggest family first, so the shelf's dominant sub-shelf leads the cycle;
  // slug tiebreak keeps the order stable between server and client.
  const queues = [...families.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([, list]) => {
      // "Call for price" rows carry no number to be typical of, so they ride at
      // the back of their own family rather than distorting its median — the
      // same treatment the explicit price sorts below already give them.
      const priced = list.filter((p) => p.price > 0);
      const call = list.filter((p) => p.price <= 0);
      const asc = [...priced].sort((a, b) => effOf(a) - effOf(b) || byNameThenId(a, b));
      return [...bisectionOrder(asc.length).map((i) => asc[i]), ...call];
    });

  const out: T[] = [];
  for (let i = 0; out.length < rows.length; i++) {
    for (const q of queues) if (i < q.length) out.push(q[i]);
  }
  return out;
}

/**
 * The two stable partitions every listing already applied, lifted verbatim so
 * they survive the reordering above. UNCHANGED behaviour, deliberately:
 *
 *  • out-of-stock sinks below in-stock (today 0 of 4,648 active products are
 *    out of stock — measured 2026-08-06 with count=exact — so this costs
 *    nothing and stays correct the day inventory is tracked);
 *  • a row with no photograph sinks below one that has one. SINK, never hide:
 *    the catalogue's seven image-less rows are the GROOM SETS, the store's most
 *    expensive line, and under the old price-DESC default they sorted to the
 *    very top of their categories and opened them on a placeholder.
 */
export function sinkUnbuyableLast<T extends ShelfRow>(rows: T[]): T[] {
  const inStock = rows.filter((p) => p.stock_status !== "outofstock");
  const oos = rows.filter((p) => p.stock_status === "outofstock");
  const stockOrdered = [...inStock, ...oos];
  const withPhoto = stockOrdered.filter((p) => (p.thumbnail_url ?? "") !== "");
  const withoutPhoto = stockOrdered.filter((p) => (p.thumbnail_url ?? "") === "");
  return [...withPhoto, ...withoutPhoto];
}

/**
 * Collapse same-name models into one tile.
 *
 * The supplier reuses one generic name across many distinct SKUs (43 ×
 * 'נטלה מהודרת מפולימר 14 ס"מ'; 528 names shared across 1,618 products), so a
 * shelf renders dozens of identical-looking cards without this. Every row is a
 * real product with its own SKU and photo — nothing leaves the catalogue, the
 * group is represented by one card carrying model_count and the product page
 * lists the rest.
 *
 * Was copy-pasted into /category/$slug, /collection/$slug and
 * /collection/personalized with three subtly different representative pickers.
 * One function now, with the union of what those three wanted: prefer a
 * representative that HAS a photo (so a collapsed group never shows the
 * placeholder while its siblings have images), then in stock, then cheapest —
 * a buyable, illustrated entry point for the group.
 */
export function collapseSameName<T extends ShelfRow>(
  rows: T[],
): Array<T & { model_count?: number; model_price_max?: number }> {
  // Key mirrors norm_he(): lowercase, fold the quote family, collapse spaces.
  const groupKey = (name: string) =>
    name
      .toLowerCase()
      .replace(/[׳״'"`‘’“”]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const groups = new Map<string, T[]>();
  for (const p of rows) {
    const k = groupKey(p.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  return [...groups.values()].map((g) => {
    const rep = [...g].sort(
      (a, b) =>
        Number(!!b.thumbnail_url) - Number(!!a.thumbnail_url) ||
        Number(b.stock_status !== "outofstock") - Number(a.stock_status !== "outofstock") ||
        a.price - b.price,
    )[0];
    if (g.length < 2) return rep;
    // The group's CEILING, raw. This is the only producer of model_price_max in
    // the codebase, and without it ProductCard's "החל מ-" branch can never fire:
    // it needs a ceiling to compare against, and it fails closed to a bare
    // number when there is none. That failure mode is the one the tile is meant
    // to fix — `rep` is the cheapest illustrated in-stock member, so a bare
    // number on a spread group prints the group's FLOOR as if it were its price.
    // Raw, not effective: ProductCard runs getEffectivePrice on both sides so a
    // spread that vanishes after the site-wide discount correctly reads as one
    // price. Prices are non-negative here; call-for-price rows carry 0 and are
    // excluded from the tile's branch by its own isCallOnly guard.
    let max = rep.price;
    for (const p of g) if (p.price > max) max = p.price;
    return { ...rep, model_count: g.length, model_price_max: max } as T & {
      model_count: number;
      model_price_max: number;
    };
  });
}

/**
 * THE entry point. One call, three routes (/shop is server-paged — see the top
 * of this file for why it is not and cannot be one of them).
 *
 * `shelfKey` is only consulted for SHELF_ORDER_PINS, and only when the shopper
 * has not chosen a sort — an explicit ?sort= always wins over a pin, because a
 * pin is the shop's opinion and ?sort= is the shopper's.
 */
export function orderCatalog<T extends ShelfRow>(
  rows: T[],
  opts: { sort?: CatalogSort; shelfKey?: string } = {},
): T[] {
  const asked = opts.sort ?? "shape";
  const mode: CatalogSort =
    asked === "shape" && opts.shelfKey ? (SHELF_ORDER_PINS[opts.shelfKey] ?? "shape") : asked;

  let list: T[];
  switch (mode) {
    case "price-asc":
      // "Call for price" items (price<=0) carry no number, so sink them to the
      // end — otherwise their 0 would lead the cheapest-first list.
      list = [...rows].sort((a, b) => {
        const aCall = a.price <= 0;
        const bCall = b.price <= 0;
        if (aCall !== bCall) return aCall ? 1 : -1;
        return a.price - b.price;
      });
      break;
    case "price-desc":
      // Same: keep call-only items at the end rather than mixed into the run.
      list = [...rows].sort((a, b) => {
        const aCall = a.price <= 0;
        const bCall = b.price <= 0;
        if (aCall !== bCall) return aCall ? 1 : -1;
        return b.price - a.price;
      });
      break;
    case "newest":
      list = [...rows].sort((a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0));
      break;
    case "oldest":
      list = [...rows].sort((a, b) => +new Date(a.created_at ?? 0) - +new Date(b.created_at ?? 0));
      break;
    case "name":
      // Codepoint order, not locale — see byNameThenId. This branch is SSR'd
      // too (the sort lives in the URL, so a shared ?sort=name link renders on
      // the server), which makes it exactly as ICU-sensitive as the default.
      list = [...rows].sort(byNameThenId);
      break;
    default:
      list = orderShelf(rows);
      break;
  }
  return sinkUnbuyableLast(list);
}
