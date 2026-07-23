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
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";

/** Cross-sell strip under the cart items — companions from related categories. */
export function CartCrossSell({ productIds }: { productIds: string[] }) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ["cart-cross-sell", productIds.slice().sort().join(",")],
    enabled: productIds.length > 0,
    queryFn: async () => {
      // 1) Category slugs the cart products already belong to
      const { data: cartCats } = await supabase
        .from("product_categories")
        .select("categories(slug)")
        .in("product_id", productIds);
      const cartSlugs = new Set<string>();
      for (const r of (cartCats ?? [])) {
        const s = (r as any).categories?.slug;
        if (s) cartSlugs.add(s);
      }

      // 2) Union of cross-sell targets for those categories
      const crossSlugs = new Set<string>();
      for (const s of cartSlugs) {
        for (const t of (CROSS_SELL_MAP[s] ?? [])) crossSlugs.add(t);
      }
      // 3) Don't suggest categories the cart items are already in
      for (const s of cartSlugs) crossSlugs.delete(s);
      const targetSlugs = crossSlugs.size > 0
        ? Array.from(crossSlugs)
        : [DEFAULT_CROSS_SELL_CATEGORY];

      // 4) Resolve target slugs → category IDs, then fetch companions
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug")
        .in("slug", targetSlugs);
      const targetIds = (cats ?? []).map((c: any) => c.id);
      if (targetIds.length === 0) return [] as ProductCardData[];

      const { data, error } = await supabase
        .from("product_categories")
        .select("products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status)")
        .in("category_id", targetIds)
        .limit(40);
      if (error) throw error;

      const inCart = new Set(productIds);
      const seen = new Set<string>();
      const out: ProductCardData[] = [];
      for (const r of (data ?? [])) {
        const p: any = (r as any).products;
        if (!p?.is_active || !p.thumbnail_url || p.stock_status === "outofstock") continue;
        if (inCart.has(p.id)) continue;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
        if (out.length >= 8) break;
      }
      return out;
    },
  });

  if (suggestions.length < 3) return null;

  return (
    <div className="mt-8">
      <h2 className="font-display text-lg md:text-xl font-bold">משלימים את ההזמנה</h2>
      <p className="text-sm text-muted-foreground mb-4">
        המשלוח קבוע לכל ההזמנה — מוצר נוסף לא מעלה את דמי המשלוח
      </p>
      <Carousel opts={{ direction: "rtl", align: "start" }} dir="rtl">
        <CarouselContent>
          {suggestions.map((p) => (
            <CarouselItem key={p.id} className="basis-1/2 md:basis-1/4">
              <ProductCard p={p} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="right-2 hidden md:inline-flex" />
        <CarouselNext className="left-2 hidden md:inline-flex" />
      </Carousel>
    </div>
  );
}
