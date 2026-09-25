// The homepage loader's half of the reviews strip. Its own module, apart from
// the HomeReviews component, because a route loader ships in the main bundle
// on every page — imported from the component file it dragged the carousel
// (embla) along with it. See src/lib/home-rails.ts for the same split.

import { getRecentApprovedReviews } from "@/lib/reviews.functions";

export type HomeReview = Awaited<ReturnType<typeof getRecentApprovedReviews>>[number];

/**
 * Server-callable form of the `home-reviews` query, for use in a route loader.
 * Components should keep using `useServerFn` (below); this exists so the
 * homepage can resolve the same data during SSR.
 */
export async function fetchHomeReviews(): Promise<HomeReview[]> {
  return await getRecentApprovedReviews();
}
