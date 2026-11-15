// The products of an occasion collection (/collection/<slug>), shared by the
// collection page and the gift finder (/gift-finder) so both list the same
// real, imaged products in the same order. Moved out of collection.$slug.tsx
// unchanged; it uses the browser-safe client, so it runs in a loader or a query.
import { supabase } from "@/integrations/supabase/client";
import type { ProductCardData } from "@/components/ProductCard";
import type { OccasionCollection } from "@/lib/collections";
import { collapseSameName, orderCatalog } from "@/lib/catalog-order";

// A curated showcase, not the full catalogue: cap the grid so every tile is a
// real, imaged product and the whole list ships in the SSR HTML (crawlable)
// without pulling thousands of rows. Mirrors /collection/personalized.
export const COLLECTION_CAP = 48;

// `family` is the source category a row was pulled from — the sub-shelf key
// orderShelf() round-robins across. An occasion collection is a union of 2-6
// categories, so without it a gift hub would open on one category's worth of
// tiles before reaching the next.
export type CollectionRow = ProductCardData & {
  is_active?: boolean;
  created_at?: string;
  family?: string | null;
};

/**
 * Server-side fetch of the products for a collection's category slugs. Mirrors
 * the proven /collection/personalized loader: resolve the slugs to category ids,
 * pull an ordered pool of their product links, then keep only active + imaged
 * products, dedupe by id, collapse same-name models, order and cap.
 *
 * Every slug in `categorySlugs` is a REAL category (verified populated), so this
 * never invents a product: everything shown is a real row from `products`.
 */
export async function fetchCollectionProducts(
  collection: Pick<OccasionCollection, "slug" | "categorySlugs">,
  /** How many products to return; the collection page shows COLLECTION_CAP. */
  cap: number = COLLECTION_CAP,
): Promise<CollectionRow[]> {
  const { data: catRows, error: catErr } = await supabase
    .from("categories")
    .select("id, slug")
    .in("slug", collection.categorySlugs);
  if (catErr) throw catErr;
  // id → slug, so every joined row can carry the sub-shelf it came from. The
  // slug is selected alongside the id purely for that; the query is otherwise
  // the one that was already here.
  const slugById = new Map<string, string>(
    (catRows ?? []).map((c: any) => [c.id as string, c.slug as string]),
  );
  const ids = [...slugById.keys()].filter(Boolean);
  if (ids.length === 0) return [];

  const SELECT =
    "category_id, products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status, created_at)";
  // Preferred: order the join by the freshest products so the bounded pool below
  // spans recent items across every category in the collection, rather than an
  // arbitrary slice dominated by whichever category is scanned first.
  let rows: any[] | null = null;
  const ordered = await supabase
    .from("product_categories")
    .select(SELECT)
    .in("category_id", ids)
    .order("created_at", { referencedTable: "products", ascending: false })
    .limit(600);
  if (!ordered.error) {
    rows = ordered.data as any[];
  } else {
    // Ordering by an embedded resource is a PostgREST feature; if it is ever
    // rejected on this schema, fall back to a larger unordered pool rather than
    // blanking the collection. Correctness of the listing beats freshness of it.
    console.warn(
      "[collection/$slug] embedded order unavailable, using unordered pool:",
      ordered.error,
    );
    const { data, error } = await supabase
      .from("product_categories")
      .select(SELECT)
      .in("category_id", ids)
      .limit(1000);
    if (error) throw error;
    rows = data as any[];
  }

  // Keep only active, imaged products (a showcase that leaned on placeholder
  // tiles would undersell the craft), deduped by id — a product that sits in two
  // of the collection's categories is returned once per membership.
  const seen = new Set<string>();
  const pool: CollectionRow[] = [];
  for (const r of (rows ?? []) as any[]) {
    const p = r.products;
    if (!p?.is_active || !p.thumbnail_url) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    // First membership wins: a product that sits in two of the collection's
    // categories is deduped above, so it round-robins under the first one the
    // ordered pool returned it for. Which of the two is arbitrary and harmless
    // — the point of `family` is that the cycle alternates, not that a row is
    // filed correctly.
    pool.push({ ...(p as CollectionRow), family: slugById.get(r.category_id) ?? null });
  }

  // Collapse same-name models into one tile, mirroring /category, /shop and
  // /collection/personalized: the supplier reuses one generic name across many
  // SKUs, so without this the grid would repeat near-identical cards.
  //
  // THE REPRESENTATIVE PICKER THAT USED TO BE INLINE HERE IS PRESERVED, not
  // dropped: collapseSameName() elects has-photo → in stock → CHEAPEST, which
  // is the deliberate rule this file already applied (in stock, then cheapest)
  // plus a photo preference that is inert here because the pool above is
  // already imaged-only. So the tile still links to the cheapest buyable model
  // of the group — the behaviour the old comment was defending.
  const collapsed = collapseSameName(pool);

  // WAS: in-stock, then `b.price - a.price` "for a gift-guide feel", then a
  // Hebrew name tiebreak — i.e. price DESC. On /collection/personalized that
  // opened a 48-tile showcase whose cheapest item was ₪280 over a real floor of
  // ₪15, and the same rule ran here. Replaced by the shared shape order: a
  // round-robin across the collection's own source categories, each ordered
  // outward from its own median, so the first screen of a gift hub spans what
  // the hub actually holds instead of its ceiling. In-stock and photo-less rows
  // still sink last — orderCatalog() ends on sinkUnbuyableLast().
  //
  // The CAP=48 slice therefore takes the first 48 of an interleaved list, which
  // is what makes it a cross-section of the collection rather than its 48 most
  // expensive rows.
  return orderCatalog(collapsed, { shelfKey: `collection/${collection.slug}` }).slice(0, cap);
}
