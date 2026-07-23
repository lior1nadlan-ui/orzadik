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

/**
 * "חדש באתר" — the newest in-stock products with images, rendered as a
 * swipeable RTL carousel of buyable ProductCards.
 */
export function FeaturedProductsCarousel() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["home-featured-products"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProductCardData[]> => {
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
    },
  });

  // Skip rendering until there is enough to fill the strip — avoids layout jank.
  if (isLoading || !products || products.length < 4) return null;

  return (
    <section className="py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-14">
          <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
            <span className="h-px w-10 bg-accent/40" />
            <span className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase">
              הגיע עכשיו
            </span>
            <span className="h-px w-10 bg-accent/40" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl tracking-wide">
            חדש באתר
          </h2>
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
