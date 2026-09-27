// Live promotions for server-only senders (the campaign and abandoned-cart
// emails). placeOrder reads them itself, with its own guard.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPromoIndex, EMPTY_PROMO_INDEX, type PromoIndex } from "@/lib/promotions";

/**
 * The promotions live right now. Never throws: on a failed read an email
 * quotes regular prices, which are never below what the site charges.
 */
export async function loadPromoIndexServer(): Promise<PromoIndex> {
  try {
    const { data, error } = await supabaseAdmin.rpc("active_promotion_index");
    if (error) {
      console.error("[promotions] index for email:", error);
      return EMPTY_PROMO_INDEX;
    }
    return buildPromoIndex(data);
  } catch (e) {
    console.error("[promotions] index for email:", e);
    return EMPTY_PROMO_INDEX;
  }
}
