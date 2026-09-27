// /mivtzaim — every product a live CRM promotion prices, with the promotions
// themselves on top (label, percentage, what they cover, until when). The
// site-wide PromoStrip links here while a promotion is live.
//
// The list comes from list_promotion_products(), which is built on the same
// active_promotion_index() that prices every card, so the page can only list
// what the site actually discounts. A store-wide promotion has no product list
// of its own: the page says so and sends shoppers to /shop, with a sample
// below. With nothing live the page stays up (the strip may be cached for a
// minute) but says so, and asks search engines not to index it.
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { orderCatalog } from "@/lib/catalog-order";
import { formatPromoEnd } from "@/lib/promotions";

const SITE = "https://orzadik.com";
const CANONICAL = `${SITE}/mivtzaim`;
/** Tiles rendered. The RPC hands back up to POOL, ordered, for the spread below. */
const CAP = 48;
const POOL = 200;

const TITLE = "מבצעים — יודאיקה ותשמישי קדושה בהנחה | אור זרוע לצדיק";
const DESCRIPTION =
  "המבצעים הפעילים באתר אור זרוע לצדיק: המחיר המוצג כבר כולל את ההנחה, והמחיר המחוק הוא המחיר הרגיל באתר. כל מבצע מוגבל בזמן — תאריך הסיום מופיע ליד כל מבצע.";

export type PublicPromo = {
  id: string;
  label: string | null;
  percentOff: number;
  endsAt: string;
  scope: "all" | "categories" | "products";
  categories: Array<{ slug: string; name: string }>;
};

type Tile = ProductCardData & { model_price_max?: number; family?: string };

async function fetchPublicPromos(): Promise<PublicPromo[]> {
  const { data, error } = await supabase.rpc("active_promotions_public");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    label: r.badge_label || null,
    percentOff: Number(r.percent_off),
    endsAt: r.ends_at,
    scope: (r.scope as PublicPromo["scope"]) ?? "products",
    categories: Array.isArray(r.categories)
      ? (r.categories as Array<{ slug: string; name: string }>)
      : [],
  }));
}

async function fetchPromoTiles(): Promise<{ tiles: Tile[]; total: number }> {
  const { data, error } = await supabase.rpc("list_promotion_products", { p_limit: POOL });
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    price: Number(r.price),
    sale_price: r.sale_price == null ? null : Number(r.sale_price),
    thumbnail_url: r.thumbnail_url,
    stock_status: r.stock_status,
    model_count: Number(r.model_count),
    model_price_max: Number(r.model_price_max),
    // Round-robin across promotions (orderShelf's "family"), and a price spread
    // inside each — instead of 48 near-identical tiles from the biggest group.
    family: String(r.percent_off),
  }));
  return {
    tiles: orderCatalog(rows, { shelfKey: "mivtzaim" }).slice(0, CAP),
    total: Number(data?.[0]?.total_count ?? 0),
  };
}

/** A store-wide promotion prices everything; show a slice of the shop. */
async function fetchShopSample(): Promise<Tile[]> {
  const { data, error } = await supabase.rpc("list_products_collapsed", {
    p_term: "",
    p_limit: 24,
    p_offset: 0,
    p_sort: "recommended",
  });
  if (error) throw error;
  return (data ?? []) as unknown as Tile[];
}

