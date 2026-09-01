import { createFileRoute, notFound, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPersonalizable } from "@/lib/personalization";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { SubcategoryChips, type CategoryChipRow } from "@/components/catalog/SubcategoryChips";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Breadcrumb } from "@/components/Breadcrumb";
import { QueryErrorState } from "@/components/QueryErrorState";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { categoryFaq, faqJsonLd } from "@/lib/category-faq";
// Same "is this category real?" predicate the /categories hub, the header
// drawer and /sitemap.xml read — see src/routes/categories.tsx.
import { isListableCategory } from "@/routes/categories";
import { guidesForCategory } from "@/lib/guide-links";
import { GuideLinks } from "@/components/content/GuideLinks";
// The shared shelf modules. Nothing in this route may re-implement what they
// already decide: collapseSameName/orderCatalog own the ORDER of every listing
// on the site, derivePriceRungs/buildFacetGroups own which controls a shelf is
// allowed to show. See the header comments in both files for the measurements.
import { collapseSameName, orderCatalog, type CatalogSort } from "@/lib/catalog-order";
import {
  buildFacetGroups,
  countSelected,
  derivePriceRungs,
  inPriceRung,
  matchesFacets,
  parseAttributeTail,
  parseFacetParam,
  parsePriceRung,
  priceRungLabel,
  EMPTY_FACETS,
  FACET_COVERAGE_NOTE,
  FACET_LABELS,
  SHIPPING_NOTE,
  type FacetGroup,
  type FacetKey,
  type PriceRung,
  type ProductAttributes,
  type SelectedFacets,
} from "@/lib/facets";
import { cn } from "@/lib/utils";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

// THE CATEGORY HERO BANNER IS GONE, and this is the note that used to sit here
// explaining how to preload it.
//
// It was a 16/7 crop rendered full-bleed above everything else: 171px tall on a
// 390px phone, and it was this route's LCP element, so head() preloaded it with
// fetchpriority=high and a matching srcSet. Measured on /category/kipot, the
// grid began at y=701 and not one complete product tile sat above the 844px
// fold. The banner was the single largest contributor.
//
// It is removed rather than shrunk, for three reasons that are all the same
// reason: 66-72% of the image masters are 500x500, so a 16/7 crop of one is a
// centre-slice of a product photo and not a photograph of anything; the
// direction this page is being rebuilt to explicitly refuses full-bleed heroes;
// and the first screen belongs to products. With it gone the LCP becomes a
// product thumbnail — which is the thing the shopper came for — so the two
// leading tiles take the high fetchpriority the banner used to hold, and the
// preload link is deleted with it (a preload for an image no longer in the DOM
// is a pure wasted download on the site's heaviest route).
//
// `categories.image_url` is NOT orphaned: it still feeds og:image / twitter:image
// in head() below, and the /categories hub still renders it.

// Old category slugs that redirect to a canonical one — from the 2026-07 dedupe
// and the 2026-09 rename that corrected part of it.
//
// The 2026-07 dedupe folded a `talit-tefillin-covers` category into
// `talit-tefillin-sets` because their products overlapped. Merging the rows was
// right; keeping the SETS slug for a page of COVERS was not, and that half is
// undone below. The kippot/talitot twins merged at the same time carried
// percent-encoded slugs with no meaningful inbound links, so they are
// intentionally left to 404 rather than risk a double-encoded redirect target.
const MERGED_CATEGORY_REDIRECTS: Record<string, string> = {
  // 2026-09 rename, and it is a CORRECTION of the 2026-07 merge below rather
  // than a new dedupe. That merge folded the covers category into a slug named
  // `talit-tefillin-sets` — while a separate, larger sets category
  // (`setim-talit-tefilin`, 229 products) went on existing. So the URL said
  // "sets" over a page of 55 covers named "כיסויים לטלית ותפילין", next to a
  // real sets page. Search Console showed both live and both losing: the covers
  // page ranked for "כיסוי טלית" and the sets page for "סט טלית ותפילין", each
  // around position 67, with the URL of one describing the other.
  "talit-tefillin-sets": "talit-tefillin-covers",
  // 2026-07 slug cleanup: four product-bearing categories carried percent-encoded
  // Hebrew slugs (ugly URLs whose natural form 404'd — the router decodes %d7.. to
  // Hebrew, which never matched the literal-encoded DB slug). Renamed to clean
  // ASCII; these 301s catch any double-encoded inbound link whose decoded param is
  // the old literal slug string.
  "%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa": "talitot",
  "%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d": "sidurim",
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%99%d7%95%d7%93%d7%90%d7%99%d7%a7%d7%94": "yehudaika",
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94":
    "marazim-chatanim",
};

// Page through product_categories → active products for one category. PostgREST
// caps an unbounded select at 1000 rows, and the largest category is already at
// 742 after the supplier import; left unbounded, a category that grows past 1000
// would silently drop products with no error. Shared by BOTH the SSR loader and
// the client useQuery so neither is capped and the two can never disagree.
async function fetchCategoryProducts(categoryId: string) {
  const PAGE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: batch, error } = await supabase
      .from("product_categories")
      // short_description carries the supplier's attribute tail
      // ('… | חומר: קטיפה | צבע: שחור | מידות: אורך 19 ס"מ'), which is the only
      // source the material / colour / size facets have — 2,383 of the 4,648
      // active products have one. It is kept RAW on the row rather than parsed
      // away here so a tile can read the same field for its attribute line
      // without this route having to invent a derived field name for it.
      // It is the one column added to this select, and it is the reason a
      // 743-row category ships a somewhat larger SSR payload than it did.
      .select(
        "products!inner(id, slug, name, price, sale_price, thumbnail_url, short_description, is_active, stock_status, created_at)",
      )
      .eq("category_id", categoryId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(batch ?? []));
    if ((batch ?? []).length < PAGE) break;
  }
  return rows.map((r: any) => r.products).filter((p: any) => p?.is_active);
}

/**
 * product id → the slug of the CHILD category it belongs to, for the children
 * of the shelf being rendered.
 *
 * This is the `family` key orderShelf() round-robins across, and it is what
 * puts a real number on every sub-shelf chip. Neither is possible from the
 * product rows alone: fetchCategoryProducts above reads the membership rows for
 * ONE category id, so it cannot see which of kipot's nine children a given
 * kippah sits in.
 *
 * The filter is on the EMBEDDED category (`categories!inner` + a predicate on
 * categories.parent_slug), which is what lets this run in PARALLEL with the
 * product read instead of after it: it needs the parent's slug, which the route
 * already has from the URL, not the list of child ids, which only arrives once
 * the categories read resolves. On the site's heaviest SSR route that is the
 * difference between one round trip and two.
 *
 * Paged and explicitly ordered: .range() without an .order() is not a stable
 * window, and the "first membership wins" rule below needs deterministic pages
 * or the same product could be filed under a different child on the server than
 * on the client. 741 of the 743 kippot carry exactly one sub-family, so the
 * rule decides almost nothing; where a product sits in two children, which one
 * it round-robins under is arbitrary and harmless.
 */
async function fetchFamilyMap(parentSlug: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: batch, error } = await supabase
      .from("product_categories")
      .select("product_id, category_id, categories!inner(slug)")
      .eq("categories.parent_slug", parentSlug)
      .order("product_id")
      .order("category_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of (batch ?? []) as any[]) {
      const slug = (r.categories as { slug?: string } | null)?.slug;
      if (slug && !map[r.product_id]) map[r.product_id] = slug;
    }
    if ((batch ?? []).length < PAGE) break;
  }
  return map;
}

/**
 * The shelf's product rows with their sub-family already attached — the single
 * read both the SSR loader and the client query use, so the two can never
 * disagree about the default order.
 *
 * `family` rides on the ROW rather than travelling as a separate id → slug map
 * in the loader payload. The map form was written first and measured against
 * /category/kipot: 743 UUID keys is ~41KB of extra SSR HTML, most of it the
 * repeated 36-character ids the product rows already carry. One short slug per
 * row is ~13KB for the same information on the heaviest page on the site.
 *
 * The family read is NON-FATAL: if it fails, every row gets a null family and
 * orderShelf falls back to price-quartile bands — a spread, but not the shelf's
 * real shape. A worse default order is not worth a blank category.
 */
async function fetchShelfProducts(categoryId: string, slug: string): Promise<Row[]> {
  const [rows, fam] = await Promise.all([
    fetchCategoryProducts(categoryId),
    fetchFamilyMap(slug).catch((err) => {
      console.warn("[category] sub-family map unavailable, ordering by price bands:", err);
      return {} as Record<string, string>;
    }),
  ]);
  return rows.map((p: any) => ({ ...p, family: fam[p.id] ?? null })) as Row[];
}

