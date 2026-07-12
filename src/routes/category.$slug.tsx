import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { categoryFaq, faqJsonLd } from "@/lib/category-faq";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

async function fetchCategoryWithRetry(slug: string, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data: cat, error: catErr } = await supabase
        .from("categories")
        .select("id, name, description, long_description, image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (catErr) throw catErr;
      if (!cat) return { cat: null, products: [] };
      const { data: rows, error: rowErr } = await supabase
        .from("product_categories")
        .select("products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status, created_at)")
        .eq("category_id", cat.id);
      if (rowErr) throw rowErr;
      const products = (rows ?? []).map((r: any) => r.products).filter((p: any) => p?.is_active);
      return { cat, products };
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        // Real error → route error boundary, not a soft-404 "category not found".
        throw err;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return { cat: null, products: [] };
}

export const Route = createFileRoute("/category/$slug")({
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

    const rawDesc = (cat.description || cat.long_description || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const desc = (
      rawDesc ||
      `מבחר ${cat.name} מהודרים בכשרות מובחרת — איכות פרימיום, אפשרות רקמה אישית ומשלוח עד הבית.`
    ).slice(0, 160);

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
        itemListElement: products.map((p: any, i: number) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://orzadik.com/product/${p.slug}`,
          name: p.name,
          ...(p.thumbnail_url ? { image: p.thumbnail_url } : {}),
        })),
      },
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "בית", item: "https://orzadik.com/" },
        { "@type": "ListItem", position: 2, name: "מוצרים", item: "https://orzadik.com/shop" },
        { "@type": "ListItem", position: 3, name: cat.name, item: url },
      ],
    };

    return {
      meta: [
        { title: `${cat.name} | אור זרוע לצדיק` },
        { name: "description", content: desc },
        { property: "og:title", content: `${cat.name} | אור זרוע לצדיק` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: cat.image_url || "https://orzadik.com/og-default.jpg" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${cat.name} | אור זרוע לצדיק` },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: cat.image_url || "https://orzadik.com/og-default.jpg" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(collectionLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
        { type: "application/ld+json", children: JSON.stringify(faqJsonLd(categoryFaq(cat.name))) },
      ],
    };
  },
  component: CategoryPage,
});

type SortMode = "recommended" | "price-asc" | "price-desc" | "newest" | "oldest";

type Row = ProductCardData & { is_active: boolean; stock_status: string; created_at: string };

function CategoryPage() {
  const { slug } = Route.useParams();
  const { cat: initialCat, products: initialProducts } = Route.useLoaderData();
  const [sort, setSort] = useState<SortMode>("recommended");
  const [inStockOnly, setInStockOnly] = useState(false);

  const { data: cat } = useQuery({
    queryKey: ["cat", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, description, long_description, image_url")
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select(
          "products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status, created_at)",
        )
        .eq("category_id", cat!.id);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.products)
        .filter((p: any) => p?.is_active) as Row[];
    },
    // Seed the product grid from the loader so it renders server-side too.
    initialData: (initialProducts as Row[] | undefined)?.length ? (initialProducts as Row[]) : undefined,
  });

  const visible = useMemo(() => {
    let list = [...products];
    if (inStockOnly) list = list.filter((p) => p.stock_status !== "outofstock");
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "oldest":
        list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        break;
      default:
        // recommended: more expensive items first; within same price, older items first (newer items go to the back)
        list.sort((a, b) => (b.price - a.price) || (+new Date(a.created_at) - +new Date(b.created_at)));
        break;
    }
    return list;
  }, [products, sort, inStockOnly]);

  return (
    <div className="pb-12">
      {/* Visible breadcrumb nav */}
      <nav aria-label="ניווט ארוחות לחם" className="container mx-auto px-4 py-3">
        <ol className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <Link to="/" className="hover:text-accent transition-colors" itemProp="item">
              <span itemProp="name">בית</span>
            </Link>
            <meta itemProp="position" content="1" />
          </li>
          <li aria-hidden="true" className="text-muted-foreground/40">/</li>
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <Link to="/shop" className="hover:text-accent transition-colors" itemProp="item">
              <span itemProp="name">מוצרים</span>
            </Link>
            <meta itemProp="position" content="2" />
          </li>
          {cat?.name && (
            <>
              <li aria-hidden="true" className="text-muted-foreground/40">/</li>
              <li
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
                className="text-foreground font-medium truncate max-w-[200px]"
                aria-current="page"
              >
                <span itemProp="name">{cat.name}</span>
                <meta itemProp="position" content="3" />
              </li>
            </>
          )}
        </ol>
      </nav>

      {/* Hero banner */}
      <header className="relative w-full overflow-hidden border-b bg-muted/40">
        {heroImage ? (
          <>
            <div className="relative w-full aspect-[16/7] md:aspect-[21/8]">
              <img
                src={heroImage}
                alt={cat?.name ? `תמונת קטגוריה עבור ${cat.name}` : "תמונת קטגוריה"}
                className="absolute inset-0 h-full w-full object-cover"
                width={1600}
                height={700}
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-6 md:pb-10 text-center">
                <h1
                  className="font-display text-3xl md:text-6xl font-bold text-white tracking-wide"
                  style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)" }}
                >
                  {cat?.name ?? slug}
                </h1>
                <div className="mx-auto mt-3 h-0.5 w-20 bg-primary" />
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
            <div className="mx-auto mt-3 h-0.5 w-16 bg-primary" />
            {cat?.description && (
              <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
                {cat.description}
              </p>
            )}
          </div>
        )}
      </header>

      <div className="container mx-auto px-4 pt-8">
        {(slug === "study-books" || slug === "esh-sheli-gold") && products.length === 0 ? (
          <div className="max-w-2xl mx-auto my-12 text-center bg-gradient-to-b from-primary/5 to-transparent border border-primary/20 rounded-2xl p-10 md:p-14">
            <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
              המוצרים בקטגוריה זו בדרך אליכם
            </h2>
            <div className="mx-auto mb-5 h-0.5 w-16 bg-primary" />
            <p className="text-muted-foreground leading-relaxed">
              אנו עובדים בימים אלו על העלאת המוצרים בקטגוריית <span className="font-semibold text-foreground">{cat?.name ?? ""}</span>.
              <br />
              חזרו בקרוב לגלות מבחר חדש ומרגש 💫
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b">
              <p className="text-sm text-muted-foreground">{visible.length} מוצרים</p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(!!v)} />
                  במלאי בלבד
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">מיון:</span>
                  <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommended">מומלצים</SelectItem>
                      <SelectItem value="price-asc">מחיר: מהנמוך לגבוה</SelectItem>
                      <SelectItem value="price-desc">מחיר: מהגבוה לנמוך</SelectItem>
                      <SelectItem value="newest">תאריך: מהחדש לישן</SelectItem>
                      <SelectItem value="oldest">תאריך: מהישן לחדש</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visible.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 8} />)}
            </div>
            {visible.length === 0 && (
              <p className="text-center py-10 text-muted-foreground">לא נמצאו מוצרים תואמים.</p>
            )}
          </>
        )}


        {/* SEO long description */}
        {cat?.long_description && (
          <section className="mt-16 max-w-3xl mx-auto text-center">
            <h2 className="font-display text-2xl font-bold mb-3">קצת על {cat.name}</h2>
            <div className="mx-auto mb-5 h-0.5 w-12 bg-primary" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
              {cat.long_description}
            </p>
          </section>
        )}

        {/* FAQ — feeds AEO (voice / "People also ask" / AI answers). Mirrors the
            FAQPage JSON-LD emitted in the route head. */}
        {cat?.name && (
          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-5 text-center">שאלות נפוצות — {cat.name}</h2>
            <Accordion type="single" collapsible className="w-full">
              {categoryFaq(cat.name).map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-right font-medium">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}
      </div>
    </div>
  );
}
