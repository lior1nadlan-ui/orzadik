import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { formatILS, useCart, getEffectivePrice, getDisplayOriginal, getDiscountPct, FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT, type CustomMethod } from "@/lib/cart";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { BundleOffer } from "@/components/BundleOffer";
import { ProductReviews } from "@/components/ProductReviews";
import { Stars } from "@/components/Stars";
import { ClubBadge } from "@/components/ClubBadge";
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";
import { ShoppingCart, Minus, Plus, Check, Truck, RotateCcw, ZoomIn } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";

async function fetchProductWithRetry(slug: string, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, short_description, price, sale_price, sku, stock_status, thumbnail_url, product_images(url, sort_order), product_categories(categories(id, slug, name))",
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        return null;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return null;
}

async function fetchReviewSummary(productId: string): Promise<{ average: number; count: number }> {
  try {
    const { data } = await supabase
      .from("reviews")
      .select("rating")
      .eq("product_id", productId)
      .eq("is_approved", true);
    const rows = (data ?? []) as { rating: number }[];
    const count = rows.length;
    const average = count > 0 ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { average, count };
  } catch {
    return { average: 0, count: 0 };
  }
}

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const product = await fetchProductWithRetry(params.slug);
    const reviewSummary = product?.id
      ? await fetchReviewSummary(product.id as string)
      : { average: 0, count: 0 };
    return { product, reviewSummary };
  },
  head: ({ loaderData, params }) => {
    const url = `https://orzadik.com/product/${params.slug}`;
    const p = loaderData?.product as any;
    const reviewSummary = (loaderData as any)?.reviewSummary as { average: number; count: number } | undefined;
    if (!p) return { meta: [{ title: "מוצר | אור זרוע לצדיק" }], links: [{ rel: "canonical", href: url }] };

    const images: string[] = [
      ...(p.thumbnail_url ? [p.thumbnail_url] : []),
      ...((p.product_images ?? [])
        .slice()
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i: any) => i.url)
        .filter(Boolean)),
    ];
    const cats = (p.product_categories ?? []).map((pc: any) => pc?.categories).filter(Boolean);
    const firstCat = cats[0];
    const isCallOnly = cats.some((c: any) => c.slug === "esh-sheli-gold");
    const plainDesc = (p.short_description || p.description || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const productLd: any = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      image: images,
      description: plainDesc || p.name,
      sku: p.sku || undefined,
      mpn: p.sku || undefined,
      brand: { "@type": "Brand", name: "אור זרוע לצדיק" },
      category: firstCat?.name,
      url,
    };
    if (!isCallOnly) {
      // priceValidUntil is recommended by Google for Offer rich results;
      // omitting it can suppress the price in search. Set ~1 year out.
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      productLd.offers = {
        "@type": "Offer",
        url,
        priceCurrency: "ILS",
        price: String(getEffectivePrice(Number(p.price))),
        priceValidUntil: validUntil.toISOString().slice(0, 10),
        availability:
          p.stock_status === "outofstock"
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@id": "https://orzadik.com/#organization" },
        // Merchant return + shipping details — required for Google's free
        // Shopping listings / merchant rich results. Mirrors the real policy
        // (14-day returns, flat ₪37 shipping, 3–7 business-day delivery in IL).
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "IL",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 14,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/ReturnFeesCustomerResponsibleForReturnShipping",
        },
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: {
            "@type": "MonetaryAmount",
            value: String(SHIPPING_FLAT),
            currency: "ILS",
          },
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "IL",
          },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 2, unitCode: "DAY" },
            transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" },
          },
        },
      };
    }
    // AggregateRating drives star ratings in Google results. Only emit it when
    // there are real approved reviews — never fabricate ratings.
    if (reviewSummary && reviewSummary.count > 0) {
      productLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: String(reviewSummary.average),
        reviewCount: String(reviewSummary.count),
        bestRating: "5",
        worstRating: "1",
      };
    }

    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "בית", item: "https://orzadik.com/" },
        { "@type": "ListItem", position: 2, name: "מוצרים", item: "https://orzadik.com/shop" },
        ...(firstCat
          ? [{ "@type": "ListItem", position: 3, name: firstCat.name, item: `https://orzadik.com/category/${firstCat.slug}` }]
          : []),
        { "@type": "ListItem", position: firstCat ? 4 : 3, name: p.name, item: url },
      ],
    };

    const desc = ((plainDesc ? plainDesc + " — " : "") + "כשרות מהודרת, אפשרות רקמה אישית ומשלוח עד הבית.").slice(0, 200);
    return {
      meta: [
        { title: `${p.name} | אור זרוע לצדיק` },
        { name: "description", content: desc.slice(0, 160) },
        { property: "og:title", content: `${p.name} | אור זרוע לצדיק` },
        { name: "twitter:title", content: `${p.name} | אור זרוע לצדיק` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(images[0] ? [{ property: "og:image", content: images[0] }] : []),
        ...(images[0] ? [{ name: "twitter:image", content: images[0] }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        // Google requires a Product to carry at least one of offers/review/
        // aggregateRating. Call-only (gold) products have no offers, so only
        // emit the Product node when it also has an aggregateRating; otherwise
        // it would be flagged invalid in Search Console.
        ...(!isCallOnly || (reviewSummary && reviewSummary.count > 0)
          ? [{ type: "application/ld+json", children: JSON.stringify(productLd) }]
          : []),
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
  component: ProductPage,
});

// Slugs of categories where we offer personalization (embroidery / laser engraving).
// Mirrors rikmat.com's personalized lineup.
const PERSONALIZATION_CATEGORY_SLUGS = new Set<string>([
  "talit-tefillin-covers",        // כיסויים לטלית ותפילין
  "talit-tefillin-sets",          // סטים לטלית ותפילין
  "tefillin-cases",               // תיקי תפילין
  "pvc-bags",                     // תיקי PVC
  "chalaka-set",                  // סט חלאקה
  "atara",                        // עטרה
  "challah-covers",               // כיסויי חלה
  "bencher-stands",               // מעמדי בנצ'ר (חריטת לייזר)
  "wedding",                      // חתונה
  "%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d",                                                                       // סידורים
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94",   // מארזים לחתנים ובר מצווה
  "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f",                                       // סט טלית תפילין (התיק)
]);

// Categories where personalization is offered as embroidery only
// (no laser engraving option shown).
const EMBROIDERY_ONLY_CATEGORY_SLUGS = new Set<string>([
  "talit-tefillin-covers",
  "talit-tefillin-sets",
  "tefillin-cases",
  "pvc-bags",
  "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f",
]);

// Categories where the "embroidery" option is presented as "הטבעה" (print/stamp)
// instead of actual embroidery. Used for siddurim / tehillim where we offer
// laser engraving or printing — not embroidery.
const PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS = new Set<string>([
  "%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d", // סידורים (כולל תהילים)
]);


// Specific product slugs where personalization is disabled even if their
// category normally supports it.
const NO_PERSONALIZATION_PRODUCT_SLUGS = new Set<string>([
  "בד-דמוי-עור-pu-טלית-2336-סמ-עם-ידית-שחור-עם-או",
  "artj-uk44978",
  "artj-uk67109",
  "artj-uk67722",
  "artj-uk67721",
  "artj-uk53706",
]);

function ProductPage() {
  const { slug } = Route.useParams();
  const { product: initialProduct, reviewSummary } = Route.useLoaderData();
  const navigate = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [customMethod, setCustomMethod] = useState<CustomMethod>("embroidery");

  // The router reuses this component instance across /product/$slug navigations,
  // so per-product UI state would otherwise bleed from one product to the next
  // (e.g. product B showing product A's selected image / quantity / custom text).
  useEffect(() => {
    setActiveImg(null);
    setQty(1);
    setCustomText("");
  }, [slug]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, short_description, price, sale_price, sku, stock_status, thumbnail_url, product_images(url, sort_order), product_categories(categories(id, slug, name))",
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Seed from the SSR loader so the first render (server + hydration) already
    // has the product — real HTML for crawlers, no "טוען...", and no duplicate
    // fetch on load. React Query still refetches per its staleness rules.
    initialData: initialProduct ?? undefined,
  });

  // Size variants — supports two styles:
  //  (a) in-place variants: row in product_variants with `price` set and no SKU → render as
  //      size selector that overrides the displayed price on this same page.
  //  (b) sibling-product variants: row with `sku` pointing to another product → renders as
  //      a link to that sibling product (legacy behavior).
  const { data: variants = [] } = useQuery({
    queryKey: ["variants", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data: vs } = await supabase
        .from("product_variants")
        .select("id, label, sku, price, sort_order")
        .eq("product_id", product!.id)
        .order("sort_order");
      if (!vs || vs.length === 0) return [] as Array<{ id: string; label: string; sku: string | null; price: number | null; slug?: string }>;
      const skus = vs.map((v: any) => v.sku).filter(Boolean);
      let siblings: any[] = [];
      if (skus.length > 0) {
        const { data: sib } = await supabase
          .from("products")
          .select("slug, sku, price")
          .in("sku", skus);
        siblings = sib ?? [];
      }
      return vs.map((v: any) => {
        const s = siblings.find((x: any) => x.sku === v.sku);
        return {
          id: v.id as string,
          label: v.label as string,
          sku: (v.sku as string | null) ?? null,
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          slug: s?.slug as string | undefined,
        };
      }).filter((v) => v.price !== null || v.slug);
    },
  });

  // For in-place variants, track the selected one (defaults to the first).
  const inPlaceVariants = variants.filter((v) => v.price !== null && !v.slug);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const selectedVariant = inPlaceVariants.find((v) => v.id === selectedVariantId) ?? inPlaceVariants[0] ?? null;


  const categoryIds: string[] = (product?.product_categories ?? [])
    .map((pc: any) => pc?.categories?.id)
    .filter(Boolean);
  const categorySlugs: string[] = (product?.product_categories ?? [])
    .map((pc: any) => pc?.categories?.slug ?? "")
    .filter(Boolean);
  const showEmbroidery = !NO_PERSONALIZATION_PRODUCT_SLUGS.has(slug) && categorySlugs.some((s) =>
    PERSONALIZATION_CATEGORY_SLUGS.has(s),
  );
  const embroideryOnly = categorySlugs.some((s) => EMBROIDERY_ONLY_CATEGORY_SLUGS.has(s));
  const printInsteadOfEmbroidery = categorySlugs.some((s) => PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS.has(s));
  const embroideryLabel = printInsteadOfEmbroidery ? "הטבעה" : "רקמה";


  const { data: related = [] } = useQuery({
    queryKey: ["related", product?.id, categorySlugs.join(",")],
    enabled: !!product?.id,
    queryFn: async () => {
      // 1) Build cross-sell candidate categories from this product's categories
      const crossSlugs = new Set<string>();
      for (const s of categorySlugs) {
        for (const t of (CROSS_SELL_MAP[s] ?? [])) crossSlugs.add(t);
      }
      // Don't suggest categories the product is already in
      for (const s of categorySlugs) crossSlugs.delete(s);
      const targetSlugs = crossSlugs.size > 0
        ? Array.from(crossSlugs)
        : [DEFAULT_CROSS_SELL_CATEGORY];

      // Resolve target slugs → category IDs
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug")
        .in("slug", targetSlugs);
      const targetIds = (cats ?? []).map((c: any) => c.id);
      if (targetIds.length === 0) return [] as ProductCardData[];

      const { data, error } = await supabase
        .from("product_categories")
        .select("products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active)")
        .in("category_id", targetIds)
        .limit(40);
      if (error) throw error;
      const seen = new Set<string>();
      const out: ProductCardData[] = [];
      // Only suggest companions whose price is meaningful compared to the main
      // product — avoid offering a 30₪ trinket alongside a 1,100₪ talit. The
      // floor scales with the main price so add-ons feel like a real upgrade.
      const mainPrice = Number(product!.price) || 0;
      const minAddonPrice = Math.max(60, Math.round(mainPrice * 0.12));
      for (const r of (data ?? [])) {
        const p: any = (r as any).products;
        if (!p?.is_active || !p.thumbnail_url) continue;
        if (p.id === product!.id) continue;
        if (seen.has(p.id)) continue;
        const pPrice = Number(p.price) || 0;
        if (pPrice < minAddonPrice) continue;
        seen.add(p.id);
        out.push(p);
        if (out.length >= 20) break;
      }
      // Fallback: if the price filter eliminated everything, relax it so the
      // section is not empty for low-priced mains.
      if (out.length === 0) {
        for (const r of (data ?? [])) {
          const p: any = (r as any).products;
          if (!p?.is_active || !p.thumbnail_url) continue;
          if (p.id === product!.id) continue;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          out.push(p);
          if (out.length >= 20) break;
        }
      }
      // Sort highest-value first so the prominent bundle slot shows
      // worthwhile companions, then lightly shuffle the tail for variety.
      out.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
      const head = out.slice(0, 4);
      const tail = out.slice(4).sort(() => Math.random() - 0.5);
      return [...head, ...tail].slice(0, 10);
    },
  });

  if (isLoading) return <div className="container mx-auto px-4 py-20 text-center">טוען...</div>;
  if (!product) return <div className="container mx-auto px-4 py-20 text-center">המוצר לא נמצא</div>;

  const gallery = [
    ...(product.thumbnail_url ? [product.thumbnail_url] : []),
    ...((product.product_images ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((i: any) => i.url)),
  ];
  const mainImg = activeImg || gallery[0];
  // If an in-place size variant is selected, use its price as the base.
  const effectiveBase = selectedVariant ? selectedVariant.price! : Number(product.price);
  const effective = getEffectivePrice(effectiveBase);
  // Honest strike-through: only vs. a genuine recorded former price (sale_price)
  // for the base product; a selected size variant has no recorded former price.
  const baseSalePrice = selectedVariant ? null : (product.sale_price ?? null);
  const original = getDisplayOriginal(effectiveBase, baseSalePrice);
  const discountPct = getDiscountPct(effectiveBase, baseSalePrice);
  const hasDiscount = discountPct > 0;
  const inStock = product.stock_status !== "outofstock";
  const firstCategory: any = (product.product_categories ?? [])[0]?.categories;
  const isCallOnly = (product.product_categories ?? []).some(
    (pc: any) => pc?.categories?.slug === "esh-sheli-gold"
  );

  function addToCart() {
    if (!product) return;
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: effectiveBase,
        salePrice: baseSalePrice,
        thumbnail: product.thumbnail_url,
        customText: customText.trim() || undefined,
        customMethod: customText.trim() ? customMethod : undefined,
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.label,
      },

      qty,
    );
  }


  return (
    <div className="container mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav aria-label="ניווט ארוחות לחם" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs md:text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
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
          {firstCategory && (
            <>
              <li aria-hidden="true" className="text-muted-foreground/40">/</li>
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                <Link
                  to="/category/$slug"
                  params={{ slug: firstCategory.slug }}
                  className="hover:text-accent transition-colors"
                  itemProp="item"
                >
                  <span itemProp="name">{firstCategory.name}</span>
                </Link>
                <meta itemProp="position" content="3" />
              </li>
            </>
          )}
          {product?.name && (
            <>
              <li aria-hidden="true" className="text-muted-foreground/40">/</li>
              <li
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
                className="text-foreground font-medium truncate max-w-[200px]"
                aria-current="page"
              >
                <span itemProp="name">{product.name}</span>
                <meta itemProp="position" content={firstCategory ? "4" : "3"} />
              </li>
            </>
          )}
        </ol>
      </nav>

      {/* Club promo — visible to guests at the top of every product page */}
      <ClubBadge className="mb-6" />

      <div className="grid md:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="group relative aspect-square w-full overflow-hidden rounded-lg border bg-gradient-to-br from-[#FAF6E9] to-white cursor-zoom-in"
                aria-label="הגדל תמונה"
              >
                {mainImg && (
                  <img
                    src={mainImg}
                    alt={product.name}
                    className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                {hasDiscount && (
                  <span className="absolute top-3 right-3 rounded-full bg-[#D4AF37] text-white text-xs font-bold px-3 py-1.5 shadow">
                    {discountPct}%- הנחה
                  </span>
                )}
                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 backdrop-blur p-2 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="h-4 w-4 text-[#A8862A]" />
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-2 bg-white">
              <DialogTitle className="sr-only">{product.name}</DialogTitle>
              {mainImg && (
                <img
                  src={mainImg}
                  alt={product.name}
                  className="h-auto w-full object-contain rounded"
                />
              )}
            </DialogContent>
          </Dialog>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="תמונות נוספות של המוצר">
              {gallery.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImg(url)}
                  aria-label={`הצג תמונה ${idx + 1} מתוך ${gallery.length}`}
                  aria-pressed={mainImg === url}
                  className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded border-2 bg-white ${
                    mainImg === url ? "border-[#D4AF37]" : "border-transparent"
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>
          {reviewSummary && reviewSummary.count > 0 && (
            <a href="#reviews" className="mb-3 inline-flex items-center gap-2 text-sm">
              <Stars value={reviewSummary.average} size={16} />
              <span className="text-muted-foreground hover:text-accent transition-colors">
                {reviewSummary.average} ({reviewSummary.count})
              </span>
            </a>
          )}
          {product.sku && <p className="text-xs text-muted-foreground mb-3">מק״ט: {product.sku}</p>}

          {/* Price block */}
          {isCallOnly ? (
            <div className="mb-3 rounded-lg border border-[#D4AF37]/40 bg-[#FAF6E9] px-4 py-3">
              <div className="text-lg font-bold text-[#A8862A]">המחיר משתנה לפי שער הזהב היומי</div>
              <div className="text-sm text-foreground mt-1">לקבלת הצעת מחיר עדכנית - צרו קשר בטלפון או בוואטסאפ</div>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
              <span className="text-3xl font-bold text-[#A8862A]">{formatILS(effective)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatILS(original)}</span>
                  <span className="rounded-full bg-[#D4AF37]/15 text-[#A8862A] text-xs font-bold px-2.5 py-1">
                    חיסכון {formatILS(original - effective)}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Stock */}
          <div className="mb-5 space-y-2">
            {inStock ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                <Check className="h-4 w-4" /> במלאי — משלוח מהיר
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
                אזל מהמלאי
              </span>
            )}
            <div className="inline-flex items-center gap-1.5 text-sm text-foreground bg-[#FAF6E9] border border-[#D4AF37]/30 rounded-md px-2.5 py-1">
              <Truck className="h-4 w-4 text-[#A8862A]" />
              <span>
                דמי משלוח {formatILS(SHIPPING_FLAT)} (מתווספים בעגלה) • <span className="font-semibold text-[#A8862A]">זמן אספקה 3–14 ימי עסקים</span>
              </span>

            </div>
          </div>


          {product.short_description && (
            <div
              className="prose prose-sm max-w-none mb-5 text-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.short_description) }}
            />
          )}

          {/* Personalization (embroidery / laser engraving) */}
          {showEmbroidery && (
            <div className="mb-5 rounded-lg border border-[#D4AF37]/30 bg-[#FAF6E9] p-4">
              <Label htmlFor="embroidery" className="text-sm font-semibold text-[#A8862A]">
                ✦ הוספת שם אישי על המוצר (אופציונלי)
              </Label>
              <Input
                id="embroidery"
                value={customText}
                onChange={(e) => setCustomText(e.target.value.slice(0, 60))}
                placeholder="הקלידו את השם שתרצו על המוצר"
                className="mt-2 bg-white"
                maxLength={60}
              />
              {customText.trim() && !embroideryOnly && (
                <div className="mt-3">
                  <span className="block text-xs font-medium text-[#A8862A] mb-1.5">בחרו שיטת התאמה:</span>
                  <div className="flex gap-2">
                    {([
                      { value: "embroidery" as const, label: embroideryLabel },
                      { value: "laser" as const, label: "חריטת לייזר" },
                    ]).map((opt) => {

                      const active = customMethod === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setCustomMethod(opt.value)}
                          className={
                            "flex-1 rounded-md border px-3 py-2 text-sm transition " +
                            (active
                              ? "border-[#D4AF37] bg-white text-[#A8862A] font-semibold shadow-sm"
                              : "border-border bg-white/60 text-foreground hover:border-[#D4AF37]/60")
                          }
                          aria-pressed={active}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {printInsteadOfEmbroidery
                  ? "ניתן להוסיף שם בהטבעה או בחריטת לייזר בעברית. ניצור איתכם קשר לאחר ההזמנה לתיאום פונט וגוון."
                  : embroideryOnly
                  ? "ניתן להוסיף שם ברקמה בעברית. ניצור איתכם קשר לאחר ההזמנה לתיאום פונט וגוון."
                  : "ניתן להוסיף שם ברקמה או בחריטת לייזר בעברית. ניצור איתכם קשר לאחר ההזמנה לתיאום פונט וגוון."}
              </p>

            </div>
          )}


          {/* Size variants */}
          {variants.length > 0 && (
            <div className="mb-5">
              <Label className="text-sm font-semibold mb-2 block">בחר גודל</Label>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  // In-place variant (price set, no sibling slug) → toggle selection on this page.
                  if (v.price !== null && !v.slug) {
                    const isActive = (selectedVariant?.id ?? null) === v.id;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={
                          "px-3 py-1.5 rounded-md text-sm transition " +
                          (isActive
                            ? "border-2 border-[#D4AF37] bg-[#FAF6E9] font-medium"
                            : "border border-border bg-background hover:border-[#D4AF37] hover:bg-muted")
                        }
                        aria-pressed={isActive}
                      >
                        {v.label}
                      </button>
                    );
                  }
                  // Sibling-product variant → link to the other product page.
                  const isActive = v.sku === product.sku;
                  return isActive ? (
                    <span
                      key={v.id}
                      className="px-3 py-1.5 rounded-md border-2 border-[#D4AF37] bg-[#FAF6E9] text-sm font-medium"
                    >
                      {v.label}
                    </span>
                  ) : (
                    <Link
                      key={v.id}
                      to="/product/$slug"
                      params={{ slug: v.slug! }}
                      className="px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:border-[#D4AF37] hover:bg-muted transition"
                    >
                      {v.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Qty + actions */}
          {isCallOnly ? (
            <div className="mb-3 space-y-3">
              <div className="rounded-lg border border-[#D4AF37]/40 bg-white p-4 text-sm text-foreground">
                <strong className="block text-[#A8862A] mb-1">להזמנת התכשיט:</strong>
                ההזמנה והתשלום מתבצעים בשיחת טלפון או בפגישה במקום בלבד — לא ניתן לרכוש דרך האתר.
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="tel:+972545818486"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#D4AF37] hover:bg-[#A8862A] text-white font-semibold px-5 py-3 transition"
                >
                  ☎ התקשרו עכשיו
                </a>
                <a
                  href={`https://wa.me/972545818486?text=${encodeURIComponent(`שלום, אשמח לפרטים והצעת מחיר על: ${product.name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10 font-semibold px-5 py-3 transition"
                >
                  💬 שלחו וואטסאפ
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="inline-flex items-center rounded-md border">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-muted" aria-label="הפחת">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-4 font-medium">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2 hover:bg-muted" aria-label="הוסף">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button
                size="lg"
                variant="outline"
                disabled={!inStock}
                onClick={() => {
                  addToCart();
                  toast.success(`${qty} × ${product.name} נוסף לעגלה`);
                }}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" /> {inStock ? "הוסף לעגלה" : "אזל מהמלאי"}
              </Button>
              <Button
                size="lg"
                disabled={!inStock}
                onClick={() => {
                  addToCart();
                  navigate({ to: "/checkout" });
                }}
                className="gap-2 bg-[#D4AF37] hover:bg-[#A8862A] text-white"
              >
                קנה עכשיו
              </Button>
            </div>
          )}

          {/* Compact bundle right under the buy buttons */}
          {related.length > 0 && (
            <BundleOffer
              variant="compact"
              main={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price,
                thumbnail_url: product.thumbnail_url,
              }}
              addons={related.slice(0, 2).map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                thumbnail_url: p.thumbnail_url,
              }))}
            />
          )}



          {/* Trust strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-[#D4AF37]" /> משלוח לכל הארץ</div>
            <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-[#D4AF37]" /> 14 יום להחזרה</div>
          </div>

          {/* Accordion */}
          <Accordion type="single" collapsible className="mt-8" defaultValue="desc">
            {product.description && (
              <AccordionItem value="desc">
                <AccordionTrigger className="font-display text-base">תיאור המוצר</AccordionTrigger>
                <AccordionContent>
                  <div
                    className="prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="ship">
              <AccordionTrigger className="font-display text-base">משלוחים</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  משלוח עד הבית לכל רחבי הארץ תוך 3–14 ימי עסקים. ניתן גם איסוף עצמי בתיאום מראש.
                  להזמנות דחופות צרו קשר בוואטסאפ ונדאג למשלוח אקספרס.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ret">
              <AccordionTrigger className="font-display text-base">מדיניות החזרות וביטולים</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ניתן לבטל עסקה בכתב עד 14 ימים מקבלת המוצר, בהתאם לחוק הגנת הצרכן — בהודעה בדוא"ל
                  או דרך עמוד יצירת הקשר. בביטול שאינו עקב פגם ייתכן ניכוי דמי ביטול בשיעור שלא יעלה על
                  5% ממחיר העסקה או 100 ₪, הנמוך מביניהם, והחזר כספי יבוצע תוך 14 ימים מקבלת ההודעה.
                  המוצר יוחזר באריזתו המקורית וללא שימוש. פריטים בהתאמה אישית (רקמה/חריטה) אינם ניתנים לביטול.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Cross-sells — near the description */}
      {related.length > 0 && (
        <section className="mt-14">
          <div className="flex items-end justify-between mb-5 border-b border-[#D4AF37]/30 pb-3">
            <div>
              <p className="text-[11px] tracking-[0.25em] text-[#A8862A] uppercase font-semibold mb-1">מוצרים נלווים</p>
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
                משלימים את הקנייה
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {related.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Bundle offer — buy together and save */}
      {related.length >= 1 && (
        <BundleOffer
          main={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            price: product.price,
            thumbnail_url: product.thumbnail_url,
          }}
          addons={related.slice(0, 2).map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            price: p.price,
            thumbnail_url: p.thumbnail_url,
          }))}
        />
      )}

      {/* Also bought */}
      {related.length > 4 && (
        <section className="mt-16 relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
          <div className="text-center pt-10 mb-8">
            <p className="text-xs tracking-[0.3em] text-[#A8862A] uppercase mb-3 font-medium">לקוחות נוספים הוסיפו</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              מוצרים שגם אהבו
            </h2>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="h-px w-12 bg-[#D4AF37]/40" />
              <span className="text-[#D4AF37] text-lg">✦</span>
              <span className="h-px w-12 bg-[#D4AF37]/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {related.slice(4, 8).map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Customer reviews + star ratings */}
      <ProductReviews productId={product.id} initialSummary={reviewSummary} />
    </div>
  );
}