async function fetchCategoryWithRetry(slug: string, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data: cat, error: catErr } = await supabase
        .from("categories")
        .select("id, name, description, long_description, image_url, parent_slug")
        .eq("slug", slug)
        .maybeSingle();
      if (catErr) throw catErr;
      if (!cat)
        return { cat: null, parent: null, products: [] as Row[], allCats: [] as CategoryChipRow[] };
      // These three reads are independent (only `parent` needs the category
      // row's parent_slug, which we already have), so run them in parallel — run
      // serially they were three round-trips landing back-to-back on SSR TTFB.
      // Behavior is preserved: fetchCategoryProducts still throws on a real DB
      // error, which rejects Promise.all and reaches the retry below; the
      // parent/allCats builders resolve with { data } and never reject, so their
      // errors stay non-fatal (page still renders, chips fill from the client).
      const [products, parentRes, allCatsRes] = await Promise.all([
        // Paged read (see fetchCategoryProducts) so a >1000-row category never
        // silently drops products, with each row's sub-family attached from a
        // sibling read that runs inside the same parallel wave.
        fetchShelfProducts(cat.id, slug),
        // Parent surfaces in the breadcrumb trail (visible nav + JSON-LD), so
        // crawlers get the full trail in the initial SSR HTML.
        cat.parent_slug
          ? supabase
              .from("categories")
              .select("slug, name")
              .eq("slug", cat.parent_slug)
              .maybeSingle()
          : Promise.resolve({ data: null as { slug: string; name: string } | null }),
        // Subcategory / sibling chips, so the internal links exist in the SSR
        // HTML (not only after the client query resolves). Same select + order
        // as SubcategoryChips/categories.tsx so it seeds the shared ["all-cats"]
        // cache. 105 rows — under the 1000-row PostgREST cap, one bounded select.
        supabase
          .from("categories")
          .select("id, slug, name, description, parent_slug, sort_order")
          .order("sort_order")
          .order("name"),
      ]);
      const parent = (parentRes.data ?? null) as { slug: string; name: string } | null;
      const allCats = (allCatsRes.data ?? []) as CategoryChipRow[];
      return { cat, parent, products, allCats };
    } catch (err: any) {
      if (
        i === maxRetries ||
        !["ECONNREFUSED", "ETIMEDOUT", "network"].some((m) => String(err).includes(m))
      ) {
        // Real error → route error boundary, not a soft-404 "category not found".
        throw err;
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return { cat: null, parent: null, products: [] as Row[], allCats: [] as CategoryChipRow[] };
}

// Grid page size — and the stride of ?page=. ONE constant, so the server-rendered
// window, the ItemList in head() and the crawlable page boundaries can never
// drift apart.
const PAGE_SIZE = 24;
// Floodgate for a hand-typed or crawler-invented ?page=999999 — same role and
// same value as /shop's clamp. It is NOT the end-of-listing check: the loader's
// out-of-range redirect below is what sends a clamped page back to a real one.
const MAX_PAGE = 500;

// Page 1 is represented as `undefined` so the canonical /category/<slug> URL
// stays parameter-free. Same parser as shop.tsx — the two listings must agree on
// what a page number means or their canonicals disagree.
function parsePage(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 1) return undefined;
  return Math.min(i, MAX_PAGE);
}

/**
 * The sorts a shopper can ask for, as they appear in ?sort=.
 *
 * "shape" is the default and is spelled by the ABSENCE of the parameter, so the
 * canonical /category/<slug> URL stays clean. "recommended" is still ACCEPTED —
 * it is what every shared link, bookmark and crawled URL from before this
 * change carries — and it maps to "shape", which is what "מומלץ" now means on
 * this site. Anything unrecognised also lands on "shape", the same "unknown
 * value narrows to no filter" contract ?price= and ?m= follow below.
 */
function parseSort(v: unknown): CatalogSort {
  return v === "price-asc" || v === "price-desc" || v === "newest" || v === "oldest" || v === "name"
    ? v
    : "shape";
}

const SORT_LABELS: Array<{ value: CatalogSort; label: string }> = [
  { value: "shape", label: "מבחר מהמדף" },
  { value: "price-asc", label: "מחיר: מהנמוך לגבוה" },
  { value: "price-desc", label: "מחיר: מהגבוה לנמוך" },
  { value: "newest", label: "תאריך: מהחדש לישן" },
  { value: "oldest", label: "תאריך: מהישן לחדש" },
  { value: "name", label: "א-ב" },
];

// THE THREE GLOBAL PRICE BUCKETS THAT USED TO BE DECLARED HERE ARE GONE.
//
// They were עד ₪100 / ₪100-300 / ₪300+, hard-coded once for the whole
// catalogue. Measured on /category/kipot 2026-08-06: all 671 collapsed cards
// land in the first one (the shelf runs ₪4-88), so the control offered three
// chips of which one selected everything and two selected nothing — a control
// that cannot change the result set, on the shop's largest shelf.
//
// THE CONTIGUITY REASONING THEY CARRIED IS PRESERVED, in derivePriceRungs()
// (src/lib/facets.ts) and restated here because it is the property that keeps
// the numbers on the chips agreeing with the numbers on the cards: bounds are
// the price the customer actually PAYS — getEffectivePrice(price) — and the
// rungs are contiguous and non-overlapping, (-inf,c1] (c1,c2] (c2,c3]
// (c3,+inf), so every card lands in exactly one rung and the counts always sum
// to the shelf. Pure filtering: no sale or discount language, only the paid
// price. What changes is where the cuts come from — this shelf's own quartiles
// instead of a constant — so every shelf gets four rungs that each hold roughly
// a quarter of it, labelled with real numbers.
//
// Old ?price=0-100 and ?price=100-300 links keep working by accident and by
// design: parsePriceRung reads "<lo>-<hi>" straight out of the URL, so they
// still mean (0,100] and (100,300]. ?price=300-plus no longer parses and
// narrows to no filter, which is the documented behaviour for an unreadable
// facet value.

type Row = ProductCardData & {
  is_active: boolean;
  stock_status: string;
  created_at: string;
  short_description?: string | null;
  /** Child-category slug — the sub-shelf this row belongs to. See fetchShelfProducts. */
  family?: string | null;
};

/**
 * A collapsed shelf card: one product row plus the material/colour/size this
 * page parses out of its supplier attribute tail (for the facets).
 */
type Card = Row & { attrs?: ProductAttributes; model_count?: number };

/** Everything the URL can say about how this shelf is being viewed. */
type ShelfView = {
  sort: CatalogSort;
  rung: { lo: number; hi: number } | null;
  subs: string[];
  facets: SelectedFacets;
};

const DEFAULT_VIEW: ShelfView = { sort: "shape", rung: null, subs: [], facets: EMPTY_FACETS };

// THE ordering of a category — one function, called by head() and by the grid.
//
// This logic used to live only inside the component's useMemo, so head() had no
// way to know what the page would actually render and built its ItemList by
// slicing the RAW DB order instead. Measured live on 2026-08-02:
// /category/chagim listed 48 products in JSON-LD, rendered 24 anchors, and only
// 4 of them were the same product — with "numberOfItems": 523, a number matching
// neither. 71 of 93 category pages disagreed like that, 1,282 products appearing
// in structured data with no anchor on the page that claimed them. Deriving both
// sides from this one function makes them identical by construction; the only
// way to reintroduce the drift is to stop calling it.
function shelfCards(products: Row[]): Card[] {
  // Collapse same-name models into one tile. The supplier reuses one generic
  // name across many distinct SKUs (43 × 'נטלה מהודרת מפולימר 14 ס"מ'), so a
  // category renders dozens of identical-looking cards. Every row is a real
  // product with its own SKU and photo, so nothing is dropped from the
  // catalogue — the group is represented by one card carrying model_count,
  // and the product page lists the rest. Done here rather than in SQL because
  // this page already loads the whole category and views it client-side.
  //
  // The grouping key and the representative picker (has photo → in stock →
  // cheapest, so a collapsed group never opens on a placeholder) both moved
  // verbatim into collapseSameName(); /collection/$slug and
  // /collection/personalized had two subtly different copies of the same code
  // and now share this one.
  //
  // `attrs` is attached BEFORE the collapse so the surviving representative
  // carries it; `family` already rides on the row from fetchShelfProducts.
  // Parsing the attribute tail here rather than in the render path means it
  // happens once per product per load instead of once per product per tap on a
  // facet chip.
  return collapseSameName(
    products.map((p) => ({ ...p, attrs: parseAttributeTail(p.short_description) })),
  );
}

/**
 * Apply the shopper's view (filters, then order) to the collapsed shelf.
 *
 * Filters run on the COLLAPSED representatives, exactly as the price facet
 * always has: a group is kept or dropped by the price and attributes of the
 * card that actually shows.
 *
 * The order is orderCatalog()'s, which means the default is no longer
 * `b.price - a.price`. That sort opened /category/kipot on
 * 88 88 88 83 83 83 71 71 71 69 … — every tile in the top 8% of a shelf whose
 * median is ₪24 — and did the same on chagim (958 840 756…) and shabbat
 * (669 486 426…). The replacement round-robins across this shelf's own
 * sub-families, walking each outward from its own median, so the first screen
 * shows the shelf's SHAPE. Cheapest-first was rejected for the mirror-image
 * reason: eight kippot sit at ₪4-6 and ascending opens on a wall of them.
 * See the header of src/lib/catalog-order.ts for the measured page-1 runs.
 *
 * BOTH STABLE PARTITIONS SURVIVE UNCHANGED, inside orderCatalog's final
 * sinkUnbuyableLast(): out-of-stock sinks below in-stock, and a row with no
 * photograph sinks below one that has one. The second is not cosmetic — the
 * catalogue's seven image-less rows are the GROOM SETS at ₪1,150-1,800, and
 * under the old price-DESC default they sorted to the very top of their
 * categories and opened them on a placeholder. Sink, never hide: the row is
 * still a real product and hiding it would make this page's own count wrong.
 */
function applyShelfView(cards: Card[], slug: string, view: ShelfView): Card[] {
  let list = cards;
  if (view.subs.length) list = list.filter((c) => !!c.family && view.subs.includes(c.family));
  if (view.rung) list = list.filter((c) => inPriceRung(c.price, view.rung!));
  if (countSelected(view.facets)) list = list.filter((c) => matchesFacets(c.attrs, view.facets));
  // shelfKey is what makes SHELF_ORDER_PINS reachable: a shelf that reads badly
  // can be pinned to an explicit sort from one line of config in
  // catalog-order.ts, with no change to this route. An explicit ?sort= always
  // beats a pin — a pin is the shop's opinion, ?sort= is the shopper's.
  return orderCatalog(list, { sort: view.sort, shelfKey: `category/${slug}` });
}

