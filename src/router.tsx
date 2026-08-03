import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ProductGridSkeleton } from "@/components/Skeletons";

/**
 * What a route paints while its loader is in flight.
 *
 * Measured before this existed: with Supabase responses delayed 2.5s, a tap on
 * a category tile left the PREVIOUS page on screen — fully interactive, fully
 * wrong — for the whole round trip, with no spinner, no skeleton and no
 * indication anything had happened. On a real cellular connection that is the
 * gap between "this site is broken" and "this site is loading", and it is the
 * gap on every navigation on the site, because no route declared a
 * pendingComponent and the router had no default.
 *
 * The shell is deliberately the shapes the destination is most likely to be:
 * every high-traffic route on this site (/shop, /category/$slug, /collection,
 * /favorites) resolves to a product grid, so ProductGridSkeleton — the SAME
 * component those routes already show for their own loading states — is what
 * appears, and the real grid drops into the same columns with no reflow. The
 * heading block above it reserves the h1/rule the page will paint. Everything
 * here is a placeholder, so the whole block is aria-hidden and a live region
 * carries the only thing a screen reader needs: that something is loading.
 */
function RoutePending() {
  return (
    <div className="container mx-auto px-4 py-14 md:py-20">
      <span className="sr-only" role="status" aria-live="polite">
        טוען…
      </span>
      <div aria-hidden="true">
        <div className="text-center mb-10 md:mb-14">
          <div className="mx-auto h-8 w-56 rounded-md bg-muted animate-pulse" />
          <span className="gold-rule block w-24 mx-auto mt-4" />
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Product/category data changes infrequently; avoid refetching on every
        // window focus or remount. 60s keeps data fresh enough for a catalog
        // while cutting redundant Supabase round-trips.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch a route's code+data as soon as the pointer/focus lands on a
    // Link. On a catalog this size the click-to-paint gap is dominated by the
    // product-page chunk plus its Supabase round trip, and hovering is a
    // reliable intent signal. defaultPreloadStaleTime stays 0 so the prefetched
    // data is still revalidated on navigation — we buy latency, not staleness.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // 150ms, not 0: preloading (above) already resolves a large share of
    // navigations in well under that, and flashing a skeleton over a load that
    // was about to finish reads as a stutter. Anything slower than 150ms is a
    // load the shopper has already noticed.
    defaultPendingMs: 150,
    // Once the skeleton IS shown it stays for at least 400ms. Without a floor,
    // a load that resolves at 160ms paints the shell for one frame — the exact
    // flicker defaultPendingMs exists to avoid, moved 150ms later.
    defaultPendingMinMs: 400,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
