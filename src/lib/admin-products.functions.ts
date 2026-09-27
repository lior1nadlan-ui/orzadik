// Bulk catalog operations for the admin products screen.
//
// Scope note on the price actions: these edit the CATALOG field
// `products.price`. They are not a change to price MATH — src/lib/pricing.ts is
// untouched, and checkout re-reads the DB price at order time and reprices
// authoritatively there. Changing a shelf price here is the same operation the
// single-product edit dialog already performs, just applied to a selection.
//
// Every price change is logged, whatever path makes it: a trigger on products
// writes product_price_changes (20260926233000_product_price_ledger.sql). The
// price actions below go through admin_set_product_prices so that one action
// is one BATCH, which admin_undo_price_batch can reverse.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { autoSlug, slugSuffix } from "@/lib/admin-catalog";

/** Hard cap per call — keeps one mis-click from rewriting the whole catalog. */
const MAX_IDS = 200;
/**
 * Cap for "every product in this category". The largest tree (כיפות) holds 743
 * products; nothing legitimate comes near this, and a price action is undoable.
 */
const MAX_SCOPE = 2000;
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
  z.object({
    kind: z.literal("price_pct"),
    pct: z
      .number()
      .min(-90)
      .max(300)
      .refine((n) => n !== 0, "0%"),
  }),
  // Above 0: a ₪0 shelf price is unsellable (see isSellablePrice).
  z.object({ kind: z.literal("price_set"), price: z.number().positive().max(1_000_000) }),
  z.object({
    kind: z.literal("category"),
    category_id: z.string().uuid(),
    mode: z.enum(["add", "remove"]),
  }),
  z.object({ kind: z.literal("active"), value: z.boolean() }),
  z.object({ kind: z.literal("stock_status"), value: z.enum(["instock", "outofstock"]) }),
  z.object({ kind: z.literal("restock"), qty: z.number().int().min(0).max(100_000) }),
]);

const Schema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(MAX_IDS).optional(),
    // "Every product in this category and its sub-categories" — resolved on
    // the server, so the owner can reprice a whole shelf instead of 25 rows.
    categoryId: z.string().uuid().optional(),
    action: ActionSchema,
  })
  .refine((d) => !!d.ids !== !!d.categoryId, { message: "ids or categoryId, not both" });

/** Product ids in a category and every category below it. */
async function productIdsInCategoryTree(categoryId: string): Promise<string[]> {
  const { data: cats, error: cErr } = await supabaseAdmin
    .from("categories")
    .select("id, slug, parent_slug");
  if (cErr) throw new Error("שגיאה בטעינת הקטגוריות.");
  const root = (cats ?? []).find((c) => c.id === categoryId);
  if (!root) throw new Error("הקטגוריה לא נמצאה.");
  const slugs = new Set<string>([root.slug]);
  // Breadth-first down the parent_slug links; bounded by the category count.
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of cats ?? []) {
      if (c.parent_slug && slugs.has(c.parent_slug) && !slugs.has(c.slug)) {
        slugs.add(c.slug);
        grew = true;
      }
    }
  }
  const catIds = (cats ?? []).filter((c) => slugs.has(c.slug)).map((c) => c.id as string);

  const ids = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .select("product_id")
      .in("category_id", catIds)
      .order("product_id", { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error("שגיאה בטעינת מוצרי הקטגוריה.");
    for (const r of data ?? []) ids.add(r.product_id as string);
    if ((data ?? []).length < DB_PAGE) break;
  }
  if (ids.size > MAX_SCOPE) {
    throw new Error(`בקטגוריה ${ids.size} מוצרים — יותר מדי לפעולה אחת.`);
  }
  return [...ids];
}

/** Run a write over ids in slices, so a long id list never overflows a URL. */
async function inSlices(
  ids: string[],
  write: (slice: string[]) => PromiseLike<{ error: unknown }>,
) {
  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const { error } = await write(ids.slice(i, i + MAX_IDS));
    if (error) return { error };
  }
  return { error: null };
}

