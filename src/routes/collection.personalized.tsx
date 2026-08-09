import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PersonalizationPreview } from "@/components/product/PersonalizationPreview";
import { PERSONALIZABLE_CATEGORY_SLUGS } from "@/lib/personalization";
import { collapseSameName, orderCatalog } from "@/lib/catalog-order";
import { GIFT_NOTE } from "@/lib/facets";

const SITE = "https://orzadik.com";
const CANONICAL = `${SITE}/collection/personalized`;
// A curated showcase, not the full catalogue: cap the grid so every tile is a
// real, imaged, personalizable product and the whole list ships in the SSR HTML
// (crawlable) without pulling thousands of rows.
const CAP = 48;

const TITLE = "רקמה וחריטה אישית — מתנה עם שם | אור זרוע לצדיק";
const DESCRIPTION =
  "פריטי יודאיקה עם רקמת שם או חריטת לייזר אישית — כיסויי טלית ותפילין, תיקים, מעמדי בנצ'ר וסידורים. הופכים פריט מהודר למתנה אישית ובלתי נשכחת. הפונט והגוון מתואמים איתכם לאחר ההזמנה.";

// `family` is the personalizable category a row was pulled from — the sub-shelf
// key orderShelf() round-robins across, so the showcase alternates between
// talit covers, bags, benchers and siddurim instead of exhausting one first.
type PersonalizedRow = ProductCardData & {
  is_active?: boolean;
  created_at?: string;
  family?: string | null;
};

// Server-side fetch of the personalizable products. `PERSONALIZABLE_CATEGORY_SLUGS`
// is the single source of truth (shared with the PDP), so this page can never
// drift from what is actually offered as personalizable — and it never invents a
// product: everything shown is a real row from `products`.
async function fetchPersonalizableProducts(): Promise<PersonalizedRow[]> {
  const slugs = [...PERSONALIZABLE_CATEGORY_SLUGS];

  const { data: catRows, error: catErr } = await supabase
    .from("categories")
    .select("id, slug")
    .in("slug", slugs);
  if (catErr) throw catErr;
  // id → slug, so every joined row can carry the sub-shelf it came from. The
  // slug rides along on the query that was already here; no extra round trip.
  const slugById = new Map<string, string>(
    (catRows ?? []).map((c: any) => [c.id as string, c.slug as string]),
  );
  const ids = [...slugById.keys()].filter(Boolean);
  if (ids.length === 0) return [];

  const SELECT =
    "category_id, products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status, created_at)";
  // Preferred: order the join by the freshest products so the bounded pool below
  // captures recent items across every personalizable category, rather than an
  // arbitrary slice dominated by whichever category the planner scans first.
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
    // blanking the showcase. Correctness of the listing beats freshness of it.
    console.warn("[collection/personalized] embedded order unavailable, using unordered pool:", ordered.error);
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
  // personalizable categories is returned once per membership.
  const seen = new Set<string>();
  const pool: PersonalizedRow[] = [];
  for (const r of (rows ?? []) as any[]) {
    const p = r.products;
    if (!p?.is_active || !p.thumbnail_url) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    // First membership wins — the row is deduped above, so a product in two
    // personalizable categories round-robins under whichever the ordered pool
    // returned first. Arbitrary and harmless: `family` exists to make the cycle
    // alternate, not to file a row correctly.
    pool.push({ ...(p as PersonalizedRow), family: slugById.get(r.category_id) ?? null });
  }

  // Collapse same-name models into one tile, mirroring /category and /shop: the
  // supplier reuses one generic name across many SKUs, so without this the
  // showcase would repeat near-identical cards.
  //
  // The representative rule this file chose is PRESERVED by collapseSameName():
  // has-photo → in stock → cheapest. The photo key is inert here (the pool is
  // imaged-only by construction above), so what remains is exactly the "in
  // stock, then cheapest, so the tile links to a buyable entry point" rule the
  // inline picker implemented.
  const collapsed = collapseSameName(pool);

  // WAS: in-stock, then `b.price - a.price` "for a showcase feel", over a
  // 600-row pool capped at 48. Measured effect: the cheapest of the 48 tiles
  // this page rendered was ₪280, while the real floor of the personalizable
  // categories is ₪15 — the page advertised personalisation as a ₪280+ service
  // it is not. The shared shape order replaces it: a round-robin across the
  // personalizable categories, each walked outward from its own median, so the
  // 48-tile slice is a cross-section of what can actually be personalised.
  // Out-of-stock and photo-less rows still sink last (sinkUnbuyableLast, inside
  // orderCatalog).
  return orderCatalog(collapsed, { shelfKey: "collection/personalized" }).slice(0, CAP);
}

