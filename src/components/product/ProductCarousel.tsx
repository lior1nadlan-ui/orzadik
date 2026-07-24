import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { SectionHeader } from "@/components/home/SectionHeader";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Shared "carousel of product cards" section — used for the cross-sell strip
// ("משלימים את הקנייה") and the same-category strip ("מוצרים דומים").
//
// The header is routed through the shared <SectionHeader> (the same primitive
// the homepage rails consume via FeaturedProductsCarousel) so the eyebrow
// tracking, display size and centered gold rule match the rest of the site
// instead of a hand-rolled, left-aligned, differently-tracked copy. It renders
// an <h2>, so it never collides with the page's single <h1>.
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
      {/* SectionHeader owns the eyebrow → title → gold-rule block (centered),
          matching the homepage product rail. Every call site passes an eyebrow;
          the fallback keeps the primitive's required prop satisfied. */}
      <SectionHeader eyebrow={eyebrow ?? ""} title={heading} />
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
