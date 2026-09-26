// Pure helpers for the admin products screen: price entry, what the customer
// actually pays, the slug rule, and the category tree used by the filter.
//
// WHY. The owner asked for price editing to be easy. Studying the screen
// (docs/improvement-workflow.md, "ממצאי הלמידה") found that the hard part was
// not typing a number but knowing what it means:
//   * the stored price is the CATALOG price; every customer pays 30% less
//     (SITE_DISCOUNT) and club members 5% less again — the form showed none of it;
//   * `sale_price`, labelled "מחיר מבצע", is really the genuine FORMER price
//     shown struck through (see getDisplayOriginal in pricing.ts);
//   * 216 live products carry Hebrew slugs, and the form refused to save any of
//     them — so their price could not be changed at all.
//
// Everything here is plain data in, plain data out, so it runs in the browser
// and in Vitest alike. Price MATH stays in src/lib/pricing.ts; this file only
// reads it.

import { applyMemberDiscount, getDisplayOriginal, getEffectivePrice } from "@/lib/pricing";

/** Highest catalog price the admin will accept (matches the server schema). */
export const MAX_PRICE = 1_000_000;

export type PriceParse = { ok: true; value: number } | { ok: false; error: string };

/**
 * Read what the owner typed into a price box. Accepts the ways a price is
 * naturally written — "120", "120.50", "1,200", "₪ 120", "120 ש״ח" — and
 * rejects anything that is not a positive amount. Zero is refused on purpose:
 * a 0 price is unsellable (isSellablePrice) and once produced ₪0 orders.
 */
export function parsePriceInput(raw: string): PriceParse {
  const cleaned = (raw ?? "")
    .replace(/[₪\s]/g, "")
    .replace(/ש["״']?ח/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "");
  if (!cleaned) return { ok: false, error: "יש להזין מחיר" };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, error: "המחיר חייב להיות מספר" };
  const value = Math.round(Number(cleaned) * 100) / 100;
  if (!(value > 0)) return { ok: false, error: "המחיר חייב להיות גדול מ-0" };
  if (value > MAX_PRICE) return { ok: false, error: "המחיר גבוה מדי" };
  return { ok: true, value };
}

export type PriceBreakdown = {
  /** The stored catalog price. */
  catalog: number;
  /** What every customer pays (after the site-wide discount). */
  customer: number;
  /** What a signed-in club member pays for this one item. */
  member: number;
  /** The struck-through former price the site shows, or null when none. */
  struck: number | null;
};

/** The three prices a catalog price turns into on the site. */
export function priceBreakdown(
  price: number,
  salePrice: number | null | undefined,
): PriceBreakdown {
  const catalog = Number(price) || 0;
  const customer = getEffectivePrice(catalog);
  const original = getDisplayOriginal(catalog, salePrice ?? null);
  return {
    catalog,
    customer,
    member: applyMemberDiscount(customer, true),
    struck: original > customer ? original : null,
  };
}

/**
 * Whether a slug can be saved, and if not, why (in Hebrew).
 *
 * A NEW slug — a new product, or an existing one whose slug the owner edited —
 * must be lowercase Latin, digits and hyphens: it becomes a public URL. An
 * existing slug the owner did not touch is left exactly as it is, whatever its
 * alphabet: 216 live products have Hebrew slugs, their pages work, and
 * refusing them meant their price could not be changed.
 */
export function slugProblem(slug: string, originalSlug: string | null | undefined): string | null {
  const s = (slug ?? "").trim();
  if (!s) return "יש להזין כתובת (Slug) באנגלית — בלעדיה דף המוצר לא יהיה נגיש ללקוחות";
  if (originalSlug && s === originalSlug) return null;
  if (!/^[a-z0-9-]+$/.test(s)) {
    return "כתובת ה-Slug חייבת להכיל אותיות אנגליות קטנות, ספרות ומקפים בלבד";
  }
  return null;
}

export type CategoryNode = { id: string; name: string; slug: string; parent_slug: string | null };

export type CategoryOption = { id: string; slug: string; name: string; depth: number };

/**
 * The categories as one ordered list for a picker: each top-level category
 * (A-Z, Hebrew collation) followed by its children, then theirs. A category
 * whose parent is missing is treated as top-level rather than dropped, and a
 * cyclic parent chain cannot loop.
 */
export function categoryOptions(cats: CategoryNode[]): CategoryOption[] {
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const children = new Map<string, CategoryNode[]>();
  const roots: CategoryNode[] = [];
  for (const c of cats) {
    if (c.parent_slug && c.parent_slug !== c.slug && bySlug.has(c.parent_slug)) {
      const list = children.get(c.parent_slug) ?? [];
      list.push(c);
      children.set(c.parent_slug, list);
    } else {
      roots.push(c);
    }
  }
  const byName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name, "he");
  const out: CategoryOption[] = [];
  const seen = new Set<string>();
  const walk = (c: CategoryNode, depth: number) => {
    if (seen.has(c.slug)) return;
    seen.add(c.slug);
    out.push({ id: c.id, slug: c.slug, name: c.name, depth });
    for (const child of (children.get(c.slug) ?? []).sort(byName)) walk(child, depth + 1);
  };
  for (const r of roots.sort(byName)) walk(r, 0);
  // Anything left is part of a parent cycle; list it flat rather than lose it.
  for (const c of [...cats].sort(byName)) if (!seen.has(c.slug)) walk(c, 0);
  return out;
}

/**
 * A category and all of its descendants — what "show me this category" means
 * to the owner: filtering by כיפות must include כיפות סרוגות.
 */
export function categoryWithDescendants(cats: CategoryNode[], slug: string): CategoryNode[] {
  const root = cats.find((c) => c.slug === slug);
  if (!root) return [];
  const out: CategoryNode[] = [];
  const seen = new Set<string>();
  const queue = [root];
  while (queue.length) {
    const c = queue.shift()!;
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(c);
    for (const child of cats) if (child.parent_slug === c.slug) queue.push(child);
  }
  return out;
}

export type PriceBatchSummary = {
  source: string;
  products: number;
  undone: number;
  oldTotal: number;
  newTotal: number;
  sample?: string | null;
};

/** One line, in Hebrew, describing a logged price change for the history list. */
export function describePriceBatch(b: PriceBatchSummary): string {
  const n = b.products;
  const what = n === 1 && b.sample ? `"${b.sample}"` : `${n.toLocaleString("he-IL")} מוצרים`;
  switch (b.source) {
    case "inline":
    case "bulk_set": {
      const avg = n > 0 ? Math.round(b.newTotal / n) : 0;
      return n === 1
        ? `מחיר ${what}: ₪${Math.round(b.oldTotal)} ← ₪${Math.round(b.newTotal)}`
        : `מחיר אחיד ₪${avg} ל-${what}`;
    }
    case "bulk_pct": {
      const pct = b.oldTotal > 0 ? Math.round((b.newTotal / b.oldTotal - 1) * 100) : 0;
      const sign = pct > 0 ? "+" : "";
      return `שינוי של ${sign}${pct}% ל-${what}`;
    }
    case "undo":
      return `ביטול שינוי מחיר (${what})`;
    default:
      return `שינוי מחיר (${what})`;
  }
}
