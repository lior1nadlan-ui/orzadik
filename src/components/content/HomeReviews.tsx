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
      <section aria-hidden="true" className={`bg-background${RESERVED_HEIGHT}`} />
    ) : null;
  }

  return (
    <section className={`bg-background${reserveSpace ? RESERVED_HEIGHT : ""}`}>
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
            <span className="h-px w-10 bg-accent/40" />
            <span className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase">
              לקוחות ממליצים
            </span>
            <span className="h-px w-10 bg-accent/40" />
          </div>
          <h2 className="font-display text-2xl md:text-4xl tracking-wide">
            מה הלקוחות שלנו מספרים
          </h2>
        </div>

        <Carousel dir="rtl" opts={{ align: "start", direction: "rtl" }} className="max-w-6xl mx-auto">
          <CarouselContent>
            {reviews.map((r) => (
              <CarouselItem key={r.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                <div className="rounded-2xl border border-accent/20 bg-background p-6 h-full flex flex-col">
                  <Stars value={r.rating} />
                  {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-4 flex-1">
                    {r.body}
                  </p>
                  <div className="mt-4 pt-4 border-t border-accent/10">
                    <p className="font-medium">{r.author_name}</p>
                    {r.products && (
                      <Link
                        to="/product/$slug"
                        params={{ slug: r.products.slug }}
                        className="text-sm text-accent hover:underline"
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