/** One logged, undoable price batch (see the ledger migration). */
async function applyPrices(
  adminId: string,
  source: "inline" | "bulk_set" | "bulk_pct",
  ids: string[],
  mode: "set" | "pct",
  value: number,
): Promise<{ batchId: string; updated: number; skipped: number }> {
  const { data, error } = await supabaseAdmin.rpc("admin_set_product_prices", {
    p_actor: adminId,
    p_source: source,
    p_ids: ids,
    p_mode: mode,
    p_value: value,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    console.error("[applyPrices] failed:", error);
    throw new Error("שגיאה בעדכון המחיר.");
  }
  return { batchId: row.batch_id, updated: row.updated, skipped: row.skipped };
}

export const bulkUpdateProducts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { action } = data;
    const ids = data.ids ?? (await productIdsInCategoryTree(data.categoryId!));
    if (ids.length === 0) return { updated: 0 };

    // Audit line BEFORE the write: if something goes wrong, the log says who
    // did what to how many rows.
    console.log(
      `[bulkUpdateProducts] admin=${adminId} action=${action.kind} count=${ids.length} params=${JSON.stringify(
        { ...action, kind: undefined },
      )}`,
    );

    switch (action.kind) {
      case "active": {
        const { error } = await inSlices(ids, (slice) =>
          supabaseAdmin.from("products").update({ is_active: action.value }).in("id", slice),
        );
        if (error) throw new Error("שגיאה בעדכון סטטוס הפעילות.");
        return { updated: ids.length };
      }

      case "stock_status": {
        const { error } = await inSlices(ids, (slice) =>
          supabaseAdmin.from("products").update({ stock_status: action.value }).in("id", slice),
        );
        if (error) throw new Error("שגיאה בעדכון סטטוס המלאי.");
        return { updated: ids.length };
      }

      case "restock": {
        const { error } = await inSlices(ids, (slice) =>
          supabaseAdmin
            .from("products")
            .update({
              stock_qty: action.qty,
              stock_status: action.qty > 0 ? "instock" : "outofstock",
            })
            .in("id", slice),
        );
        if (error) throw new Error("שגיאה בעדכון המלאי.");
        return { updated: ids.length };
      }

      case "price_set": {
        // Counted BEFORE the write so the warning describes the same selection
        // that was just changed.
        const variantProducts = await countProductsWithVariants(ids);
        const res = await applyPrices(adminId, "bulk_set", ids, "set", action.price);
        return { ...res, variantProducts };
      }

      case "price_pct": {
        // Whole shekels, never below ₪1, and products at price 0 ("call for
        // price") are left alone — the same rules as before, now in one SQL
        // statement so the whole action is one undoable batch.
        const variantProducts = await countProductsWithVariants(ids);
        const res = await applyPrices(adminId, "bulk_pct", ids, "pct", action.pct);
        return { ...res, variantProducts };
      }

      case "category": {
        if (action.mode === "add") {
          const { error } = await inSlices(ids, (slice) =>
            supabaseAdmin.from("product_categories").upsert(
              slice.map((id) => ({ product_id: id, category_id: action.category_id })),
              { onConflict: "product_id,category_id", ignoreDuplicates: true },
            ),
          );
          if (error) throw new Error("שגיאה בשיוך לקטגוריה.");
        } else {
          const { error } = await inSlices(ids, (slice) =>
            supabaseAdmin
              .from("product_categories")
              .delete()
              .eq("category_id", action.category_id)
              .in("product_id", slice),
          );
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
      price_delta:
        v.price_delta === null || v.price_delta === undefined ? 0 : Number(v.price_delta),
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
    .select("id, name, slug, parent_slug")
    .order("name");
  if (error) throw new Error("שגיאה בטעינת הקטגוריות.");
  return data ?? [];
});

// ---------------------------------------------------------------------------
// Per-product category assignment (product_categories)
//
// The single-product edit form had no way to place a product in a category, so
// a freshly created product stayed orphaned until it was linked from the bulk
// screen. These two functions read the product's current categories and write
// the chosen set. Both run behind requireAdmin with the service-role client;
// product_categories is the plain (product_id, category_id) join table.
// ---------------------------------------------------------------------------

/** The category ids this product currently belongs to — seeds the picker when editing. */
export const getProductCategoryIds = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<string[]> => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("product_categories")
      .select("category_id")
      .eq("product_id", data.productId);
    if (error) {
      console.error("[getProductCategoryIds] failed:", error);
      throw new Error("שגיאה בטעינת הקטגוריות של המוצר.");
    }
    return (rows ?? []).map((r) => r.category_id as string);
  });