export const Route = createFileRoute("/collection/personalized")({
  loader: async () => {
    try {
      return { products: await fetchPersonalizableProducts() };
    } catch (err) {
      // A DB blip should leave the story page standing (it still ranks and still
      // explains the offer) rather than blowing the whole route into the error
      // boundary — degrade to an empty grid with a link out to /shop.
      console.warn("[collection/personalized] loader failed:", err);
      return { products: [] as PersonalizedRow[] };
    }
  },
  head: ({ loaderData }) => {
    const products = (loaderData?.products ?? []) as PersonalizedRow[];

    // Social / preview image. This hub has no banner of its own, so the most
    // honest card image is a photo of a product it ACTUALLY lists: the loader
    // already keeps only active, imaged products, so the first tile's thumbnail
    // is a real image of a real personalizable item rendered on this page. It is
    // the raw absolute Supabase Storage URL — the same thing product.$slug feeds
    // to og:image — not a thumbUrl() transform, since scrapers want the
    // full-size original. Falls back to the site's brand card when empty.
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
      "@id": CANONICAL,
      url: CANONICAL,
      name: "רקמה וחריטה אישית | אור זרוע לצדיק",
      description: DESCRIPTION,
      inLanguage: "he-IL",
      isPartOf: { "@id": "https://orzadik.com/#website" },
      // Same representative photo as og:image — a real image of an item listed
      // below. Omitted entirely when nothing is listed, rather than pointing the
      // node at the generic brand banner.
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
        { "@type": "ListItem", position: 2, name: "מוצרים", item: `${SITE}/shop` },
        { "@type": "ListItem", position: 3, name: "רקמה וחריטה אישית", item: CANONICAL },
      ],
    };

    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: CANONICAL },
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: ogImageAlt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: CANONICAL }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(collectionLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
  component: PersonalizedCollectionPage,
});

function PersonalizedCollectionPage() {
  // Cast mirrors head() above and category.$slug's loader consumption: TanStack
  // Start's serialized loader-data type widens the product array, so we restate
  // the shape we returned from the loader.
  const products = (Route.useLoaderData().products ?? []) as PersonalizedRow[];

  return (
    <div className="pb-16">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb
          items={[
            { label: "בית", to: "/" },
            { label: "מוצרים", to: "/shop" },
            { label: "רקמה וחריטה אישית" },
          ]}
        />
      </div>

      {/* Hero — the shared gold-ruled page header, honest sub copy.
          `note` states the gift affordance that /checkout already implements
          (see GIFT_NOTE): wrap and a printed dedication, free. A personalised
          item is a gift in almost every case, so this is the fact the shopper
          is missing at this point — not a promotion, and it carries no
          threshold and no deadline. */}
      <div className="container mx-auto px-4 pt-6">
        <PageHeader
          eyebrow="התאמה אישית"
          title="רקמה וחריטה על שם אישי"
          sub="כיתוב שם, ברכה או תאריך — ברקמה עדינה או בחריטת לייזר — שהופכים פריט מהודר למתנה אישית. הפונט, הגוון והמיקום מתואמים איתכם לאחר ההזמנה."
          note={GIFT_NOTE}
        />
      </div>

      {/* Story — how it works, plus the two honest "הדמיה" panels so the offer is
          visible, not just described. */}
      <section className="container mx-auto px-4 max-w-5xl">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="glass h-full p-6 md:p-7 [--glass-radius:1.25rem]">
            <div className="text-gold text-lg mb-2" aria-hidden="true">✦</div>
            <h2 className="font-display text-xl md:text-2xl font-bold mb-2 text-foreground">רקמת שם</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              רקמה בחוט עדין על כיסויי טלית ותפילין, תיקים וכיסויי חלה — שם, ברכה או
              הקדשה, בהתאמה לאירוע ולסגנון.
            </p>
            <PersonalizationPreview text="משפחת לוי" method="embroidery" />
          </div>

          <div className="glass h-full p-6 md:p-7 [--glass-radius:1.25rem]">
            <div className="text-gold text-lg mb-2" aria-hidden="true">✦</div>
            <h2 className="font-display text-xl md:text-2xl font-bold mb-2 text-foreground">חריטת לייזר</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              חריטה מדויקת על מעמדי בנצ'ר, סטים ומתנות עץ — לשם, לתאריך או להקדשה
              שנשמרים לאורך שנים.
            </p>
            <PersonalizationPreview text="יוסף" method="laser" />
          </div>
        </div>

        {/* Honest coordination note — echoes the site's existing promise so the
            previews above are never read as the exact final result. */}
        <p className="mt-6 text-center text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          ✦ ההדמיות להמחשה בלבד. לאחר ההזמנה ניצור איתכם קשר לתיאום הגופן, הצבע
          והמיקום — כדי שהתוצאה תהיה בדיוק כפי שדמיינתם.
        </p>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 pt-12">
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            פריטים להתאמה אישית
          </h2>
          <span aria-hidden="true" className="gold-rule block w-16 mx-auto mt-3" />
        </div>

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
            <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">הפריטים בדרך אליכם</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              רוצים פריט עם רקמה או חריטה אישית? עברו על המבחר או פנו אלינו ונשמח
              לעזור בהתאמה.
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

      {/* CTA out to the full catalogue */}
      {products.length > 0 && (
        <section className="container mx-auto px-4 pt-14 text-center max-w-2xl">
          <p className="text-muted-foreground leading-relaxed mb-6">
            לא מצאתם בדיוק את מה שחיפשתם? המבחר המלא פתוח לפניכם, ואפשר להוסיף
            רקמה או חריטה לפריטים המתאימים.
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
