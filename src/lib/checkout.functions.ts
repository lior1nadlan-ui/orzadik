import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { checkOrderRateLimit, checkOrderRateLimitByIp } from "@/lib/rate-limit.server";
import {
  SHIPPING_FLAT,
  getEffectivePrice as effectivePrice,
  applyMemberDiscount as applyMember,
} from "@/lib/pricing";

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}


// Price math (SITE_DISCOUNT / MEMBER_DISCOUNT / SHIPPING_FLAT / effectivePrice /
// applyMember) now comes from the shared src/lib/pricing.ts — no more duplicated
// constants to keep in sync with the client.

// Strip HTML tags from user-supplied plain-text fields before storing.
// Prevents stored XSS if any admin/email template ever renders these unsanitized.
const stripHtml = (v: string) => v.replace(/<[^>]*>/g, "").trim();

const CheckoutSchema = z.object({
  customer_name: z.string().trim().min(1).max(200).transform(stripHtml),
  customer_email: z.string().trim().email().max(255),
  customer_phone: z.string().trim().min(3).max(50).transform(stripHtml),
  customer_address: z.string().trim().min(1).max(500).transform(stripHtml),
  customer_city: z.string().trim().max(200).transform(stripHtml).optional().nullable(),
  notes: z.string().trim().max(2000).transform(stripHtml).optional().nullable(),
  contact_consent: z.boolean().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(999),
        variant_id: z.string().uuid().optional().nullable(),
        custom_text: z.string().trim().max(120).transform(stripHtml).optional().nullable(),
        custom_method: z.enum(["embroidery", "laser"]).optional().nullable(),
      }),
    )
    .min(1)
    .max(100),
});



export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CheckoutSchema.parse(input))
  .handler(async ({ data }) => {
    // Normalize the email so casing/rotation can't dodge the per-email cap.
    const normalizedEmail = data.customer_email.trim().toLowerCase();

    // Rate limit: max 5 orders per email per hour (protects against order spam / scraping)
    const { limited } = await checkOrderRateLimit(normalizedEmail, 5, 60 * 60 * 1000);
    if (limited) {
      throw new Error("יותר מדי ניסיונות הזמנה. אנא המתן שעה ונסה שוב, או צור קשר בוואטסאפ.");
    }

    // Secondary cap by client IP: the email is client-supplied and easily
    // rotated, so an email-only limit is bypassable. Max 15 orders/hour/IP.
    const clientIp = getClientIp(getRequest());
    const { limited: ipLimited } = await checkOrderRateLimitByIp(clientIp);
    if (ipLimited) {
      throw new Error("יותר מדי ניסיונות הזמנה מהכתובת הזו. אנא המתן ונסה שוב, או צור קשר בוואטסאפ.");
    }

    // Re-fetch authoritative prices from DB
    const ids = data.items.map((i) => i.product_id);
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, sku, is_active, stock_status")
      .in("id", ids);
    if (pErr) { console.error("[placeOrder] products fetch:", pErr); throw new Error("שגיאה בטעינת המוצרים. אנא נסה שוב."); }

    // Fetch any referenced size variants for authoritative variant pricing
    const variantIds = data.items.map((i) => i.variant_id).filter(Boolean) as string[];
    let variantsById = new Map<string, { id: string; product_id: string; label: string; price: number | null }>();
    if (variantIds.length > 0) {
      const { data: vrows, error: vErr } = await supabaseAdmin
        .from("product_variants")
        .select("id, product_id, label, price")
        .in("id", variantIds);
      if (vErr) { console.error("[placeOrder] variants fetch:", vErr); throw new Error("שגיאה בטעינת גדלי המוצרים. אנא נסה שוב."); }
      variantsById = new Map((vrows ?? []).map((v: any) => [v.id as string, { id: v.id, product_id: v.product_id, label: v.label, price: v.price !== null && v.price !== undefined ? Number(v.price) : null }]));
    }

    const byId = new Map(products?.map((p) => [p.id, p]) ?? []);
    const lineItems = data.items.map((i) => {
      const p = byId.get(i.product_id);
      if (!p || !p.is_active) throw new Error(`מוצר לא זמין`);
      if (p.stock_status === "outofstock") throw new Error(`מוצר אזל מהמלאי: ${p.name}`);
      let basePrice = Number(p.price);
      let variantLabel: string | null = null;
      if (i.variant_id) {
        const v = variantsById.get(i.variant_id);
        if (!v || v.product_id !== p.id) throw new Error(`גודל לא תקין עבור ${p.name}`);
        if (v.price !== null) basePrice = v.price;
        variantLabel = v.label;
      }
      const unit_price = effectivePrice(basePrice);
      const methodLabel = i.custom_method === "laser" ? "לייזר" : i.custom_method === "embroidery" ? "רקמה" : null;
      const combinedCustom = i.custom_text
        ? methodLabel ? `[${methodLabel}] ${i.custom_text}` : i.custom_text
        : null;
      return {
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        unit_price,
        quantity: i.quantity,
        line_total: unit_price * i.quantity,
        custom_text: combinedCustom,
        variant_label: variantLabel,
      };
    });

    // Derive identity from JWT only — never trust client-supplied user_id
    const authedUserId = await getOptionalUserId();
    let isMember = false;
    if (authedUserId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("is_member")
        .eq("id", authedUserId)
        .maybeSingle();
      isMember = !!prof?.is_member;
    }


    const rawSubtotal = lineItems.reduce((s, l) => s + l.line_total, 0);
    const subtotal = applyMember(rawSubtotal, isMember);
    const memberDiscount = rawSubtotal - subtotal;
    const shipping = subtotal > 0 ? SHIPPING_FLAT : 0;
    const total = subtotal + shipping;

    const memberNote = isMember ? `[חבר מועדון — הנחת 5% (${memberDiscount} ₪)]` : "";
    const finalNotes = data.notes
      ? memberNote ? `${data.notes}\n${memberNote}` : data.notes
      : memberNote || null;

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: authedUserId,
        customer_name: data.customer_name,
        customer_email: normalizedEmail,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        customer_city: data.customer_city ?? null,
        notes: finalNotes,
        subtotal,
        shipping,
        total,
        status: "pending",
        payment_status: "unpaid",
        contact_consent: data.contact_consent ?? false,
        contact_consent_at: data.contact_consent ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (oErr) { console.error("[placeOrder] order insert:", oErr); throw new Error("לא ניתן ליצור את ההזמנה כעת. אנא נסה שוב."); }

    const itemsPayload = lineItems.map((l) => ({ ...l, order_id: order.id }));
    const { error: iErr } = await supabaseAdmin.from("order_items").insert(itemsPayload);
    if (iErr) {
      console.error("[placeOrder] items insert:", iErr);
      // Compensating rollback: an order with no items is unusable and would
      // otherwise linger as an orphan (and pollute the per-email rate-limit
      // count). Remove it before surfacing the error so the customer can retry.
      const { error: delErr } = await supabaseAdmin.from("orders").delete().eq("id", order.id);
      if (delErr) console.error("[placeOrder] orphan order cleanup failed:", delErr);
      throw new Error("שגיאה בשמירת פרטי ההזמנה. אנא נסה שוב.");
    }

    // Mark any open abandoned cart for this email as converted
    await supabaseAdmin
      .from("abandoned_carts")
      .update({ converted_order_id: order.id })
      .ilike("email", normalizedEmail)
      .is("converted_order_id", null);

    return { id: order.id as string };
  });