const SetCategoriesSchema = z.object({
  productId: z.string().uuid(),
  // Empty is legal: it clears the product's category memberships.
  categoryIds: z.array(z.string().uuid()).max(200),
});

/**
 * Replace-set the product's categories in a single call: delete the product's
 * existing rows, then insert the chosen ones. The two statements are not wrapped
 * in a DB transaction (no RPC is available and the schema is fixed), so a failed
 * insert after a successful delete would leave the product with no categories;
 * the caller surfaces that as a warning and the owner can simply re-save.
 */
export const setProductCategories = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SetCategoriesSchema.parse(i))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const unique = [...new Set(data.categoryIds)];

    console.log(
      `[setProductCategories] admin=${adminId} product=${data.productId} categories=${unique.length}`,
    );

    const { error: delErr } = await supabaseAdmin
      .from("product_categories")
      .delete()
      .eq("product_id", data.productId);
    if (delErr) {
      console.error("[setProductCategories] delete failed:", delErr);
      throw new Error("שגיאה בעדכון הקטגוריות.");
    }

    if (unique.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("product_categories")
        .insert(unique.map((cid) => ({ product_id: data.productId, category_id: cid })));
      if (insErr) {
        console.error("[setProductCategories] insert failed:", insErr);
        throw new Error("שגיאה בעדכון הקטגוריות.");
      }
    }

    return { count: unique.length };
  });

// ---------------------------------------------------------------------------
// Inline price edit, price history and undo
//
// The owner edits a price straight in the products table. Each edit is its own
// logged batch, so the toast's "בטל" and the history list can reverse it.
// ---------------------------------------------------------------------------

export const setProductPrice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ productId: z.string().uuid(), price: z.number().positive().max(1_000_000) })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    console.log(`[setProductPrice] admin=${adminId} product=${data.productId} price=${data.price}`);
    return applyPrices(adminId, "inline", [data.productId], "set", data.price);
  });

export const undoPriceBatch = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ batchId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    console.log(`[undoPriceBatch] admin=${adminId} batch=${data.batchId}`);
    const { data: rows, error } = await supabaseAdmin.rpc("admin_undo_price_batch", {
      p_actor: adminId,
      p_batch: data.batchId,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (error || !row) {
      console.error("[undoPriceBatch] failed:", error);
      throw new Error("לא ניתן לבטל — ייתכן שהשינוי כבר בוטל.");
    }
    return { restored: row.restored, skipped: row.skipped };
  });

export type PriceBatchRow = {
  batchId: string;
  source: string;
  changedAt: string;
  products: number;
  undone: number;
  oldTotal: number;
  newTotal: number;
  sample: string | null;
};

export const listPriceBatches = createServerFn({ method: "POST" }).handler(
  async (): Promise<PriceBatchRow[]> => {
    await requireAdmin();
    const { data, error } = await supabaseAdmin.rpc("admin_recent_price_batches", {
      p_limit: 20,
    });
    if (error) {
      console.error("[listPriceBatches] failed:", error);
      throw new Error("שגיאה בטעינת היסטוריית המחירים.");
    }
    return (data ?? []).map((r) => ({
      batchId: r.batch_id,
      source: r.source,
      changedAt: r.changed_at,
      products: Number(r.products),
      undone: Number(r.undone),
      oldTotal: Number(r.old_total),
      newTotal: Number(r.new_total),
      sample: r.sample ?? null,
    }));
  },
);

export type ProductPriceChange = {
  changedAt: string;
  source: string;
  oldPrice: number | null;
  newPrice: number | null;
  oldSalePrice: number | null;
  newSalePrice: number | null;
};

