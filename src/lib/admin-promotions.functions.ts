// Server functions behind the CRM promotions screen (/admin/promotions).
// Every one runs behind requireAdmin with the service-role client. The rules a
// promotion must satisfy live in admin-promotions.ts (tested) and again in the
// table's CHECK constraints (20260927060000_promotions.sql).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import {
  MAX_PRODUCTS,
  promotionInputErrors,
  promotionStatus,
  previewRange,
  type PromotionRecord,
  type PromotionStatus,
} from "@/lib/admin-promotions";

const ScopeSchema = z.enum(["all", "categories", "products"]);

const InputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(200),
  badge_label: z.string().max(200).nullable(),
  percent_off: z.number(),
  scope: ScopeSchema,
  category_ids: z.array(z.string().uuid()).max(200),
  product_ids: z.array(z.string().uuid()).max(MAX_PRODUCTS + 1),
  starts_at: z.string(),
  ends_at: z.string(),
  confirm_high_discount: z.boolean().optional(),
});

export type PromotionListItem = PromotionRecord & {
  status: PromotionStatus;
  created_at: string;
  /** Products the scope covers now (active products only). Null for ended/disabled. */
  product_count: number | null;
  paid_orders: number;
  units: number;
  revenue: number;
};

type PreviewJson = {
  count: number;
  min_price: number | null;
  max_price: number | null;
  sample: { id: string; name: string; price: number }[];
};

async function previewScope(
  scope: z.infer<typeof ScopeSchema>,
  categoryIds: string[],
  productIds: string[],
): Promise<PreviewJson> {
  const { data, error } = await supabaseAdmin.rpc("admin_promotion_preview", {
    p_scope: scope,
    p_category_ids: categoryIds,
    p_product_ids: productIds,
  });
  if (error) {
    console.error("[promotions] preview:", error);
    throw new Error("שגיאה בחישוב המוצרים שבמבצע.");
  }
  const j = (data ?? {}) as unknown as PreviewJson;
  return {
    count: Number(j.count ?? 0),
    min_price: j.min_price == null ? null : Number(j.min_price),
    max_price: j.max_price == null ? null : Number(j.max_price),
    sample: (j.sample ?? []).map((s) => ({ id: s.id, name: s.name, price: Number(s.price) })),
  };
}

export const listPromotions = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const [{ data: rows, error }, { data: stats, error: sErr }] = await Promise.all([
    supabaseAdmin
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.rpc("admin_promotion_stats"),
  ]);
  if (error) throw new Error("שגיאה בטעינת המבצעים.");
  if (sErr) console.error("[promotions] stats:", sErr);
  const byPromo = new Map((stats ?? []).map((s) => [s.promotion_id, s]));
  const now = new Date();

  const items: PromotionListItem[] = await Promise.all(
    (rows ?? []).map(async (r) => {
      const rec = { ...r, percent_off: Number(r.percent_off) } as PromotionRecord & {
        created_at: string;
      };
      const status = promotionStatus(rec, now);
      // Coverage matters while a promotion can still price something.
      const product_count =
        status === "active" || status === "scheduled"
          ? (await previewScope(rec.scope, rec.category_ids, rec.product_ids)).count
          : null;
      const s = byPromo.get(rec.id);
      return {
        ...rec,
        status,
        product_count,
        paid_orders: Number(s?.orders ?? 0),
        units: Number(s?.units ?? 0),
        revenue: Number(s?.revenue ?? 0),
      };
    }),
  );
  return items;
});

export const previewPromotion = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        scope: ScopeSchema,
        category_ids: z.array(z.string().uuid()).max(200),
        product_ids: z.array(z.string().uuid()).max(MAX_PRODUCTS + 1),
        percent_off: z.number().min(0).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const p = await previewScope(data.scope, data.category_ids, data.product_ids);
    return {
      count: p.count,
      range: previewRange(p.min_price, p.max_price, data.percent_off),
      sample: p.sample,
    };
  });

export const savePromotion = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const isNew = !data.id;
    const errors = promotionInputErrors({ ...data, badge_label: data.badge_label }, { isNew });
    if (errors.length) throw new Error(errors.join(" "));

    const row = {
      name: data.name.trim(),
      badge_label: data.badge_label?.trim() || null,
      percent_off: data.percent_off,
      scope: data.scope,
      // Only the list the scope uses is kept, so a promotion switched from
      // categories to the whole store does not carry a dead category list.
      category_ids: data.scope === "categories" ? data.category_ids : [],
      product_ids: data.scope === "products" ? data.product_ids : [],
      starts_at: new Date(data.starts_at).toISOString(),
      ends_at: new Date(data.ends_at).toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    };
    if (isNew) {
      const { data: created, error } = await supabaseAdmin
        .from("promotions")
        .insert({ ...row, is_active: true, created_by: adminId })
        .select("id")
        .single();
      if (error) {
        console.error("[promotions] insert:", error);
        throw new Error("לא ניתן לשמור את המבצע.");
      }
      return { id: created.id as string };
    }
    const { error } = await supabaseAdmin.from("promotions").update(row).eq("id", data.id!);
    if (error) {
      console.error("[promotions] update:", error);
      throw new Error("לא ניתן לשמור את המבצע.");
    }
    return { id: data.id! };
  });

/**
 * "סיים עכשיו". A live promotion ends now (its end date moves to now, so the
 * record still says when it actually ran); a scheduled one is cancelled.
 * Prices return to regular on the site within the minute the storefront caches.
 */
export const endPromotion = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { data: p, error } = await supabaseAdmin
      .from("promotions")
      .select("id, is_active, starts_at, ends_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !p) throw new Error("המבצע לא נמצא.");
    const status = promotionStatus(p);
    const stamp = { updated_at: new Date().toISOString(), updated_by: adminId };
    const patch =
      status === "active"
        ? { ...stamp, ends_at: new Date().toISOString() }
        : { ...stamp, is_active: false };
    const { error: uErr } = await supabaseAdmin.from("promotions").update(patch).eq("id", data.id);
    if (uErr) {
      console.error("[promotions] end:", uErr);
      throw new Error("לא ניתן לסיים את המבצע.");
    }
    return { ok: true };
  });

/** Product search for the "specific products" scope. */
export const searchPromotionProducts = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ q: z.string().trim().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const term = data.q.replace(/[%_,()]/g, " ").trim();
    const { data: rows, error } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, price, thumbnail_url")
      .eq("is_active", true)
      .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
      .order("name")
      .limit(20);
    if (error) throw new Error("שגיאה בחיפוש מוצרים.");
    return (rows ?? []).map((r) => ({ ...r, price: Number(r.price) }));
  });

/** Names for the products an existing promotion already holds. */
export const productsByIds = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(MAX_PRODUCTS + 1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.ids.length === 0) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, price, thumbnail_url")
      .in("id", data.ids);
    if (error) throw new Error("שגיאה בטעינת המוצרים.");
    return (rows ?? []).map((r) => ({ ...r, price: Number(r.price) }));
  });
