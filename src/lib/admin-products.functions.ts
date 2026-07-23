// Bulk catalog operations for the admin products screen.
//
// Scope note on the price actions: these edit the CATALOG field
// `products.price`. They are not a change to price MATH — src/lib/pricing.ts is
// untouched, and checkout re-reads the DB price at order time and reprices
// authoritatively there. Changing a shelf price here is the same operation the
// single-product edit dialog already performs, just applied to a selection.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";

/** Hard cap per call — keeps one mis-click from rewriting the whole catalog. */
const MAX_IDS = 200;
/** Parallelism for the per-row price walk. */
const CHUNK = 20;
/** PostgREST silently caps unbounded selects at 1000 rows — page explicitly. */
const DB_PAGE = 1000;

/**
 * How many of these products have at least one `product_variants` row.
 *
 * The bulk price actions write `products.price` only. For a product with size
 * rows, checkout reprices from `product_variants.price` when that column is
 * set, so those products need a separate pass in the product edit dialog. We
 * report the count instead of rewriting variant prices — silently rewriting a
 * per-size price the owner never typed is exactly the surprise this guard
 * exists to prevent.
 */
async function countProductsWithVariants(ids: string[]): Promise<number> {
  const seen = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("product_variants")
      .select("product_id")
      .in("product_id", ids)
      .order("product_id", { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (error) {
      // Advisory only — never fail the bulk action over the warning count.
      console.error("[countProductsWithVariants] failed:", error);
      return seen.size;
    }
    for (const r of data ?? []) seen.add(r.product_id as string);
    if ((data ?? []).length < DB_PAGE) break;
  }
  return seen.size;
}

const ActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("price_pct"), pct: z.number().min(-90).max(300) }),
  z.object({ kind: z.literal("price_set"), price: z.number().min(0).max(1_000_000) }),
  z.object({
    kind: z.literal("category"),
    category_id: z.string().uuid(),
    mode: z.enum(["add", "remove"]),
  }),
  z.object({ kind: z.literal("active"), value: z.boolean() }),
  z.object({ kind: z.literal("stock_status"), value: z.enum(["instock", "outofstock"]) }),
  z.object({ kind: z.literal("restock"), qty: z.number().int().min(0).max(100_000) }),
]);

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_IDS),
  action: ActionSchema,
});

export const bulkUpdateProducts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { ids, action } = data;

    // Audit line BEFORE the write: if something goes wrong, the log says who
    // did what to how many rows.
    console.log(
      `[bulkUpdateProducts] admin=${adminId} action=${action.kind} count=${ids.length} params=${JSON.stringify(
        { ...action, kind: undefined },
      )}`,
    );

    switch (action.kind) {
      case "active": {
        const { error } = await supabaseAdmin
          .from("products")
          .update({ is_active: action.value })
          .in("id", ids);
        if (error) throw new Error("שגיאה בעדכון סטטוס הפעילות.");
        return { updated: ids.length };
      }

      case "stock_status": {
        const { error } = await supabaseAdmin
          .from("products")
          .update({ stock_status: action.value })
          .in("id", ids);
        if (error) throw new Error("שגיאה בעדכון סטטוס המלאי.");
        return { updated: ids.length };
      }

      case "restock": {
        const { error } = await supabaseAdmin
          .from("products")
          .update({
            stock_qty: action.qty,
            stock_status: action.qty > 0 ? "instock" : "outofstock",
          })
          .in("id", ids);
        if (error) throw new Error("שגיאה בעדכון המלאי.");
        return { updated: ids.length };
      }

      case "price_set": {
        // Counted BEFORE the write so the warning describes the same selection
        // that was just changed.
        const variantProducts = await countProductsWithVariants(ids);
        const { error } = await supabaseAdmin
          .from("products")
          .update({ price: action.price })
          .in("id", ids);
        if (error) throw new Error("שגיאה בעדכון המחיר.");
        return { updated: ids.length, variantProducts };
      }

      case "price_pct": {
        // Percentage changes are per-row: read the current prices, compute, write
        // back. Prices stay whole shekels (the catalog convention) and never
        // drop below ₪1 — a 0 price means "call for price" in this store, so a
        // rounding-down must not silently convert a product into a gold-price
        // item.
        const variantProducts = await countProductsWithVariants(ids);
        const { data: rows, error } = await supabaseAdmin
          .from("products")
          .select("id, price")
          .in("id", ids);
        if (error) throw new Error("שגיאה בטעינת המחירים.");

        const factor = 1 + action.pct / 100;
        const updates = (rows ?? [])
          // Leave call-for-price products alone entirely.
          .filter((p) => Number(p.price) > 0)
          .map((p) => ({
            id: p.id,
            price: Math.max(1, Math.round(Number(p.price) * factor)),
          }));

        let updated = 0;
        for (let i = 0; i < updates.length; i += CHUNK) {
          const slice = updates.slice(i, i + CHUNK);
          const results = await Promise.all(
            slice.map((u) =>
              supabaseAdmin.from("products").update({ price: u.price }).eq("id", u.id),
            ),
          );
          for (const r of results) {
            if (r.error) console.error("[bulkUpdateProducts] price row failed:", r.error);
            else updated++;
          }
        }
        return { updated, skipped: ids.length - updates.length, variantProducts };
      }

      case "category": {
        if (action.mode === "add") {
          const { error } = await supabaseAdmin
            .from("product_categories")
            .upsert(
              ids.map((id) => ({ product_id: id, category_id: action.category_id })),
              { onConflict: "product_id,category_id", ignoreDuplicates: true },
            );
          if (error) throw new Error("שגיאה בשיוך לקטגוריה.");
        } else {
          const { error } = await supabaseAdmin
            .from("product_categories")
            .delete()
            .eq("category_id", action.category_id)
            .in("product_id", ids);
          if (error) throw new Error("שגיאה בהסרה מהקטגוריה.");
        }
        return { updated: ids.length };
      }
    }
  });

