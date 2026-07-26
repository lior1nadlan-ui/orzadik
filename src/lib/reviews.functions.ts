import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { checkOrderRateLimitByIp } from "@/lib/rate-limit.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/email.server";

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
  // Present (and truthy) only when the review is tied to a real order — this is
  // the sole basis for the "קונה מאומת" badge. Optional so the SSR seed in the
  // product route's loader (which doesn't select it) still satisfies the type;
  // the client revalidation via getProductReviews supplies it.
  order_id?: string | null;
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
      // order_id is selected so the client can render the verified-buyer badge.
      // The approved-only gate below is unchanged.
      .select("id, author_name, rating, title, body, created_at, order_id")
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

// ---- Verified-buyer review flow (order-scoped, HMAC-signed link) ------------
//
// A buyer who received the post-purchase review-request email can follow a
// signed link and leave a review tied to their order. The token is bound to the
// ORDER id and signed with the SAME secret + HMAC helper as the unsubscribe
// token (email.server.ts). The payload is domain-separated with a "review:"
// prefix so a review token can never be replayed as an unsubscribe token (or
// vice versa). unsubscribeToken/verifyUnsubscribeToken return null/false when
// UNSUBSCRIBE_SECRET is unset — an unconfigured deployment then produces no
// working links rather than forgeable ones. review-request.functions imports
// reviewToken/reviewUrl to build the email CTA.

const reviewPayload = (orderId: string) => `review:${orderId}`;

export async function reviewToken(orderId: string): Promise<string | null> {
  return unsubscribeToken(reviewPayload(orderId));
}
export async function verifyReviewToken(orderId: string, token: string): Promise<boolean> {
  return verifyUnsubscribeToken(reviewPayload(orderId), token);
}
export function reviewUrl(orderId: string, token: string): string {
  return `https://orzadik.com/review?order=${encodeURIComponent(orderId)}&token=${token}`;
}

export type ReviewOrderProduct = { product_id: string; product_name: string };

const ReviewOrderSchema = z.object({
  order: z.string().uuid(),
  token: z.string().trim().min(1).max(128),
});

// SSR-load the order behind a signed review link. Verifies the token, confirms
// the order actually received a review request, and returns ONLY the products
// on it (id + name) — never the customer's name, email, address or any other
// order field. Any failure (bad token, unknown order, no review request sent,
// no products) resolves to null so the route shows one calm message with no
// detail leak, never confirming whether a given order exists.
export const getOrderForReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ReviewOrderSchema.parse(i))
  .handler(
    async ({ data }): Promise<{ orderId: string; products: ReviewOrderProduct[] } | null> => {
      const ok = await verifyReviewToken(data.order, data.token);
      if (!ok) return null;

      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .select("id, review_request_sent_at, order_items(product_id, product_name)")
        .eq("id", data.order)
        .maybeSingle();
      // Only honour links for orders that actually received a review request.
      if (error || !order || !order.review_request_sent_at) return null;

      // Dedupe products (an order can list the same product on two lines) and
      // expose only display-safe fields.
      const seen = new Set<string>();
      const products: ReviewOrderProduct[] = [];
      for (const it of ((order.order_items as any[]) ?? [])) {
        const pid = it?.product_id;
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        products.push({ product_id: pid, product_name: String(it.product_name ?? "") });
      }
      if (products.length === 0) return null;
      return { orderId: order.id as string, products };
    },
  );

const SubmitVerifiedSchema = z.object({
  order: z.string().uuid(),
  token: z.string().trim().min(1).max(128),
  product_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  author_name: z.string().trim().min(1).max(80).transform(stripHtml),
  title: z.string().trim().max(120).transform(stripHtml).optional().nullable(),
  body: z.string().trim().max(2000).transform(stripHtml).optional().nullable(),
});

// Submit a verified-buyer review. Re-verifies the signed token, confirms the
// chosen product actually belongs to that order, then inserts with order_id set
// and is_approved=false — the owner still moderates every review before it
// shows. Rate-limited by IP (shared order limiter).
export const submitVerifiedReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SubmitVerifiedSchema.parse(i))
  .handler(async ({ data }) => {
    const ip = getClientIp(getRequest());
    const { limited } = await checkOrderRateLimitByIp(ip);
    if (limited) throw new Error("יותר מדי חוות דעת נשלחו מהכתובת הזו. אנא נסו מאוחר יותר.");

    const ok = await verifyReviewToken(data.order, data.token);
    if (!ok) throw new Error("הקישור אינו תקין או שפג תוקפו.");

    // The order must exist, have received a review request, and actually contain
    // the chosen product — so a valid token for one order can't be used to
    // review a product the buyer never purchased.
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, review_request_sent_at, order_items(product_id)")
      .eq("id", data.order)
      .maybeSingle();
    if (error || !order || !order.review_request_sent_at) {
      throw new Error("הקישור אינו תקין או שפג תוקפו.");
    }
    const belongs = ((order.order_items as any[]) ?? []).some(
      (it) => it?.product_id === data.product_id,
    );
    if (!belongs) throw new Error("המוצר שנבחר אינו שייך להזמנה זו.");

    const { error: insErr } = await supabaseAdmin.from("reviews").insert({
      product_id: data.product_id,
      order_id: data.order, // verified-buyer link → drives the "קונה מאומת" badge
      author_name: data.author_name,
      rating: data.rating,
      title: data.title || null,
      body: data.body || null,
      is_approved: false, // owner still moderates
    } as any);
    if (insErr) {
      console.error("[submitVerifiedReview] insert:", insErr);
      throw new Error("לא ניתן לשמור את חוות הדעת כעת. אנא נסו שוב.");
    }
    return { ok: true as const };
  });

// ---- Public: recent approved reviews for the homepage ----------------------

export const getRecentApprovedReviews = createServerFn({ method: "POST" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, author_name, rating, title, body, created_at, products(name, slug)")
    .eq("is_approved", true)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    console.error("[getRecentApprovedReviews]:", error);
    return [];
  }
  return data ?? [];
});

// ---- Admin: moderation -----------------------------------------------------

// requireAdmin moved to admin-authz.server.ts — shared with the CRM functions.

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
