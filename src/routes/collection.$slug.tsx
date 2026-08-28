import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCollection, type OccasionCollection } from "@/lib/collections";
import { collapseSameName, orderCatalog } from "@/lib/catalog-order";
import { GIFT_NOTE } from "@/lib/facets";
import { ChevronDown } from "lucide-react";

const SITE = "https://orzadik.com";
// A curated showcase, not the full catalogue: cap the grid so every tile is a
// real, imaged product and the whole list ships in the SSR HTML (crawlable)
// without pulling thousands of rows. Mirrors /collection/personalized.
const CAP = 48;

// `family` is the source category a row was pulled from — the sub-shelf key
// orderShelf() round-robins across. An occasion collection is a union of 2-6
// categories, so without it a gift hub would open on one category's worth of
// tiles before reaching the next.
type CollectionRow = ProductCardData & {
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
async function fetchCollectionProducts(collection: OccasionCollection): Promise<CollectionRow[]> {
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
  return orderCatalog(collapsed, { shelfKey: `collection/${collection.slug}` }).slice(0, CAP);
}

export const Route = createFileRoute("/collection/$slug")({
  loader: async ({ params }) => {
    // 404 for any slug that is not a curated collection. The static
    // /collection/personalized route matches before this one, so it is never
    // routed here.
    const collection = getCollection(params.slug);
    if (!collection) throw notFound();
    try {
      return { products: await fetchCollectionProducts(collection) };
    } catch (err) {
      // A DB blip should leave the landing page standing (it still ranks and
      // still explains the occasion) rather than blowing the whole route into
      // the error boundary — degrade to an empty grid with a link out to /shop.
      console.warn("[collection/$slug] loader failed:", err);
      return { products: [] as CollectionRow[] };
    }
  },
  head: ({ params, loaderData }) => {
    const collection = getCollection(params.slug);
    // notFound short-circuits rendering, but head() can still run — guard it.
    if (!collection) return { meta: [{ title: "אוסף | אור זרוע לצדיק" }] };

    const url = `${SITE}/collection/${collection.slug}`;
    const title = collection.metaTitle || `${collection.title} | אור זרוע לצדיק`;
    const description = collection.metaDescription;
    const products = (loaderData?.products ?? []) as CollectionRow[];

    // Social / preview image. An occasion hub has no banner of its own, so the
    // most honest card image is a photo of a product this page ACTUALLY lists:
    // the loader already keeps only active, imaged products, so the first tile's
    // thumbnail is a real image of a real item rendered on this page. It is the
    // raw absolute Supabase Storage URL — the same thing product.$slug feeds to
    // og:image — not a thumbUrl() transform, since scrapers want the full-size
    // original. Falls back to the site's brand card when the grid is empty.
    const ogProduct = products.find((p) => !!p.thumbnail_url);
    const ogProductImage = ogProduct?.thumbnail_url ?? null;
    const ogImage = ogProductImage || `${SITE}/og-default.jpg`;
    // Alt describes the image we actually chose: the product's own name when it
    // is a product photo, the site-wide brand alt when it is the default card.
    // (The root route declares og:image:alt, so this override replaces it rather
    // than leaving the brand alt glued to a product photo.)
    const ogImageAlt = ogProduct?.name || "אור זרוע לצדיק — תשמישי קדושה ויודאיקה מהודרת";

    const collectionLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: `${collection.title} | אור זרוע לצדיק`,
      description,
      inLanguage: "he-IL",
      isPartOf: { "@id": "https://orzadik.com/#website" },
      // Same representative photo as og:image — a real image of an item listed
      // below. Omitted entirely when the collection lists nothing, rather than
      // pointing the node at the generic brand banner.
      ...(ogProductImage ? { image: ogProductImage } : {}),
      mainEntity: {
        "@type": "ItemList",
        // Honest by construction: the loader caps the list at CAP, so `products`
        // is BOTH everything this page renders and everything itemListElement
        // below enumerates — numberOfItems can never claim items the markup does
        // not contain.
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE}/product/${p.slug}`,
          name: p.name,
          ...(p.thumbnail_url ? { image: p.thumbnail_url } : {}),
        })),
      },
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "בית", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "אוספים", item: `${SITE}/categories` },
        { "@type": "ListItem", position: 3, name: collection.title, item: url },
      ],
    };

    const scripts = [
      { type: "application/ld+json", children: JSON.stringify(collectionLd) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
    ];
    // FAQPage JSON-LD only when the collection carries a real FAQ — and the same
    // answers are rendered into the server HTML below, so the structured data
    // never claims text a crawler cannot find on the page.
    if (collection.faq && collection.faq.length > 0) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: collection.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      });
    }

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: ogImageAlt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: CollectionPage,
});

function CollectionPage() {
  const { slug } = Route.useParams();
  // Config, not serialized loader data — re-derive from the slug (the loader
  // already 404'd any slug that is not a real collection).
  const collection = getCollection(slug) as OccasionCollection;
  // Cast mirrors head() and /collection/personalized: the serialized loader-data
  // type widens the product array, so we restate the shape the loader returned.
  const products = (Route.useLoaderData().products ?? []) as CollectionRow[];

  return (
    <div className="pb-16">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb
          items={[
            { label: "בית", to: "/" },
            { label: "אוספים", to: "/categories" },
            { label: collection.title },
          ]}
        />
      </div>

      {/* Hero — the shared gold-ruled page header, honest occasion copy.
          `note` is the gift affordance a shopper on an OCCASION page is
          actually deciding about, and it is already implemented at checkout
          (see GIFT_NOTE) — this only moves the fact to where the decision is
          made. It is a statement, not a promotion: no threshold, no deadline. */}
      <div className="container mx-auto px-4 pt-6">
        <PageHeader
          eyebrow={collection.eyebrow}
          title={collection.title}
          sub={collection.intro}
          note={GIFT_NOTE}
        />
      </div>

      {/* Products */}
      <section className="container mx-auto px-4">
        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} p={p} eager={i < 4} highPriority={i < 2} />
            ))}
          </div>
        ) : (
          <div className="glass max-w-2xl mx-auto my-6 text-center p-10 md:p-14 [--glass-radius:1.5rem]">
            <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-secondary hairline flex items-center justify-center">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">הפריטים בדרך אליכם</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              עברו על המבחר המלא או פנו אלינו ונשמח לעזור לכם למצוא את המתנה המתאימה.
            </p>
            <Link
              to="/shop"
              className="press inline-block rounded-full bg-accent text-accent-foreground px-8 py-3 text-sm font-medium transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
            >
              לכל המוצרים
            </Link>
          </div>
        )}
      </section>

      {/* FAQ — feeds AEO (voice / "People also ask" / AI answers) and mirrors the
          FAQPage JSON-LD emitted in head(). Native <details>/<summary> keeps every
          answer in the server HTML while still collapsing visually, with no JS and
          no hydration cost — so the structured data never outruns the page. */}
      {collection.faq && collection.faq.length > 0 && (
        <section className="container mx-auto px-4 pt-14 max-w-3xl">
          <h2 className="font-display text-2xl font-bold mb-5 text-center">שאלות נפוצות</h2>
          <div className="w-full border-t border-glass-line">
            {collection.faq.map((item, i) => (
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

      {/* CTA out to the full catalogue */}
      {products.length > 0 && (
        <section className="container mx-auto px-4 pt-14 text-center max-w-2xl">
          <p className="text-muted-foreground leading-relaxed mb-6">
            לא מצאתם בדיוק את מה שחיפשתם? המבחר המלא פתוח לפניכם.
          </p>
          <Link
            to="/shop"
            className="press inline-block rounded-full bg-card/70 px-8 py-3 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
          >
            לכל המוצרים
          </Link>
        </section>
      )}
    </div>
  );
}
