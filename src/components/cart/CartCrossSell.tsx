import { ProductCard } from "@/components/ProductCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { useCrossSellSuggestions } from "@/components/cart/cross-sell-query";

/**
 * Cross-sell strip — genuine companions from categories related to what's
 * already in the cart, derived from the CROSS_SELL_MAP (e.g. talit → tefillin
 * bag/cover; kiddush cup → challah cover). No scarcity, urgency or discount:
 * just "complete the purchase" suggestions. Empties gracefully (renders nothing)
 * when there aren't at least a few real complements.
 *
 * This is the roomy carousel on the /cart page. The mini-cart drawer's 3-up
 * strip is CartCrossSellCompact; both read the same query (cross-sell-query.ts).
 */
export function CartCrossSell({ productIds }: { productIds: string[] }) {
  const suggestions = useCrossSellSuggestions(productIds);

  if (suggestions.length < 3) return null;

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
