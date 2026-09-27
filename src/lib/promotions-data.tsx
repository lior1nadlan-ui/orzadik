// Where the storefront gets its promotions from, and how every component reads
// them. The pure math is in promotions.ts; this module is the I/O and React
// glue around it.
//
// Flow: the root loader calls fetchPromoPayload() during SSR, so the first
// paint already carries promotional prices (no regular→promo flash, and
// crawlers see the real price). PromoProvider seeds a React Query entry with
// it and refreshes it every few minutes; every price component reads the index
// from context. Nothing here ever throws: when the RPC fails the site shows
// regular prices — and placeOrder, which reads promotions itself, refuses to
// charge more than the page showed.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  compactPromoRows,
  indexFromPayload,
  priceView,
  promoFor,
  promoHeadline,
  EMPTY_PROMO_INDEX,
  EMPTY_PROMO_PAYLOAD,
  type PriceView,
  type PromoHeadline,
  type PromoIndex,
  type PromoPayload,
} from "@/lib/promotions";

export const PROMO_QUERY_KEY = ["promo-index"] as const;

// A Worker isolate serves many requests, so an SSR render does not have to pay
// a round trip for promotions every time. A minute is also how long a started
// or ended promotion may take to reach a page, which docs/promotions-wave.md
// promises the owner.
const SERVER_TTL_MS = 60_000;
let serverCache: { at: number; payload: PromoPayload } | null = null;

/**
 * Read the live promotions. THROWS on failure — for React Query, which then
 * keeps the last good copy instead of replacing it with nothing (a failed
 * background refresh must not strip promotional prices off an open page).
 * Loaders use loadPromoPayload below, which never throws.
 */
export async function fetchPromoPayload(): Promise<PromoPayload> {
  const onServer = typeof window === "undefined";
  if (onServer && serverCache && Date.now() - serverCache.at < SERVER_TTL_MS) {
    return serverCache.payload;
  }
  const { data, error } = await supabase.rpc("active_promotion_index");
  if (error) throw error;
  const payload = compactPromoRows(data);
  if (onServer) serverCache = { at: Date.now(), payload };
  return payload;
}

/**
 * For route loaders: the live promotions, or none. A page must render even when
 * the promotions read fails — at regular prices, which placeOrder can only
 * lower, never raise, relative to what was shown.
 */
export async function loadPromoPayload(): Promise<PromoPayload> {
  try {
    return await fetchPromoPayload();
  } catch (e) {
    console.warn("[promotions] index unavailable, showing regular prices:", e);
    return serverCache?.payload ?? EMPTY_PROMO_PAYLOAD;
  }
}

/**
 * loadPromoPayload for a route that runs on client navigation too: in the
 * browser PromoProvider already holds a fresh copy, so reuse it instead of a
 * round trip per page view.
 */
export async function loadPromoPayloadCached(qc: QueryClient | undefined): Promise<PromoPayload> {
  if (qc && typeof window !== "undefined") {
    const cached = qc.getQueryData<PromoPayload>(PROMO_QUERY_KEY);
    if (cached) return cached;
  }
  return loadPromoPayload();
}

const PromoCtx = createContext<PromoIndex>(EMPTY_PROMO_INDEX);
const HeadlineCtx = createContext<PromoHeadline | null>(null);

export function PromoProvider({
  seed,
  children,
}: {
  seed: PromoPayload | undefined;
  children: ReactNode;
}) {
  const { data } = useQuery({
    queryKey: PROMO_QUERY_KEY,
    queryFn: fetchPromoPayload,
    initialData: seed ?? EMPTY_PROMO_PAYLOAD,
    staleTime: 60_000,
    // Promotions start and end on their own; a tab left open on a product page
    // should notice within a few minutes, without hammering the database.
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const index = useMemo(() => indexFromPayload(data), [data]);
  const headline = useMemo(() => promoHeadline(data), [data]);
  return (
    <PromoCtx.Provider value={index}>
      <HeadlineCtx.Provider value={headline}>{children}</HeadlineCtx.Provider>
    </PromoCtx.Provider>
  );
}

export function usePromoIndex(): PromoIndex {
  return useContext(PromoCtx);
}

/** The live promotions in one line's worth — for the strip. Null = none. */
export function usePromoHeadline(): PromoHeadline | null {
  return useContext(HeadlineCtx);
}

/** The price view for one product — what every price on the site renders from. */
export function usePriceView(productId: string | null | undefined, price: number): PriceView {
  const index = usePromoIndex();
  return priceView(price, promoFor(index, productId));
}

/**
 * The cart and the checkout are where a stale promotion costs money, so they
 * refresh the index when they open instead of trusting a copy up to five
 * minutes old.
 */
export function useRefreshPromotionsOnMount() {
  const qc = useQueryClient();
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: PROMO_QUERY_KEY });
  }, [qc]);
}
