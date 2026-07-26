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
import { trackViewItem } from "@/lib/analytics";
import { ProductCardData } from "@/components/ProductCard";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { PersonalizationPreview } from "@/components/product/PersonalizationPreview";
import {
  isPersonalizableProduct,
  embroideryLabel as getEmbroideryLabel,
  EMBROIDERY_ONLY_CATEGORY_SLUGS,
  PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS,
} from "@/lib/personalization";
import { ProductReviews } from "@/components/ProductReviews";
import type { PublicReview } from "@/lib/reviews.functions";
import { Stars } from "@/components/Stars";
import { ClubBadge } from "@/components/ClubBadge";
import { Breadcrumb, type BreadcrumbItemData } from "@/components/Breadcrumb";
import { CardSkeleton } from "@/components/Skeletons";
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";
import { thumbUrl } from "@/lib/img";
import { ShoppingCart, Minus, Plus, Check, Truck, RotateCcw, ZoomIn, Heart, Lock, ShieldCheck } from "lucide-react";
import { sellerIdentityLine, CONSUMER_POLICY } from "@/lib/business";
import { useFavorites } from "@/components/engagement/favorites";
import { readRecent, recordRecent } from "@/components/engagement/recently-viewed";
import { useState, useEffect, useRef } from "react";
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

