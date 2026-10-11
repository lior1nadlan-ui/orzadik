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
import { getEffectivePrice } from "@/lib/pricing";

export const MAX_PRICE_LIST_ROWS = 2000;

/**
 * salePrice is the former ("struck") price: undefined = leave as is,
 * null = remove it (written as 0 in the list), a number = set it.
 */
export type PriceListRow = { line: number; sku: string; price: number; salePrice?: number | null };
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

/** Split a line into cells. Tabs (Excel) keep empty cells, so the columns of
 *  a pasted "ייצוא לאקסל" sheet stay in place; anything after the third
 *  column (name, stock, link) is ignored. */
function cells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  const byComma = line
    .split(/,(?!\d{3}(?:\D|$))/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (byComma.length >= 2) return byComma;
  return line.split(/\s+/).filter(Boolean);
}

export function parsePriceList(text: string): PriceListParse {
  const rows: PriceListRow[] = [];
  const errors: PriceListError[] = [];
  const seen = new Map<string, string>();
  const conflicts = new Set<string>();

  (text ?? "").split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parts = cells(trimmed);
    const filled = parts.filter(Boolean);
    if (filled.length < 2) {
      errors.push({ line, text: trimmed, error: "צריך מק״ט ומחיר בשורה" });
      return;
    }
    // "59 UK3": price first is accepted only on a plain two-value line.
    const priceFirst = parts.length === 2 && looksLikePrice(parts[0]) && !looksLikePrice(parts[1]);
    const skuRaw = priceFirst ? parts[1] : parts[0];
    const priceRaw = priceFirst ? parts[0] : parts[1];
    const saleRaw = priceFirst ? "" : (parts[2] ?? "");
    // A header row ("מק״ט, מחיר") is skipped silently.
    if (line === 1 && !/\d/.test(priceRaw)) return;
    if (!skuRaw) {
      errors.push({ line, text: trimmed, error: "חסר מק״ט" });
      return;
    }
    const price = parsePriceInput(priceRaw);
    if (!price.ok) {
      errors.push({ line, text: trimmed, error: price.error });
      return;
    }
    let salePrice: number | null | undefined;
    if (saleRaw) {
      if (/^0+([.,]0+)?$/.test(saleRaw)) salePrice = null;
      else {
        const sp = parsePriceInput(saleRaw);
        if (!sp.ok) {
          errors.push({ line, text: trimmed, error: `מחיר קודם: ${sp.error}` });
          return;
        }
        // The site shows the former price struck through only when it is above
        // what the customer pays (price minus SITE_DISCOUNT) — see
        // getDisplayOriginal. Anything lower would be stored and never shown.
        const pays = getEffectivePrice(price.value);
        if (Math.round(sp.value) <= pays) {
          errors.push({
            line,
            text: trimmed,
            error: `המחיר הקודם חייב להיות גבוה מהמחיר ללקוח (₪${pays}), אחרת לא יוצג`,
          });
          return;
        }
        salePrice = sp.value;
      }
    }
    const sku = normSku(skuRaw);
    const key = `${price.value}|${salePrice === undefined ? "" : String(salePrice)}`;
    const prev = seen.get(sku);
    if (prev !== undefined) {
      if (prev !== key) conflicts.add(sku);
      return;
    }
    seen.set(sku, key);
    rows.push(
      salePrice === undefined
        ? { line, sku, price: price.value }
        : { line, sku, price: price.value, salePrice },
    );
  });

  return {
    rows: rows.filter((r) => !conflicts.has(r.sku)),
    errors,
    conflicts: [...conflicts],
  };
}
