// Ecommerce funnel analytics — GA4 (gtag) + Meta Pixel (fbq), fired together.
//
// Until now `purchase` was the ONLY ecommerce event in the app, so GA4 showed
// sessions → (black box) → purchase and the owner could not tell whether
// visitors never add to cart or abandon at checkout. This module fires the
// full funnel: view_item, add_to_cart, view_cart, begin_checkout — each
// mirrored to the Meta Pixel — so the drop-off is finally visible, and the
// already-loaded Google Ads tag can build real audiences.
//
// SAFETY:
//  * Every function no-ops on the server and when neither gtag nor fbq is a
//    function, so it is safe to call from any component without a window guard.
//  * Consent Mode / fbq-consent already decide whether storage is used (see
//    GoogleAnalytics.tsx / MetaPixel.tsx). Sending an event before consent is
//    harmless — Google/Meta buffer it under the "denied" default and only
//    activate storage once the visitor grants it. So we do NOT gate on consent
//    here; that would drop events for users who never open the banner.
//  * Read-only price import (getEffectivePrice) — this module never computes or
//    charges anything. It reports the SAME effective price the customer sees.

import { getEffectivePrice } from "@/lib/pricing";

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

function tags(): { gtag?: Gtag; fbq?: Fbq } {
  if (typeof window === "undefined") return {};
  const w = window as unknown as { gtag?: Gtag; fbq?: Fbq };
  return {
    gtag: typeof w.gtag === "function" ? w.gtag : undefined,
    fbq: typeof w.fbq === "function" ? w.fbq : undefined,
  };
}

/** One product, as the funnel events describe it. */
export type AnalyticsProduct = {
  id: string;
  name: string;
  /** Base catalog price; the effective (charged) price is derived here. */
  price: number;
  quantity?: number;
  category?: string | null;
};

/** GA4 items[] entry. */
function ga4Item(p: AnalyticsProduct) {
  return {
    item_id: p.id,
    item_name: p.name,
    price: getEffectivePrice(Number(p.price) || 0),
    quantity: p.quantity ?? 1,
    ...(p.category ? { item_category: p.category } : {}),
  };
}

/** Sum of effective line prices — the `value` every event carries. */
function totalValue(products: AnalyticsProduct[]): number {
  return products.reduce(
    (s, p) => s + getEffectivePrice(Number(p.price) || 0) * (p.quantity ?? 1),
    0,
  );
}

function fbqContents(products: AnalyticsProduct[]) {
  return products.map((p) => ({
    id: p.id,
    quantity: p.quantity ?? 1,
    item_price: getEffectivePrice(Number(p.price) || 0),
  }));
}

/** Product-detail view. GA4 view_item ↔ Meta ViewContent. */
export function trackViewItem(p: AnalyticsProduct) {
  const { gtag, fbq } = tags();
  if (!gtag && !fbq) return;
  const value = totalValue([p]);
  gtag?.("event", "view_item", { currency: "ILS", value, items: [ga4Item(p)] });
  fbq?.("track", "ViewContent", {
    content_type: "product",
    content_ids: [p.id],
    content_name: p.name,
    currency: "ILS",
    value,
  });
}

/** Add to cart. GA4 add_to_cart ↔ Meta AddToCart. */
export function trackAddToCart(p: AnalyticsProduct) {
  const { gtag, fbq } = tags();
  if (!gtag && !fbq) return;
  const value = totalValue([p]);
  gtag?.("event", "add_to_cart", { currency: "ILS", value, items: [ga4Item(p)] });
  fbq?.("track", "AddToCart", {
    content_type: "product",
    content_ids: [p.id],
    content_name: p.name,
    contents: fbqContents([p]),
    currency: "ILS",
    value,
  });
}

/** Cart view. GA4 view_cart (no standard Meta equivalent). */
export function trackViewCart(products: AnalyticsProduct[]) {
  const { gtag } = tags();
  if (!gtag || products.length === 0) return;
  gtag("event", "view_cart", {
    currency: "ILS",
    value: totalValue(products),
    items: products.map(ga4Item),
  });
}

/** Checkout start. GA4 begin_checkout ↔ Meta InitiateCheckout. */
export function trackBeginCheckout(products: AnalyticsProduct[]) {
  const { gtag, fbq } = tags();
  if ((!gtag && !fbq) || products.length === 0) return;
  const value = totalValue(products);
  gtag?.("event", "begin_checkout", {
    currency: "ILS",
    value,
    items: products.map(ga4Item),
  });
  fbq?.("track", "InitiateCheckout", {
    content_type: "product",
    content_ids: products.map((p) => p.id),
    contents: fbqContents(products),
    num_items: products.reduce((n, p) => n + (p.quantity ?? 1), 0),
    currency: "ILS",
    value,
  });
}

/**
 * Site search. GA4 `search` + `view_search_results` ↔ Meta `Search`.
 *
 * Fired at two moments (see SiteHeader overlay submit + /shop query settle):
 * when the visitor submits a term, and once per settled results query. The
 * `count` is the number of results the query returned and is ALWAYS reported —
 * including `count === 0`. A zero-result term is the highest-signal input the
 * catalog can get (an unmet demand or a naming gap), so it must not be dropped.
 *
 * No-ops on the server and when neither gtag nor fbq is present, like every
 * other tracker here. An empty term is ignored (nothing was actually searched).
 */
export function trackSearch(term: string, count: number) {
  const { gtag, fbq } = tags();
  if (!gtag && !fbq) return;
  const search_term = term.trim();
  if (!search_term) return;
  // 0 is a legitimate, meaningful count — only a non-finite value is dropped.
  const results = Number.isFinite(count) ? count : undefined;

  gtag?.("event", "search", { search_term });
  gtag?.("event", "view_search_results", {
    search_term,
    ...(results !== undefined ? { results_count: results } : {}),
  });
  fbq?.("track", "Search", {
    search_string: search_term,
    ...(results !== undefined ? { results_count: results } : {}),
  });
}