/**
 * The controls this shelf is ALLOWED to show, derived from the shelf itself.
 *
 * Everything here is computed from the full collapsed shelf, never from the
 * filtered result, for two reasons: a count then means "how many of these this
 * shelf holds", which is a stable fact a shopper can navigate by; and no chip
 * can ever read 0, because a value only exists in the tally if a card carried
 * it. The trade-off, stated honestly rather than hidden: with two groups
 * selected the counts do not narrow each other, so a combination can still
 * return nothing — which the empty state below handles and offers a way out of.
 *
 * Sub-shelves follow the same two rules buildFacetGroups applies to material /
 * colour / size: a bucket holding the WHOLE shelf is dropped (tapping it
 * changes nothing) and a group with fewer than two live buckets is dropped
 * entirely (one chip that selects everything is not a filter).
 */
function shelfControls(
  cards: Card[],
  rows: Row[],
  children: Array<{ slug: string; name: string }>,
): {
  rungs: PriceRung[];
  groups: FacetGroup[];
  subCounts: Record<string, number>;
  subs: Array<{ slug: string; name: string; count: number }>;
} {
  const rungs = derivePriceRungs(cards.map((c) => c.price));
  const groups = buildFacetGroups(cards);

  // Tallied over the UNCOLLAPSED rows, not over `cards`.
  //
  // collapseSameName groups by NAME across the whole shelf, and the survivor
  // carries exactly one `family`. Two children that stock the same-named model
  // therefore collapse into a single card belonging to one of them, and the
  // other child's tally silently loses those rows — on a shelf where every one
  // of a child's products shares a name with a sibling's, its count reaches 0.
  // A 0 then removed the chip entirely (see SubcategoryChips), which deletes the
  // only internal link an indexed child page gets from its parent and prints a
  // number the child's own page contradicts. Counting rows cannot do that: a
  // child with stock always has a positive tally.
  //
  // These are PRODUCTS, not tiles — the child's own page collapses too, so it
  // may render fewer cards than this number. That is the same products-not-tiles
  // convention the header counts use, and it is the honest one here: the chip
  // answers "how much is behind this door".
  const subCounts: Record<string, number> = {};
  for (const r of rows) if (r.family) subCounts[r.family] = (subCounts[r.family] ?? 0) + 1;
  const live = children
    .map((c) => ({ ...c, count: subCounts[c.slug] ?? 0 }))
    .filter((c) => c.count > 0 && c.count < rows.length);
  const subs = live.length >= 2 ? live : [];

  return { rungs, groups, subCounts, subs };
}

