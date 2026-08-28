import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { checkTrackRateLimitByIp, getClientIp } from "@/lib/rate-limit.server";

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
        "id, order_number, status, payment_status, subtotal, shipping, total, created_at, user_id, is_gift, gift_wrap, gift_note, order_items(id, product_id, product_name, quantity, line_total, custom_text, variant_label)",
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
 *
 * `id` IS in the allowlist, deliberately. Without it /track could not link an
 * unpaid order to /order/{id} — the ONLY surface that re-opens CardCom for the
 * same order (see the rationale block at order.$id.tsx:69) — so its "finish
 * paying" CTA had to send the buyer to /cart, which mints a second unpaid order
 * and burns one of the five placeOrder allows per hour. The id is no more
 * sensitive than the order_number the caller has already proven they know: this
 * endpoint is IP-rate-limited and answers "not found" and "wrong email" with the
 * same string, so it cannot be used to discover either value.
 *
 * custom_text / variant_label are here for the same reason they are on the
 * confirmation page: they are the two fields that stop being changeable once
 * production starts, so the buyer must be able to re-read them.
 */
export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TrackSchema.parse(input))
  .handler(async ({ data }) => {
    const ip = getClientIp(getRequest());
    const { limited } = await checkTrackRateLimitByIp(ip);
    if (limited) {
      throw new Error("יותר מדי בקשות מהכתובת הזו. אנא נסו שוב בעוד כמה דקות.");
    }

    const NOT_FOUND = "לא נמצאה הזמנה התואמת לפרטים שהוזנו.";

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, shipping_status, created_at, paid_at, shipped_at, shipping_notified_at, tracking_number, shipping_carrier, customer_email, customer_city, user_id, is_gift, order_items(product_name, quantity, custom_text, variant_label)",
      )
      .eq("order_number", data.order_number.trim())
      .maybeSingle();
    if (error) {
      console.error("[trackOrder] load:", error);
      throw new Error("שגיאה בטעינת ההזמנה. אנא נסו שוב.");
    }
    if (!order) throw new Error(NOT_FOUND);

    if (
      String(order.customer_email ?? "")
        .trim()
        .toLowerCase() !== data.email.trim().toLowerCase()
    ) {
      throw new Error(NOT_FOUND);
    }

    // user_id is fetched only to DERIVE the flag below and is then stripped — it
    // is never returned. /track is the one order surface that requires no
    // session at all, so it must not hand an account identifier to a caller who
    // proved only an order number and an email.
    //
    // Why the flag exists: /track's "complete the payment" CTA links to
    // /order/$id, and getOrderConfirmation THROWS "אין הרשאה לצפות בהזמנה זו"
    // whenever order.user_id is set and the caller is not that user. A member
    // who ordered while signed in and then tracked from a phone — or after the
    // session expired — landed on a page that retries forever and can never
    // succeed, and createCardcomPayment applies the same owner check, so even
    // the pay button behind it would have failed. The client now renders that
    // CTA only for guest orders and keeps the old /cart route otherwise.
    const { customer_email: _omitEmail, user_id: ownerId, ...rest } = order;
    return { ...rest, is_guest_order: ownerId == null };
  });
