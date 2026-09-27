// CRM promotions ("מבצעים") — the one place promotion math lives, imported by
// the storefront (every price a shopper sees), placeOrder (the charge) and
// /feed.xml. Like pricing.ts it must stay free of client- or server-only
// imports so it runs in both. See docs/promotions-wave.md.
//
// The model: a promotion is an EXTRA percentage off the price the site already
// charges (getEffectivePrice). The database decides which promotion is live for
// which product — active_promotion_index() returns one row per product plus at
// most one store-wide row — and this module turns those rows into prices.
import { getEffectivePrice, isSellablePrice } from "@/lib/pricing";

/** One row of active_promotion_index(). `product_id` null = the whole store. */
export type PromoRow = {
  product_id: string | null;
  promotion_id: string;
  percent_off: number | string;
  badge_label: string | null;
  ends_at: string;
};

export type ActivePromo = {
  id: string;
  /** The configured percentage, 0 < p <= 70. */
  percentOff: number;
  /** Optional public label ("מבצע חנוכה"). */
  label: string | null;
  /** ISO timestamp — shown to shoppers as the end date. */
  endsAt: string;
};

/** What the storefront and the server look promotions up in. */
export type PromoIndex = {
  all: ActivePromo | null;
  byProduct: Record<string, ActivePromo>;
};

export const EMPTY_PROMO_INDEX: PromoIndex = { all: null, byProduct: {} };

function toPromo(r: PromoRow): ActivePromo | null {
  const pct = Number(r.percent_off);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 70) return null;
  return { id: r.promotion_id, percentOff: pct, label: r.badge_label || null, endsAt: r.ends_at };
}

/** Build the lookup from the RPC rows. Malformed rows are dropped, never trusted. */
export function buildPromoIndex(rows: readonly PromoRow[] | null | undefined): PromoIndex {
  const index: PromoIndex = { all: null, byProduct: {} };
  for (const r of rows ?? []) {
    const promo = toPromo(r);
    if (!promo) continue;
    if (r.product_id === null) {
      if (!index.all || promo.percentOff > index.all.percentOff) index.all = promo;
    } else {
      const cur = index.byProduct[r.product_id];
      if (!cur || promo.percentOff > cur.percentOff) index.byProduct[r.product_id] = promo;
    }
  }
  return index;
}

/**
 * The wire format the root loader ships inside the SSR payload. The RPC returns
 * one row per product — 743 rows for a promotion on all kippot — and repeating
 * the promotion's label and end date on each of them roughly quadruples the
 * page weight. Grouped by promotion, each product costs one id. `productIds`
 * null is the store-wide promotion.
 */
export type PromoPayload = { promos: Array<ActivePromo & { productIds: string[] | null }> };

export const EMPTY_PROMO_PAYLOAD: PromoPayload = { promos: [] };

export function compactPromoRows(rows: readonly PromoRow[] | null | undefined): PromoPayload {
  const byId = new Map<string, ActivePromo & { productIds: string[] | null }>();
  for (const r of rows ?? []) {
    const promo = toPromo(r);
    if (!promo) continue;
    let entry = byId.get(promo.id);
    if (!entry) {
      entry = { ...promo, productIds: r.product_id === null ? null : [] };
      byId.set(promo.id, entry);
    }
    if (r.product_id === null) entry.productIds = null;
    else if (entry.productIds) entry.productIds.push(r.product_id);
  }
  return { promos: [...byId.values()] };
}

export function indexFromPayload(payload: PromoPayload | null | undefined): PromoIndex {
  const rows: PromoRow[] = [];
  for (const p of payload?.promos ?? []) {
    const base = {
      promotion_id: p.id,
      percent_off: p.percentOff,
      badge_label: p.label,
      ends_at: p.endsAt,
    };
    if (p.productIds === null) rows.push({ ...base, product_id: null });
    else for (const id of p.productIds) rows.push({ ...base, product_id: id });
  }
  return buildPromoIndex(rows);
}

/**
 * The promotion that prices a product, or null. Promotions never stack: the
 * higher percentage wins between the product's own and the store-wide one (on a
 * tie the product's own, whose label is the more specific).
 */
export function promoFor(
  index: PromoIndex,
  productId: string | null | undefined,
): ActivePromo | null {
  const own = productId ? (index.byProduct[productId] ?? null) : null;
  const all = index.all;
  if (own && all) return all.percentOff > own.percentOff ? all : own;
  return own ?? all;
}

/**
 * The promotional price for a regular (already site-discounted) price. Rounded
 * to whole ₪ like every other price here. A non-positive price is returned as
 * it is: 0 means "call for a price", and a promotion must not touch it.
 */
export function promoPrice(regular: number, promo: ActivePromo | null): number {
  if (!promo || !Number.isFinite(regular) || regular <= 0) return regular;
  return Math.max(1, Math.round(regular * (1 - promo.percentOff / 100)));
}

/** Everything a price display needs, for one catalogue price. */
export type PriceView = {
  /** What the customer pays. */
  pays: number;
  /** The price the site charges without the promotion — the honest "before". */
  regular: number;
  /** The promotion that applied, or null. */
  promo: ActivePromo | null;
  /**
   * The discount the shopper can check against the two numbers on screen,
   * computed from the ROUNDED prices — so "-20%" always matches them. 0 when
   * there is no promotion or rounding erased it.
   */
  pct: number;
};

/** Price view for a catalogue price. `promo` null (or an unsellable price) = no promotion. */
export function priceView(price: number, promo: ActivePromo | null): PriceView {
  const regular = getEffectivePrice(price);
  if (!promo || !isSellablePrice(price)) return { pays: regular, regular, promo: null, pct: 0 };
  const pays = promoPrice(regular, promo);
  const pct = pays < regular ? Math.round((1 - pays / regular) * 100) : 0;
  return pct > 0 ? { pays, regular, promo, pct } : { pays: regular, regular, promo: null, pct: 0 };
}

/** "31.12" in Israel time — the end date a shopper reads under a promotional price. */
export function formatPromoEnd(endsAt: string): string {
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
  })
    .format(d)
    .replace(/\//g, ".");
}

/** "YYYY-MM-DD" in Israel time — for schema.org priceValidUntil. */
export function promoEndDate(endsAt: string): string {
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

/** What the site-wide strip and /mivtzaim announce. */
export type PromoHeadline = {
  /** Live promotions that price at least one product. */
  count: number;
  /** The biggest configured percentage among them — "עד 30%". */
  maxPercent: number;
  /** The one live promotion when there is exactly one, else null. */
  single: (ActivePromo & { storeWide: boolean }) | null;
};

/**
 * The strip's summary of the live promotions, or null when there is nothing to
 * announce. A category promotion whose categories hold no active product
 * prices nothing, so it is left out rather than advertised.
 */
export function promoHeadline(payload: PromoPayload | null | undefined): PromoHeadline | null {
  const live = (payload?.promos ?? []).filter(
    (p) => p.productIds === null || p.productIds.length > 0,
  );
  if (live.length === 0) return null;
  const maxPercent = Math.max(...live.map((p) => p.percentOff));
  if (live.length > 1) return { count: live.length, maxPercent, single: null };
  const { productIds, ...promo } = live[0];
  return { count: 1, maxPercent, single: { ...promo, storeWide: productIds === null } };
}