export const Route = createFileRoute("/mivtzaim")({
  loader: async () => {
    // Each read degrades on its own: the page must stand even when one fails.
    const [promos, listed] = await Promise.all([
      fetchPublicPromos().catch((e) => {
        console.warn("[mivtzaim] promotions unavailable:", e);
        return [] as PublicPromo[];
      }),
      fetchPromoTiles().catch((e) => {
        console.warn("[mivtzaim] product list unavailable:", e);
        return { tiles: [] as Tile[], total: 0 };
      }),
    ]);
    const storeWide = promos.find((p) => p.scope === "all") ?? null;
    const sample =
      storeWide && listed.tiles.length === 0 ? await fetchShopSample().catch(() => []) : [];
    return { promos, tiles: listed.tiles, total: listed.total, sample };
  },
  head: ({ loaderData }) => {
    const promos = (loaderData?.promos ?? []) as PublicPromo[];
    const tiles = [...(loaderData?.tiles ?? []), ...(loaderData?.sample ?? [])] as Tile[];
    const live = promos.length > 0;
    const og = tiles.find((t) => !!t.thumbnail_url)?.thumbnail_url || `${SITE}/og-default.jpg`;
    const collectionLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": CANONICAL,
      url: CANONICAL,
      name: "מבצעים | אור זרוע לצדיק",
      description: DESCRIPTION,
      inLanguage: "he-IL",
      isPartOf: { "@id": "https://orzadik.com/#website" },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: tiles.length,
        itemListElement: tiles.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE}/product/${p.slug}`,
          name: p.name,
        })),
      },
    };
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        // Nothing live = nothing to rank for; keep the empty page out of the index.
        ...(live ? [] : [{ name: "robots", content: "noindex, follow" }]),
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: CANONICAL },
        { property: "og:image", content: og },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: CANONICAL }],
      scripts: live
        ? [{ type: "application/ld+json", children: JSON.stringify(collectionLd) }]
        : [],
    };
  },
  component: PromotionsPage,
});

/** "כיפות, טליתות ועוד 2" — the categories a promotion was set on. */
function categoryLinks(cats: PublicPromo["categories"]) {
  const shown = cats.slice(0, 4);
  return (
    <>
      {shown.map((c, i) => (
        <span key={c.slug}>
          {i > 0 ? ", " : ""}
          <Link
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="font-semibold text-accent underline decoration-gold underline-offset-4"
          >
            {c.name}
          </Link>
        </span>
      ))}
      {cats.length > shown.length ? ` ועוד ${cats.length - shown.length}` : ""}
    </>
  );
}

function PromoCard({ p }: { p: PublicPromo }) {
  const end = formatPromoEnd(p.endsAt);
  return (
    <li className="glass p-5 text-center [--glass-radius:1rem]">
      <div className="text-sm font-semibold text-foreground">{p.label || "מבצע באתר"}</div>
      <div className="mt-2">
        <span
          dir="ltr"
          className="inline-block rounded-full bg-argaman px-3 py-1 text-lg font-bold text-white"
        >
          -{p.percentOff}%
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {p.scope === "all" ? (
          <>על כל המוצרים באתר</>
        ) : p.scope === "categories" && p.categories.length > 0 ? (
          <>על {categoryLinks(p.categories)}</>
        ) : (
          <>על פריטים נבחרים — ברשימה למטה</>
        )}
      </p>
      {end ? <p className="mt-1 text-xs text-muted-foreground">בתוקף עד {end}</p> : null}
    </li>
  );
}

function PromotionsPage() {
  const data = Route.useLoaderData();
  const promos = data.promos as PublicPromo[];
  const tiles = data.tiles as Tile[];
  const sample = data.sample as Tile[];
  const total = data.total;
  const storeWide = promos.some((p) => p.scope === "all");

  return (
    <div className="pb-16">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb items={[{ label: "בית", to: "/" }, { label: "מבצעים" }]} />
      </div>

      <div className="container mx-auto px-4 pt-6">
        <PageHeader
          eyebrow="מבצעים"
          title={promos.length > 0 ? "המבצעים באתר עכשיו" : "אין כרגע מבצע פעיל"}
          sub={
            promos.length > 0
              ? "המחיר על כל פריט כבר כולל את ההנחה, והמחיר המחוק לידו הוא המחיר הרגיל באתר. ההנחה מחושבת גם בעגלה ובקופה."
              : "מבצעים מתפרסמים כאן ובפס שבראש האתר. בינתיים, כל המבחר פתוח לפניכם."
          }
        />
      </div>

      {promos.length > 0 ? (
        <section className="container mx-auto px-4 max-w-5xl">
          <ul
            className={`grid gap-4 ${promos.length === 1 ? "max-w-sm mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}
          >
            {promos.map((p) => (
              <PromoCard key={p.id} p={p} />
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            מבצעים לא מצטברים: כשפריט נכלל ביותר ממבצע אחד, חלה ההנחה הגבוהה מביניהם.
          </p>
        </section>
      ) : null}

      {tiles.length > 0 ? (
        <section className="container mx-auto px-4 pt-12">
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              פריטים במבצע
            </h2>
            <span aria-hidden="true" className="gold-rule block w-16 mx-auto mt-3" />
            {total > tiles.length ? (
              <p className="mt-3 text-sm text-muted-foreground">
                מוצגים {tiles.length} מתוך {total}
                {promos.some((p) => p.scope === "categories")
                  ? " — השאר בקטגוריות שבמבצע, כבר במחיר המבצע."
                  : "."}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tiles.map((p, i) => (
              <ProductCard key={p.id} p={p} eager={i < 4} highPriority={i < 2} />
            ))}
          </div>
        </section>
      ) : null}

      {storeWide && sample.length > 0 ? (
        <section className="container mx-auto px-4 pt-12">
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              המבצע חל על כל החנות
            </h2>
            <span aria-hidden="true" className="gold-rule block w-16 mx-auto mt-3" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sample.map((p, i) => (
              <ProductCard key={p.id} p={p} eager={i < 4} highPriority={i < 2} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="container mx-auto px-4 pt-14 text-center max-w-2xl">
        <Link
          to="/shop"
          className="press inline-block rounded-full bg-accent text-accent-foreground px-8 py-3 text-sm font-medium transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
        >
          {storeWide ? "לכל המוצרים — במחיר המבצע" : "לכל המוצרים"}
        </Link>
      </section>
    </div>
  );
}
