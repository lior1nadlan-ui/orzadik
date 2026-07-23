import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
  });

  return router;
};
