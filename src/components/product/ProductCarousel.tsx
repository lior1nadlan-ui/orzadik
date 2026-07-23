import { ProductCard, ProductCardData } from "@/components/ProductCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Shared "carousel of product cards" section — used for the cross-sell strip
// ("משלימים את הקנייה") and the same-category strip ("מוצרים דומים").
export function ProductCarousel({
  items,
  heading,
  eyebrow,
  itemClassName = "basis-1/2 md:basis-1/4",
}: {
  items: ProductCardData[];
  heading: string;
  eyebrow?: string;
  itemClassName?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-14">
      <div className="flex items-end justify-between pb-3">
        <div>
          {eyebrow && (
            <p className="text-[11px] tracking-[0.25em] text-accent uppercase font-semibold mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
            {heading}
          </h2>
        </div>
      </div>
      {/* Precise gold hairline instead of a solid gold border — decorative, and
          the only gold that is allowed to be this light. */}
      <div className="gold-rule mb-5" aria-hidden="true" />
      <Carousel dir="rtl" opts={{ direction: "rtl", align: "start", dragFree: true }}>
        <CarouselContent>
          {items.map((p) => (
            <CarouselItem key={p.id} className={itemClassName}>
              <ProductCard p={p} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="right-2 top-1/2 hidden md:inline-flex" />
        <CarouselNext className="left-2 top-1/2 hidden md:inline-flex" />
      </Carousel>
    </section>
  );
}
