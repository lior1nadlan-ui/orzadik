import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPersonalizable } from "@/lib/personalization";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { SubcategoryChips, type CategoryChipRow } from "@/components/catalog/SubcategoryChips";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useState } from "react";
import { categoryFaq, faqJsonLd } from "@/lib/category-faq";
import { getEffectivePrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

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
      .select("products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status, created_at)")
      .eq("category_id", categoryId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(batch ?? []));
    if ((batch ?? []).length < PAGE) break;
  }
  return rows.map((r: any) => r.products).filter((p: any) => p?.is_active);
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
      if (!cat) return { cat: null, parent: null, products: [], allCats: [] as CategoryChipRow[] };
      // Paged read (see fetchCategoryProducts) so a >1000-row category never
      // silently drops products; a thrown DB error still reaches the retry below.
      const products = await fetchCategoryProducts(cat.id);
      // Subcategories surface their parent level in the breadcrumb trail
      // (visible nav + JSON-LD) — fetch it once here so crawlers get the full
      // trail in the initial SSR HTML.
      let parent: { slug: string; name: string } | null = null;
      if (cat.parent_slug) {
        const { data: parentRow } = await supabase
          .from("categories")
          .select("slug, name")
          .eq("slug", cat.parent_slug)
          .maybeSingle();
        parent = parentRow ?? null;
      }
      // Subcategory / sibling chips, fetched here so the internal links exist
      // in the SSR HTML instead of only after the client query resolves.
      // Same select + order as SubcategoryChips/categories.tsx so it seeds the
      // shared ["all-cats"] cache. 105 rows — comfortably under the 1000-row
      // PostgREST cap, so one bounded-in-practice select, not a paged read.
      // Non-fatal like the parent lookup above: the chips are navigation, not
      // the page — if this one select fails the page still renders and the
      // client query fills the strip in.
      const { data: allCatRows } = await supabase
        .from("categories")
        .select("id, slug, name, description, parent_slug, sort_order")
        .order("sort_order")
        .order("name");
      const allCats = (allCatRows ?? []) as CategoryChipRow[];
      return { cat, parent, products, allCats };
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        // Real error → route error boundary, not a soft-404 "category not found".
        throw err;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return { cat: null, parent: null, products: [], allCats: [] as CategoryChipRow[] };
}