// ---------------------------------------------------------------------------
// Size variants (product_variants)
//
// Why this exists: for a product that has variant rows, checkout re-reads
// `product_variants.price` and charges THAT when it is set (see
// src/lib/checkout.functions.ts). Until now no admin screen showed those rows,
// so editing `products.price` could leave the amount actually charged stale.
// These two functions are read + write for that table only; no price MATH is
// involved (src/lib/pricing.ts is untouched).
// ---------------------------------------------------------------------------

/** One editable size row as the admin dialog sees it. */
export type AdminVariantRow = {
  id: string;
  label: string;
  sku: string | null;
  price: number | null;
  price_delta: number;
  in_stock: boolean;
  sort_order: number;
};

export const listProductVariants = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<AdminVariantRow[]> => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("product_variants")
      .select("id, label, sku, price, price_delta, in_stock, sort_order")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) {
      console.error("[listProductVariants] failed:", error);
      throw new Error("שגיאה בטעינת הגדלים.");
    }
    return (rows ?? []).map((v) => ({
      id: v.id as string,
      label: (v.label ?? "") as string,
      sku: (v.sku ?? null) as string | null,
      // numeric columns arrive as strings over PostgREST in some drivers.
      price: v.price === null || v.price === undefined ? null : Number(v.price),
      price_delta: v.price_delta === null || v.price_delta === undefined ? 0 : Number(v.price_delta),
      // Most rows are unset; anything that isn't an explicit false counts as
      // available — the same rule checkout applies.
      in_stock: v.in_stock !== false,
      sort_order: Number(v.sort_order ?? 0),
    }));
  });

const VariantSaveSchema = z.object({
  productId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(120),
        // null = "no separate size price"; checkout then charges products.price.
        price: z.number().min(0).max(1_000_000).nullable(),
        in_stock: z.boolean(),
        sort_order: z.number().int().min(0).max(9999),
      }),
    )
    .min(1)
    .max(MAX_IDS),
});

export const saveProductVariants = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => VariantSaveSchema.parse(i))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();

    // Ownership check: only rows that already belong to this product may be
    // written, so a tampered payload can't repoint another product's sizes.
    const { data: owned, error: oErr } = await supabaseAdmin
      .from("product_variants")
      .select("id")
      .eq("product_id", data.productId);
    if (oErr) {
      console.error("[saveProductVariants] ownership read:", oErr);
      throw new Error("שגיאה בטעינת הגדלים.");
    }
    const ownedIds = new Set((owned ?? []).map((r) => r.id as string));
    const rows = data.rows.filter((r) => ownedIds.has(r.id));
    if (rows.length === 0) return { updated: 0 };

    console.log(
      `[saveProductVariants] admin=${adminId} product=${data.productId} rows=${rows.length}`,
    );

    let updated = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const results = await Promise.all(
        slice.map((r) =>
          supabaseAdmin
            .from("product_variants")
            .update({
              label: r.label,
              price: r.price,
              in_stock: r.in_stock,
              sort_order: r.sort_order,
            })
            .eq("id", r.id)
            .eq("product_id", data.productId),
        ),
      );
      for (const res of results) {
        if (res.error) console.error("[saveProductVariants] row failed:", res.error);
        else updated++;
      }
    }
    return { updated };
  });

/** Flat category list for the bulk dialog's picker. */
export const listCategoriesForBulk = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug")
    .order("name");
  if (error) throw new Error("שגיאה בטעינת הקטגוריות.");
  return data ?? [];
});
