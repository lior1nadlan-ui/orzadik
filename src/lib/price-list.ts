// "עדכון מחירים לפי מק״ט" — read a pasted price list.
//
// WHY. On 11.10.2026 the owner spent a morning changing prices one product at
// a time. Supplier lists and Excel sheets already pair a SKU with a price; this
// lets him paste them and update every row in one undoable batch.
//
// One product per line: a SKU and a price, separated by a tab (pasted from
// Excel), comma, semicolon or spaces, in either order. Plain data in, plain
// data out, so it runs in the browser and in Vitest alike.

import { parsePriceInput } from "@/lib/admin-pricing";

export const MAX_PRICE_LIST_ROWS = 2000;

export type PriceListRow = { line: number; sku: string; price: number };
export type PriceListError = { line: number; text: string; error: string };

export type PriceListParse = {
  rows: PriceListRow[];
  errors: PriceListError[];
  /** SKUs that appear on more than one line with different prices. */
  conflicts: string[];
};

const normSku = (s: string) => s.trim().toUpperCase();

/** Does this token look like a price ("120", "120.50", "1,200", "₪120")? */
const looksLikePrice = (t: string) => parsePriceInput(t).ok && /\d/.test(t) && !/[A-Za-z]/.test(t);

export function parsePriceList(text: string): PriceListParse {
  const rows: PriceListRow[] = [];
  const errors: PriceListError[] = [];
  const seen = new Map<string, number>();
  const conflicts = new Set<string>();

  (text ?? "").split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Tab / ; split first (Excel); a comma only when it is not a thousands
    // separator; otherwise whitespace.
    let parts = trimmed
      .split(/\t|;/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2)
      parts = trimmed
        .split(/,(?!\d{3}(\D|$))/)
        .map((p) => (p ?? "").trim())
        .filter(Boolean);
    if (parts.length < 2) parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length !== 2) {
      errors.push({ line, text: trimmed, error: "צריך מק״ט ומחיר בשורה" });
      return;
    }
    const [a, b] = parts;
    const priceFirst = looksLikePrice(a) && !looksLikePrice(b);
    const skuRaw = priceFirst ? b : a;
    const priceRaw = priceFirst ? a : b;
    // A header row ("מק״ט, מחיר") is skipped silently.
    if (line === 1 && !/\d/.test(priceRaw)) return;
    const price = parsePriceInput(priceRaw);
    if (!price.ok) {
      errors.push({ line, text: trimmed, error: price.error });
      return;
    }
    const sku = normSku(skuRaw);
    const prev = seen.get(sku);
    if (prev !== undefined) {
      if (prev !== price.value) conflicts.add(sku);
      return;
    }
    seen.set(sku, price.value);
    rows.push({ line, sku, price: price.value });
  });

  const conflictList = [...conflicts];
  return {
    rows: rows.filter((r) => !conflicts.has(r.sku)),
    errors,
    conflicts: conflictList,
  };
}
