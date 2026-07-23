import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { formatILS, useCart, getEffectivePrice, FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT, type CustomMethod } from "@/lib/cart";
import { ProductCardData } from "@/components/ProductCard";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { BundleOffer } from "@/components/BundleOffer";
import { ProductReviews } from "@/components/ProductReviews";
import { Stars } from "@/components/Stars";
import { ClubBadge } from "@/components/ClubBadge";
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";
import { thumbUrl } from "@/lib/img";
import { ShoppingCart, Minus, Plus, Check, Truck, RotateCcw, ZoomIn, Heart } from "lucide-react";
import { useFavorites } from "@/components/engagement/favorites";
import { readRecent, recordRecent } from "@/components/engagement/recently-viewed";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";

async function fetchProductWithRetry(slug: string, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, short_description, price, sale_price, sku, stock_status, thumbnail_url, product_images(url, sort_order), product_categories(categories(id, slug, name, parent_slug))",
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        // A real error (not a missing row) — surface it to the route error
        // boundary rather than masquerading as "product not found" (soft-404).
        throw err;
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
    if (!product) throw notFound(); // real HTTP 404 for non-existent slugs, not a soft-404
    const reviewSummary = product.id
      ? await fetchReviewSummary(product.id as string)
      : { average: 0, count: 0 };
    // When the first category is a subcategory, resolve its parent so the
    // breadcrumb trail (JSON-LD in head + visible nav) includes the full path.
    const loaderCats = ((product as any).product_categories ?? [])
      .map((pc: any) => pc?.categories)
      .filter(Boolean);
    const loaderFirstCat = loaderCats[0];
    let parentCat: { slug: string; name: string } | null = null;
    if (loaderFirstCat?.parent_slug) {
      try {
        const { data } = await supabase
          .from("categories")
          .select("slug, name")
          .eq("slug", loaderFirstCat.parent_slug)
          .maybeSingle();
        parentCat = data ?? null;
      } catch {
        parentCat = null;
      }
    }
    return { product, reviewSummary, parentCat };
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
        // Shopping listings / merchant rich results. Must mirror the binding
        // copy the customer sees (14-day returns, flat shipping fee, 3–14
        // business-day delivery per /terms and the on-page delivery note) —
        // structured data must never promise faster than the visible text.
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
            handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
            transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 14, unitCode: "DAY" },
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

    // Build the trail dynamically — positions come from the array index so
    // they stay consecutive whether or not the parent/category levels exist.
    const parentCat = (loaderData as any)?.parentCat as { slug: string; name: string } | null | undefined;
    const crumbs: Array<{ name: string; item: string }> = [
      { name: "בית", item: "https://orzadik.com/" },
      { name: "מוצרים", item: "https://orzadik.com/shop" },
      ...(parentCat
        ? [{ name: parentCat.name, item: `https://orzadik.com/category/${parentCat.slug}` }]
        : []),
      ...(firstCat
        ? [{ name: firstCat.name, item: `https://orzadik.com/category/${firstCat.slug}` }]
        : []),
      { name: p.name, item: url },
    ];
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.item,
      })),
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
  // parentCat is resolved once in the loader (server-side) and reused for both
  // the JSON-LD trail in head() and the visible breadcrumb — no client query.
  const { product: initialProduct, reviewSummary, parentCat: parentCategory } =
    Route.useLoaderData();
  const navigate = useNavigate();
  const { add } = useCart();
  const { has: hasFav, toggle: toggleFav } = useFavorites();
  const [qty, setQty] = useState(1);
  // Recently-viewed snapshots — empty on the server, SSR-safe.
  const [recent, setRecent] = useState<ProductCardData[]>([]);
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customText, setCustomText] = useState("");
  const [customMethod, setCustomMethod] = useState<CustomMethod>("embroidery");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Keep the thumbnail highlight in sync with the slide the carousel shows.
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // The router reuses this component instance across /product/$slug navigations,
  // so per-product UI state would otherwise bleed from one product to the next
  // (e.g. product B showing product A's selected image / quantity / size variant /
  // personalization).
  useEffect(() => {
    api?.scrollTo(0, true);
    setSelectedIndex(0);
    setQty(1);
    setCustomText("");
    setCustomMethod("embroidery");
    setSelectedVariantId(null);
  }, [slug]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, short_description, price, sale_price, sku, stock_status, thumbnail_url, product_images(url, sort_order), product_categories(categories(id, slug, name, parent_slug))",
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

  // Recently-viewed: read BEFORE recording so the current product stays out of
  // its own strip. Keyed on product.id (not slug) and separate from the
  // UI-reset effect above — it runs only once the loaded product is known.
  useEffect(() => {
    if (!product) return; // skip when the loader 404s
    setRecent(readRecent());
    recordRecent({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      sale_price: product.sale_price,
      thumbnail_url: product.thumbnail_url,
      stock_status: product.stock_status,
    });
  }, [product?.id]);

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
        .select("id, label, sku, price, sort_order, in_stock")
        .eq("product_id", product!.id)
        .order("sort_order");
      if (!vs || vs.length === 0) return [] as Array<{ id: string; label: string; sku: string | null; price: number | null; inStock: boolean; slug?: string }>;
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
          // Legacy rows predate the column — null/undefined means "available".
          inStock: v.in_stock !== false,
          slug: s?.slug as string | undefined,
        };
      }).filter((v) => v.price !== null || v.slug);
    },
  });

  // For in-place variants, track the selected one. The default is the first
  // AVAILABLE size — never pre-select a size the customer cannot actually buy.
  // (Price math is untouched: whichever variant is selected is still priced by
  // its own `price` through getEffectivePrice, exactly as before.)
  const inPlaceVariants = variants.filter((v) => v.price !== null && !v.slug);
  const siblingVariants = variants.filter((v) => !(v.price !== null && !v.slug));
  const selectedVariant =
    inPlaceVariants.find((v) => v.id === selectedVariantId) ??
    inPlaceVariants.find((v) => v.inStock) ??
    inPlaceVariants[0] ??
    null;


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

  // Same-category recommendations — the related query above deliberately
  // excludes the product's own categories, so this fills the "מוצרים דומים" strip.
  const { data: similar = [] } = useQuery({
    queryKey: ["similar", product?.id],
    enabled: !!product?.id && categoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status)")
        .in("category_id", categoryIds)
        .limit(24);
      if (error) throw error;
      const seen = new Set<string>();
      const out: ProductCardData[] = [];
      for (const r of (data ?? [])) {
        const p: any = (r as any).products;
        if (!p?.is_active || !p.thumbnail_url) continue;
        if (p.id === product!.id) continue;
        if (p.stock_status === "outofstock") continue;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
        if (out.length >= 10) break;
      }
      return out;
    },
  });

  if (isLoading) return <div className="container mx-auto px-4 py-20 text-center">טוען...</div>;
  if (!product) return <div className="container mx-auto px-4 py-20 text-center">המוצר לא נמצא</div>;

  // Dedupe (thumbnail_url often repeats inside product_images) and copy before
  // sorting so the React Query cache object is never mutated — mirrors head().
  const gallery: string[] = Array.from(
    new Set<string>([
      ...(product.thumbnail_url ? [product.thumbnail_url] : []),
      ...((product.product_images ?? [])
        .slice()
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i: any) => i.url)
        .filter(Boolean)),
    ]),
  );
  // If an in-place size variant is selected, use its price as the base.
  const effectiveBase = selectedVariant ? selectedVariant.price! : Number(product.price);
  const effective = getEffectivePrice(effectiveBase);
  // Honest strike-through: only vs. a genuine recorded former price (sale_price)
  // for the base product; a selected size variant has no recorded former price.
  const baseSalePrice = selectedVariant ? null : (product.sale_price ?? null);
  const inStock = product.stock_status !== "outofstock";
  // A product whose every in-place size is marked "אזל" cannot be bought even
  // when products.stock_status still says instock — the admin variants panel
  // only writes product_variants.in_stock and never touches the parent column.
  // selectedVariant still falls back to the first size so the price and the
  // selected chip stay coherent, but that id must never reach the cart:
  // placeOrder rejects any line whose variant has in_stock === false.
  const variantAvailable = inPlaceVariants.length === 0 || !!selectedVariant?.inStock;
  // The single buy gate for this page — every add-to-cart entry point uses it.
  const canBuy = inStock && variantAvailable;
  const firstCategory: any = (product.product_categories ?? [])[0]?.categories;
  const isCallOnly = (product.product_categories ?? []).some(
    (pc: any) => pc?.categories?.slug === "esh-sheli-gold"
  );

  // Favorites heart — rendered in every branch (regular, call-only and
  // out-of-stock), since wishlisting an unavailable item is the feature's
  // best use case.
  const favSaved = hasFav(product.id);
  const favButton = (
    <button
      type="button"
      onClick={() => {
        const wasAdded = toggleFav(product.id);
        if (wasAdded) {
          toast.success("נשמר במועדפים", {
            action: { label: "למועדפים", onClick: () => navigate({ to: "/favorites" }) },
          });
        }
      }}
      aria-pressed={favSaved}
      aria-label={favSaved ? "הסר מהמועדפים" : "הוסף למועדפים"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-muted transition-colors"
    >
      <Heart className={`h-5 w-5 ${favSaved ? "fill-accent text-accent" : "text-foreground/60"}`} />
    </button>
  );

  // Phone + WhatsApp pair — the single escape hatch for everything that cannot
  // be completed in the cart right now: gold items priced by the daily rate,
  // and products that are out of stock. Callers supply the flex wrapper.
  const CONTACT_TEL = "+972545818486";
  const CONTACT_WA = "972545818486";
  const QUOTE_WA_TEXT = `שלום, אשמח לפרטים והצעת מחיר על: ${product.name}`;
  // No restock date, no "we'll email you" — only an invitation to ask.
  const RESTOCK_WA_TEXT = `שלום, המוצר "${product.name}" מופיע כאזל באתר. אשמח לבדוק אפשרות לחידוש מלאי או מוצר חלופי.`;
  const contactCtas = (waText: string, compact = false) => (
    <>
      <a
        href={`tel:${CONTACT_TEL}`}
        className={
          "inline-flex items-center justify-center gap-2 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground font-semibold transition " +
          (compact ? "flex-1 px-4 py-2.5 text-sm" : "px-5 py-3")
        }
      >
        ☎ התקשרו עכשיו
      </a>
      <a
        href={`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(waText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={
          "inline-flex items-center justify-center gap-2 rounded-md border-2 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10 font-semibold transition " +
          (compact ? "flex-1 px-4 py-2.5 text-sm" : "px-5 py-3")
        }
      >
        💬 שלחו וואטסאפ
      </a>
    </>
  );

  // Filter at render too — the component instance is reused across client-side
  // slug navigations, so state can briefly carry the previous product's list.
  const recentToShow = recent.filter((r) => r.id !== product.id);

  // Running breadcrumb positions — stay consecutive whether or not the
  // parent-category li renders.
  const categoryCrumbPos = parentCategory ? 4 : 3;
  const productCrumbPos = firstCategory ? categoryCrumbPos + 1 : 3;

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

  // Roving focus for the size radiogroup: a role="radio" set is expected to be
  // one tab stop with arrows moving between options. RTL — ArrowRight goes to
  // the previous option, matching the visual order. Runs only from a real key
  // event, so the DOM lookup is client-side by construction.
  function onSizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const selectable = inPlaceVariants.filter((v) => v.inStock);
    if (selectable.length < 2) return;
    e.preventDefault();
    const curIdx = Math.max(
      0,
      selectable.findIndex((v) => v.id === (selectedVariant?.id ?? null)),
    );
    const forward = e.key === "ArrowLeft" || e.key === "ArrowDown";
    const next = selectable[(curIdx + (forward ? 1 : -1) + selectable.length) % selectable.length];
    setSelectedVariantId(next.id);
    (e.currentTarget.querySelector(`[data-variant-id="${next.id}"]`) as HTMLElement | null)?.focus();
  }

  // The one add-to-cart entry point for the page — the desktop buy row and the
  // mobile sticky bar must never drift apart.
  function addToCartWithFeedback() {
    if (!product) return;
    addToCart();
    const parts = [`נוסף לעגלה: ${qty} × ${product.name}`];
    if (selectedVariant?.label) parts.push(`גודל: ${selectedVariant.label}`);
    if (customText.trim()) {
      parts.push(
        customMethod === "embroidery"
          ? `${embroideryLabel}: ${customText.trim()}`
          : `חריטה: ${customText.trim()}`,
      );
    }
    // Give the toast an exit — without it the user is stranded after it fades
    // (worst on mobile / with personalization, which can only be reviewed in
    // the cart).
    toast.success(parts.join(" • "), {
      action: { label: "לצפייה בעגלה", onClick: () => navigate({ to: "/cart" }) },
    });
  }


  return (
    <div className="container mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav aria-label="ניווט מיקום באתר" className="mb-4">
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
          {parentCategory && (
            <>
              <li aria-hidden="true" className="text-muted-foreground/40">/</li>
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                <Link
                  to="/category/$slug"
                  params={{ slug: parentCategory.slug }}
                  className="hover:text-accent transition-colors"
                  itemProp="item"
                >
                  <span itemProp="name">{parentCategory.name}</span>
                </Link>
                <meta itemProp="position" content="3" />
              </li>
            </>
          )}
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
                <meta itemProp="position" content={String(categoryCrumbPos)} />
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
                <meta itemProp="position" content={String(productCrumbPos)} />
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
          {gallery.length > 0 ? (
            <Dialog>
              <Carousel
                dir="rtl"
                opts={{ direction: "rtl", loop: true }}
                setApi={setApi}
                className="w-full overflow-hidden rounded-lg border border-gold/40 bg-cream"
              >
                <CarouselContent>
                  {gallery.map((url, i) => (
                    <CarouselItem key={url}>
                      <div className="aspect-square w-full">
                        <img
                          src={url}
                          alt={`${product.name} — תמונה ${i + 1}`}
                          // First slide is the page's LCP; the rest sit off-screen
                          // in the strip until swiped to.
                          loading={i === 0 ? "eager" : "lazy"}
                          fetchPriority={i === 0 ? "high" : "auto"}
                          decoding="async"
                          className="h-full w-full object-contain p-4"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="absolute bottom-3 left-3 z-10 rounded-full bg-white/90 backdrop-blur p-2 shadow cursor-zoom-in hover:bg-white transition-colors"
                    aria-label="הגדל תמונה"
                  >
                    <ZoomIn className="h-4 w-4 text-accent" />
                  </button>
                </DialogTrigger>
                {gallery.length > 1 && (
                  <>
                    <CarouselPrevious className="right-2 top-1/2" />
                    <CarouselNext className="left-2 top-1/2" />
                  </>
                )}
              </Carousel>
              <DialogContent className="max-w-4xl p-2 bg-white">
                <DialogTitle className="sr-only">{product.name}</DialogTitle>
                {/* Mounted only while the dialog is open, so startIndex opens on
                    the slide the user was viewing. */}
                <Carousel dir="rtl" opts={{ direction: "rtl", loop: true, startIndex: selectedIndex }}>
                  <CarouselContent>
                    {gallery.map((url, i) => (
                      <CarouselItem key={url}>
                        <img
                          src={url}
                          alt={`${product.name} — תמונה ${i + 1}`}
                          className="h-auto w-full object-contain rounded"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="right-2 top-1/2" />
                  <CarouselNext className="left-2 top-1/2" />
                </Carousel>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="aspect-square w-full rounded-lg border border-gold/40 bg-cream" />
          )}
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="תמונות נוספות של המוצר">
              {gallery.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => api?.scrollTo(idx)}
                  aria-label={`הצג תמונה ${idx + 1} מתוך ${gallery.length}`}
                  aria-pressed={idx === selectedIndex}
                  className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white ${
                    idx === selectedIndex ? "ring-2 ring-accent" : "ring-1 ring-border"
                  }`}
                >
                  {/* 80 CSS px — request a 160px transform (2× for retina)
                      instead of the full-size original. The main slide and the
                      zoom dialog keep the originals. */}
                  <img src={thumbUrl(url, 160) ?? url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">{product.name}</h1>
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
            <div className="mb-3 rounded-lg border border-gold/40 bg-cream px-4 py-3">
              <div className="text-lg font-bold text-accent">המחיר משתנה לפי שער הזהב היומי</div>
              <div className="text-sm text-foreground mt-1">לקבלת הצעת מחיר עדכנית - צרו קשר בטלפון או בוואטסאפ</div>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
              <span className="text-3xl font-bold text-accent">{formatILS(effective)}</span>
            </div>
          )}

          {/* Stock */}
          <div className="mb-5 space-y-2">
            {canBuy ? (
              // Availability only. The single binding delivery statement lives
              // in the row below (3–14 ימי עסקים) — no speed claim here.
              // Uses canBuy so the badge can never say "במלאי" next to a
              // disabled buy button when every size is sold out.
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                <Check className="h-4 w-4" /> במלאי
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
                אזל מהמלאי
              </span>
            )}
            <div className="inline-flex items-center gap-1.5 text-sm text-foreground bg-cream border border-gold/50 rounded-md px-2.5 py-1">
              <Truck className="h-4 w-4 text-accent" />
              <span>
                דמי משלוח {formatILS(SHIPPING_FLAT)} (מתווספים בעגלה) • <span className="font-semibold text-accent">זמן אספקה 3–14 ימי עסקים</span>
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
            <div className="mb-5 rounded-lg border border-gold/40 bg-cream p-4">
              <Label htmlFor="embroidery" className="text-sm font-semibold text-accent">
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
                  <span className="block text-xs font-medium text-accent mb-1.5">בחרו שיטת התאמה:</span>
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
                              ? "border-gold bg-white text-accent font-semibold shadow-sm"
                              : "border-border bg-white/60 text-foreground hover:border-gold/60")
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


          {/* Size variants. Two genuinely different interaction models, so they
              get two labelled rows instead of one undifferentiated chip list:
              in-place sizes are radio buttons that reprice this page, sibling
              SKUs are links that navigate to another product. */}
          {variants.length > 0 && (
            <fieldset className="mb-5 m-0 border-0 p-0">
              <legend className="text-sm font-semibold mb-2">בחר גודל</legend>

              {inPlaceVariants.length > 0 && (
                <div
                  role="radiogroup"
                  aria-label="בחירת גודל"
                  onKeyDown={onSizeKeyDown}
                  className="flex flex-wrap gap-2"
                >
                  {inPlaceVariants.map((v) => {
                    const isActive = (selectedVariant?.id ?? null) === v.id;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        role="radio"
                        aria-checked={isActive}
                        data-variant-id={v.id}
                        tabIndex={isActive ? 0 : -1}
                        disabled={!v.inStock}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={
                          "px-3 py-1.5 rounded-md text-sm transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-50 " +
                          (isActive
                            ? "border-2 border-gold bg-cream font-medium"
                            : "border border-border bg-background hover:border-gold hover:bg-muted disabled:hover:border-border disabled:hover:bg-background")
                        }
                      >
                        {v.label}
                        {!v.inStock && <span className="sr-only"> — אזל מהמלאי</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {siblingVariants.length > 0 && (
                <div className={inPlaceVariants.length > 0 ? "mt-3" : ""}>
                  <span className="block text-xs font-medium text-muted-foreground mb-1.5" id="sibling-sizes-label">
                    מידות נוספות
                  </span>
                  <div role="group" className="flex flex-wrap gap-2" aria-labelledby="sibling-sizes-label">
                    {siblingVariants.map((v) => {
                      // Sibling-product variant → link to the other product page.
                      const isCurrent = v.sku === product.sku;
                      return isCurrent ? (
                        <span
                          key={v.id}
                          aria-current="true"
                          className="px-3 py-1.5 rounded-md border-2 border-gold bg-cream text-sm font-medium"
                        >
                          {v.label}
                        </span>
                      ) : (
                        <Link
                          key={v.id}
                          to="/product/$slug"
                          params={{ slug: v.slug! }}
                          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:border-gold hover:bg-muted transition"
                        >
                          {v.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {/* Qty + actions */}
          {isCallOnly ? (
            <div className="mb-3 space-y-3">
              <div className="rounded-lg border border-gold/40 bg-white p-4 text-sm text-foreground">
                <strong className="block text-accent mb-1">להזמנת התכשיט:</strong>
                ההזמנה והתשלום מתבצעים בשיחת טלפון או בפגישה במקום בלבד — לא ניתן לרכוש דרך האתר.
              </div>
              <div className="flex flex-wrap gap-3">
                {contactCtas(QUOTE_WA_TEXT)}
                {favButton}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="inline-flex items-center overflow-hidden rounded-full border border-border">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="px-3 py-2 hover:bg-muted disabled:pointer-events-none disabled:opacity-50" aria-label="הפחת">
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
                disabled={!canBuy}
                onClick={addToCartWithFeedback}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" />{" "}
                {!canBuy
                  ? "אזל מהמלאי"
                  : qty > 1
                  ? `הוסף לעגלה — ${formatILS(effective * qty)}`
                  : "הוסף לעגלה"}
              </Button>
              <Button
                size="lg"
                disabled={!canBuy}
                onClick={() => {
                  addToCart();
                  navigate({ to: "/checkout" });
                }}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                קנה עכשיו
              </Button>
              {favButton}
            </div>
          )}

          {/* Out of stock is not a dead end: both buy buttons above are
              disabled, so offer the same phone/WhatsApp pair the call-only
              products use. Deliberately promises nothing — no restock date, no
              back-in-stock notification, no claim the item will return. */}
          {!isCallOnly && !canBuy && (
            <div className="mb-3 space-y-3">
              <div className="rounded-lg border border-gold/40 bg-white p-4 text-sm text-foreground">
                <strong className="block text-accent mb-1">המוצר אזל כרגע</strong>
                דברו איתנו לבדיקת חידוש מלאי או חלופה מתאימה.
              </div>
              <div className="flex flex-wrap gap-3">{contactCtas(RESTOCK_WA_TEXT)}</div>
            </div>
          )}

          {/* Compact bundle right under the buy buttons. Hidden when the main
              product is unavailable — "add the set" force-includes the main
              item, so offering it here would drop an out-of-stock item into
              the cart. The cross-sell carousel below still shows companions. */}
          {canBuy && related.length > 0 && (
            <BundleOffer
              variant="compact"
              main={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                // Same base price the page CTA uses, so the bundle total never
                // contradicts the price shown above it.
                price: effectiveBase,
                sale_price: baseSalePrice,
                thumbnail_url: product.thumbnail_url,
                // Keep the cart line tied to the size whose price is shown —
                // checkout reprices by variantId, mirroring addToCart().
                variantId: selectedVariant?.id,
                variantLabel: selectedVariant?.label,
              }}
              addons={related.slice(0, 2).map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                sale_price: p.sale_price,
                thumbnail_url: p.thumbnail_url,
              }))}
            />
          )}



          {/* Trust strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-accent" /> משלוח לכל הארץ</div>
            <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-accent" /> 14 יום להחזרה</div>
          </div>

          {/* Accordion */}
          <Accordion type="single" collapsible className="mt-8" defaultValue="desc">
            {product.description && (
              <AccordionItem value="desc" className="border-gold/30">
                <AccordionTrigger className="font-display text-base">תיאור המוצר</AccordionTrigger>
                <AccordionContent>
                  <div
                    className="prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="ship" className="border-gold/30">
              <AccordionTrigger className="font-display text-base">משלוחים</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  משלוח עד הבית לכל רחבי הארץ תוך 3–14 ימי עסקים. ניתן גם איסוף עצמי בתיאום מראש.
                  להזמנות דחופות צרו קשר בוואטסאפ ונדאג למשלוח אקספרס.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ret" className="border-gold/30">
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

      {/* Cross-sells — one carousel showing every fetched companion */}
      {related.length > 0 && (
        <ProductCarousel
          eyebrow="מוצרים נלווים"
          heading="משלימים את הקנייה"
          items={related}
          itemClassName="basis-1/2 md:basis-1/4 lg:basis-1/5"
        />
      )}

      {/* Bundle offer — a one-click way to add the matching items. The total is
          a plain sum; there is no set discount, so no saving is claimed. */}
      {canBuy && related.length >= 1 && (
        <BundleOffer
          main={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            // Same base price the page CTA uses, so the bundle total never
            // contradicts the price shown above it.
            price: effectiveBase,
            sale_price: baseSalePrice,
            thumbnail_url: product.thumbnail_url,
            // Keep the cart line tied to the size whose price is shown —
            // checkout reprices by variantId, mirroring addToCart().
            variantId: selectedVariant?.id,
            variantLabel: selectedVariant?.label,
          }}
          addons={related.slice(0, 2).map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            price: p.price,
            sale_price: p.sale_price,
            thumbnail_url: p.thumbnail_url,
          }))}
        />
      )}

      {/* Same-category recommendations. The 4-item floor keeps the strip from
          looking thin on a normal page — but when the product is out of stock
          this strip IS the way forward, so show whatever exists (the carousel
          renders nothing on an empty list). */}
      {(!canBuy || similar.length >= 4) && (
        <ProductCarousel
          eyebrow="עוד מהקטגוריה"
          heading={canBuy ? "מוצרים דומים" : "מוצרים דומים שזמינים עכשיו"}
          items={similar}
        />
      )}

      {/* Recently viewed — local snapshots, zero extra queries */}
      {recentToShow.length >= 2 && (
        <ProductCarousel eyebrow="במיוחד בשבילך" heading="צפית לאחרונה" items={recentToShow} />
      )}

      {/* Customer reviews + star ratings */}
      <ProductReviews productId={product.id} initialSummary={reviewSummary} />

      {/* Mobile buy bar. `sticky` (not `fixed`) on purpose: it pins to the
          bottom of the viewport while the page body is in view and then
          retires into the flow at the end of the container, so it can never
          cover the footer. Pure CSS — nothing here touches window/document, so
          it renders identically on the server. */}
      <div className="lg:hidden sticky bottom-0 z-40 -mx-4 mt-10 border-t border-gold/40 bg-background/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.35)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
        {isCallOnly || !canBuy ? (
          <div className="flex items-center gap-2">
            {contactCtas(isCallOnly ? QUOTE_WA_TEXT : RESTOCK_WA_TEXT, true)}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-shrink-0">
              <div className="text-[11px] leading-none text-muted-foreground">
                {qty > 1 ? `סה״כ ${qty} יח׳` : "מחיר"}
              </div>
              <div className="mt-0.5 text-lg font-bold leading-none text-accent">
                {formatILS(effective * qty)}
              </div>
            </div>
            <Button
              size="lg"
              onClick={addToCartWithFeedback}
              className="flex-1 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <ShoppingCart className="h-4 w-4" /> הוסף לעגלה
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
