import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";

/** Rescue strip for the empty cart — suggests products so the page isn't a dead end. */
export function EmptyCartSuggestions() {
  const { data: suggestions = [] } = useQuery({
    queryKey: ["empty-cart-suggestions"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", DEFAULT_CROSS_SELL_CATEGORY)
        .maybeSingle();
      if (!cat?.id) return [] as ProductCardData[];

      const { data, error } = await supabase
        .from("product_categories")
        .select(
          "products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status)",
        )
        .eq("category_id", cat.id)
        .limit(12);
      if (error) throw error;

      const out: ProductCardData[] = [];
      for (const r of data ?? []) {
        const p: any = (r as any).products;
        if (!p?.is_active || !p.thumbnail_url || p.stock_status === "outofstock") continue;
        out.push(p);
        if (out.length >= 10) break;
      }
      return out;
    },
  });

  if (suggestions.length < 4) return null;

  return (
    <div className="mt-12">
      <h2 className="font-display text-xl md:text-2xl font-bold text-center">אולי יעניין אתכם</h2>
      {/* Decorative gold hairline under the section head. */}
      <div className="gold-rule mx-auto mb-6 mt-3 w-24" aria-hidden="true" />
      <Carousel opts={{ direction: "rtl", align: "start" }} dir="rtl">
        <CarouselContent>
          {suggestions.map((p) => (
            <CarouselItem key={p.id} className="basis-1/2 md:basis-1/4">
              <ProductCard p={p} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Shared RTL-aware arrows (prev on the RIGHT) — never hand-rolled. */}
        <CarouselPrevious className="press right-2 hidden md:inline-flex" />
        <CarouselNext className="press left-2 hidden md:inline-flex" />
      </Carousel>
    </div>
  );
}
