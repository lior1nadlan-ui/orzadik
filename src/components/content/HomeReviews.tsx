import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Stars } from "@/components/Stars";
import { SectionHeader } from "@/components/home/SectionHeader";
import { getRecentApprovedReviews } from "@/lib/reviews.functions";

export type HomeReview = Awaited<ReturnType<typeof getRecentApprovedReviews>>[number];

/** Below this the strip reads as "nobody reviewed us" rather than social proof. */
const MIN_REVIEWS = 3;

/**
 * Height of the populated section (header + one row of review cards). Only
 * used when the caller asks for it — see `reserveSpace`.
 */
const RESERVED_HEIGHT = " min-h-[500px] md:min-h-[560px]";

/**
 * Server-callable form of the `home-reviews` query, for use in a route loader.
 * Components should keep using `useServerFn` (below); this exists so the
 * homepage can resolve the same data during SSR.
 */
export async function fetchHomeReviews(): Promise<HomeReview[]> {
  return await getRecentApprovedReviews();
}

/**
 * Homepage social-proof carousel fed by real approved reviews.
 * Renders nothing while the reviews feature is still sparse (fewer than 3
 * approved reviews with a body).
 *
 * Pass `initialReviews` (from a route loader) so that decision is made on the
 * server and the section is either in the initial HTML or absent for good.
 * `reserveSpace` is for the case where that loader fetch failed: the gate then
 * resolves after hydration, so the section holds its height rather than
 * injecting itself mid-page.
 */
export function HomeReviews({
  initialReviews,
  reserveSpace = false,
}: {
  initialReviews?: HomeReview[];
  reserveSpace?: boolean;
}) {
  const load = useServerFn(getRecentApprovedReviews);
  const { data } = useQuery({
    queryKey: ["home-reviews"],
    // Seeded from the SSR loader when the caller has it; the query still
    // refetches on its own schedule.
    initialData: initialReviews,
    queryFn: () => load(),
  });

  const reviews = data ?? [];

  if (reviews.length < MIN_REVIEWS) {
    // With SSR data the server already knows there is nothing to show, so the
    // section simply never exists and cannot appear later. Only the degraded
    // path holds space open for a result that is still in flight.
    return reserveSpace ? (
      <section aria-hidden="true" className={RESERVED_HEIGHT.trim()} />
    ) : null;
  }

  return (
    // No opaque section fill — the page's own white glass mesh is the ground.
    <section className={reserveSpace ? RESERVED_HEIGHT.trim() : undefined}>
      <div className="container mx-auto px-4 py-14 md:py-20">
        <SectionHeader eyebrow="לקוחות ממליצים" title="מה הלקוחות שלנו מספרים" />

        <Carousel dir="rtl" opts={{ align: "start", direction: "rtl" }} className="max-w-6xl mx-auto">
          <CarouselContent>
            {reviews.map((r) => (
              <CarouselItem key={r.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                {/* Embla's viewport is overflow-hidden, so the default wide glass
                    shadow would be sliced off at the strip's edges — the panel is
                    retuned through its own variable rather than fought with a
                    utility (see the override contract in styles.css). */}
                <div className="glass p-6 h-full flex flex-col [--glass-radius:1rem] [--glass-shadow:var(--shadow-card)]">
                  <Stars value={r.rating} />
                  {r.title && <p className="mt-3 font-semibold text-foreground">{r.title}</p>}
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-4 flex-1">
                    {r.body}
                  </p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="font-medium text-foreground">{r.author_name}</p>
                    {r.products && (
                      <Link
                        to="/product/$slug"
                        params={{ slug: r.products.slug }}
                        className="text-sm text-accent underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                      >
                        לצפייה במוצר: {r.products.name}
                      </Link>
                    )}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* RTL side + arrow icon come from the carousel component; only the edge offset is tuned here */}
          <CarouselPrevious className="right-0 -translate-y-1/2 hidden md:inline-flex" />
          <CarouselNext className="left-0 -translate-y-1/2 hidden md:inline-flex" />
        </Carousel>
      </div>
    </section>
  );
}