export const Route = createFileRoute("/category/$slug")({
  validateSearch: (s: Record<string, unknown>): { sort?: string; instock?: boolean; price?: string } => ({
    sort: typeof s.sort === "string" ? s.sort : undefined,
    instock: s.instock === true || s.instock === "true" ? true : undefined,
    // Client-side price-range facet (see PRICE_BUCKETS). An unknown value narrows
    // to no filter in the component, so a hand-edited ?price= never throws.
    price: typeof s.price === "string" ? s.price : undefined,
  }),
  loader: async ({ params }) => {
    const result = await fetchCategoryWithRetry(params.slug);
    if (!result.cat) throw notFound(); // real HTTP 404 for non-existent categories
    return result;
  },
  head: ({ loaderData, params }) => {
    const url = `https://orzadik.com/category/${params.slug}`;
    const cat = loaderData?.cat as any;
    if (!cat) return { meta: [{ title: "קטגוריה | אור זרוע לצדיק" }], links: [{ rel: "canonical", href: url }] };
    const products = (loaderData?.products ?? []) as any[];
    const parentForDesc = (loaderData?.parent ?? null) as { slug: string; name: string } | null;

    const rawDesc = (cat.description || cat.long_description || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // Owner-written copy always wins. The fallback below is only for categories
    // whose `description` is still empty — it is built from facts this page
    // already knows (how many products it actually lists, and where it sits in
    // the tree) so the 105 category pages don't all ship one byte-identical
    // meta description. Deliberately states no stock / delivery / return
    // promise: those live on the product and terms pages.
    const count = products.length;
    const lead =
      count > 0
        ? `${count} ${count === 1 ? "מוצר" : "מוצרים"} בקטגוריית ${cat.name} באתר "אור זרוע לצדיק"`
        : `קטגוריית ${cat.name} באתר "אור זרוע לצדיק"`;
    const placement = parentForDesc ? `, תת-קטגוריה של ${parentForDesc.name}` : "";
    const tail =
      count > 0
        ? "תמונות, מחירים ופרטים מלאים לכל פריט."
        : "רשימת המוצרים בקטגוריה מוצגת בעמוד זה.";
    const full = rawDesc || `${lead}${placement}. ${tail}`;
    // Trim on a word boundary — a mid-word cut is visible in the SERP snippet.
    const desc =
      full.length <= 160
        ? full
        : `${full.slice(0, 160).replace(/\s+\S*$/, "").trim() || full.slice(0, 160).trim()}…`;

    // Cap the inline ItemList to roughly the first rendered window (2 × the
    // grid's 24-item page). numberOfItems stays the TRUE category total — it may
    // exceed the listed items, which is honest — but we no longer inline a JSON
    // node for every one of up to ~742 products. That trimmed tens-to-~100KB of
    // markup off the heaviest organic landing pages, for items no crawler sees
    // above the fold anyway.
    const LD_ITEM_LIMIT = 48;
    const ldProducts = products.slice(0, LD_ITEM_LIMIT);
    const collectionLd: any = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: `${cat.name} | אור זרוע לצדיק`,
      description: desc,
      inLanguage: "he-IL",
      isPartOf: { "@id": "https://orzadik.com/#website" },
      ...(cat.image_url ? { image: cat.image_url } : {}),
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: ldProducts.map((p: any, i: number) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://orzadik.com/product/${p.slug}`,
          name: p.name,
          ...(p.thumbnail_url ? { image: p.thumbnail_url } : {}),
        })),
      },
    };
    // Surface the parent-category level on subcategory pages so the trail is
    // בית / מוצרים / parent / cat — positions stay consecutive either way.
    const parent = (loaderData?.parent ?? null) as { slug: string; name: string } | null;
    const crumbs = [
      { name: "בית", item: "https://orzadik.com/" },
      { name: "מוצרים", item: "https://orzadik.com/shop" },
      ...(parent ? [{ name: parent.name, item: `https://orzadik.com/category/${parent.slug}` }] : []),
      { name: cat.name, item: url },
    ];
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })),
    };

    // LCP preload. On categories that have a hero banner it is the page's
    // largest paint, so start it downloading from the initial HTML. The hero
    // <img> renders the raw image_url with no srcSet, so a plain href preload
    // matches exactly what it fetches — nothing to mirror via imagesrcset, and
    // no double-download. Guarded: categories with no hero emit no preload, and
    // the grid thumbnails drop their high fetchpriority so this hero wins.
    const heroPreload = cat.image_url
      ? [{ rel: "preload", as: "image", href: cat.image_url, fetchpriority: "high" }]
      : [];

    return {
      meta: [
        { title: `${cat.name} | אור זרוע לצדיק` },
        { name: "description", content: desc },
        { property: "og:title", content: `${cat.name} | אור זרוע לצדיק` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: cat.image_url || "https://orzadik.com/og-default.jpg" },
        { property: "og:image:alt", content: cat.name },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${cat.name} | אור זרוע לצדיק` },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: cat.image_url || "https://orzadik.com/og-default.jpg" },
      ],
      links: [{ rel: "canonical", href: url }, ...heroPreload],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(collectionLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
        { type: "application/ld+json", children: JSON.stringify(faqJsonLd(categoryFaq(cat.name))) },
      ],
    };
  },
  component: CategoryPage,
});

type SortMode = "recommended" | "price-asc" | "price-desc" | "newest" | "oldest" | "name";

function isSortMode(v: unknown): v is SortMode {
  return v === "recommended" || v === "price-asc" || v === "price-desc" || v === "newest"
    || v === "oldest" || v === "name";
}

// Static price-range buckets for the client-side facet. Bounds are the price the
// customer actually pays — getEffectivePrice(price) — so the labels match the
// numbers shown on every card. Ranges are contiguous and non-overlapping:
// עד ₪100 (≤100), ₪100–300 (100<x≤300), ₪300+ (>300). Pure filtering — the
// buckets carry no sale/discount language, only the paid price.
type PriceBucketId = "0-100" | "100-300" | "300-plus";

const PRICE_BUCKETS: { id: PriceBucketId; label: string; test: (eff: number) => boolean }[] = [
  { id: "0-100", label: "עד ₪100", test: (eff) => eff <= 100 },
  { id: "100-300", label: "₪100–300", test: (eff) => eff > 100 && eff <= 300 },
  { id: "300-plus", label: "₪300+", test: (eff) => eff > 300 },
];

function isPriceBucketId(v: unknown): v is PriceBucketId {
  return v === "0-100" || v === "100-300" || v === "300-plus";
}

type Row = ProductCardData & { is_active: boolean; stock_status: string; created_at: string };

function CategoryPage() {
  const { slug } = Route.useParams();
  const { cat: initialCat, products: initialProducts, parent, allCats } = Route.useLoaderData();
  const { sort: sortFromUrl, instock: instockFromUrl, price: priceFromUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Seed from the URL so sorted/filtered views survive reload and sharing.
  const [sort, setSort] = useState<SortMode>(isSortMode(sortFromUrl) ? sortFromUrl : "recommended");
  const [inStockOnly, setInStockOnly] = useState(instockFromUrl ?? false);
  const [priceBucket, setPriceBucket] = useState<PriceBucketId | null>(
    isPriceBucketId(priceFromUrl) ? priceFromUrl : null,
  );

  const changeSort = (v: SortMode) => {
    setSort(v);
    navigate({
      search: (prev) => ({ ...prev, sort: v === "recommended" ? undefined : v }),
      replace: true,
      resetScroll: false,
    });
  };

  const changeInStockOnly = (v: boolean) => {
    setInStockOnly(v);
    navigate({
      search: (prev) => ({ ...prev, instock: v ? true : undefined }),
      replace: true,
      resetScroll: false,
    });
  };

  // Single-select facet: tapping the active bucket clears it (null → no ?price=).
  const changePriceBucket = (v: PriceBucketId | null) => {
    setPriceBucket(v);
    navigate({
      search: (prev) => ({ ...prev, price: v ?? undefined }),
      replace: true,
      resetScroll: false,
    });
  };

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
    // Seed from the SSR loader so the H1, description and banner render on the
    // server (real HTML for crawlers) instead of an empty shell.
    initialData: initialCat ?? undefined,
  });

  const heroImage = cat?.image_url;

  const { data: products = [] } = useQuery({
    queryKey: ["cat-products", cat?.id],
    enabled: !!cat?.id,
    // Page like the loader (shared fetchCategoryProducts) so this stays correct
    // past PostgREST's 1000-row cap instead of silently dropping products from
    // the biggest categories the way an unbounded single select would.
    queryFn: async () => (await fetchCategoryProducts(cat!.id)) as Row[],
    // Seed the product grid from the loader so it renders server-side too.
    initialData: (initialProducts as Row[] | undefined)?.length ? (initialProducts as Row[]) : undefined,
  });

  const visible = useMemo(() => {
    // Collapse same-name models into one tile. The supplier reuses one generic
    // name across many distinct SKUs (43 × 'נטלה מהודרת מפולימר 14 ס"מ'), so a
    // category renders dozens of identical-looking cards. Every row is a real
    // product with its own SKU and photo, so nothing is dropped from the
    // catalogue — the group is represented by one card carrying model_count,
    // and the product page lists the rest. Done here rather than in SQL because
    // this page already loads the whole category and sorts it client-side.
    //
    // Key mirrors norm_he(): lowercase, fold the quote family, collapse spaces.
    const groupKey = (name: string) =>
      name
        .toLowerCase()
        .replace(/[׳״'"`‘’“”]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const groups = new Map<string, Row[]>();
    for (const p of products) {
      const k = groupKey(p.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    // Representative: prefer one that HAS a photo (so a collapsed group never
    // shows the placeholder while its siblings have images), then in stock,
    // then cheapest.
    const collapsed: Row[] = [...groups.values()].map((g) => {
      const rep = [...g].sort(
        (a, b) =>
          Number(!!b.thumbnail_url) - Number(!!a.thumbnail_url) ||
          Number(b.stock_status !== "outofstock") - Number(a.stock_status !== "outofstock") ||
          a.price - b.price,
      )[0];
      return g.length > 1 ? ({ ...rep, model_count: g.length } as Row) : rep;
    });

    let list = collapsed;
    if (inStockOnly) list = list.filter((p) => p.stock_status !== "outofstock");
    // Price-range facet — filter on the effective (paid) price so the buckets
    // agree with the numbers on the cards. Applied to the collapsed
    // representatives, so a group is kept/dropped by the price of the card that
    // actually shows (the cheapest imaged/in-stock model chosen above).
    if (priceBucket) {
      const bucket = PRICE_BUCKETS.find((b) => b.id === priceBucket);
      if (bucket) list = list.filter((p) => bucket.test(getEffectivePrice(p.price)));
    }
    switch (sort) {
      case "price-asc":
        // "Call for price" items (price<=0) carry no number, so sink them to the
        // end — otherwise their 0 would lead the cheapest-first list.
        list.sort((a, b) => {
          const aCall = a.price <= 0, bCall = b.price <= 0;
          if (aCall !== bCall) return aCall ? 1 : -1;
          return a.price - b.price;
        });
        break;
      case "price-desc":
        // Same: keep call-only items at the end rather than mixed into the run.
        list.sort((a, b) => {
          const aCall = a.price <= 0, bCall = b.price <= 0;
          if (aCall !== bCall) return aCall ? 1 : -1;
          return b.price - a.price;
        });
        break;
      case "newest":
        list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "oldest":
        list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name, "he"));
        break;
      default:
        // recommended: more expensive items first; within same price, older items first (newer items go to the back)
        list.sort((a, b) => (b.price - a.price) || (+new Date(a.created_at) - +new Date(b.created_at)));
        break;
    }
    // Whatever the sort mode, out-of-stock items always sink to the end
    // (stable partition — in-stock order is untouched).
    const inStock = list.filter((p) => p.stock_status !== "outofstock");
    const oos = list.filter((p) => p.stock_status === "outofstock");
    return [...inStock, ...oos];
  }, [products, sort, inStockOnly, priceBucket]);

  // Client-side windowing. This page loads its whole category into memory (the
  // largest is 742 rows) and sorts/filters it there, but mounting every card at
  // once is wasteful; slice the fully sorted+filtered list to a growing window
  // and reveal +24 per click, mirroring /shop's "load more".
  const PAGE_SIZE = 24;
  const [shown, setShown] = useState(PAGE_SIZE);
  // A new sort / stock filter / category is a fresh "page 1" — reset the window
  // so the user starts from the top of the reordered list, matching /shop
  // dropping ?page= on re-sort.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [sort, inStockOnly, priceBucket, slug]);
  const windowed = visible.slice(0, shown);
  const remaining = visible.length - windowed.length;

  return (
    <div className="pb-12">
      {/* Location trail — the shared, RTL-correct primitive. The route still
          emits its own BreadcrumbList JSON-LD from head(), so this visible trail
          carries no microdata; the old hand-rolled <ol> duplicated that graph. */}
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb
          items={[
            { label: "בית", to: "/" },
            { label: "מוצרים", to: "/shop" },
            ...(parent ? [{ label: parent.name, to: "/category/$slug", params: { slug: parent.slug } }] : []),
            { label: cat?.name ?? slug },
          ]}
        />
      </div>

      {/* Hero banner */}
      <header className="relative w-full overflow-hidden border-b bg-muted/40">
        {heroImage ? (
          <>
            <div className="relative w-full aspect-[16/7] md:aspect-[21/8]">
              <img
                src={heroImage}
                alt={cat?.name ? `תמונת קטגוריה עבור ${cat.name}` : "תמונת קטגוריה"}
                // Above-the-fold hero — the category page's LCP element, so it
                // is fetched eagerly on purpose. loading="lazy" here would
                // contradict fetchPriority="high" and delay LCP; the explicit
                // intrinsic size reserves the box and keeps CLS at zero.
                fetchPriority="high"
                loading="eager"
                decoding="async"
                sizes="100vw"
                className="absolute inset-0 h-full w-full object-cover"
                width={1600}
                height={700}
              />
              {/* Light scrim, not the old wine band: it only softens the bottom
                  edge of the photo into the white ground. It carries no text, so
                  it has no contrast duty of its own. */}
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/85 via-background/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-5 md:pb-8">
                {/* The H1 sits in a .glass-strong caption panel — 94% white, the
                    only glass that is contrast-safe over unknown imagery (worst
                    case backing #F0F0F0). That is what lets the title be plain
                    --foreground ink at ~15.9:1 and retires the textShadow hack,
                    which was propping up light-on-photo text that could never be
                    measured. */}
                <div className="glass-strong mx-auto max-w-2xl px-6 py-4 md:px-10 md:py-6 text-center [--glass-radius:1.25rem]">
                  <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-wide">
                    {cat?.name ?? slug}
                  </h1>
                  <div aria-hidden="true" className="gold-rule mx-auto mt-3 w-24" />
                </div>
              </div>
            </div>
            {cat?.description && (
              <div className="container mx-auto px-4 py-6 text-center">
                <p className="max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
                  {cat.description}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="container relative mx-auto px-4 py-12 md:py-16 text-center">
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">
              {cat?.name ?? slug}
            </h1>
            <div aria-hidden="true" className="gold-rule mx-auto mt-3 w-24" />
            {cat?.description && (
              <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
                {cat.description}
              </p>
            )}
          </div>
        )}
      </header>

      <div className="container mx-auto px-4 pt-8">
        {/* When the category itself is personalizable (its slug is in the shared
            PERSONALIZABLE_CATEGORY_SLUGS source of truth), a single tasteful line
            surfaces the store's real differentiator and links to the dedicated
            story page. One row, above the chips — it never touches the grid. */}
        {isPersonalizable([slug]) && (
          <div className="mb-6 flex justify-center">
            <Link
              to="/collection/personalized"
              className="press inline-flex items-center gap-2 rounded-full bg-card/70 px-4 py-2 text-sm text-accent hairline transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
            >
              <span aria-hidden="true">✦</span>
              פריטי הקטגוריה ניתנים להוספת רקמה/חריטה אישית
            </Link>
          </div>
        )}

        {/* Subcategory / sibling chips — restyled from here (gold hairline,
            argaman active) via scoped descendant overrides: SubcategoryChips is a
            shared component other pages use, so its own classes stay untouched.
            The active chip is targeted through the aria-current="page" attribute
            the router puts on the link for the current category.

            Kept in step with the chip base in SubcategoryChips.tsx: the base now
            draws its hairline as an INSET RING rather than a border, so the
            override swaps the ring colour (decorative gold, never text) instead
            of a border colour. The argaman fill is the one legitimate small
            semantic burgundy left in the system — 12.57:1 with white text. */}
        <div className="[&_a]:shadow-[inset_0_0_0_1px_var(--glass-line-gold)] [&_a]:bg-card/70 [&_a]:text-foreground [&_a[aria-current=page]]:bg-argaman [&_a[aria-current=page]]:text-white [&_a[aria-current=page]]:shadow-none">
          <SubcategoryChips
            slug={slug}
            parentSlug={cat?.parent_slug ?? null}
            initialCats={allCats as CategoryChipRow[] | undefined}
          />
        </div>

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
              אנו עובדים בימים אלו על העלאת המוצרים בקטגוריית <span className="font-semibold text-foreground">{cat?.name ?? ""}</span>.
              <br />
              חזרו בקרוב לגלות מבחר חדש ומרגש 💫
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar — one glass pane, matching /shop */}
            <div className="glass flex flex-wrap items-center justify-between gap-4 mb-6 p-4 md:px-5 [--glass-radius:1.25rem]">
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{visible.length} מוצרים</p>
              <div className="flex flex-wrap items-center gap-4">
                {/* Price-range facet — single-select chips over the effective
                    (paid) price. Pure filtering; no sale/discount language. The
                    active chip takes the gold --accent fill (CTA colour); the
                    rest are the same white-glass chips used elsewhere on the
                    page. "הכל" clears the facet. */}
                <div className="flex items-center gap-2" role="group" aria-label="סינון לפי טווח מחיר">
                  <span className="text-sm text-muted-foreground">מחיר:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => changePriceBucket(null)}
                      aria-pressed={priceBucket === null}
                      className={cn(
                        "press rounded-full px-3 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out",
                        priceBucket === null
                          ? "bg-accent text-white"
                          : "bg-card/70 text-foreground hairline [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary",
                      )}
                    >
                      הכל
                    </button>
                    {PRICE_BUCKETS.map((b) => {
                      const active = priceBucket === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          // Tap the active chip again to clear it back to "הכל".
                          onClick={() => changePriceBucket(active ? null : b.id)}
                          aria-pressed={active}
                          className={cn(
                            "press rounded-full px-3 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out",
                            active
                              ? "bg-accent text-white"
                              : "bg-card/70 text-foreground hairline [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary",
                          )}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={inStockOnly}
                    onCheckedChange={(v) => changeInStockOnly(!!v)}
                    className="data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-accent-foreground"
                  />
                  במלאי בלבד
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">מיון:</span>
                  <Select value={sort} onValueChange={(v) => changeSort(v as SortMode)}>
                    <SelectTrigger className="w-[200px] h-10 rounded-lg border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommended">מומלצים</SelectItem>
                      <SelectItem value="price-asc">מחיר: מהנמוך לגבוה</SelectItem>
                      <SelectItem value="price-desc">מחיר: מהגבוה לנמוך</SelectItem>
                      <SelectItem value="newest">תאריך: מהחדש לישן</SelectItem>
                      <SelectItem value="oldest">תאריך: מהישן לחדש</SelectItem>
                      <SelectItem value="name">א-ב</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Grid — sliced to the current window (see `shown` above). The first
                row still loads eager, but high fetchPriority goes to a thumbnail
                ONLY when there is no hero banner: with a hero, that image is the
                LCP paint and is preloaded in head(), so no thumbnail may compete
                for high priority or it would delay the hero. */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {windowed.map((p, i) => <ProductCard key={p.id} p={p} eager={i < 4} highPriority={!heroImage && i < 2} />)}
            </div>
            {visible.length === 0 && (
              // Same designed glass empty state as /shop (gold-free), so the two
              // discovery pages read consistently. When the in-stock filter is
              // what emptied the grid, offer a one-tap way back to the full list.
              <div className="glass max-w-2xl mx-auto my-12 text-center p-10 md:p-14 [--glass-radius:1.5rem]">
                <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-secondary hairline flex items-center justify-center">
                  <span className="text-3xl">🔍</span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">לא נמצאו מוצרים</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {inStockOnly || priceBucket
                    ? "אין כרגע מוצרים שתואמים את הסינון בקטגוריה הזו."
                    : "אין כרגע מוצרים בקטגוריה הזו."}
                </p>
                {(inStockOnly || priceBucket) && (
                  <button
                    onClick={() => {
                      setInStockOnly(false);
                      setPriceBucket(null);
                      navigate({
                        search: (prev) => ({ ...prev, instock: undefined, price: undefined }),
                        replace: true,
                        resetScroll: false,
                      });
                    }}
                    className="press mt-6 rounded-full bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
                  >
                    הצג את כל המוצרים
                  </button>
                )}
              </div>
            )}
            {/* Load more — same ink-on-white chip and label as /shop. No async
                state: the whole list is already in memory, so revealing more is
                instant. */}
            {remaining > 0 && (
              <div className="mt-10 text-center">
                <button
                  onClick={() => setShown((c) => c + PAGE_SIZE)}
                  className="press rounded-full bg-card/70 px-8 py-3 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
                >
                  טען עוד מוצרים ({remaining})
                </button>
              </div>
            )}
          </>
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


        {/* SEO long description */}
        {cat?.long_description && (
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
            still collapsing visually, with no JS and no hydration cost. */}
        {cat?.name && (
          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-5 text-center">שאלות נפוצות — {cat.name}</h2>
            {/* Native <details>/<summary> stays — the FAQPage JSON-LD in the route
                head claims this text, so every answer must be in the server HTML.
                Hairline rules replace the gold borders; the chevron keeps
                --accent (5.47:1 on the ground, and an icon only needs 3:1). */}
            <div className="w-full border-t border-glass-line">
              {categoryFaq(cat.name).map((item, i) => (
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
    </div>
  );
}