// Approved reviews for SSR. Mirrors fetchReviewSummary (same isomorphic client,
// same public read path) and matches getProductReviews' select/filter/order/
// limit exactly, so the SSR-seeded list is identical to the one the client
// query later revalidates to. Moderation gate preserved: only is_approved rows.
async function fetchReviews(productId: string): Promise<PublicReview[]> {
  try {
    const { data } = await supabase
      .from("reviews")
      .select("id, author_name, rating, title, body, created_at, order_id")
      .eq("product_id", productId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as PublicReview[];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const product = await fetchProductWithRetry(params.slug);
    if (!product) throw notFound(); // real HTTP 404 for non-existent slugs, not a soft-404
    // Summary (accurate full-count, for head()/JSON-LD/star-link) and the
    // approved-review list (SSR-seed for ProductReviews) are independent public
    // reads — run them together.
    const [reviewSummary, initialReviews] = product.id
      ? await Promise.all([
          fetchReviewSummary(product.id as string),
          fetchReviews(product.id as string),
        ])
      : [{ average: 0, count: 0 }, [] as PublicReview[]];
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
    return { product, reviewSummary, initialReviews, parentCat };
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
    // LCP preload hint. The first gallery image is the product page's largest
    // paint (this is the 4,600+-page organic template). Preload it mirroring
    // EXACTLY what the gallery's first <img> renders — same thumbUrl helper,
    // same widths/quality (600/900/1200 @ q80 + the original at 1400w) and the
    // same `sizes` — so imagesrcset/imagesizes resolve to the identical
    // candidate the element picks and the browser downloads it once. A mismatch
    // would double-download. Non-Supabase URLs (thumbUrl returns them unchanged)
    // get a plain href preload, matching the gallery's srcSet={undefined} path.
    // Guarded: products with no image emit no preload.
    const lcpImg: string | undefined = images[0];
    const lcpRendered = lcpImg ? thumbUrl(lcpImg, 1200, 80) : null;
    const lcpCanTransform = lcpRendered != null && lcpRendered !== lcpImg;
    const lcpSrcSet = lcpImg && lcpCanTransform
      ? [
          ...[600, 900, 1200].map((w) => `${thumbUrl(lcpImg, w, 80)} ${w}w`),
          `${lcpImg} 1400w`,
        ].join(", ")
      : undefined;
    const lcpPreload = lcpImg
      ? [
          {
            rel: "preload",
            as: "image",
            href: lcpImg,
            ...(lcpSrcSet
              ? { imagesrcset: lcpSrcSet, imagesizes: "(max-width:768px) 100vw, 50vw" }
              : {}),
            fetchpriority: "high",
          },
        ]
      : [];
    const cats = (p.product_categories ?? []).map((pc: any) => pc?.categories).filter(Boolean);
    const firstCat = cats[0];
    const isCallOnly = cats.some((c: any) => c.slug === "esh-sheli-gold");
    // The SAME personalization gate the page body uses for `showEmbroidery`:
    // same helper, same inputs (product slug + its category slugs, both already
    // in hand here). head() therefore knows exactly what the PDP knows about
    // whether this product is made-to-order, so the markup below can never
    // claim a return right the on-page return line denies.
    const personalizable = isPersonalizableProduct(
      params.slug,
      cats.map((c: any) => c.slug).filter(Boolean),
    );
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
        // Shipping details — feeds the shipping row of Google's free product
        // listings (the store already publishes a Merchant feed at /feed.xml).
        // Every figure is READ from the constant the rest of the app uses and
        // is never re-typed here: SHIPPING_FLAT (lib/pricing.ts) is the fee the
        // checkout actually charges, and CONSUMER_POLICY.deliveryMin/MaxDays
        // (lib/business.ts) is the same 3–14 business-day window published in
        // /terms §6, in the delivery line on this page and in the cart. So the
        // markup cannot drift from — or promise faster than — the visible text.
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: {
            "@type": "MonetaryAmount",
            value: String(SHIPPING_FLAT),
            currency: "ILS",
          },
          // Israel only, per /terms §6 ("האספקה מתבצעת בתחומי מדינת ישראל
          // בלבד"). No `freeShippingThreshold` is emitted: FREE_SHIPPING_THRESHOLD
          // is Infinity, i.e. the flat fee is charged on every order.
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "IL",
          },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            // Google derives the delivery estimate from handlingTime +
            // transitTime. /terms §6 publishes ONE end-to-end window — 3 to 14
            // business days from order confirmation to the door — and no
            // separate packing window, so the whole window is carried by
            // transitTime and handlingTime is pinned to 0. That makes the
            // computed total exactly the window the store honors; inventing a
            // packing figure would either be unverifiable or push the maximum
            // past 14, and leaving handlingTime out would let Google assume one.
            handlingTime: {
              "@type": "QuantitativeValue",
              minValue: 0,
              maxValue: 0,
              unitCode: "DAY",
            },
            transitTime: {
              "@type": "QuantitativeValue",
              minValue: CONSUMER_POLICY.deliveryMinDays,
              maxValue: CONSUMER_POLICY.deliveryMaxDays,
              unitCode: "DAY",
            },
            // The window is counted in BUSINESS days — /terms §6 excludes
            // Friday, Saturday, holiday eves and holidays — so the shipping
            // week is Sunday–Thursday. Without this, Google reads 3–14 as
            // calendar days and would advertise delivery faster than promised.
            // (This does not contradict the LocalBusiness node in __root.tsx,
            // which omits opening hours on purpose: the store's counter hours
            // are genuinely unrecorded, whereas the shipping week is stated in
            // the terms. Holiday closures have no field in this schema.)
            businessDays: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: [
                "https://schema.org/Sunday",
                "https://schema.org/Monday",
                "https://schema.org/Tuesday",
                "https://schema.org/Wednesday",
                "https://schema.org/Thursday",
              ],
            },
          },
        },
        // Merchant return policy — Google reads this as a merchant-listing
        // property. It is emitted ONLY for products the claim is actually true
        // for, never as a blanket statement:
        //
        //  • Non-personalizable products: /terms §7 grants the statutory
        //    distance-selling cancellation right unconditionally — 14 days from
        //    receipt (§7 ¶2), the buyer returns the item and bears the return
        //    shipping cost (§7 ¶6, "עלות החזרת המוצר במקרה זה חלה על הלקוח").
        //    The window is READ from CONSUMER_POLICY.cancellationDays
        //    (lib/business.ts) — the very constant the on-page return line
        //    renders — so the markup cannot drift from the visible copy.
        //  • Personalizable ones: /terms §7 ¶7 — following Consumer Protection
        //    Law §14ג(ד) — excludes made-to-order items (רקמה / חריטת לייזר /
        //    הקדשה) from that right, so NO return-policy node is emitted at all
        //    rather than a false one.
        //
        // The split uses `personalizable`, the page's own `showEmbroidery` gate,
        // so the markup and the on-page line are decided by the same rule.
        ...(personalizable
          ? {}
          : {
              hasMerchantReturnPolicy: {
                "@type": "MerchantReturnPolicy",
                applicableCountry: "IL",
                returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                merchantReturnDays: CONSUMER_POLICY.cancellationDays,
                returnMethod: "https://schema.org/ReturnByMail",
                returnFees: "https://schema.org/ReturnFeesCustomerResponsibleForReturnShipping",
              },
            }),
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
        ...(images[0] ? [{ property: "og:image:alt", content: p.name }] : []),
        ...(images[0] ? [{ name: "twitter:image", content: images[0] }] : []),
      ],
      links: [{ rel: "canonical", href: url }, ...lcpPreload],
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