/** The last few price changes of one product, for its edit dialog. */
export const productPriceHistory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<ProductPriceChange[]> => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("product_price_changes")
      .select("changed_at, source, old_price, new_price, old_sale_price, new_sale_price")
      .eq("product_id", data.productId)
      .order("changed_at", { ascending: false })
      .limit(6);
    if (error) {
      console.error("[productPriceHistory] failed:", error);
      return [];
    }
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return (rows ?? []).map((r) => ({
      changedAt: r.changed_at,
      source: r.source,
      oldPrice: num(r.old_price),
      newPrice: num(r.new_price),
      oldSalePrice: num(r.old_sale_price),
      newSalePrice: num(r.new_sale_price),
    }));
  });

// ---------------------------------------------------------------------------
// Gallery (products.thumbnail_url + product_images) and quick add
//
// The product page shows thumbnail_url first and then product_images by
// sort_order (routes/product.$slug.tsx). No admin screen could edit the
// gallery: 3,780 gallery rows existed, all from the import. These let the
// product dialog show and save it as one ordered list, and let the owner
// create several products from photos into one category in one step.
// ---------------------------------------------------------------------------

const ImageUrl = z
  .string()
  .max(1000)
  .refine((u) => /^https?:\/\//.test(u) || u.startsWith("/"), "invalid image url");

export const listProductImages = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Array<{ url: string; sort_order: number | null }>> => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("product_images")
      .select("url, sort_order")
      .eq("product_id", data.productId);
    if (error) {
      console.error("[listProductImages] failed:", error);
      throw new Error("שגיאה בטעינת תמונות המוצר.");
    }
    return (rows ?? []).map((r) => ({ url: r.url as string, sort_order: r.sort_order ?? null }));
  });

/**
 * Save the gallery the owner arranged: the first image becomes thumbnail_url,
 * the rest replace the product's product_images rows in order. Like
 * setProductCategories this is delete-then-insert without a transaction; a
 * failed insert is reported and the owner can save again.
 */
export const saveProductGallery = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        thumbnailUrl: ImageUrl.nullable(),
        extra: z.array(ImageUrl).max(30),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    console.log(
      `[saveProductGallery] admin=${adminId} product=${data.productId} images=${
        (data.thumbnailUrl ? 1 : 0) + data.extra.length
      }`,
    );
    const { error: tErr } = await supabaseAdmin
      .from("products")
      .update({ thumbnail_url: data.thumbnailUrl })
      .eq("id", data.productId);
    if (tErr) throw new Error("שגיאה בשמירת התמונה הראשית.");

    const { error: dErr } = await supabaseAdmin
      .from("product_images")
      .delete()
      .eq("product_id", data.productId);
    if (dErr) throw new Error("שגיאה בעדכון הגלריה.");
    const extra = [...new Set(data.extra)].filter((u) => u !== data.thumbnailUrl);
    if (extra.length > 0) {
      const { error: iErr } = await supabaseAdmin
        .from("product_images")
        .insert(extra.map((url, i) => ({ product_id: data.productId, url, sort_order: i + 1 })));
      if (iErr) throw new Error("התמונה הראשית נשמרה, אבל שמירת שאר התמונות נכשלה — שמרו שוב.");
    }
    return { images: (data.thumbnailUrl ? 1 : 0) + extra.length };
  });

const QuickItem = z.object({
  name: z.string().trim().min(2).max(200),
  price: z.number().positive().max(1_000_000),
  imageUrl: ImageUrl.nullable(),
});

/** A random 5-digit slug suffix from the Workers-safe crypto API. */
const randomUnit = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/**
 * Create several products at once, all in one category, each from a photo, a
 * name and a price. The slug is generated (autoSlug) so a Hebrew name needs no
 * English, retrying on the rare collision. Returns what was created and what
 * failed, so a partial batch is never silent.
 */
