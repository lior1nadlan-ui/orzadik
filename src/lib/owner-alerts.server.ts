// Sending the contact-form and review alerts to the owner's Telegram. The texts
// are built (and their escaping tested) in owner-alerts.ts.
//
// NEVER THROWS. Both call sites sit in a customer's submit path: a Telegram
// outage must not turn a delivered contact message or a saved review into an
// error on the customer's screen.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramText } from "@/lib/telegram.server";
import {
  LOW_STOCK,
  buildContactAlert,
  buildLowStockAlert,
  buildReviewAlert,
} from "@/lib/owner-alerts";

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

/**
 * After a paid order's stock decrement: tell the owner which of its products
 * (stock-tracked only) are now at or below LOW_STOCK. Runs once per order,
 * because decrement_order_stock is latched and the callers only alert when it
 * touched rows.
 */
export async function alertOwnerLowStock(orderId: string): Promise<void> {
  try {
    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("product_id")
      .eq("order_id", orderId)
      .not("product_id", "is", null);
    const ids = [...new Set((lines ?? []).map((l) => l.product_id as string))];
    if (ids.length === 0) return;
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("name, sku, stock_qty")
      .in("id", ids)
      .eq("track_stock", true)
      .lte("stock_qty", LOW_STOCK);
    const text = buildLowStockAlert(
      (products ?? []).map((p) => ({ name: p.name, sku: p.sku, qty: Number(p.stock_qty ?? 0) })),
      ORIGIN,
    );
    if (text) await sendTelegramText(text);
  } catch (e) {
    console.error("[owner-alert] low stock:", e);
  }
}
