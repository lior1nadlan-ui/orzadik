import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
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
 *   <768px 744 · 768–1279px 817 · >=1280px 885
 * Only used when the caller asks for it — see `reserveSpace`.
 */
const RESERVED_HEIGHT = " min-h-[750px] md:min-h-[820px] xl:min-h-[890px]";

/**
 * The query behind "חדש באתר". Exported so a route loader can run it on the
 * server and hand the result back as `initialProducts` — same function, same
 * shape, so the SSR HTML and the client refetch can never disagree.
 */
export async function fetchHomeFeaturedProducts(): Promise<ProductCardData[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, price, sale_price, thumbnail_url, stock_status")
    .eq("is_active", true)
    .neq("stock_status", "outofstock")
    .not("thumbnail_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as ProductCardData[];
}

/**
 * "חדש באתר" — the newest in-stock products with images, rendered as a
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
    <section className={sectionClass}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-14">
          <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-3">
            הגיע עכשיו
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-wide">
            חדש באתר
          </h2>
          <span aria-hidden="true" className="block h-px w-24 mx-auto mt-4 bg-[image:var(--gradient-gold-line)]" />
        </div>

        <Carousel dir="rtl" opts={{ direction: "rtl", align: "start" }} className="px-2">
          <CarouselContent>
            {products.map((p) => (
              <CarouselItem key={p.id} className="basis-1/2 md:basis-1/3 lg:basis-1/4">
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
            className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-accent"
          >
            לכל המוצרים ←
          </Link>
        </div>
      </div>
    </section>
  );
}