export const Route = createFileRoute("/category/$slug")({
  // ?instock= IS GONE. 0 of the 4,648 active products carry stock_status
  // 'outofstock' and track_stock is false, so the checkbox it drove could not
  // change a result set on any page of this site. Removing it from the schema
  // means a stale "?instock=true" link simply drops the parameter — the URL
  // narrows to the plain shelf rather than 404ing or throwing. The out-of-stock
  // SINK and the "אזל מהמלאי" tile badge both stay: they cost nothing and stay
  // correct the day inventory is tracked.
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    sort?: string;
    price?: string;
    sub?: string;
    m?: string;
    c?: string;
    s?: string;
    page?: number;
  } => ({
    sort: typeof s.sort === "string" ? s.sort : undefined,
    // Every facet value below is read as a STRING and normalised in the
    // component against what this shelf actually offers, so a hand-edited or
    // stale value narrows to no filter instead of rendering an empty grid.
    // ?price= is "<lo>-<hi>" with "*" for an open end — never an empty side,
    // because TanStack's search parser reads "-33" as the NUMBER -33 and the
    // typeof guard here would then drop the lowest rung silently.
    price: typeof s.price === "string" ? s.price : undefined,
    sub: typeof s.sub === "string" ? s.sub : undefined,
    m: typeof s.m === "string" ? s.m : undefined,
    c: typeof s.c === "string" ? s.c : undefined,
    s: typeof s.s === "string" ? s.s : undefined,
    page: parsePage(s.page),
  }),
  // ONLY ?page= is a loader dep. sort/price/sub/m/c/s are client-side view
  // facets over a category that is already fully in memory, so keeping them out
  // means toggling a chip still costs zero round-trips (they are read off
  // `location` below).
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ params, deps, location }) => {
    // Categories merged away or renamed: 301 old inbound links / index entries to
    // their canonical so no SEO equity or bookmark 404s. Only clean ASCII slugs
    // are mapped here (a percent-encoded target would be re-encoded by the router
    // into a broken double-encoded path).
    //
    // THE REDIRECT FIRES ON A MISS, NOT BEFORE THE FETCH, and that ordering is
    // load-bearing. It used to run first, which is cheaper by one query — but it
    // made every rename a two-step deploy with a broken window in between: the
    // code redirecting old→new is a 404 until the database is renamed, and the
    // database renamed under the old code is a 404 the other way. Consulting the
    // map only when the slug does not resolve makes the two independent: whichever
    // of the pair exists in the database is served, and the other one redirects to
    // it. That is what made the talit-tefillin-sets → talit-tefillin-covers rename
    // safe to ship without choreographing deploy against migration.
    //
    // A map entry can never loop: a redirect is only issued for a slug that
    // MISSED, and it always targets a slug that is expected to hit. If the target
    // misses too, the second pass 404s rather than bouncing.
    const result = await fetchCategoryWithRetry(params.slug);
    if (!result.cat) {
      const merged = MERGED_CATEGORY_REDIRECTS[params.slug];
      if (merged) {
        throw redirect({ to: "/category/$slug", params: { slug: merged }, statusCode: 301 });
      }
      throw notFound(); // real HTTP 404 for non-existent categories
    }

    // The facets are deliberately NOT loader deps (see above), so read them off
    // the location instead.
    const facets = location.search as {
      sort?: string;
      price?: string;
      sub?: string;
      m?: string;
      c?: string;
      s?: string;
    };

    // Past the end of the listing. /shop already learned this lesson the hard
    // way: a ?page= beyond the last real page answers HTTP 200 with zero
    // products and a self-canonical, i.e. a crawlable soft-404, and the MAX_PAGE
    // clamp above means ?page=999999 lands there rather than 404ing. 302 rather
    // than 301 for the same reason as /shop: the last page moves with the
    // catalogue on every supplier import, and a permanent redirect would be
    // cached long after the page becomes real. Only computed past page 1 — page 1
    // can never be out of range, and this is an extra ordering pass over up to
    // 742 rows on the site's heaviest SSR route.
    if (deps.page > 1) {
      const lastPage = Math.max(
        1,
        Math.ceil(shelfCards(result.products as Row[]).length / PAGE_SIZE),
      );
      if (deps.page > lastPage) {
        throw redirect({
          to: "/category/$slug",
          params: { slug: params.slug },
          // Carry the facets through, or this redirect would silently clear the
          // shopper's sort and filters on the way back to a real page.
          search: {
            sort: facets.sort,
            price: facets.price,
            sub: facets.sub,
            m: facets.m,
            c: facets.c,
            s: facets.s,
            page: lastPage > 1 ? lastPage : undefined,
          },
          statusCode: 302,
        });
      }
    }

    // `filtered` is computed from the URL, not from loader deps, so it is exact
    // for every server render (the only render a crawler ever sees) and simply
    // goes stale after a client-side chip toggle — which no crawler performs.
    //
    // It may only ever err TOWARDS true. `filtered` suppresses the ItemList in
    // head(), so a false positive costs a page its structured data (silence,
    // which is honest) while a false negative would ship an ItemList naming 24
    // products the filtered grid does not render — the exact defect the
    // shared-ordering work exists to prevent. sort and price go through the
    // SAME parsers the component uses, so "?sort=garbage" is unfiltered on both
    // sides; sub/m/c/s are treated as filtering on any non-empty value, even
    // one this shelf will end up discarding.
    const nonEmpty = (v?: string) => typeof v === "string" && v.trim().length > 0;
    const filtered =
      parseSort(facets.sort) !== "shape" ||
      parsePriceRung(facets.price) !== null ||
      nonEmpty(facets.sub) ||
      nonEmpty(facets.m) ||
      nonEmpty(facets.c) ||
      nonEmpty(facets.s);
    return { ...result, page: deps.page, filtered };
  },
  head: ({ loaderData, params }) => {
    const url = `https://orzadik.com/category/${params.slug}`;
    const cat = loaderData?.cat as any;
    if (!cat)
      return {
        meta: [{ title: "קטגוריה | אור זרוע לצדיק" }],
        links: [{ rel: "canonical", href: url }],
      };
    const products = (loaderData?.products ?? []) as any[];
    const parentForDesc = (loaderData?.parent ?? null) as { slug: string; name: string } | null;

    // ?page= is the crawlable half of this listing. Measured 2026-08-02 across
    // all 93 sitemap'd categories: 6,291 collapsed cards exist, 1,654 of them
    // were in the server HTML (24 per category) and the other 4,637 sat behind a
    // JS-only "load more" with no ?page= or any other URL behind it — 51
    // categories deeper than one page, /category/kipot showing 24 of 671. The
    // only crawlable route to that tail was the 148-page /shop chain, i.e. crawl
    // depth ~148 and not one topical link from the category that describes the
    // product. Paginating adds 218 URLs and makes all 6,291 reachable at depth ≤3.
    //
    // head() and the grid slice the SAME collapseAndOrder() result at the SAME
    // offset, so the ItemList below cannot name a product the page does not
    // render. That is the whole fix for the schema half of this route.
    //
    // This block sits ABOVE the description on purpose: the description is now
    // page-aware, and a head() that computed its snippet before it knew which
    // page it was on is exactly how all 218 ?page= URLs came to ship the same
    // one.
    const page = loaderData?.page ?? 1;
    const filtered = loaderData?.filtered ?? false;
    // The UNFILTERED default view — the same call the grid makes with
    // DEFAULT_VIEW — so head() and the rendered anchors are one list by
    // construction. On a facet URL `filtered` is true and no ItemList is
    // emitted at all, so this list is only ever published when it is exact.
    const ordered = applyShelfView(shelfCards(products as Row[]), params.slug, DEFAULT_VIEW);
    const pageStart = (page - 1) * PAGE_SIZE;
    const pageItems = ordered.slice(pageStart, pageStart + PAGE_SIZE);
    const lastPage = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
    // A sort / stock / price chip makes the URL a VIEW of the category, not a
    // page of it: it stays canonical to the bare category (unchanged behaviour)
    // and gets no rel=prev/next, which would otherwise point at the unfiltered
    // page 2. Those URLs are reachable only from a shared link — every facet
    // control is a <button>, so none of them is a crawlable href.
    const paged = !filtered;
    // "A page of the series" — self-canonical, index-eligible, and NOT the
    // category's front door. One predicate, because everything that must not be
    // repeated byte-for-byte across the 218 of them (the snippet below, the
    // FAQPage markup, the body essay) has to agree on what a deep page is.
    // Gated on `paged`, not on `page` alone: on a FACET url (?instock=true&page=3)
    // canonical, og:url and the CollectionPage @id all collapse to the bare
    // category, and a head that announced "עמוד 3" against a canonical carrying
    // no page parameter is the page contradicting itself in the one place a
    // searcher reads first.
    const deep = paged && page > 1;
    // Deeper pages are canonical to themselves so their products are indexable
    // in their own right; page 1 keeps the bare, parameter-free URL the sitemap
    // lists. Same split as /shop.
    const canonical = deep ? `${url}?page=${page}` : url;
    const title = deep
      ? `${cat.name} — עמוד ${page} | אור זרוע לצדיק`
      : `${cat.name} | אור זרוע לצדיק`;

    const rawDesc = (cat.description || cat.long_description || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // Trim on a word boundary — a mid-word cut is visible in the SERP snippet.
    const clip = (s: string, max: number) =>
      s.length <= max
        ? s
        : `${
            s
              .slice(0, max)
              .replace(/\s+\S*$/, "")
              .trim() || s.slice(0, max).trim()
          }…`;
    // Owner-written copy always wins. The fallback below is only for categories
    // whose `description` is still empty — it is built from facts this page
    // already knows (how many products it actually lists, and where it sits in
    // the tree) so the 105 category pages don't all ship one byte-identical
    // meta description. Deliberately states no stock / delivery / return
    // promise: those live on the product and terms pages.
    //
    // The count is `ordered.length` — COLLAPSED cards — not products.length.
    // Everything else on the page counts cards: the toolbar reads "671 מוצרים"
    // on /category/kipot and the pager reads "מתוך 28" (= ceil(671/24)), both
    // measured live 2026-08-03, while products.length there is 743 raw rows.
    // A description claiming 743 named a number that appeared nowhere on the
    // page it described. (Today only the 8 description-less categories can
    // reach this branch and all of them are empty, so no live snippet moves —
    // but the next category the owner leaves blank would have shipped the wrong
    // number.)
    const count = ordered.length;
    // On a deep page the lead drops the count: the page marker below carries
    // the numbers, and repeating the whole-category total in front of a
    // 24-product slice is what made page 28 announce itself as the category.
    const lead =
      count > 0 && !deep
        ? `${count} ${count === 1 ? "מוצר" : "מוצרים"} בקטגוריית ${cat.name} באתר "אור זרוע לצדיק"`
        : `קטגוריית ${cat.name} באתר "אור זרוע לצדיק"`;
    const placement = parentForDesc ? `, תת-קטגוריה של ${parentForDesc.name}` : "";
    const tail =
      count > 0
        ? "תמונות, מחירים ופרטים מלאים לכל פריט."
        : "רשימת המוצרים בקטגוריה מוצגת בעמוד זה.";
    const base = rawDesc || `${lead}${placement}. ${tail}`;

    // What a page-N URL owes a searcher. Measured live 2026-08-03:
    // /category/kipot and /category/kipot?page=3 shipped a BYTE-IDENTICAL
    // description / og:description / twitter:description — the <title> was the
    // only thing in either head that differed. All ~218 ?page= URLs are
    // self-canonical and index-eligible, so that was 218 pages asking to be
    // indexed on ~93 distinct snippets.
    //
    // The honest differentiator is the one fact this URL owns and page 1 does
    // not: which slice of the listing it actually renders. It is APPENDED, not
    // prepended — a searcher scanning a SERP needs "what is this category"
    // before "which page of it" — and the 160-char budget is therefore spent on
    // the LEAD, never on the marker, or the one part that makes the snippet
    // unique would be the part the cap eats.
    //
    // ASCII "-" in the range, never U+2013. An en dash is bidi class ON, so
    // inside RTL text a numeric range built with one resolves BACKWARDS and the
    // page advertises "48-25".
    const from = pageStart + 1;
    const to = pageStart + pageItems.length;
    const slice =
      pageItems.length === 0
        ? ""
        : pageItems.length === 1
          ? ` — מוצר ${from} מתוך ${count}`
          : ` — מוצרים ${from}-${to} מתוך ${count}`;
    const marker = deep ? `עמוד ${page} מתוך ${lastPage}${slice}.` : "";
    // 158, not 160: clip() can add one "…" and the join adds one space, so the
    // lead's budget is the 160-char cap minus both, minus the marker. Without
    // that arithmetic an owner description at the cap pushed the whole thing to
    // 161 and the SERP would cut the marker back off — the exact part this is
    // here to protect.
    const desc = marker
      ? `${clip(base, Math.max(0, 158 - marker.length))} ${marker}`
      : clip(base, 160);

    // A category with nothing in it must not be advertised as a rankable
    // landing page. Seven zero-product categories were live with the site-wide
    // "index, follow", each shipping a CollectionPage whose ItemList was
    // literally `numberOfItems: 0, itemListElement: []` plus a full
    // five-question FAQPage answering "מהם זמני המשלוח למוצרים בקטגוריית …"
    // for a category that sells nothing — textbook soft-404/thin-content
    // signals, and crawl budget taken from the ~3,540 real product pages. The
    // same predicate also catches the double-encoded twins of the four
    // percent-encoded categories: those render 200 but the canonical below
    // resolves to their natural-encoded form, which genuinely 404s.
    const indexable = isListableCategory(params.slug, products.length);

    const collectionLd: any = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": canonical,
      url: canonical,
      name: title,
      description: desc,
      inLanguage: "he-IL",
      isPartOf: { "@id": "https://orzadik.com/#website" },
      ...(cat.image_url ? { image: cat.image_url } : {}),
      // The ItemList is this page's own ≤24 items, and numberOfItems is that
      // array's length. It used to be the whole-category count (523 on
      // /category/chagim, 743 on /category/kipot) over a 48-item slice of the
      // RAW DB order, which the grid never renders — so the count matched
      // neither the list nor the page, and the list was mostly products that
      // were not there. Measured live 2026-08-02: 71 of 93 categories
      // disagreed, 1,282 products were claimed by a page carrying no anchor to
      // them, /category/talit-tefilin listed 48 of which exactly 1 was on the
      // page. Positions are global (pageStart + i + 1) so the paginated series
      // reads as one list rather than 28 lists that all start at 1.
      //
      // On a facet view the loader cannot know the rendered order, so we emit no
      // list rather than a wrong one. Silence is honest; a mismatched list is
      // the same class of defect as an invented rating.
      ...(paged
        ? {
            mainEntity: {
              "@type": "ItemList",
              // numberOfItems and position must describe the SAME list. Counting
              // this page's items (24) while numbering them globally (25-48 on
              // page 2) declares a 24-item list whose members sit at positions
              // 25-48 — which is not a coherent list at all. The list this node
              // describes is "the products rendered on THIS page", so the
              // positions are local to it; the page's place in the wider set is
              // already carried by rel=prev/next and the canonical.
              numberOfItems: pageItems.length,
              itemListElement: pageItems.map((p, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `https://orzadik.com/product/${p.slug}`,
                name: p.name,
                ...(p.thumbnail_url ? { image: p.thumbnail_url } : {}),
              })),
            },
          }
        : {}),
    };
    // Surface the parent-category level on subcategory pages so the trail is
    // בית / מוצרים / parent / cat — positions stay consecutive either way.
    const parent = (loaderData?.parent ?? null) as { slug: string; name: string } | null;
    const crumbs = [
      { name: "בית", item: "https://orzadik.com/" },
      { name: "מוצרים", item: "https://orzadik.com/shop" },
      ...(parent
        ? [{ name: parent.name, item: `https://orzadik.com/category/${parent.slug}` }]
        : []),
      { name: cat.name, item: url },
    ];
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })),
    };

    // NO LCP PRELOAD. There used to be one here for the category hero banner,
    // mirroring the <img>'s srcSet byte-for-byte so the browser fetched exactly
    // one candidate. The banner is gone (see the note at the top of this file),
    // so the preload would now be a high-priority download for an image that is
    // never painted — on the site's heaviest SSR route. The LCP is a product
    // thumbnail instead, and the two leading tiles carry fetchpriority=high
    // unconditionally now that nothing competes with them.

    return {
      meta: [
        { title },
        // "follow", not "nofollow": the page is empty but its breadcrumb and
        // "לכל המוצרים בחנות" links are legitimate routes back into the
        // catalog. Meta is merged leaf→root with first-seen winning (see
        // __root.tsx), so this overrides the site-wide "index, follow".
        ...(indexable ? [] : [{ name: "robots", content: "noindex, follow" }]),
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        // og:image stays the category image on every page of the series, and
        // the alt stays the plain category name. That was reviewed as a third
        // "byte-identical across 218 URLs" symptom and deliberately kept.
        //
        // The original justification was that the banner really is painted at
        // the top of page 28. It no longer is — the banner was removed from the
        // page body — but the conclusion survives on the stronger of its two
        // legs: og:image describes the CATEGORY to a social scraper, not this
        // page's layout, and `categories.image_url` is still the one editorial
        // image the shop has chosen for this category (the /categories hub
        // renders it). The alternative (the first product thumbnail on
        // this page) would ship a ~300px image into a summary_large_image card
        // that wants ≥1200x630 — X and Facebook downgrade or drop cards below
        // their minimums, so we would have traded a duplicate-but-correct
        // preview for a broken one. Naming a page number in og:image:alt would
        // be worse still: the alt describes the IMAGE, and the banner is not
        // "page 3 of anything". The snippet is where a deep page has to earn
        // its own identity, and that is what `desc` above now does.
        { property: "og:image", content: cat.image_url || "https://orzadik.com/og-default.jpg" },
        { property: "og:image:alt", content: cat.name },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: cat.image_url || "https://orzadik.com/og-default.jpg" },
      ],
      links: [
        { rel: "canonical", href: canonical },
        // The prev/next chain is what turns 93 dead-end pages into a walkable
        // series. Page 2's "prev" is the bare URL, never "?page=1" — that would
        // advertise a second address for a page that already has a canonical one.
        ...(deep ? [{ rel: "prev", href: page - 1 > 1 ? `${url}?page=${page - 1}` : url }] : []),
        ...(paged && page < lastPage ? [{ rel: "next", href: `${url}?page=${page + 1}` }] : []),
      ],
      // The breadcrumb stays on a noindex page (it is true, and it is the trail
      // back out). The CollectionPage and the FAQPage do NOT: an empty ItemList
      // and five shipping/returns answers about a category with no products are
      // markup claiming a storefront that isn't there.
      //
      // The FAQPage is additionally page-1-only. categoryFaq() is generated from
      // the category NAME alone, so it is the same five Q&A on every page of the
      // series — and Google's FAQ structured-data guidelines name exactly that
      // ("the same FAQ appears on multiple pages") as a reason to withhold the
      // markup. Page 1 is the canonical front door and keeps it; the other ~217
      // ?page= URLs still RENDER the accordion (a shopper who lands on page 12
      // has the same questions) but stop claiming the rich result 217 times
      // over. The invariant the visible block was written around is unchanged
      // and runs one way only: markup ⇒ the answers are in the server HTML.
      // Visible copy without markup was always fine.
      scripts: indexable
        ? [
            { type: "application/ld+json", children: JSON.stringify(collectionLd) },
            { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
            ...(deep
              ? []
              : [
                  {
                    type: "application/ld+json",
                    children: JSON.stringify(faqJsonLd(categoryFaq(cat.name, params.slug))),
                  },
                ]),
          ]
        : [{ type: "application/ld+json", children: JSON.stringify(breadcrumbLd) }],
    };
  },
  component: CategoryPage,
});

