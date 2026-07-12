import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";

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
        "id, order_number, status, payment_status, subtotal, shipping, total, created_at, user_id, order_items(id, product_name, quantity, line_total, custom_text, variant_label)",
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
