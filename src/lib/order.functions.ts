import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { checkTrackRateLimitByIp } from "@/lib/rate-limit.server";

const InputSchema = z.object({ order_id: z.string().uuid() });

/**
 * Fetch a single order for the confirmation page.
 *
 * Why a server function instead of a direct client query:
 *  - Orders RLS grants SELECT only to the owner (auth.uid() = user_id) or an
 *    admin, and anon has NO grant at all. Guest checkouts (user_id IS NULL)
 *    therefore could never read their own confirmation from the browser.
 *  - This runs with the service-role client and authorizes explicitly,
 *    mirroring the guest trust model already used in createCardcomPayment:
 *      • guest orders (user_id null) are viewable by anyone holding the
 *        unguessable order UUID (the same value Cardcom redirects to),
 *      • owned orders require the owner or an admin.
 *
 * Only display-safe columns are returned — never Cardcom internals/notes.
 */
export const getOrderConfirmation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, subtotal, shipping, total, created_at, user_id, is_gift, gift_wrap, order_items(id, product_id, product_name, quantity, line_total, custom_text, variant_label)",
      )
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) {
      console.error("[getOrderConfirmation] load:", error);
      throw new Error("שגיאה בטעינת ההזמנה.");
    }
    if (!order) return null;

    // Authorization for owned orders: owner or admin only.
    if (order.user_id) {
      const callerId = await getOptionalUserId();
      let allowed = callerId === order.user_id;
      if (!allowed && callerId) {
        const { data: role } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .maybeSingle();
        allowed = !!role;
      }
      if (!allowed) throw new Error("אין הרשאה לצפות בהזמנה זו.");
    }

    const { user_id: _omit, ...safe } = order;
    return safe;
  });

// ---- Guest order tracking (/track) -----------------------------------------

const TrackSchema = z.object({
  order_number: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(255),
});

/**
 * Look up an order's shipping progress from the order number + the email it was
 * placed with. This is the only order read that requires no session at all, so
 * it is built defensively:
 *
 *  - Per-IP rate limit BEFORE the query, so the endpoint can't be used to
 *    enumerate order numbers.
 *  - "Not found" and "email doesn't match" return the SAME message. Any
 *    difference between them would confirm that an order number exists.
 *  - The column list is an explicit allowlist of progress fields. Address,
 *    phone, notes, totals and every cardcom_* column stay server-side; the
 *    matching email is dropped before the row is returned.
 */
export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TrackSchema.parse(input))
  .handler(async ({ data }) => {
    const req = getRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const { limited } = await checkTrackRateLimitByIp(ip);
    if (limited) {
      throw new Error("יותר מדי בקשות מהכתובת הזו. אנא נסו שוב בעוד כמה דקות.");
    }

    const NOT_FOUND = "לא נמצאה הזמנה התואמת לפרטים שהוזנו.";

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, status, payment_status, shipping_status, created_at, paid_at, shipped_at, shipping_notified_at, tracking_number, shipping_carrier, customer_email, customer_city, is_gift, order_items(product_name, quantity)",
      )
      .eq("order_number", data.order_number.trim())
      .maybeSingle();
    if (error) {
      console.error("[trackOrder] load:", error);
      throw new Error("שגיאה בטעינת ההזמנה. אנא נסו שוב.");
    }
    if (!order) throw new Error(NOT_FOUND);

    if (
      String(order.customer_email ?? "").trim().toLowerCase() !==
      data.email.trim().toLowerCase()
    ) {
      throw new Error(NOT_FOUND);
    }

    const { customer_email: _omitEmail, ...safe } = order;
    return safe;
  });