/**
 * One tappable facet value: label, and the number of cards on THIS shelf that
 * carry it. A chip is never rendered with a count of 0 — see shelfControls and
 * buildFacetGroups, which drop those values before they reach here.
 *
 * min-h-11 is the 44px touch floor; the padding alone left the old chips at
 * 34px. The active fill is --accent (#7E611E, 5.81:1 against white), the only
 * gold on this site allowed to carry text. `.press` owns transform, so the
 * transition property list spells out every property it animates rather than
 * pairing `.press` with a bare colour transition that would animate nothing.
 */
function FacetChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm transition-[background-color,color,box-shadow,transform] duration-150 ease-out",
        active
          ? "bg-accent text-white"
          : "bg-card/70 text-foreground hairline [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary",
      )}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "opacity-60")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** One labelled block of chips inside the shelf sheet. */
function SheetGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-glass-line pt-5">
      <h3 className="mb-3 text-sm font-medium text-foreground">{label}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function CategoryPage() {
  const { slug } = Route.useParams();
  const { cat: initialCat, products: initialProducts, parent, allCats } = Route.useLoaderData();
  const {
    sort: sortFromUrl,
    price: priceFromUrl,
    sub: subFromUrl,
    m: mFromUrl,
    c: cFromUrl,
    s: sFromUrl,
    page: pageFromUrl,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  // The only piece of component state on this route, and it is presentation
  // only: whether the shelf sheet is open. It starts closed, so the server and
  // the first client render agree and the sheet contributes nothing to the SSR
  // HTML — which is also why none of the facet counts inside it can affect the
  // rendered markup a crawler sees.
  const [sheetOpen, setSheetOpen] = useState(false);

  // DERIVED from the URL, deliberately NOT held in useState.
  //
  // These were useState seeded from the URL at mount. TanStack Router reuses
  // this component across $slug changes, so the state outlived the URL: tap a price
  // filter on one category, then use a subcategory chip or the header drawer, and
  // the next category rendered with a CLEAN url, the correct <h1>, and
  // "0 מוצרים · לא נמצאו מוצרים" — including /category/marazim-chatanim, where all
  // eleven ₪1,150-1,800 groom boxes vanished. Reloading "fixed" it, which is
  // exactly why it stayed invisible: nobody reloads, they leave.
  //
  // Deriving costs nothing — the router already re-renders on a param change — and
  // it makes the URL the single source of truth, so back/forward and sharing work
  // for free. This is the pattern /shop already uses for its sort (shop.tsx).
  const sort = parseSort(sortFromUrl);
  const page = pageFromUrl ?? 1;

  const { data: cat } = useQuery({
    queryKey: ["cat", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, description, long_description, image_url, parent_slug")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
    // Seed from the SSR loader so the H1, description and chips render on the
    // server (real HTML for crawlers) instead of an empty shell.
    initialData: initialCat ?? undefined,
  });

  // Guides for this category, resolved through the parent_slug walk-up so a
  // subcategory (e.g. כיפות קטיפה) inherits its parent's guide. `allCats` is
  // already in the loader data, so the climb costs nothing.
  const categoryGuides = guidesForCategory(
    slug,
    cat?.parent_slug ?? null,
    allCats as Array<{ slug: string; parent_slug?: string | null }> | undefined,
  );

  // isError/refetch were NOT destructured here until 2026-08-03, so a failed
  // product query left `products` at its `= []` default and the page rendered
  // the designed "לא נמצאו מוצרים / אין כרגע מוצרים בקטגוריה הזו" empty state —
  // a false statement about a 4,648-item shop, with no retry and nothing to say
  // the network had failed. /shop already handled the identical case correctly;
  // both now render the shared QueryErrorState.
  const {
    data: products = [],
    isError: productsFailed,
    isFetching: productsFetching,
    refetch: refetchProducts,
  } = useQuery({
    // `slug` joins the key because the rows now carry a per-shelf derived field
    // (`family`, which is a CHILD of this slug) — two categories could share a
    // cat.id only by bug, but the key should say what the rows are keyed to.
    queryKey: ["cat-products", cat?.id, slug],
    enabled: !!cat?.id,
    // The SAME read the loader uses (shared fetchShelfProducts) so this stays
    // correct past PostgREST's 1000-row cap instead of silently dropping
    // products from the biggest categories — and so a client-side navigation
    // orders the shelf by real sub-families rather than the price-band
    // fallback, exactly as the server render did.
    queryFn: () => fetchShelfProducts(cat!.id, slug),
    // Seed the product grid from the loader so it renders server-side too.
    initialData: (initialProducts as Row[] | undefined)?.length
      ? (initialProducts as Row[])
      : undefined,
  });

  // The sub-shelves of this category, read off the SAME ["all-cats"] rows
  // SubcategoryChips renders from, so the chips and the sheet can never offer
  // different sub-families.
  const children = useMemo(
    () =>
      ((allCats ?? []) as CategoryChipRow[])
        .filter((c) => c.parent_slug === slug)
        .map((c) => ({ slug: c.slug, name: c.name })),
    [allCats, slug],
  );

  // The whole collapsed shelf, once. Everything below is a view of it.
  const cards = useMemo(() => shelfCards(products as Row[]), [products]);

  // Which controls this shelf earns — derived from the UNFILTERED shelf, so a
  // count is a fact about the shelf and a chip can never read 0.
  const controls = useMemo(
    () => shelfControls(cards, products as Row[], children),
    [cards, products, children],
  );

  // Normalise the URL against what the shelf actually offers. An unknown value
  // is dropped rather than matched against nothing, so a link shared before the
  // last supplier import renders the shelf instead of an empty grid.
  const rung = useMemo(() => parsePriceRung(priceFromUrl), [priceFromUrl]);
  const subs = useMemo(() => {
    if (typeof subFromUrl !== "string" || !subFromUrl.trim()) return [];
    const allowed = new Set(controls.subs.map((c) => c.slug));
    return [
      ...new Set(
        subFromUrl
          .split(",")
          .map((v) => v.trim())
          .filter((v) => allowed.has(v)),
      ),
    ];
  }, [subFromUrl, controls.subs]);
  const facets: SelectedFacets = useMemo(() => {
    const bucketsOf = (k: FacetKey) => controls.groups.find((g) => g.key === k)?.buckets ?? [];
    return {
      m: parseFacetParam(mFromUrl, bucketsOf("m")),
      c: parseFacetParam(cFromUrl, bucketsOf("c")),
      s: parseFacetParam(sFromUrl, bucketsOf("s")),
    };
  }, [mFromUrl, cFromUrl, sFromUrl, controls.groups]);

  const filterCount = (rung ? 1 : 0) + subs.length + countSelected(facets);
  const hasFilters = filterCount > 0;

  const visible = useMemo(
    () => applyShelfView(cards, slug, { sort, rung, subs, facets }),
    [cards, slug, sort, rung, subs, facets],
  );

  // Every facet change drops ?page=: a different order or filter means a
  // different page 1, and keeping the old offset would strand the shopper in the
  // middle of a list they just reshuffled. Same rule /shop applies on re-sort.
  const setFacets = (patch: Record<string, string | undefined>) => {
    navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
      replace: true,
      resetScroll: false,
    });
  };
  const join = (list: string[]) => (list.length ? list.join(",") : undefined);
  const toggled = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const changeSort = (v: CatalogSort) => setFacets({ sort: v === "shape" ? undefined : v });
  // Single-select: tapping the active rung clears it back to the whole shelf.
  const toggleRung = (id: string) => setFacets({ price: priceFromUrl === id ? undefined : id });
  const toggleSub = (v: string) => setFacets({ sub: join(toggled(subs, v)) });
  const toggleFacet = (k: FacetKey, v: string) => setFacets({ [k]: join(toggled(facets[k], v)) });
  const clearFilters = () =>
    setFacets({ price: undefined, sub: undefined, m: undefined, c: undefined, s: undefined });

  // Client-side windowing. This page loads its whole category into memory (the
  // largest is 742 rows) and views it there, but mounting every card at once is
  // wasteful; slice the fully sorted+filtered list to a growing window and
  // reveal +24 per click, mirroring /shop's "load more".
  //
  // The window STARTS at the ?page= offset instead of always at 0. That is what
  // makes the deep half of a category exist in the server HTML: the <a href>
  // pagination at the bottom of this page is the only route a crawler has into
  // products 25..743, and the offset has to be honoured on the server for those
  // URLs to render anything different from page 1.
  //
  // The reveal count is DERIVED during render, not corrected afterwards by an
  // effect. It used to be plain state that a useEffect keyed on the facets reset
  // to PAGE_SIZE — but an effect runs AFTER the commit, so the first render
  // following a pagination click still sliced with the PREVIOUS window.
  // Replayed against /category/kipot's real 671 cards (its own toolbar count,
  // measured 2026-08-03): three "load more" clicks put shown at 96, which is
  // what makes the "הבא" link resolve to ?page=5 — and that first commit then
  // rendered visible.slice(96, 192), i.e. cards 97..192 under a heading reading
  // "עמוד 5 מתוך 28", with its own "הבא" pointing at ?page=9 and the load-more
  // chip reading (479). One commit later the effect snapped it to cards
  // 97..120 / ?page=6 / (551). So the URL said page 5 while the grid showed
  // four pages' worth, 72 ProductCards mounted and fired thumbnail requests
  // only to be discarded, and the grid visibly collapsed under the shopper on
  // the site's heaviest route. The same stale commit happens on every facet
  // toggle, which is the far more common interaction.
  //
  // Keying the count to the window it was counted FOR makes the two incapable
  // of disagreeing: when the key changes, `shown` is already PAGE_SIZE in the
  // very same render that first sees the new page — there is no in-between
  // commit for them to differ in, and no effect to forget to update. Every
  // facet that can change the list is in the key, which is why the new ones
  // (sub / m / c / s) are spelled out rather than summarised by a count.
  const windowKey = [
    slug,
    sort,
    priceFromUrl ?? "",
    subs.join(","),
    facets.m.join(","),
    facets.c.join(","),
    facets.s.join(","),
    page,
  ].join("|");
  const [reveal, setReveal] = useState<{ key: string; count: number }>({
    key: windowKey,
    count: PAGE_SIZE,
  });
  const shown = reveal.key === windowKey ? reveal.count : PAGE_SIZE;
  const pageStart = (page - 1) * PAGE_SIZE;
  const windowed = visible.slice(pageStart, pageStart + shown);
  const remaining = visible.length - (pageStart + windowed.length);
  const lastPage = Math.max(1, Math.ceil(visible.length / PAGE_SIZE), page);
  // "Next" skips past everything already revealed, so a visitor who pressed
  // "load more" twice is not offered a link back to products they can see.
  const nextPage = Math.min(MAX_PAGE, Math.floor((pageStart + windowed.length) / PAGE_SIZE) + 1);
  const hasMorePages = pageStart + windowed.length < visible.length;
  // Page links carry the active view so a shopper paging through
  // "כיפות קטיפה · ₪14-24" stays inside it.
  const pageSearch = (
    n: number,
  ): {
    sort?: string;
    price?: string;
    sub?: string;
    m?: string;
    c?: string;
    s?: string;
    page?: number;
  } => ({
    sort: sort === "shape" ? undefined : sort,
    price: rung ? (priceFromUrl as string) : undefined,
    sub: join(subs),
    m: join(facets.m),
    c: join(facets.c),
    s: join(facets.s),
    page: n <= 1 ? undefined : n,
  });
  // Byte-identical to the "load more" chip below it, minus the wider padding:
  // the two controls do the same job (more products) and sit in the same band,
  // so they must read as one family. Ink on a 70% white pane, hover swaps to
  // background-on-foreground — no gold, which on this page is reserved for the
  // active facet chip and the decorative rules.
  const pageLinkClass =
    "press inline-flex min-h-11 items-center rounded-full bg-card/70 px-6 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background";

  // THE BAND BELOW THE FIRST GRID ROW.
  //
  // Everything here used to sit ABOVE the grid, and together with the hero
  // banner it is why the first product on /category/kipot began at y=701 on a
  // 390px phone with not one complete tile above the 844px fold. None of it is
  // deleted — the category prose in particular is the ONLY surface on this site
  // where a category's own words render, and its SEO contribution has never
  // been measured, so moving it is the only safe change. It is placed with
  // `row-start-2 col-span-full` INSIDE the grid, which puts it under a complete
  // first row at every breakpoint (2, 3 or 4 columns) with no breakpoint-
  // specific slicing: CSS grid places definite-position items first, so the
  // leading products fill row 1 and the rest resume at row 3.
  const showSubChips = children.length > 0 || !!cat?.parent_slug;
  const bandHasContent = !!cat?.description || isPersonalizable([slug]) || showSubChips;
  const shelfBand = bandHasContent ? (
    <div className="col-span-full row-start-2 my-2 border-y border-glass-line py-5">
      {cat?.description && (
        <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
      )}

      {/* When the category itself is personalizable (its slug is in the shared
          PERSONALIZABLE_CATEGORY_SLUGS source of truth), a single tasteful line
          surfaces the store's real differentiator and links to the dedicated
          story page. */}
      {isPersonalizable([slug]) && (
        <Link
          to="/collection/personalized"
          className="press mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-card/70 px-4 text-sm text-accent hairline transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
        >
          <span aria-hidden="true">✦</span>
          פריטי הקטגוריה ניתנים להוספת רקמה/חריטה אישית
        </Link>
      )}

      {/* Sub-shelf links — restyled from here (gold hairline, argaman active)
          via scoped descendant overrides: SubcategoryChips is a shared component
          other pages use, so its own classes stay untouched. The active chip is
          targeted through the aria-current="page" attribute the router puts on
          the link for the current category.

          Kept in step with the chip base in SubcategoryChips.tsx: the base draws
          its hairline as an INSET RING rather than a border, so the override
          swaps the ring colour (decorative gold, never text) instead of a border
          colour. The argaman fill is the one legitimate small semantic burgundy
          left in the system — 12.57:1 with white text.

          `counts` is passed ONLY when this shelf has children of its own. In
          sibling mode the chips point at OTHER shelves, whose cards this page
          never loaded — a count of "unknown" must not render as a count of 0,
          which is what filtering on an absent number would do. */}
      <div className="[&_a]:shadow-[inset_0_0_0_1px_var(--glass-line-gold)] [&_a]:bg-card/70 [&_a]:text-foreground [&_a[aria-current=page]]:bg-argaman [&_a[aria-current=page]]:text-white [&_a[aria-current=page]]:shadow-none">
        <SubcategoryChips
          slug={slug}
          parentSlug={cat?.parent_slug ?? null}
          initialCats={allCats as CategoryChipRow[] | undefined}
          // An EMPTY map means "we could not find out", not "every child has
          // nothing". fetchShelfProducts deliberately swallows a fetchFamilyMap
          // rejection and returns {}, which leaves every row's `family` null and
          // every tally absent — and a component that reads absence as zero then
          // drops all ~46 child chips, i.e. the parent silently loses the only
          // inbound links those indexed pages get. Pass undefined so the chips
          // render unfiltered and uncounted, which is the correct degradation.
          counts={
            children.length > 0 && Object.keys(controls.subCounts).length > 0
              ? controls.subCounts
              : undefined
          }
          className="mb-0"
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="pb-12">
      {/* Location trail — the shared, RTL-correct primitive. The route still
          emits its own BreadcrumbList JSON-LD from head(), so this visible trail
          carries no microdata; the old hand-rolled <ol> duplicated that graph.
          py-1.5 rather than py-3: this is the first of only two things now
          allowed above the grid, and every pixel of it is charged to the fold
          budget below. */}
      <div className="container mx-auto px-4 py-1.5">
        <Breadcrumb
          items={[
            { label: "בית", to: "/" },
            { label: "מוצרים", to: "/shop" },
            ...(parent
              ? [{ label: parent.name, to: "/category/$slug", params: { slug: parent.slug } }]
              : []),
            { label: cat?.name ?? slug },
          ]}
        />
      </div>

      <div className="container mx-auto px-4">
        {/* THE SHELF BAR — the whole of this page's chrome, ~100px on a 390px
            phone against the ~700px it replaced. Three things and no more:
            what shelf this is, how many items are in the view right now, and
            one control that opens everything else. The hero banner, the
            category prose, the personalisation line, the guide chips and the
            four-row toolbar have all either moved below the first grid row or
            moved into the sheet.

            THE BUDGET, and the arithmetic behind every spacing value in here.
            At 390x844 the grid must start at y<=300 and two complete tiles must
            sit above y=844. Measured from the top of the viewport at scroll 0,
            so the sticky SiteHeader is charged to it too:

              SiteHeader (club strip h-9 + the h-14 logo bar)      ~108
              breadcrumb  py-1.5 + a 20px line                       32
              h1 text-2xl on one line with the count                 32
              shipping line  mt-1 + text-xs                          20
              control row    mt-2 + the 44px touch floor             52
              grid           mt-3                                    12
                                                                  -----
                                                                   ~256

            ~44px of slack, which is what a long category name wrapping the h1
            to a second line costs. Two things can eat it and both are outside
            this file: SiteHeader growing, and the tile growing (the tile only
            threatens the SECOND half of the budget — at a 340px tile the first
            row ends at ~596, and it would have to reach 588px before a complete
            row stopped fitting above 844). */}
        <header>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-2xl md:text-4xl font-bold tracking-wide text-foreground">
              {cat?.name ?? slug}
            </h1>
            {/* The live count. aria-live so a facet toggle is announced — it is
                the only feedback a screen-reader user gets that a chip did
                anything, because the grid itself is silent. */}
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {visible.length} מוצרים
            </p>
          </div>
          {/* The one basket fact this site has, stated plainly. SHIPPING_FLAT is
              37 and FREE_SHIPPING_THRESHOLD is Infinity, so there is no
              threshold to bar, no countdown to run and nothing to progress
              toward — the second clause is the only useful consequence of a
              flat per-order fee. ASCII hyphen, see the note on SHIPPING_NOTE. */}
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">{SHIPPING_NOTE}</p>

          {/* One row of chips. The button opens the sheet; the chips beside it
              are what is currently ON, each tappable to switch it off, so the
              shopper never has to reopen the sheet to find out what is
              filtering their view. With nothing selected the row is one 44px
              button — which is the whole point of the budget. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-card/70 px-4 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-accent" />
              סינון ומיון
              {filterCount > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white tabular-nums">
                  {filterCount}
                </span>
              )}
            </button>

            {sort !== "shape" && (
              <ActiveChip
                label={SORT_LABELS.find((o) => o.value === sort)?.label ?? ""}
                onClear={() => changeSort("shape")}
              />
            )}
            {rung && (
              <ActiveChip
                // The current ladder's own label when the rung is on it, and
                // a label rebuilt from the BOUNDS when it is not — a link
                // shared before the last import, or one of the old global
                // ?price=0-100 buckets, still says what it is filtering.
                label={
                  controls.rungs.find((r) => r.id === priceFromUrl)?.label ??
                  priceRungLabel(rung.lo, rung.hi)
                }
                onClear={() => setFacets({ price: undefined })}
              />
            )}
            {subs.map((v) => (
              <ActiveChip
                key={`sub-${v}`}
                label={controls.subs.find((c) => c.slug === v)?.name ?? v}
                onClear={() => toggleSub(v)}
              />
            ))}
            {(["m", "c", "s"] as FacetKey[]).flatMap((k) =>
              facets[k].map((v) => (
                <ActiveChip key={`${k}-${v}`} label={v} onClear={() => toggleFacet(k, v)} />
              )),
            )}
          </div>
        </header>

        {(slug === "study-books" || slug === "esh-sheli-gold") && products.length === 0 ? (
          <div className="glass max-w-2xl mx-auto my-12 text-center p-10 md:p-14 [--glass-radius:1.5rem]">
            <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-secondary hairline flex items-center justify-center">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
              המוצרים בקטגוריה זו בדרך אליכם
            </h2>
            <div aria-hidden="true" className="gold-rule mx-auto mb-5 w-16" />
            <p className="text-muted-foreground leading-relaxed">
              אנו עובדים בימים אלו על העלאת המוצרים בקטגוריית{" "}
              <span className="font-semibold text-foreground">{cat?.name ?? ""}</span>.
              <br />
              חזרו בקרוב לגלות מבחר חדש ומרגש 💫
            </p>
          </div>
        ) : (
          <>
            {/* Grid. The first row loads eager and the two leading thumbnails
                take fetchpriority=high unconditionally — with the hero banner
                gone, one of them IS the LCP element and there is nothing left
                for them to compete with. */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {windowed.map((p, i) => (
                <Fragment key={p.id}>
                  <ProductCard p={p} eager={i < 4} highPriority={i < 2} />
                  {/* After the first row on a phone. Clamped so a shelf showing
                      a single card still gets its prose. */}
                  {i === Math.min(1, windowed.length - 1) ? shelfBand : null}
                </Fragment>
              ))}
            </div>
            {/* A failed query is NOT an empty category — say which one happened.
                Checked before the empty state below so the two can never both
                be true at once. */}
            {productsFailed && windowed.length === 0 && (
              <QueryErrorState onRetry={() => refetchProducts()} retrying={productsFetching} />
            )}
            {!productsFailed && windowed.length === 0 && (
              // Same designed glass empty state as /shop (gold-free), so the two
              // discovery pages read consistently. When a facet is what emptied
              // the grid, offer a one-tap way back to the full shelf — the
              // counts in the sheet are per-facet, so two groups CAN combine
              // into nothing and this is where that lands.
              <div className="glass max-w-2xl mx-auto my-12 text-center p-10 md:p-14 [--glass-radius:1.5rem]">
                <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-secondary hairline flex items-center justify-center">
                  <span className="text-3xl">🔍</span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
                  לא נמצאו מוצרים
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {visible.length > 0
                    ? // The loader 302s a ?page= past the end of the UNFILTERED
                      // listing, but a facet shortens the list further, so a shared
                      // "?sub=kipot-velvet&page=9" can still land past the end. Say
                      // so and offer the way back rather than showing a blank grid.
                      "אין מוצרים בעמוד הזה."
                    : hasFilters
                      ? "אין כרגע מוצרים שתואמים את הסינון בקטגוריה הזו."
                      : "אין כרגע מוצרים בקטגוריה הזו."}
                </p>
                {visible.length > 0 && (
                  <Link
                    to="/category/$slug"
                    params={{ slug }}
                    search={pageSearch(1)}
                    className={cn(pageLinkClass, "mt-6")}
                  >
                    חזרה לעמוד הראשון
                  </Link>
                )}
                {/* A genuinely-empty category (no filter active) previously rendered
                    NO link at all — the shopper had to reach for the browser's back
                    button. Always offer a way onward. */}
                {visible.length === 0 && !hasFilters && (
                  <Link to="/shop" className={cn(pageLinkClass, "mt-6")}>
                    לכל המוצרים בחנות
                  </Link>
                )}
                {visible.length === 0 && hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={cn(pageLinkClass, "mt-6")}
                  >
                    הצג את כל המוצרים
                  </button>
                )}
              </div>
            )}
            {/* The band rides inside the grid, after the first row — so when
                there IS no first row it would vanish, and with it the only
                surface where this category's own prose renders. Render it here
                instead. The grid-placement classes are inert outside a grid. */}
            {windowed.length === 0 ? shelfBand : null}
            {/* Load more — same ink-on-white chip and label as /shop. No async
                state: the whole list is already in memory, so revealing more is
                instant. */}
            {remaining > 0 && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  // Stamped with the window it belongs to, so a count revealed
                  // on page 1 can never be applied to page 5 (see `windowKey`).
                  onClick={() => setReveal({ key: windowKey, count: shown + PAGE_SIZE })}
                  className="press inline-flex min-h-11 items-center rounded-full bg-card/70 px-8 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
                >
                  טען עוד מוצרים ({remaining})
                </button>
              </div>
            )}

            {/* Real <a href> pagination beside the "load more" button — the same
                pairing /shop uses. "Load more" stays the primary human
                affordance (instant, no navigation, the whole category is already
                in memory and nothing about that changed); these anchors are what
                give the rest of the category an address at all. Before them, 51
                of 93 categories hid 4,637 of their 6,291 cards behind that
                button with no URL of any kind behind it. */}
            {(page > 1 || hasMorePages) && (
              <nav
                aria-label="ניווט בין עמודי הקטגוריה"
                className="mt-10 flex items-center justify-between gap-4"
              >
                {page > 1 ? (
                  <Link
                    to="/category/$slug"
                    params={{ slug }}
                    search={pageSearch(page - 1)}
                    rel="prev"
                    className={pageLinkClass}
                  >
                    הקודם
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  עמוד {page} מתוך {lastPage}
                </span>
                {hasMorePages ? (
                  <Link
                    to="/category/$slug"
                    params={{ slug }}
                    search={pageSearch(nextPage)}
                    rel="next"
                    className={pageLinkClass}
                  >
                    הבא
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}

        {/* The guides, below the grid, with blurbs — a shopper who reached the
            bottom without adding anything is usually still deciding, and this is
            the question they actually have.

            The DUPLICATE chip-variant row that used to sit above the grid is
            gone: it was 50px of the fold budget spent on links that are still
            right here, in the server HTML, one block lower. */}
        {categoryGuides.length > 0 && (
          <GuideLinks
            guides={categoryGuides}
            variant="card"
            heading="לפני שקונים"
            className="mt-14 max-w-2xl mx-auto"
          />
        )}

        {/* Email capture — a category browser has shown intent for a whole
            product world; offer the content list here, not only in the footer.
            Content/holiday value proposition, not deals. */}
        <section className="mt-14 glass max-w-xl mx-auto px-6 py-7 text-center [--glass-radius:1.25rem]">
          <div className="text-xs tracking-[0.35em] text-accent uppercase mb-2">רשימת התפוצה</div>
          <p className="text-sm text-muted-foreground mb-4">
            מדריכים ותוכן לקראת החגים, ופריטים חדשים לפני כולם — בלי ספאם.
          </p>
          <div className="mx-auto max-w-md">
            <NewsletterSignup source="category" />
          </div>
        </section>

        {/* SEO long description — page 1 only.
            This is one essay about the whole category, and it was being shipped
            verbatim on every ?page= URL: on /category/kipot that is the same
            block of prose on 28 self-canonical, index-eligible pages. Its home
            is the category's front door, which is the URL the sitemap lists and
            the one every deeper page canonicalises TOWARDS. A deep page still
            carries everything that identifies it (H1, the one-line description
            in the band above, breadcrumb, FAQ) and everything that
            differentiates it (its own 24 cards, its own snippet) — it just stops
            re-serving the essay. Gated on `page` alone rather than the head's
            `deep`: on a facet view this is a pure UX call (the canonical already
            points home), and a shopper 3 pages into a filtered list is not there
            to read the intro either. */}
        {page === 1 && cat?.long_description && (
          <section className="mt-16 max-w-3xl mx-auto text-center">
            <h2 className="font-display text-2xl font-bold mb-3">קצת על {cat.name}</h2>
            <div aria-hidden="true" className="gold-rule mx-auto mb-5 w-12" />
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {cat.long_description}
            </p>
          </section>
        )}

        {/* FAQ — feeds AEO (voice / "People also ask" / AI answers). Mirrors the
            FAQPage JSON-LD emitted in the route head, so the answers must be in
            the server HTML: a JS accordion that mounts its panel only when open
            leaves the JSON-LD claiming text no crawler can find on the page.
            Native <details>/<summary> keeps every answer in the markup while
            still collapsing visually, with no JS and no hydration cost.
            The head now emits that FAQPage only for a category that actually
            holds products (see `indexable` there). This block still renders on
            an empty one — visible copy without markup is fine, the invariant
            that matters is the other direction. */}
        {cat?.name && (
          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-5 text-center">
              שאלות נפוצות — {cat.name}
            </h2>
            {/* Native <details>/<summary> stays — the FAQPage JSON-LD in the route
                head claims this text, so every answer must be in the server HTML.
                Hairline rules replace the gold borders; the chevron keeps
                --accent (5.47:1 on the ground, and an icon only needs 3:1). */}
            <div className="w-full border-t border-glass-line">
              {categoryFaq(cat.name, slug).map((item, i) => (
                <details key={i} className="group border-b border-glass-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-right font-display text-base font-medium transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent [&::-webkit-details-marker]:hidden">
                    <span>{item.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-accent transition-[transform,rotate] duration-200 ease-out group-open:rotate-180"
                    />
                  </summary>
                  <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* THE SHELF SHEET — everything that used to be a four-row toolbar above
          the grid, plus the two facet families this shelf never had.
          Bottom-anchored and near-full-height, because on a phone that is the
          only shape a list of ~40 chips can take without scrolling the page
          away underneath it. It renders nothing until opened, so it costs the
          SSR HTML nothing and cannot affect what a crawler sees. */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          // A flex COLUMN with one scrolling child, not one scrolling box with
          // an absolutely-positioned bar: `position:absolute; bottom:0` inside
          // an overflow-y-auto element resolves against the scrollable content
          // box, so the action bar would have sat at the bottom of the whole
          // scroll length and been off-screen until the shopper reached the end
          // of the list. As a flex sibling it is simply always there.
          className="flex h-[92dvh] flex-col gap-0 overflow-hidden [--glass-radius:0px]"
        >
          {/* text-start twice: SheetHeader's base is `text-center sm:text-left`,
              and on an RTL site the sm variant has to be beaten by another sm
              variant or the desktop sheet header flips to the wrong edge. */}
          {/* ps-11 clears the built-in close button, exactly as CartDrawer:95
              does and for the same reason. sheet.tsx anchors its Close at
              `absolute right-4 top-4` with p-1 around a 16px icon, i.e. a 24px
              box 16-40px from the PHYSICAL right edge — which under dir="rtl" is
              the inline START, where the title begins. Without this the close
              button sits on top of the first characters of "סינון ומיון". Do not
              "fix" it by making sheet.tsx use a logical end-4 instead: that
              moves the button to the visual left in RTL and breaks CartDrawer's
              clearance at the same time. */}
          <SheetHeader className="shrink-0 space-y-1 ps-11 text-start sm:text-start">
            <SheetTitle className="font-display text-xl">סינון ומיון</SheetTitle>
            <SheetDescription>
              {visible.length} מוצרים מתוך {cards.length} ב{cat?.name ?? slug}
            </SheetDescription>
          </SheetHeader>

          {/* The negative inline margins let the scrollbar sit on the sheet's
              own edge while the content keeps the sheet's 24px gutter. */}
          <div className="-mx-6 mt-4 flex-1 space-y-5 overflow-y-auto px-6 pb-4">
            <SheetGroup label="סדר התצוגה">
              {SORT_LABELS.map((o) => (
                <FacetChip
                  key={o.value}
                  active={sort === o.value}
                  onClick={() => changeSort(o.value)}
                  label={o.label}
                />
              ))}
              {/* What the default actually does, said once. It is not a
                  recommendation engine and there are no orders to learn from —
                  it is a spread across this shelf's own sub-families, opened at
                  their medians. */}
              <p className="mt-1 w-full text-xs text-muted-foreground leading-relaxed">
                "מבחר מהמדף" פותח בפריטים האופייניים למדף — לא בזולים ולא ביקרים שבו.
              </p>
            </SheetGroup>

            {/* Four rungs cut at THIS shelf's own quartiles, so each holds about
                a quarter of it and every label is a real number. The three
                global buckets this replaced put all 671 kippot in "עד ₪100". */}
            {controls.rungs.length > 0 && (
              <SheetGroup label="מחיר">
                {controls.rungs.map((r) => (
                  <FacetChip
                    key={r.id}
                    active={priceFromUrl === r.id}
                    onClick={() => toggleRung(r.id)}
                    label={r.label}
                    count={r.count}
                  />
                ))}
              </SheetGroup>
            )}

            {/* Sub-shelves as a MULTI-select filter — the one thing the chip row
                below the first grid row cannot express, because a link goes to
                exactly one place. 741 of the 743 kippot carry exactly one
                sub-family and every sub-family is a strict subset of kipot, so
                selecting one here and navigating to its page show the same
                cards; selecting two shows what neither page can. */}
            {controls.subs.length > 0 && (
              <SheetGroup label="תת-קטגוריה">
                {controls.subs.map((c) => (
                  <FacetChip
                    key={c.slug}
                    active={subs.includes(c.slug)}
                    onClick={() => toggleSub(c.slug)}
                    label={c.name}
                    count={c.count}
                  />
                ))}
              </SheetGroup>
            )}

            {/* Material / colour / size, parsed out of the supplier's own
                attribute tail. buildFacetGroups drops a bucket under two items,
                a bucket that holds the whole shelf, and any group left with
                fewer than two buckets — so a shelf whose coverage is too thin
                simply shows no group here rather than a list of one-item
                buckets. */}
            {controls.groups.map((g) => (
              <SheetGroup key={g.key} label={FACET_LABELS[g.key]}>
                {g.buckets.map((b) => (
                  <FacetChip
                    key={b.value}
                    active={facets[g.key].includes(b.value)}
                    onClick={() => toggleFacet(g.key, b.value)}
                    label={b.value}
                    count={b.count}
                  />
                ))}
              </SheetGroup>
            ))}

            {controls.groups.length > 0 && (
              // Said once: the tail is supplier data and half the catalogue does
              // not carry it, so filtering by an attribute shows only the items
              // that are tagged.
              <p className="border-t border-glass-line pt-5 text-xs text-muted-foreground leading-relaxed">
                {FACET_COVERAGE_NOTE}
              </p>
            )}
          </div>

          {/* Action bar — a flex sibling of the scroll region, so it is always
              on screen without overlaying the list. "הצג" carries the live
              count, so the shopper commits to a number rather than a guess. */}
          <div className="-mx-6 -mb-6 flex shrink-0 items-center gap-3 border-t border-glass-line px-6 py-4">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="press inline-flex min-h-11 items-center rounded-full bg-card/70 px-5 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
            >
              נקה סינון
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="press inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
            >
              הצג {visible.length} מוצרים
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * An active selection, shown in the shelf bar with its own clear button so a
 * shopper can see and undo their view without reopening the sheet.
 *
 * Ink on white rather than the accent fill the sheet's chips use: in the sheet
 * "active" has to stand out from twenty inactive siblings, whereas here every
 * chip is active by definition and a row of gold pills would outshout the
 * <h1> two lines above it.
 */
function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-secondary px-4 text-sm text-foreground transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-card"
    >
      <span>{label}</span>
      <X aria-hidden="true" className="h-3.5 w-3.5 opacity-70" />
      <span className="sr-only">הסרת הסינון</span>
    </button>
  );
}
