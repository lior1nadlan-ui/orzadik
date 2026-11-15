// "מוצא המתנות" (/gift-finder): three short questions — the occasion, the
// budget, and whether to add a name — answered from the occasion collections
// the site already curates (collections.ts). Pure; the page fetches a
// collection's products (collection-products.ts) and narrows them here.
//
// Why: 4 of the 11 paid orders by 15.11.2026 were gifts, and a gift buyer
// often does not know the catalogue's words. The finder speaks in occasions and
// shekels instead of category names.
import { OCCASION_COLLECTIONS, type OccasionCollection } from "@/lib/collections";
import { seasonalOrder } from "@/lib/holiday-season";
import { getEffectivePrice } from "@/lib/pricing";
import { isPersonalizableProduct } from "@/lib/personalization";

/** Short chip labels; the collection's own title stays its page heading. */
const OCCASION_LABEL: Record<string, string> = {
  "bar-mitzva": "בר מצווה",
  "chatan-kala": "חתן וכלה",
  chalaka: "חלאקה",
  "bait-chadash": "בית חדש",
  "matanot-rosh-hashana": "ראש השנה",
  "matanot-hanukkah": "חנוכה",
  "matanot-pesach": "פסח",
};

export type GiftOccasion = {
  collection: OccasionCollection;
  label: string;
  /** "לקראת חנוכה" while that holiday is near (holiday-season.ts). */
  seasonLabel?: string;
};

/** Every occasion, the coming holiday first — the homepage rail's order. */
export function giftOccasions(now: number): GiftOccasion[] {
  const out: GiftOccasion[] = [];
  for (const slot of seasonalOrder(
    OCCASION_COLLECTIONS.map((c) => c.slug),
    now,
  )) {
    const collection = OCCASION_COLLECTIONS.find((c) => c.slug === slot.slug);
    if (!collection) continue;
    out.push({
      collection,
      label: OCCASION_LABEL[collection.slug] ?? collection.title,
      ...(slot.label ? { seasonLabel: slot.label } : {}),
    });
  }
  return out;
}

export type GiftBudget = { key: string; label: string; lo: number; hi: number };

/** Ranges of the price the shopper pays; each includes its low end only. */
export const GIFT_BUDGETS: GiftBudget[] = [
  { key: "any", label: "לא משנה", lo: 0, hi: Number.POSITIVE_INFINITY },
  { key: "u150", label: "עד 150 ₪", lo: 0, hi: 150 },
  { key: "150-300", label: "150-300 ₪", lo: 150, hi: 300 },
  { key: "300-600", label: "300-600 ₪", lo: 300, hi: 600 },
  { key: "600+", label: "600 ₪ ומעלה", lo: 600, hi: Number.POSITIVE_INFINITY },
];

export function budgetByKey(key: string | null | undefined): GiftBudget {
  return GIFT_BUDGETS.find((b) => b.key === key) ?? GIFT_BUDGETS[0];
}

type GiftRow = { slug: string; price: number | string | null; family?: string | null };

/**
 * The products that fit: within the budget by the price the shopper pays
 * (the site price; a running promotion only lowers it), and — when a name is
 * wanted — from a shelf that offers one. A product without a price ("צרו קשר
 * למחיר") fits only "לא משנה".
 */
export function filterGifts<T extends GiftRow>(
  rows: readonly T[],
  budget: GiftBudget,
  withName: boolean,
): T[] {
  return rows.filter((r) => {
    const paid = getEffectivePrice(Number(r.price) || 0);
    if (budget.key !== "any") {
      if (!(paid > 0) || paid < budget.lo || paid >= budget.hi) return false;
    }
    if (withName && !isPersonalizableProduct(r.slug, r.family ? [r.family] : [])) return false;
    return true;
  });
}
