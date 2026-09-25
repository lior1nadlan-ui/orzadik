import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchHomeFeaturedProducts } from "@/lib/home-rails";
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
