import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { checkOrderRateLimitByIp } from "@/lib/rate-limit.server";

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

const stripHtml = (v: string) => v.replace(/<[^>]*>/g, "").trim();

export type ReviewSummary = { average: number; count: number };
export type PublicReview = {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

// ---- Public: submit a review (moderated — starts unapproved) ---------------

const SubmitSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  author_name: z.string().trim().min(1).max(80).transform(stripHtml),
  title: z.string().trim().max(120).transform(stripHtml).optional().nullable(),
  body: z.string().trim().max(2000).transform(stripHtml).optional().nullable(),
});

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SubmitSchema.parse(i))
  .handler(async ({ data }) => {
    // Throttle by IP (reuse the order IP limiter table): max 15/hour.
    const ip = getClientIp(getRequest());
    const { limited } = await checkOrderRateLimitByIp(ip);
    if (limited) throw new Error("יותר מדי חוות דעת נשלחו מהכתובת הזו. אנא נסו מאוחר יותר.");

    // Product must exist and be active.
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, is_active")
      .eq("id", data.product_id)
      .maybeSingle();
    if (!product || !product.is_active) throw new Error("מוצר לא נמצא.");

    const userId = await getOptionalUserId();

    const { error } = await supabaseAdmin.from("reviews").insert({
      product_id: data.product_id,
      author_name: data.author_name,
      rating: data.rating,
      title: data.title || null,
      body: data.body || null,
      is_approved: false, // moderated
      // order_id intentionally omitted here; a purchase link can be added later
    } as any);
    if (error) {
      console.error("[submitReview] insert:", error);
      throw new Error("לא ניתן לשמור את חוות הדעת כעת. אנא נסו שוב.");
    }
    return { ok: true as const };
  });

// ---- Public: fetch approved reviews + summary for a product ----------------

const ProductIdSchema = z.object({ product_id: z.string().uuid() });

export const getProductReviews = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ProductIdSchema.parse(i))
  .handler(async ({ data }): Promise<{ summary: ReviewSummary; reviews: PublicReview[] }> => {
    const { data: rows, error } = await supabaseAdmin
      .from("reviews")
      .select("id, author_name, rating, title, body, created_at")
      .eq("product_id", data.product_id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[getProductReviews]:", error);
      return { summary: { average: 0, count: 0 }, reviews: [] };
    }
    const reviews = (rows ?? []) as PublicReview[];
    const count = reviews.length;
    const average =
      count > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { summary: { average, count }, reviews };
  });

// ---- Admin: moderation -----------------------------------------------------

async function requireAdmin() {
  const userId = await getOptionalUserId();
  if (!userId) throw new Error("אין הרשאה.");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("אין הרשאה.");
  return userId;
}

export const listPendingReviews = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, product_id, author_name, rating, title, body, is_approved, created_at, products(name, slug)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[listPendingReviews]:", error);
    throw new Error("שגיאה בטעינת חוות הדעת.");
  }
  return data ?? [];
});

const ModerateSchema = z.object({ id: z.string().uuid(), approved: z.boolean() });
export const setReviewApproval = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ModerateSchema.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("reviews")
      .update({ is_approved: data.approved })
      .eq("id", data.id);
    if (error) throw new Error("שגיאה בעדכון חוות הדעת.");
    return { ok: true as const };
  });

const DeleteSchema = z.object({ id: z.string().uuid() });
export const deleteReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DeleteSchema.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error("שגיאה במחיקת חוות הדעת.");
    return { ok: true as const };
  });
