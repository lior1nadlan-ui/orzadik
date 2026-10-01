// Orders the owner opens from the CRM on a customer's behalf — someone who
// called or wrote on WhatsApp and wants the shop to set it up. The order is a
// normal unpaid order; the customer pays it on its own page (/order/{id}),
// which the owner sends them as a link. Card details never pass through the
// owner, and the price is decided exactly as the site decides it
// (priceOrderLines), never typed in by hand.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { priceOrderLines } from "@/lib/order-pricing.server";
import { applyMemberDiscount, getEffectivePrice, getShipping } from "@/lib/pricing";
import { PICKUP } from "@/lib/business";
import { orderPaymentUrl } from "@/lib/wa-templates";
import { logOrderEvent } from "@/lib/order-events.server";
import { PHONE_ORDER_TAG } from "@/lib/telegram-latch";

const stripHtml = (v: string) => v.replace(/<[^>]*>/g, "").trim();

/** Product picker for a phone order: active products, with their sizes. */
export const searchOrderProducts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ q: z.string().trim().max(120) }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const term = data.q
      .replace(/[,()%\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (term.length < 2) return [];
    const like = `%${term}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("products")
      .select(
        "id, name, sku, price, thumbnail_url, stock_status, product_variants(id, label, price, in_stock)",
      )
      .eq("is_active", true)
      .or(`name.ilike.${like},sku.ilike.${like}`)
      .limit(15);
    if (error) throw new Error("שגיאה בחיפוש מוצרים.");
    return (rows ?? []).map((p: any) => ({
      id: p.id as string,
      name: p.name as string,
      sku: (p.sku as string | null) ?? null,
      thumbnail_url: (p.thumbnail_url as string | null) ?? null,
      outOfStock: p.stock_status === "outofstock",
      // What the site charges today before promotions — a preview only; the
      // order itself is priced on the server when it is created.
      price: getEffectivePrice(Number(p.price)),
      variants: ((p.product_variants as any[]) ?? []).map((v) => ({
        id: v.id as string,
        label: v.label as string,
        price: v.price != null ? getEffectivePrice(Number(v.price)) : null,
        inStock: v.in_stock !== false,
      })),
    }));
  });

const PhoneOrderSchema = z.object({
  customer_name: z.string().trim().min(1).max(200).transform(stripHtml),
  customer_email: z.string().trim().email().max(255),
  customer_phone: z.string().trim().min(3).max(50).transform(stripHtml),
  fulfillment: z.enum(["delivery", "pickup"]),
  customer_address: z.string().trim().max(500).transform(stripHtml).optional().nullable(),
  customer_city: z.string().trim().max(200).transform(stripHtml).optional().nullable(),
  notes: z.string().trim().max(2000).transform(stripHtml).optional().nullable(),
  // The customer agreed, on the call, to be contacted about this order — the
  // same consent the checkout box records. Drives the payment reminder and
  // the review request.
  contact_consent: z.boolean(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(999),
        variant_id: z.string().uuid().optional().nullable(),
        custom_text: z.string().trim().max(120).transform(stripHtml).optional().nullable(),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * Create an unpaid order for a customer and return its payment link.
 *
 * Club membership is honoured when the email belongs to a member — the same 5%
 * they would get ordering on the site themselves. user_id stays NULL on
 * purpose: /order/{id} admits an owned order only to its signed-in owner, so a
 * phone customer would be asked to log in before paying.
 */
export const createPhoneOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => {
    const r = PhoneOrderSchema.safeParse(i);
    if (!r.success) throw new Error("חלק מהפרטים אינם תקינים — בדקו אימייל, טלפון ומוצרים.");
    return r.data;
  })
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const email = data.customer_email.trim().toLowerCase();
    const pickup = data.fulfillment === "pickup";
    if (!pickup && !(data.customer_address ?? "").trim()) {
      throw new Error("יש להזין כתובת למשלוח, או לבחור איסוף עצמי.");
    }

    const lineItems = await priceOrderLines(data.items);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("is_member")
      .eq("email", email)
      .maybeSingle();
    const isMember = !!prof?.is_member;

    const rawSubtotal = lineItems.reduce((s, l) => s + l.line_total, 0);
    const subtotal = applyMemberDiscount(rawSubtotal, isMember);
    const shipping = getShipping(subtotal, data.fulfillment);
    const total = subtotal + shipping;

    const tags = [PHONE_ORDER_TAG];
    if (isMember) tags.push(`[חבר מועדון — הנחת 5% (${rawSubtotal - subtotal} ₪)]`);
    const notes = [data.notes, ...tags].filter(Boolean).join("\n");

    const now = new Date().toISOString();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: null,
        customer_name: data.customer_name,
        customer_email: email,
        customer_phone: data.customer_phone,
        customer_address: pickup ? PICKUP.addressLine : data.customer_address!,
        customer_city: pickup ? PICKUP.city : (data.customer_city ?? null),
        fulfillment: data.fulfillment,
        notes,
        subtotal,
        shipping,
        total,
        status: "pending",
        payment_status: "unpaid",
        contact_consent: data.contact_consent,
        contact_consent_at: data.contact_consent ? now : null,
      })
      .select("id, order_number")
      .single();
    if (error || !order) {
      console.error("[createPhoneOrder] insert:", error);
      throw new Error("לא ניתן ליצור את ההזמנה כעת.");
    }

    const { error: iErr } = await supabaseAdmin
      .from("order_items")
      .insert(lineItems.map((l) => ({ ...l, order_id: order.id })));
    if (iErr) {
      console.error("[createPhoneOrder] items:", iErr);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("שגיאה בשמירת פריטי ההזמנה.");
    }

    await logOrderEvent(order.id, "created_by_phone", { userId: adminId });

    // Who opened it, on the customer's timeline — the CRM's own notes table.
    await supabaseAdmin.from("crm_customer_notes").insert({
      customer_email: email,
      note: `נפתחה הזמנה טלפונית ${order.order_number} על סך ${total} ₪`,
      created_by: adminId,
    });

    return {
      id: order.id as string,
      orderNumber: order.order_number as string,
      total,
      payUrl: orderPaymentUrl(order.id),
    };
  });
