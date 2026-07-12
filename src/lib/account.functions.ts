import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delete the signed-in user's account and personal data (GDPR / Privacy
 * Protection Regulations "right to erasure", takana 13 §8).
 *
 * Legal nuance: past orders are financial/tax records that must be retained,
 * so they are ANONYMIZED (PII stripped, unlinked from the user) rather than
 * deleted. Everything that is purely personal is removed:
 *   - card tokens (order_payment_secrets) for the user's orders
 *   - abandoned-cart snapshots (by user id and by auth email)
 *   - the profile row and any role assignments
 *   - the Supabase auth user itself
 *
 * Identity is taken from the validated JWT (requireSupabaseAuth) — a caller
 * can only ever delete their own account.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const claims = (context.claims ?? {}) as Record<string, unknown>;
    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;

    // 1. Collect the user's orders so we can scrub their payment secrets.
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId);
    const orderIds = (orders ?? []).map((o) => o.id);

    // 2. Remove card tokens for those orders (no longer needed; data minimization).
    if (orderIds.length > 0) {
      await supabaseAdmin
        .from("order_payment_secrets")
        .delete()
        .in("order_id", orderIds);

      // 3. Anonymize the orders — keep the financial record, strip personal data,
      //    and unlink from the (about-to-be-deleted) auth user.
      await supabaseAdmin
        .from("orders")
        .update({
          user_id: null,
          customer_name: "לקוח שנמחק",
          customer_email: "deleted@orzadik.com",
          customer_phone: "",
          customer_address: "—",
          customer_city: null,
          notes: null,
        })
        .in("id", orderIds);

      // 3b. Scrub personalization free-text on the line items — custom_text can
      //     hold a name/dedication, i.e. personal data the erasure must remove.
      await supabaseAdmin
        .from("order_items")
        .update({ custom_text: null })
        .in("order_id", orderIds);
    }

    // 4. Delete abandoned-cart snapshots tied to this user / email.
    await supabaseAdmin.from("abandoned_carts").delete().eq("user_id", userId);
    if (email) {
      await supabaseAdmin.from("abandoned_carts").delete().eq("email", email);
    }

    // 5. Delete role assignments and the profile row.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // §14(b) duty: when a future transactional-email/shipping/analytics provider
    // holds a copy of this person's data, deletion/rectification must be
    // propagated to them too. No such active sub-processor list exists yet
    // (orders stay with us; Supabase/Lovable ARE our storage). Wire downstream
    // erasure here once an external recipient is added.

    // 6. Finally remove the auth user.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("[deleteMyAccount] auth delete failed:", delErr);
      throw new Error("מחיקת החשבון נכשלה. אנא נסו שוב או צרו קשר.");
    }

    return { success: true };
  });

/**
 * Right of access (Privacy Protection Law §13): return all personal data held
 * about the signed-in user, for self-serve viewing/export. Identity from JWT.
 * Excludes payment tokens (order_payment_secrets) — those are not handed back.
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const claims = (context.claims ?? {}) as Record<string, unknown>;
    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "full_name, email, phone, is_member, member_since, marketing_consent, marketing_consent_at, marketing_consent_source, created_at",
      )
      .eq("id", userId)
      .maybeSingle();

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, subtotal, shipping, total, customer_name, customer_email, customer_phone, customer_address, customer_city, notes, created_at, order_items(product_name, quantity, unit_price, line_total, custom_text, variant_label)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let carts: unknown[] = [];
    if (email) {
      const { data: c } = await supabaseAdmin
        .from("abandoned_carts")
        .select("email, name, items, subtotal, created_at, converted_order_id")
        .eq("email", email);
      carts = c ?? [];
    }

    return {
      exported_at: new Date().toISOString(),
      profile: profile ?? null,
      orders: orders ?? [],
      abandoned_carts: carts,
    };
  });
