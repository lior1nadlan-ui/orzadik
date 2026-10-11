/**
 * The columns the admin product form may write. An allowlist, not a blocklist:
 * the edit dialog is opened with a row loaded via select("*"), which also
 * carries GENERATED ALWAYS columns (name_norm, search_blob). Sending those back
 * failed every save with 'column "name_norm" can only be updated to DEFAULT'
 * (11.10.2026) — any column added to products later must never reach the
 * update unless it is listed here.
 */
export const PRODUCT_FORM_COLUMNS = [
  "name",
  "slug",
  "description",
  "short_description",
  "price",
  "sale_price",
  "sku",
  "stock_status",
  "stock_qty",
  "thumbnail_url",
  "is_active",
  "track_stock",
] as const;

export type ProductFormColumn = (typeof PRODUCT_FORM_COLUMNS)[number];

/**
 * The update for an existing product: only form columns whose value differs
 * from the row the dialog was opened with. Sending the whole form would write
 * back every field as it was when the dialog opened, so a price changed
 * meanwhile (inline in the table, or in another tab) was silently reverted.
 */
export function productUpdatePatch(
  original: Record<string, unknown>,
  form: Record<string, unknown>,
): Partial<Record<ProductFormColumn, unknown>> {
  const patch: Partial<Record<ProductFormColumn, unknown>> = {};
  for (const col of PRODUCT_FORM_COLUMNS) {
    if (!(col in form)) continue;
    const next = form[col] === undefined ? null : form[col];
    const prev = original[col] === undefined ? null : original[col];
    // numeric columns arrive from PostgREST as strings ("80.00") or numbers.
    const same =
      typeof next === "number" && prev !== null && prev !== "" && !Number.isNaN(Number(prev))
        ? next === Number(prev)
        : next === prev;
    if (!same) patch[col] = next;
  }
  return patch;
}
