import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

/**
 * A section that swipes on a phone and lays out as a normal grid on desktop.
 *
 * Why not "render a carousel and a grid and hide one with CSS": that ships the
 * same content twice in the DOM. Screen readers read it twice and crawlers see
 * duplicated markup. Instead this renders ONE tree and uses Embla's own
 * `breakpoints` to switch itself off at md — an inactive Embla applies no
 * transform and leaves the track as a plain flex container, which the md:
 * classes below then restyle into a grid.
 *
 * RTL is inherited from the shared ui/carousel: `dir="rtl"` plus
 * `opts.direction:"rtl"` give a right-edge "previous" control and swapped
 * arrow keys. Never hand-roll the arrows.
 */
export function MobileCarousel({
  children,
  /** Slide width on phones. Two-up by default; use "basis-4/5" for wide cards. */
  basis = "basis-1/2",
  /** Grid the content becomes from md upward. */
  mdGrid = "md:grid-cols-3",
  /** Gap used in the desktop grid (the carousel always uses the 1rem gutter). */
  mdGap = "md:gap-6",
  className,
}: {
  children: React.ReactNode[];
  basis?: string;
  mdGrid?: string;
  mdGap?: string;
  className?: string;
}) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <Carousel
      dir="rtl"
      className={className}
      opts={{
        direction: "rtl",
        align: "start",
        dragFree: true,
        // Below md this is a real carousel; from md up Embla deactivates and
        // the track becomes the grid described by mdGrid/mdGap.
        breakpoints: { "(min-width: 768px)": { active: false } },
      }}
    >
      <CarouselContent className={cn("md:m-0 md:grid", mdGrid, mdGap)}>
        {items.map((child, i) => (
          <CarouselItem key={i} className={cn(basis, "md:basis-auto md:pl-0")}>
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      {/* No arrow buttons: below md the interaction is a swipe, and from md up
          this is a grid with nothing to scroll. */}
    </Carousel>
  );
}
