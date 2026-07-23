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
        const { error } = await supabaseAdmin
          .from("products")
          .update({ price: action.price })
          .in("id", ids);
        if (error) throw new Error("שגיאה בעדכון המחיר.");
        return { updated: ids.length };
      }

      case "price_pct": {
        // Percentage changes are per-row: read the current prices, compute, write
        // back. Prices stay whole shekels (the catalog convention) and never
        // drop below ₪1 — a 0 price means "call for price" in this store, so a
        // rounding-down must not silently convert a product into a gold-price
        // item.
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
        return { updated, skipped: ids.length - updates.length };
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
