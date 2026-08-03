import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { SectionHeader } from "@/components/home/SectionHeader";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

/** Below this the strip looks broken rather than sparse, so it is not shown. */
const MIN_PRODUCTS = 4;

/**
 * Height of the populated section, measured in-browser at the widths where the
 * fluid container changes size (max per range, so it can only ever over-reserve):
 *   <768px 744 · 768-1279px 817 · >=1280px 885
 * Only used when the caller asks for it — see `reserveSpace`.
 */
const RESERVED_HEIGHT = " min-h-[750px] md:min-h-[820px] xl:min-h-[890px]";

/**
 * Normalised name key — quote family folded, whitespace collapsed, case folded,
 * and any leading pure-digit token dropped. That last step is not cosmetic: the
 * supplier import left SKU numbers glued to the front of some names, so
 * "206 גביע קריסטל מהודר ללא רגל 9 ס\"מ" and "גביע קריסטל מהודר ללא רגל 9 ס\"מ"
 * are the same product to a shopper's eye and were landing in the same rail.
 */
function nameKey(name: string): string {
  return name
    .replace(/[״"'׳‘’“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+\s+/, "")
    .toLowerCase();
}

/**
 * The "family" a product belongs to, for rail diversity only: the first two
 * words of its normalised name. Crude on purpose — it is the same idea as
 * list_products_collapsed's name_norm grouping and the client-side groupKey,
 * one notch looser, and it is only ever used to decide how many NEAR-identical
 * tiles a ten-slot rail may show. It is never used for identity, pricing or
 * links.
 *
 * Measured on the live catalogue 2026-08-03: the 48-row premium pool held 16
 * rows starting "טלית פלטניום", 8 starting "טלית פרימיום" and 8 Passover sets
 * starting "סט פסח". Two words separates those three genuinely different lines
 * while still collapsing each of them.
 */
function familyKey(name: string): string {
  return nameKey(name).split(" ").slice(0, 2).join(" ");
}

/**
 * The head noun — the first word. Hebrew product names in this catalogue lead
 * with the thing itself (נטלה, גביע, טלית, חנוכייה, שטנדר), so this is a
 * coarser bucket than familyKey and catches what familyKey cannot: three
 * washing cups called "נטלה אקריליק", "נטלה מהודרת" and "נטלה פולימר" are three
 * families and one product type. Both caps are applied; the head cap is the
 * looser of the two.
 */
function headKey(name: string): string {
  return nameKey(name).split(" ")[0] ?? "";
}

/**
 * Build a rail pool that a shopper can tell apart: drop exact repeats of a
 * name, then allow at most `maxPerFamily` tiles from any one two-word family
 * and at most `maxPerHead` from any one head noun, keeping the incoming order
 * otherwise. Exported because the homepage's gift rail runs the identical
 * treatment over a different slice of the catalogue — the two rails must not
 * re-invent "these tiles look the same" separately.
 */
export function diversifyRail<T extends { name: string }>(
  rows: T[],
  {
    maxPerFamily,
    maxPerHead = Number.POSITIVE_INFINITY,
    limit,
  }: { maxPerFamily: number; maxPerHead?: number; limit: number },
): T[] {
  const names = new Set<string>();
  const families = new Map<string, number>();
  const heads = new Map<string, number>();
  const out: T[] = [];
  for (const row of rows) {
    if (out.length >= limit) break;
    const nk = nameKey(row.name);
    if (names.has(nk)) continue;
    const fk = familyKey(row.name);
    const hk = headKey(row.name);
    const famUsed = families.get(fk) ?? 0;
    const headUsed = heads.get(hk) ?? 0;
    if (famUsed >= maxPerFamily || headUsed >= maxPerHead) continue;
    names.add(nk);
    families.set(fk, famUsed + 1);
    heads.set(hk, headUsed + 1);
    out.push(row);
  }
  return out;
}

/**
 * Rotate a SHOW-sized window through `pool` once per UTC day.
 *
 * Days since the UTC epoch — identical on the Worker (UTC) and any client,
 * since Date.now() is timezone-independent epoch ms — so server and client
 * compute the identical set and there is no hydration mismatch. Exported for
 * the same reason as diversifyRail: one rotation, two rails.
 *
 * Pool size deliberately is NOT a multiple of `show`: gcd(10, 48) = 2 gives 24
 * distinct windows before the cycle repeats, where a 40-row pool would give 4.
 */
export function rotateDaily<T>(pool: T[], show: number): T[] {
  if (pool.length <= show) return pool;
  const day = Math.floor(Date.now() / 86_400_000);
  const start = (day * show) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, show);
}

/**
 * The query behind the "מומלצים" rail. Exported so a route loader can run it on
 * the server and hand the result back as `initialProducts` — same function,
 * same shape, so the SSR HTML and the client refetch can never disagree.
 *
 * NOT ordered by created_at: the whole catalog was bulk-imported at ~one
 * timestamp, so "newest" was meaningless (and the old "חדש באתר" heading was
 * untrue). Instead we build a POOL of genuinely presentable items — in stock,
 * with an image, with a real long description, priced — ordered by price so the
 * premium pieces surface, then rotate a SHOW-sized window once per UTC day for
 * freshness. That intent is unchanged; what changed is WHICH rows reach it.
 *
 * ——— WHY THE POOL IS NOW COLLAPSED AND CAPPED ———
 * Measured on the live catalogue 2026-08-03 (anon REST, the exact query this
 * function used to run): the 48-row pool ended in EIGHT contiguous Passover
 * sets, four of which carry byte-identical names
 * ("סט פסח מפואר 4 חלקים כיסוי פסח+אפיקומן+הסבה ומגבת אריזת פיויסי"). The
 * rotation start is (day * 10) % 48, and on 2026-08-03 it was 40 — so the
 * homepage's one product rail showed, in Av, eight Passover sets with four
 * tiles the shopper could not tell apart. Rows 6-21 were sixteen ₪1,100
 * "טלית פלטניום" that differed only by an embroidery motif, so the same failure
 * was one turn of the dial away on most other days too.
 *
 * Two changes, both reusing mechanisms this codebase already owns:
 *   1. The pool comes from list_products_collapsed — the SAME RPC /shop and the
 *      header search run — which returns one row per name group with a
 *      model_count, so the four identical Passover rows arrive as one tile
 *      reading "6 דגמים". Its 'recommended' sort is in-stock → has-image →
 *      has-copy → price DESC, which is exactly the presentability gate this
 *      function used to hand-roll in PostgREST filters, plus the premium
 *      ordering. Verified live: the top 120 rows are all in stock, all have a
 *      thumbnail and all are priced > 0.
 *   2. diversifyRail then caps any one family at 2 of the 48 pool slots and any
 *      one head noun at 3, so no window of 10 can be dominated by one line.
 *      Simulated over the next 40 days against the live pool: 24 distinct
 *      windows, worst-case duplicate names 0 (was 4), worst-case tiles from one
 *      family 2 (was 8), worst-case tiles sharing a head noun 3 (was 8), pool
 *      price band ₪353-₪1,800 paid.
 *
 * Ordering stays on the raw `price` column, not a recomputed one:
 * getEffectivePrice is Math.round(price * 0.7), a monotonic transform, so
 * price DESC and paid-price DESC are the SAME order. (The earlier suspicion
 * that they differ came from `sale_price`, which is only the honest
 * struck-through former price — ProductCard charges getEffectivePrice(price)
 * and nothing else. Re-ordering by it would rank by a strike-through.)
 *
 * The ILIKE-style fallback is kept for the same reason shop.tsx keeps one: a
 * search-backend problem must degrade the rail, never blank the homepage. The
 * fallback cannot collapse in the DB, so diversifyRail carries it there.
 */
// RAW_POOL is 200 rather than 48 because the caps below DISCARD rows: 200 is the
// measured minimum that still fills a 48-row pool once "at most 2 per family,
// at most 3 per head noun" has been applied (160 rows yields only 44).
const RAW_POOL = 200;
const POOL = 48;
const SHOW = 10;
const MAX_PER_FAMILY = 2;
const MAX_PER_HEAD = 3;

export async function fetchHomeFeaturedProducts(): Promise<ProductCardData[]> {
  {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc("list_products_collapsed", {
      p_term: "",
      p_limit: RAW_POOL,
      p_offset: 0,
      p_sort: "recommended",
    });
    if (!rpcErr) {
      const rows = (rpcRows ?? []) as ProductCardData[];
      const pool = diversifyRail(rows, {
        maxPerFamily: MAX_PER_FAMILY,
        maxPerHead: MAX_PER_HEAD,
        limit: POOL,
      });
      return rotateDaily(pool, SHOW);
    }
    console.warn("[home] list_products_collapsed unavailable, using fallback:", rpcErr);
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, price, sale_price, thumbnail_url, stock_status")
    .eq("is_active", true)
    .neq("stock_status", "outofstock")
    .not("thumbnail_url", "is", null)
    .not("description", "is", null)
    .neq("description", "")
    .gt("price", 0)
    .order("price", { ascending: false })
    .order("id", { ascending: true }) // stable tiebreaker so the pool is deterministic
    .limit(RAW_POOL);
  if (error) throw error;
  const pool = diversifyRail((data ?? []) as ProductCardData[], {
    maxPerFamily: MAX_PER_FAMILY,
    maxPerHead: MAX_PER_HEAD,
    limit: POOL,
  });
  return rotateDaily(pool, SHOW);
}

/**
 * The presentational half of a homepage product rail: section header, swipeable
 * RTL carousel of buyable ProductCards, and one trailing link out.
 *
 * Extracted so the "מומלצים באתר" rail below and the homepage's gift rail are
 * the same object with different data, rather than two copies of this markup
 * that drift. Purely presentational and SSR-safe — no hooks, no fetching, no
 * browser globals — so a caller can render it straight from loader data.
 */
export function ProductRail({
  eyebrow,
  title,
  sub,
  products,
  moreLabel,
  moreSearch,
  className,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  products: ProductCardData[];
  moreLabel: string;
  /** Search params for the trailing /shop link (e.g. a sort). */
  moreSearch?: { sort?: string };
  className?: string;
}) {
  return (
    <section className={className ?? "py-14 md:py-20"}>
      <div className="container mx-auto px-4">
        <SectionHeader eyebrow={eyebrow} title={title} sub={sub} />

        <Carousel dir="rtl" opts={{ direction: "rtl", align: "start" }} className="px-2">
          <CarouselContent>
            {products.map((p) => (
              <CarouselItem key={p.id} className="basis-[44%] md:basis-1/3 lg:basis-1/4">
                <ProductCard p={p} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="right-2 -translate-y-1/2 hidden md:inline-flex" />
          <CarouselNext className="left-2 -translate-y-1/2 hidden md:inline-flex" />
        </Carousel>

        <div className="text-center">
          <Link
            to="/shop"
            search={moreSearch as never}
            className="mt-6 inline-block text-sm text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
          >
            {moreLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * "מומלצים באתר" — a daily-rotated pool of presentable in-stock products,
 * swipeable RTL carousel of buyable ProductCards.
 *
 * Pass `initialProducts` (from a route loader) to have the section rendered
 * server-side. `reserveSpace` is for the case where that loader fetch failed:
 * the ">= MIN_PRODUCTS" gate then resolves after hydration, so the section
 * holds its height instead of injecting itself mid-page. Callers with no
 * loader at all leave both off and get the plain client-fetch behaviour.
 */
export function FeaturedProductsCarousel({
  initialProducts,
  reserveSpace = false,
}: {
  initialProducts?: ProductCardData[];
  reserveSpace?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["home-featured-products"],
    staleTime: 5 * 60_000,
    // Seeded from the SSR loader when the caller has it, so the cards are in
    // the initial HTML; the query still refetches once it goes stale.
    initialData: initialProducts,
    queryFn: fetchHomeFeaturedProducts,
  });

  const products = data ?? [];
  const sectionClass = `py-14 md:py-20${reserveSpace ? RESERVED_HEIGHT : ""}`;

  if (products.length < MIN_PRODUCTS) {
    // With SSR data the server already knows there is nothing to show, so the
    // section simply never exists and cannot appear later. Only the degraded
    // path holds space open for a result that is still in flight.
    return reserveSpace ? <section aria-hidden="true" className={sectionClass} /> : null;
  }

  return (
    <ProductRail
      eyebrow="פריטים נבחרים"
      title="מומלצים באתר"
      products={products}
      moreLabel="לכל המוצרים ←"
      className={sectionClass}
    />
  );
}
