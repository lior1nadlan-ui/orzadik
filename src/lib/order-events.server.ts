// Order history: who moved an order, and when (public.order_events). Written
// by the server from the shared apply* functions, so a press in the CRM and a
// press in Telegram leave the same trail.
//
// NEVER THROWS. History is a record of an action, not part of it — a failed
// insert is logged and the action it describes still stands.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Who did it: a site admin (user id) and/or a readable label ("טלגרם · ליאור"). */
export type Actor = { userId?: string | null; label?: string | null };

export async function logOrderEvent(
  orderId: string,
  kind: string,
  actor?: Actor,
  detail?: string | null,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("order_events").insert({
      order_id: orderId,
      kind,
      detail: detail ? detail.slice(0, 500) : null,
      actor_user_id: actor?.userId ?? null,
      actor_label: actor?.label ? actor.label.slice(0, 120) : null,
    });
    if (error) console.error("[order-events] insert failed:", error.message);
  } catch (e) {
    console.error("[order-events] insert threw:", e);
  }
}