// Personalization (embroidery / רקמה + laser engraving / חריטה) is the store's
// one real differentiator. The category/product sets and the derivation helpers
// now live in a single source of truth — @/lib/personalization — so the PDP and
// every browse surface agree on "is this personalizable, and how?". Imported at
// the top of this file; behaviour here is unchanged.

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// Which zoom modality the current device gets. Lens (hover-magnify) is reserved
// for fine-pointer desktops that have NOT asked to reduce motion — a
// cursor-tracked lens is direct manipulation but still motion, so reduced-motion
// users fall back to the static pan-scroll view. Client-only: SSR renders
// lensMode=false (the pan-scroll default that needs no JS), then the effect
// upgrades real desktops after hydration, so there is no hydration mismatch.
function useZoomMode(): boolean {
  const [lensMode, setLensMode] = useState(false);
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setLensMode(fine.matches && !reduced.matches);
    update();
    fine.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);
  return lensMode;
}

// Real zoom for the gallery dialog. Two modalities, one component:
//  • lensMode (desktop, fine pointer, motion allowed): a circular hover lens
//    that magnifies the region under the cursor ~2.3× from the full-res source,
//    so embroidery / filigree / engraving / kashrut marks can be inspected.
//  • otherwise (touch / coarse pointer / reduced-motion): the source scaled
//    ~2.3× inside an overflow-auto, touch-pannable container, centred on open.
// The lens math uses the IMAGE's on-screen rect (getBoundingClientRect), so it
// is correct regardless of the carousel's transform; all DOM reads happen in
// pointer handlers / effects, never at render — SSR-safe.
function ZoomableImage({
  src,
  alt,
  lensMode,
}: {
  src: string;
  alt: string;
  lensMode: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const ZOOM = 2.3;
  const LENS = 176;

  // Start the pan-scroll view centred on the image instead of at a corner.
  useEffect(() => {
    if (lensMode) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [src, lensMode]);

  const onMove = (e: React.PointerEvent) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setLens({
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height),
      w: rect.width,
      h: rect.height,
    });
  };

  if (lensMode) {
    let overlay: React.ReactNode = null;
    if (lens) {
      const bgW = lens.w * ZOOM;
      const bgH = lens.h * ZOOM;
      const bgX = clamp((lens.x / lens.w) * bgW - LENS / 2, 0, Math.max(0, bgW - LENS));
      const bgY = clamp((lens.y / lens.h) * bgH - LENS / 2, 0, Math.max(0, bgH - LENS));
      const left = clamp(lens.x - LENS / 2, 0, Math.max(0, lens.w - LENS));
      const top = clamp(lens.y - LENS / 2, 0, Math.max(0, lens.h - LENS));
      overlay = (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full ring-2 ring-accent shadow-xl"
          style={{
            width: LENS,
            height: LENS,
            left,
            top,
            backgroundColor: "#fff",
            backgroundImage: `url("${src}")`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${bgW}px ${bgH}px`,
            backgroundPosition: `-${bgX}px -${bgY}px`,
          }}
        />
      );
    }
    return (
      <div className="flex justify-center">
        <div
          className="relative inline-block leading-none"
          onPointerEnter={onMove}
          onPointerMove={onMove}
          onPointerLeave={() => setLens(null)}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            className="block max-h-[80vh] w-auto max-w-full rounded cursor-zoom-in select-none"
          />
          {overlay}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[80vh] overflow-auto rounded"
      style={{ touchAction: "pan-x pan-y" }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-none rounded select-none"
        style={{ width: `${ZOOM * 100}%` }}
      />
    </div>
  );
}

function ProductPage() {
  const { slug } = Route.useParams();
  // parentCat is resolved once in the loader (server-side) and reused for both
  // the JSON-LD trail in head() and the visible breadcrumb — no client query.
  const { product: initialProduct, reviewSummary, initialReviews, parentCat: parentCategory } =
    Route.useLoaderData();
  const navigate = useNavigate();
  // Desktop fine-pointer (motion allowed) gets the hover lens; everyone else the
  // touch-pannable scaled view. Resolved once, shared by every zoom slide.
  const lensMode = useZoomMode();
  const { add, closeCart } = useCart();
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
    // GA4 view_item / Meta ViewContent — one per product view. no-ops on SSR.
    trackViewItem({
      id: product.id,
      name: product.name,
      price: product.price,
      category: (product.product_categories ?? [])[0]?.categories?.name ?? null,
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
  // Same gate as before, now from the shared module. isPersonalizableProduct is
  // exactly `!NO_PERSONALIZATION_PRODUCT_SLUGS.has(slug) && isPersonalizable(...)`,
  // and embroideryOnly / printInsteadOfEmbroidery / embroideryLabel are derived
  // from the same sets — so the same products show the same UI as before.
  const showEmbroidery = isPersonalizableProduct(slug, categorySlugs);
  const embroideryOnly = categorySlugs.some((s) => EMBROIDERY_ONLY_CATEGORY_SLUGS.has(s));
  const printInsteadOfEmbroidery = categorySlugs.some((s) => PRINT_INSTEAD_OF_EMBROIDERY_CATEGORY_SLUGS.has(s));
  const embroideryLabel = getEmbroideryLabel(categorySlugs);
  // Short, category-accurate label for the above-the-fold personalization chip.
  const personalizationChipLabel = printInsteadOfEmbroidery
    ? "ניתן להוסיף הטבעה או חריטה אישית"
    : embroideryOnly
    ? "ניתן להוסיף רקמה אישית"
    : "ניתן להוסיף רקמה או חריטה אישית";


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
  // Other models sold under the SAME name. The supplier reuses one generic name
  // across many distinct SKUs, so listings collapse them to a single tile — this
  // rail is where the shopper actually picks between them. Ordered images-first
  // by the RPC.
  const { data: models = [] } = useQuery({
    queryKey: ["product-models", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_product_models", {
        p_product_id: product!.id,
        p_limit: 24,
      });
      if (error) throw error;
      return (data ?? []) as ProductCardData[];
    },
  });

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

  if (isLoading) {
    // Gallery + buy-box skeleton in the real two-column PDP shape, so the page
    // holds its layout instead of collapsing to a single "טוען..." line. Built
    // from the shared CardSkeleton (min-h overridden per slot). aria-hidden on
    // the visual scaffold; the status text stays for assistive tech.
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-10" aria-hidden="true">
          {/* Gallery: square hero + thumbnail strip */}
          <div>
            <CardSkeleton className="aspect-square min-h-0" />
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} className="h-20 w-20 min-h-0 flex-shrink-0" />
              ))}
            </div>
          </div>
          {/* Buy box: title, price, stock chip, short copy, buy row */}
          <div className="space-y-4">
            <CardSkeleton className="h-9 w-3/4 min-h-0" />
            <CardSkeleton className="h-7 w-32 min-h-0" />
            <CardSkeleton className="h-6 w-44 min-h-0" />
            <CardSkeleton className="h-20 w-full min-h-0" />
            <CardSkeleton className="h-12 w-full min-h-0" />
          </div>
        </div>
        <p role="status" className="sr-only">טוען…</p>
      </div>
    );
  }
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
      className="press inline-flex h-11 w-11 items-center justify-center rounded-full border border-input bg-white/70 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
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
  // Pre-sale question — pre-fill what the shopper is actually looking at so the
  // reply lands on the right SKU: the product name, the size they have selected
  // (selectedVariant tracks the currently-shown size), and the personalization
  // text if they have typed one. Details go on their own lines (%0A after
  // encoding) so the message stays readable in WhatsApp.
  const presaleDetails = [
    selectedVariant?.label ? `מידה: ${selectedVariant.label}` : null,
    customText.trim() ? `כיתוב מבוקש: ${customText.trim()}` : null,
  ].filter(Boolean);
  const PRESALE_WA_TEXT =
    `שלום, יש לי שאלה על המוצר "${product.name}".` +
    (presaleDetails.length ? `\n${presaleDetails.join("\n")}` : "");
  // No restock date, no "we'll email you" — only an invitation to ask.
  const RESTOCK_WA_TEXT = `שלום, המוצר "${product.name}" מופיע כאזל באתר. אשמח לבדוק אפשרות לחידוש מלאי או מוצר חלופי.`;
  const contactCtas = (waText: string, compact = false) => (
    <>
      <a
        href={`tel:${CONTACT_TEL}`}
        className={
          // hover:bg-accent/90 composites to 4.66:1 with white and has no
          // headroom; --accent-strong is 7.38:1.
          "press inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-foreground font-semibold [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong " +
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
          // WhatsApp keeps its brand green on the border (#25D366, decorative)
          // but the LABEL moves from #128C7E (4.14:1 on white — fails AA at
          // 14px semibold) to WhatsApp's own dark brand green #075E54, 7.67:1.
          "press inline-flex items-center justify-center gap-2 rounded-md border-2 border-[#25D366] text-[#075E54] font-semibold [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#25D366]/10 " +
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

  // Visible breadcrumb trail — the shared <Breadcrumb> primitive (structured
  // data still comes from the BreadcrumbList JSON-LD in head(), so this carries
  // no microdata). Mirrors that JSON-LD trail: Home → Shop → parent category →
  // category → this product. The category levels appear only when known.
  const breadcrumbItems: BreadcrumbItemData[] = [
    { label: "בית", to: "/" },
    { label: "מוצרים", to: "/shop" },
    ...(parentCategory
      ? [{ label: parentCategory.name, to: "/category/$slug", params: { slug: parentCategory.slug } }]
      : []),
    ...(firstCategory
      ? [{ label: firstCategory.name, to: "/category/$slug", params: { slug: firstCategory.slug } }]
      : []),
    { label: product.name },
  ];

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
  // mobile sticky bar must never drift apart. add() now slides the mini-cart
  // drawer open as the confirmation: it shows every line (including the chosen
  // size and personalization text) with a running subtotal and a direct path to
  // checkout, so the old transient toast — which stranded the shopper once it
  // faded, worst on mobile — is no longer needed.
  function addToCartWithFeedback() {
    if (!product) return;
    addToCart();
  }


  return (
    <div className="container mx-auto px-4 py-10">
      {/* Breadcrumb — shared primitive (visible trail only; JSON-LD lives in head()) */}
      <div className="mb-4">
        <Breadcrumb items={breadcrumbItems} />
      </div>

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
                className="glass glass-gold w-full overflow-hidden"
              >
                <CarouselContent>
                  {gallery.map((url, i) => {
                    // The main slide is the page LCP. When the image is a
                    // Supabase object URL (thumbUrl rewrites it — the SAME guard
                    // the thumbnail strip below relies on), offer a width-capped,
                    // quality-80 srcSet plus the original as the largest
                    // candidate, so phones get a right-sized hero while retina
                    // desktops still pull a sharp one. quality stays at 80 — this
                    // is the hero image, it must not soften. Non-Supabase URLs
                    // fall through untouched on the original.
                    const rendered = thumbUrl(url, 1200, 80);
                    const canTransform = rendered != null && rendered !== url;
                    const mainSrcSet = canTransform
                      ? [
                          ...[600, 900, 1200].map((w) => `${thumbUrl(url, w, 80)} ${w}w`),
                          `${url} 1400w`,
                        ].join(", ")
                      : undefined;
                    return (
                      <CarouselItem key={url}>
                        <div className="aspect-square w-full">
                          <img
                            src={url}
                            srcSet={mainSrcSet}
                            sizes={mainSrcSet ? "(max-width:768px) 100vw, 50vw" : undefined}
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
                    );
                  })}
                </CarouselContent>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    // Sits ON the product image, so it needs the 94%-white
                    // glass, not the 72% one: --accent stays ≥5.1:1 there over
                    // any backdrop.
                    className="glass-strong press absolute bottom-3 left-3 z-10 p-2 cursor-zoom-in [--glass-radius:9999px]"
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
              <DialogContent className="glass-strong border-0 max-w-4xl p-2 [--glass-radius:1.25rem]">
                <DialogTitle className="sr-only">{product.name}</DialogTitle>
                {/* Mounted only while the dialog is open, so startIndex opens on
                    the slide the user was viewing. watchDrag is off: pointer
                    drag/touch pan belongs to the zoom (lens tracking on desktop,
                    scroll-pan on touch), so slide changes go through the arrows. */}
                <Carousel dir="rtl" opts={{ direction: "rtl", loop: true, startIndex: selectedIndex, watchDrag: false }}>
                  <CarouselContent>
                    {gallery.map((url, i) => (
                      <CarouselItem key={url}>
                        <ZoomableImage
                          src={url}
                          alt={`${product.name} — תמונה ${i + 1}`}
                          lensMode={lensMode}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {gallery.length > 1 && (
                    <>
                      <CarouselPrevious className="right-2 top-1/2" />
                      <CarouselNext className="left-2 top-1/2" />
                    </>
                  )}
                </Carousel>
              </DialogContent>
            </Dialog>
          ) : (
            // No image on file: the same branded "אין תמונה" placeholder
            // ProductThumb renders (centered muted label), inside the gallery's
            // glass-gold square — so it reads as "no photo yet", not a broken box.
            <div className="glass glass-gold aspect-square w-full flex items-center justify-center text-muted-foreground text-sm">
              אין תמונה
            </div>
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
              <span className="text-muted-foreground transition-colors duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent">
                {reviewSummary.average} ({reviewSummary.count})
              </span>
            </a>
          )}
          {product.sku && <p className="text-xs text-muted-foreground mb-3">מק״ט: {product.sku}</p>}

          {/* Price block */}
          {isCallOnly ? (
            <div className="glass mb-3 px-4 py-3">
              <div className="text-lg font-bold text-accent">המחיר משתנה לפי שער הזהב היומי</div>
              <div className="text-sm text-foreground mt-1">לקבלת הצעת מחיר עדכנית - צרו קשר בטלפון או בוואטסאפ</div>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
              <span className="text-3xl font-bold text-accent">{formatILS(effective)}</span>
            </div>
          )}

          {/* Personalization differentiator — surfaced above the fold so the one
              thing that sets this store apart is seen with the price, not only
              once the buyer scrolls to the input. Anchor jumps down to the input
              (pure href — SSR-safe, no JS). */}
          {showEmbroidery && (
            <a
              href="#personalization"
              className="press glass mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent [--glass-radius:9999px] [--glass-shadow:0_1px_2px_rgba(22,24,29,0.05)] [@media(hover:hover)_and_(pointer:fine)]:hover:[--glass-bg:rgba(255,255,255,0.94)]"
            >
              ✦ {personalizationChipLabel}
            </a>
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
            {/* Tuned through the glass variables rather than fought with
                utilities — a chip wants a tight radius and a shallow shadow.
                (A literal `none` cannot be one item of a box-shadow LIST; it
                would invalidate the whole declaration and drop the hairline.) */}
            <div className="glass inline-flex items-center gap-1.5 text-sm text-foreground px-2.5 py-1 [--glass-radius:0.625rem] [--glass-shadow:0_1px_2px_rgba(22,24,29,0.05)]">
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
            // scroll-mt keeps the block clear of the sticky header when the
            // above-the-fold chip's #personalization anchor jumps down to it.
            <div id="personalization" className="glass mb-5 p-4 scroll-mt-24">
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
                            // Hot control on the buy path: press feedback only
                            // (transform, 160ms, ease-out via .press) — no
                            // colour animation, per the frequency rule. Hover
                            // is gated to real pointers so touch never sticks.
                            "press flex-1 rounded-md border px-3 py-2 text-sm " +
                            (active
                              ? "border-accent bg-white text-accent font-semibold"
                              : "border-input bg-white/70 text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent")
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
              {/* Live הדמיה — as the buyer types their name it appears on a
                  material swatch (fabric for רקמה/הטבעה, wood for חריטה). The
                  component labels itself clearly as a simulation and reflects the
                  chosen method. It reads state only — the cart payload
                  (customText / customMethod) is unchanged. */}
              <PersonalizationPreview
                text={customText}
                method={customMethod}
                embroideryLabel={embroideryLabel}
              />
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
                          // `disabled:line-through` is a SOLD-OUT SIZE marker,
                          // not a price. It is the one legitimate line-through
                          // on the site — do not remove it.
                          // Motion: .press only (transform / 160ms / ease-out).
                          // Hover is pointer-gated and `enabled:`-scoped, which
                          // removes the old disabled:hover:* neutralisers.
                          "press px-3 py-1.5 rounded-md text-sm disabled:cursor-not-allowed disabled:line-through disabled:opacity-50 " +
                          (isActive
                            ? "border-2 border-accent bg-white text-accent font-semibold"
                            : "border border-input bg-white/70 [@media(hover:hover)_and_(pointer:fine)]:enabled:hover:border-accent")
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
                          className="px-3 py-1.5 rounded-md border-2 border-accent bg-white text-accent text-sm font-semibold"
                        >
                          {v.label}
                        </span>
                      ) : (
                        <Link
                          key={v.id}
                          to="/product/$slug"
                          params={{ slug: v.slug! }}
                          className="press px-3 py-1.5 rounded-md border border-input bg-white/70 text-sm [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent"
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
              <div className="glass p-4 text-sm text-foreground">
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
              {/* --input (3.25:1 on white) is the form-CONTROL boundary token;
                  --border is a decorative 1.25:1 line and fails 1.4.11 here. */}
              <div className="inline-flex items-center overflow-hidden rounded-full border border-input bg-white/70">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="press px-3 py-2 disabled:pointer-events-none disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted" aria-label="הפחת">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-4 font-medium">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="press px-3 py-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted" aria-label="הוסף">
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
                  // "Buy now" goes straight to checkout, so suppress the drawer
                  // that add() opens: openCart() then closeCart() batch in this
                  // one handler, leaving it closed before we navigate.
                  addToCart();
                  closeCart();
                  navigate({ to: "/checkout" });
                }}
                className="gap-2"
              >
                קנה עכשיו
              </Button>
              {favButton}
            </div>
          )}

          {/* At-the-decision reassurance — sits immediately under the buy row so
              the three things that answer a first-time, zero-review buyer's doubt
              are seen WITH the CTA, not scrolled past. Only on purchasable
              products; call-only / out-of-stock surface their own contact CTAs. */}
          {!isCallOnly && canBuy && (
            <div className="mb-3 space-y-2.5">
              {/* WhatsApp concierge — the honest substitute for reviews: a real
                  person answers before you buy. Pre-filled with the exact product,
                  size and personalization the shopper is looking at. */}
              <a
                href={`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(PRESALE_WA_TEXT)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="press glass flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#075E54] [--glass-radius:0.75rem] [@media(hover:hover)_and_(pointer:fine)]:hover:[--glass-bg:rgba(255,255,255,0.94)]"
              >
                <span aria-hidden="true" className="text-base leading-none">💬</span>
                <span>שאלה לפני שקונים? דברו איתנו בוואטסאפ — נענה אישית</span>
              </a>

              {/* 14-day statutory return, surfaced at peak first-purchase anxiety
                  instead of buried in the returns accordion. When the shopper has
                  entered personalization the copy flips to the accordion's caveat
                  (personalized items are excluded) so the two never contradict. */}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5 shrink-0 text-accent" />
                {customText.trim()
                  ? "פריט בהתאמה אישית אינו ניתן להחזרה לפי חוק הגנת הצרכן"
                  : `החזרה תוך ${CONSUMER_POLICY.cancellationDays} יום לפי חוק הגנת הצרכן`}
              </p>

              {/* Gift-intent hint — Judaica skews gift, and the wrap + printed
                  dedication genuinely exist at checkout (free). Informational
                  only: no new gift state is threaded through the cart here. */}
              <p className="text-xs text-muted-foreground">
                🎁 מתנה? בקופה אפשר להוסיף עטיפה והקדשה אישית — ללא עלות
              </p>
            </div>
          )}

          {/* Out of stock is not a dead end: both buy buttons above are
              disabled, so offer the same phone/WhatsApp pair the call-only
              products use. Deliberately promises nothing — no restock date, no
              back-in-stock notification, no claim the item will return. */}
          {!isCallOnly && !canBuy && (
            <div className="mb-3 space-y-3">
              <div className="glass p-4 text-sm text-foreground">
                <strong className="block text-accent mb-1">המוצר אזל כרגע</strong>
                דברו איתנו לבדיקת חידוש מלאי או חלופה מתאימה.
              </div>
              <div className="flex flex-wrap gap-3">{contactCtas(RESTOCK_WA_TEXT)}</div>
            </div>
          )}

          {/* Trust block — the buy/no-buy moment carries the most doubt, and with
              no reviews yet the reassurance has to come from facts the store
              already stands behind. Every line is truthful and store-level (never
              a per-SKU claim): secure Cardcom payment, the statutory 14-day
              cancellation right, home delivery, and the registered seller
              identity. Reuses BUSINESS / CONSUMER_POLICY so the copy can't drift
              from the terms page. */}
          <div className="mt-6 glass p-4">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-foreground/90">
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0 text-accent" />
                תשלום מאובטח בסליקת Cardcom · תקן PCI
              </li>
              <li className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 shrink-0 text-accent" />
                זכות ביטול {CONSUMER_POLICY.cancellationDays} יום לפי חוק הגנת הצרכן
              </li>
              <li className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-accent" />
                משלוח עד הבית לכל רחבי הארץ
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
                כשרות והידור — מתוך מחויבות לאיכות
              </li>
            </ul>
            <div className="mt-3 border-t border-glass-line pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {sellerIdentityLine()}
            </div>
          </div>

          {/* Accordion — one glass pane, hairline dividers between the rows,
              instead of three gold-ruled bands. */}
          <div className="glass mt-8 px-4 md:px-5">
          <Accordion type="single" collapsible defaultValue="desc">
            <AccordionItem value="desc" className="border-glass-line last:border-b-0">
              <AccordionTrigger className="font-display text-base">תיאור המוצר</AccordionTrigger>
              <AccordionContent>
                {product.description ? (
                  <div
                    className="prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
                  />
                ) : (
                  // 142 products have no long description. Rather than omit the
                  // section, build a truthful fallback from facts the page
                  // already holds — the product name, its category, the store's
                  // kashrut/quality stance, and (when applicable) that
                  // personalization is offered. Deliberately generic: it invents
                  // no material, dimension, or availability the DB doesn't have.
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {product.name}
                    {firstCategory ? ` מתוך מבחר ה${firstCategory.name}` : ""} של אור זרוע לצדיק —
                    תשמישי קדושה ויודאיקה הנבחרים בהקפדה על כשרות והידור.
                    {showEmbroidery ? " לפריט זה ניתן להוסיף התאמה אישית (רקמה/חריטה) בעמוד ההזמנה." : ""}
                    {" "}יש לכם שאלה על הפריט? נשמח לעזור בטלפון או בוואטסאפ.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship" className="border-glass-line last:border-b-0">
              <AccordionTrigger className="font-display text-base">משלוחים</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  משלוח עד הבית לכל רחבי הארץ תוך 3–14 ימי עסקים. ניתן גם איסוף עצמי בתיאום מראש.
                  להזמנות דחופות צרו קשר בוואטסאפ ונדאג למשלוח אקספרס.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ret" className="border-glass-line last:border-b-0">
              <AccordionTrigger className="font-display text-base">מדיניות החזרות וביטולים</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ניתן לבטל עסקה בכתב עד 14 ימים מקבלת המוצר, בהתאם לחוק הגנת הצרכן — בהודעה בדוא"ל
                  או דרך{" "}
                  <Link
                    to="/contact"
                    className="text-accent underline underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                  >
                    עמוד יצירת הקשר
                  </Link>
                  . בביטול שאינו עקב פגם ייתכן ניכוי דמי ביטול בשיעור שלא יעלה על
                  5% ממחיר העסקה או 100 ₪, הנמוך מביניהם, והחזר כספי יבוצע תוך 14 ימים מקבלת ההודעה.
                  המוצר יוחזר באריזתו המקורית וללא שימוש. פריטים בהתאמה אישית (רקמה/חריטה) אינם ניתנים לביטול.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          </div>
        </div>
      </div>

      {/* Other models under the same supplier name — the counterpart to the
          "N דגמים" tile in the listings. */}
      {models.length > 0 && (
        <ProductCarousel
          eyebrow="אותו פריט, גוונים ודגמים נוספים"
          heading={`עוד ${models.length} דגמים`}
          items={models}
          itemClassName="basis-1/2 md:basis-1/4 lg:basis-1/5"
        />
      )}

      {/* Cross-sells — one carousel showing every fetched companion */}
      {related.length > 0 && (
        <ProductCarousel
          eyebrow="מוצרים נלווים"
          heading="משלימים את הקנייה"
          items={related}
          itemClassName="basis-1/2 md:basis-1/4 lg:basis-1/5"
        />
      )}

      {/* Same-category recommendations. This is a near-twin of the cross-sell
          rail above (both are "here's more to explore" strips), so on a buyable
          page where the cross-sell rail already fills that slot we DROP this one
          rather than stack two look-alike carousels. It still renders when:
            • the product is out of stock — then this strip IS the way forward
              (show whatever exists; the carousel no-ops on an empty list), or
            • there is no cross-sell rail (related is empty) AND there are ≥4
              same-category items, so the page keeps one healthy discovery strip. */}
      {(!canBuy || (related.length === 0 && similar.length >= 4)) && (
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
      <ProductReviews productId={product.id} initialSummary={reviewSummary} initialReviews={initialReviews} />

      {/* Mobile buy bar. `sticky` (not `fixed`) on purpose: it pins to the
          bottom of the viewport while the page body is in view and then
          retires into the flow at the end of the container, so it can never
          cover the footer. Pure CSS — nothing here touches window/document, so
          it renders identically on the server. */}
      <div className="glass-strong lg:hidden sticky bottom-0 z-40 -mx-4 mt-10 px-4 py-3 [--glass-radius:0] [--glass-shadow-lift:0_-10px_30px_-16px_rgba(22,24,29,0.20)]">
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
              className="flex-1 gap-2"
            >
              <ShoppingCart className="h-4 w-4" /> הוסף לעגלה
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
