// The cross-sell query shared by the /cart carousel (CartCrossSell) and the
// mini-cart strip (CartCrossSellCompact). One react-query key, so the drawer
// reuses whatever the cart page already fetched (and vice-versa) instead of
// issuing a second read.
//
// Its own module so the mini-cart — which ships in the main bundle on every
// page — can use it without importing the carousel the /cart page renders.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductCardData } from "@/components/ProductCard";
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";

export function useCrossSellSuggestions(productIds: string[]): ProductCardData[] {
  const { data = [] } = useQuery({
    queryKey: ["cart-cross-sell", productIds.slice().sort().join(",")],
    enabled: productIds.length > 0,
    // The suggestion set only shifts when the cart's contents change (which
    // already re-keys the query), so hold it for a few minutes — reopening the
    // drawer shouldn't refetch the same companions.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // 1) Category slugs the cart products already belong to
      const { data: cartCats } = await supabase
        .from("product_categories")
        .select("categories(slug)")
        .in("product_id", productIds);
      const cartSlugs = new Set<string>();
      for (const r of cartCats ?? []) {
        const s = (r as any).categories?.slug;
        if (s) cartSlugs.add(s);
      }

      // 2) Union of cross-sell targets for those categories
      const crossSlugs = new Set<string>();
      for (const s of cartSlugs) {
        for (const t of CROSS_SELL_MAP[s] ?? []) crossSlugs.add(t);
      }
      // 3) Don't suggest categories the cart items are already in
      for (const s of cartSlugs) crossSlugs.delete(s);
      const targetSlugs =
        crossSlugs.size > 0 ? Array.from(crossSlugs) : [DEFAULT_CROSS_SELL_CATEGORY];

      // 4) Resolve target slugs → category IDs, then fetch companions
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug")
        .in("slug", targetSlugs);
      const targetIds = (cats ?? []).map((c: any) => c.id);
      if (targetIds.length === 0) return [] as ProductCardData[];

      const { data, error } = await supabase
        .from("product_categories")
        .select(
          "products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status)",
        )
        .in("category_id", targetIds)
        .limit(40);
      if (error) throw error;

      const inCart = new Set(productIds);
      const seen = new Set<string>();
      const out: ProductCardData[] = [];
      for (const r of data ?? []) {
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

  return data;
}