export const createProductsQuick = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        categoryId: z.string().uuid(),
        active: z.boolean(),
        items: z.array(QuickItem).min(1).max(50),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { data: cat, error: cErr } = await supabaseAdmin
      .from("categories")
      .select("id, slug")
      .eq("id", data.categoryId)
      .maybeSingle();
    if (cErr || !cat) throw new Error("הקטגוריה לא נמצאה.");
    console.log(
      `[createProductsQuick] admin=${adminId} category=${cat.slug} items=${data.items.length}`,
    );

    const created: Array<{ id: string; slug: string; name: string }> = [];
    const failed: Array<{ name: string; reason: string }> = [];
    for (const item of data.items) {
      let done = false;
      for (let attempt = 0; attempt < 4 && !done; attempt++) {
        // Every slug ends in a fresh random number, so a collision just draws again.
        const trySlug = autoSlug(item.name, cat.slug, slugSuffix(randomUnit));
        const { data: row, error } = await supabaseAdmin
          .from("products")
          .insert({
            slug: trySlug,
            name: item.name,
            price: item.price,
            thumbnail_url: item.imageUrl,
            stock_status: "instock",
            is_active: data.active,
            track_stock: false,
          })
          .select("id, slug, name")
          .single();
        if (error) {
          if (error.code === "23505") continue; // slug taken — draw again
          failed.push({ name: item.name, reason: "שגיאה ביצירת המוצר" });
          console.error("[createProductsQuick] insert failed:", error);
          done = true;
          break;
        }
        const { error: lErr } = await supabaseAdmin
          .from("product_categories")
          .insert({ product_id: row.id, category_id: cat.id });
        if (lErr) console.error("[createProductsQuick] category link failed:", lErr);
        created.push({ id: row.id, slug: row.slug, name: row.name });
        done = true;
      }
      if (!done) failed.push({ name: item.name, reason: "לא נמצאה כתובת פנויה" });
    }
    return { created, failed };
  });

// ---------------------------------------------------------------------------
// Product image upload (Storage bucket "product-images")
//
// The form previously accepted only a pasted URL. This lets the owner upload a
// real file: the client base64-encodes the bytes and posts them here, and the
// service-role client writes them to the existing public bucket. No client-side
// service-role usage — the upload happens only inside this admin server fn.
// ---------------------------------------------------------------------------

/** Content types we accept, mapped to the stored object's extension. */
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
/** 5 MB cap on the decoded bytes — plenty for a catalog photo, small enough to POST. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Decode standard base64 to bytes without depending on Node's Buffer (Workers-safe). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const UploadImageSchema = z.object({
  contentType: z.string().min(1).max(100),
  // Raw base64 (no data: prefix); the client strips it before posting.
  dataBase64: z.string().min(1),
  fileName: z.string().max(255).optional(),
});

export const uploadProductImage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UploadImageSchema.parse(i))
  .handler(async ({ data }): Promise<{ url: string; path: string }> => {
    const adminId = await requireAdmin();

    const ct = data.contentType.toLowerCase().split(";")[0].trim();
    if (!IMAGE_EXT[ct]) {
      throw new Error("סוג הקובץ אינו נתמך. יש להעלות תמונה (PNG, JPG, WEBP, GIF או AVIF).");
    }
    // Cheap guard before decoding: base64 inflates ~4/3, so anything well past
    // the cap can be rejected without materialising the whole payload.
    if (data.dataBase64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64) {
      throw new Error("הקובץ גדול מדי. הגודל המרבי הוא 5MB.");
    }

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(data.dataBase64);
    } catch {
      throw new Error("קובץ לא תקין.");
    }
    if (bytes.length === 0) throw new Error("הקובץ ריק.");
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error("הקובץ גדול מדי. הגודל המרבי הוא 5MB.");
    }

    // Collision-safe object path — a random uuid means two uploads of the same
    // filename never clobber each other. Kept under uploads/ so it doesn't mix
    // with the catalog/ import namespace.
    const ext = IMAGE_EXT[ct];
    const path = `uploads/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabaseAdmin.storage.from("product-images").upload(path, bytes, {
      contentType: ct,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.error("[uploadProductImage] upload failed:", error);
      throw new Error("שגיאה בהעלאת התמונה.");
    }

    const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    console.log(`[uploadProductImage] admin=${adminId} path=${path} bytes=${bytes.length}`);
    return { url: pub.publicUrl, path };
  });
