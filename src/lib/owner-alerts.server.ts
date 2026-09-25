// Sending the contact-form and review alerts to the owner's Telegram. The texts
// are built (and their escaping tested) in owner-alerts.ts.
//
// NEVER THROWS. Both call sites sit in a customer's submit path: a Telegram
// outage must not turn a delivered contact message or a saved review into an
// error on the customer's screen.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramText } from "@/lib/telegram.server";
import { buildContactAlert, buildReviewAlert } from "@/lib/owner-alerts";

const ORIGIN = process.env.APP_URL || "https://orzadik.com";

export async function alertOwnerContact(m: {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}): Promise<boolean> {
  try {
    return await sendTelegramText(buildContactAlert(m));
  } catch (e) {
    console.error("[owner-alert] contact:", e);
    return false;
  }
}

export async function alertOwnerReview(r: {
  productId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  author: string;
  verified: boolean;
}): Promise<void> {
  try {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("name")
      .eq("id", r.productId)
      .maybeSingle();
    await sendTelegramText(buildReviewAlert({ ...r, productName: product?.name ?? null }, ORIGIN));
  } catch (e) {
    console.error("[owner-alert] review:", e);
  }
}
