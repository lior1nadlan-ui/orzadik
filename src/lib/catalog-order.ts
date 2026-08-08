// THE ordering of a shelf — one function, shared by /category/$slug, /shop's
// sibling collections and both /collection routes, so no two listing pages can
// mean different things by "the default order" again.
//
// WHY THIS FILE EXISTS AT ALL
//
// Every listing on this site defaulted to price DESC. /category/$slug sorted
// `b.price - a.price`; /collection/$slug and /collection/personalized sorted
// `b.price - a.price` under a comment describing it as "premium … for a
// gift-guide feel"; /shop's RPC ends its "recommended" branch on `r.price DESC`
// once the constant in-stock / has-photo / has-copy keys fall through.
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
export type CatalogSort =
  | "shape"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "oldest"
  | "name";

/**
 * Per-shelf escape hatch. Key is the shelf slug (/category/<slug> or
 * /collection/<slug>); value is the sort that shelf opens on instead of
 * "shape". Empty on purpose — it exists so pinning a shelf is a one-line config
 * edit with a reason attached, not a refactor. Only consulted when the shopper
 * has NOT chosen a sort of their own.
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
      const asc = [...priced].sort(
        (a, b) =>
          effOf(a) - effOf(b) ||
          a.name.localeCompare(b.name, "he") ||
          a.id.localeCompare(b.id),
      );
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
export function collapseSameName<T extends ShelfRow>(rows: T[]): Array<T & { model_count?: number }> {
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
    return g.length > 1 ? ({ ...rep, model_count: g.length } as T & { model_count: number }) : rep;
  });
}

/**
 * THE entry point. One call, four routes.
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
      list = [...rows].sort((a, b) => a.name.localeCompare(b.name, "he"));
      break;
    default:
      list = orderShelf(rows);
      break;
  }
  return sinkUnbuyableLast(list);
}
