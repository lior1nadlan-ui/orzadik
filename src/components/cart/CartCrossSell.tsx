import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { ProductThumb } from "@/components/ProductThumb";
import { formatILS, getEffectivePrice } from "@/lib/cart";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { CROSS_SELL_MAP, DEFAULT_CROSS_SELL_CATEGORY } from "@/lib/cross-sells";

/**
 * Cross-sell strip — genuine companions from categories related to what's
 * already in the cart, derived from the CROSS_SELL_MAP (e.g. talit → tefillin
 * bag/cover; kiddush cup → challah cover). No scarcity, urgency or discount:
 * just "complete the purchase" suggestions. Empties gracefully (renders nothing)
 * when there aren't at least a few real complements.
 *
 *   variant="full"    — the roomy carousel on the /cart page.
 *   variant="compact" — a 3-up thumbnail strip for the mini-cart drawer, sized
 *                       for the narrow panel and placed above the checkout CTA.
 *
 * Both variants share ONE react-query key, so the drawer reuses whatever the
 * cart page already fetched (and vice-versa) instead of issuing a second read.
 */
export function CartCrossSell({
  productIds,
  variant = "full",
  onNavigate,
}: {
  productIds: string[];
  variant?: "full" | "compact";
  /** Fired when a compact suggestion is tapped — lets the drawer close itself. */
  onNavigate?: () => void;
}) {
  const { data: suggestions = [] } = useQuery({
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

  // Compact strip for the mini-cart drawer: a 3-up row of small tiles that link
  // to the product page (the drawer stays the checkout surface — we don't add to
  // cart from here). Sits between the order total and the checkout button.
  if (variant === "compact") {
    return (
      <div className="mt-4 border-t border-glass-line pt-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">מומלץ להשלמה</p>
        <div className="grid grid-cols-3 gap-2">
          {suggestions.slice(0, 3).map((p) => {
            const effective = getEffectivePrice(p.price);
            return (
              <Link
                key={p.id}
                to="/product/$slug"
                params={{ slug: p.slug }}
                onClick={onNavigate}
                className="group/cs block text-center"
                aria-label={p.name}
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-glass-line">
                  <ProductThumb
                    url={p.thumbnail_url}
                    alt={p.name}
                    width={200}
                    className="h-full w-full object-cover transition-[transform,scale] duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/cs:scale-105"
                  />
                </div>
                <div className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-foreground transition-colors duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover/cs:text-accent">
                  {p.name}
                </div>
                {effective > 0 && (
                  <div className="text-xs font-bold text-accent">{formatILS(effective)}</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="font-display text-lg md:text-xl font-bold">מומלץ להשלמה</h2>
      <p className="text-sm text-muted-foreground">
        המשלוח קבוע לכל ההזמנה — מוצר נוסף לא מעלה את דמי המשלוח
      </p>
      {/* Decorative gold hairline under the section head. */}
      <div className="gold-rule mb-5 mt-3" aria-hidden="true" />
      <Carousel opts={{ direction: "rtl", align: "start" }} dir="rtl">
        <CarouselContent>
          {suggestions.map((p) => (
            <CarouselItem key={p.id} className="basis-1/2 md:basis-1/4">
              <ProductCard p={p} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Shared RTL-aware arrows (prev on the RIGHT) — side, icon and keyboard
            handling stay in ui/carousel; only the edge offset is set here. */}
        <CarouselPrevious className="press right-2 hidden md:inline-flex" />
        <CarouselNext className="press left-2 hidden md:inline-flex" />
      </Carousel>
    </div>
  );
}
