import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";
import { checkOrderRateLimit, checkOrderRateLimitByIp, getClientIp } from "@/lib/rate-limit.server";
import { sendOrderCreatedOwnerAlert } from "@/lib/order-emails.server";
import { recordNewsletterConsent } from "@/lib/newsletter.functions";
import { priceOrderLines } from "@/lib/order-pricing.server";
import { PICKUP } from "@/lib/business";
import { getShipping, applyMemberDiscount as applyMember } from "@/lib/pricing";

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
  // Delivery by courier (default, and what an older cached bundle sends by
  // omission) or collection from the shop, which waives the shipping fee.
  fulfillment: z.enum(["delivery", "pickup"]).optional(),
  // Separate, optional marketing consent. Unrelated to contact_consent, whose
  // checkout label explicitly promises the details are NOT used for marketing.
  marketing_consent: z.boolean().optional(),
  // Gift options are FREE and data-only — deliberately so. They are recorded on
  // the order for packing, and are read by nothing in the price path.
  is_gift: z.boolean().optional(),
  gift_note: z.string().trim().max(300).transform(stripHtml).optional().nullable(),
  gift_wrap: z.boolean().optional(),
  // The items amount the checkout page showed (after promotions, before the
  // member discount and shipping). Optional so an older cached bundle can still
  // order; when present, placeOrder will not charge more than it.
  expected_items_total: z.number().int().nonnegative().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(999),
        variant_id: z.string().uuid().optional().nullable(),
        custom_text: z.string().trim().max(120).transform(stripHtml).optional().nullable(),
        custom_method: z.enum(["embroidery", "laser", "print"]).optional().nullable(),
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
      throw new Error(
        "יותר מדי ניסיונות הזמנה מהכתובת הזו. אנא המתן ונסה שוב, או צור קשר בוואטסאפ.",
      );
    }

    const lineItems = await priceOrderLines(data.items);

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

    // Never charge more than the page showed. The checkout computes the items
    // amount with the same functions, so the two agree unless something moved
    // in between — a promotion ended, or a price was raised — and then the
    // customer re-checks the new amount instead of meeting it on the card form.
    if (data.expected_items_total !== undefined && rawSubtotal > data.expected_items_total) {
      throw new Error(
        "המחירים באתר עודכנו בזמן שמילאתם את הפרטים (למשל מבצע שהסתיים). רעננו את העמוד כדי לראות את הסכום המעודכן לפני התשלום.",
      );
    }
    const subtotal = applyMember(rawSubtotal, isMember);
    const memberDiscount = rawSubtotal - subtotal;
    const fulfillment = data.fulfillment ?? "delivery";
    const shipping = getShipping(subtotal, fulfillment);
    const total = subtotal + shipping;

    const memberNote = isMember ? `[חבר מועדון — הנחת 5% (${memberDiscount} ₪)]` : "";
    const finalNotes = data.notes
      ? memberNote
        ? `${data.notes}\n${memberNote}`
        : data.notes
      : memberNote || null;

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: authedUserId,
        customer_name: data.customer_name,
        customer_email: normalizedEmail,
        customer_phone: data.customer_phone,
        // A pickup order's address IS the shop, whatever the form held — the
        // packing slip, the emails and the CRM then all say where it goes.
        customer_address: fulfillment === "pickup" ? PICKUP.addressLine : data.customer_address,
        customer_city: fulfillment === "pickup" ? PICKUP.city : (data.customer_city ?? null),
        fulfillment,
        notes: finalNotes,
        subtotal,
        shipping,
        total,
        status: "pending",
        payment_status: "unpaid",
        contact_consent: data.contact_consent ?? false,
        contact_consent_at: data.contact_consent ? new Date().toISOString() : null,
        // Data-only: never read by the subtotal/shipping/total math above.
        // The dedication is dropped unless the order is actually marked a gift,
        // so an unticked-but-typed note can't reach the packing slip.
        is_gift: data.is_gift ?? false,
        gift_wrap: data.is_gift ? (data.gift_wrap ?? false) : false,
        gift_note: data.is_gift ? data.gift_note || null : null,
      })
      .select()
      .single();
    if (oErr) {
      console.error("[placeOrder] order insert:", oErr);
      throw new Error("לא ניתן ליצור את ההזמנה כעת. אנא נסה שוב.");
    }

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

    // NOTE: the abandoned-cart "converted" stamp deliberately does NOT happen
    // here any more. This order is `status: pending, payment_status: unpaid` —
    // the buyer has not paid, they are only about to be sent to CardCom. Marking
    // the cart converted at this point permanently disqualified it from BOTH
    // reminder passes (they gate on `converted_order_id IS NULL`, and nothing
    // ever clears it), so the single most recoverable segment — shoppers who
    // filled the whole form, reached the payment page, then hesitated or had a
    // card declined — was the one segment that never got a reminder, while
    // people who bailed much earlier still got two. The stamp now lives in
    // settleCardcomOrder, keyed on the paid transition. See
    // src/lib/cardcom-settle.server.ts.

    // Optional marketing opt-in ticked at checkout. Fully isolated: the order
    // is already committed at this point, and nothing in here may surface an
    // error to the customer or interrupt the payment redirect.
    if (data.marketing_consent) {
      try {
        await recordNewsletterConsent({
          email: normalizedEmail,
          name: data.customer_name,
          source: "checkout",
          userId: authedUserId,
          // Explicit opt-in tied to a committed order = fresh first-party
          // consent; honor it even if the address had previously unsubscribed.
          allowResubscribe: true,
        });
      } catch (e) {
        console.error("[placeOrder] newsletter opt-in failed (non-fatal):", e);
      }
    }

    // Owner alert on creation (owner asked to hear about EVERY order, not only
    // paid ones — the paid confirmation still arrives from the webhook).
    // Awaited because the Workers runtime may cancel floating promises when
    // the response returns; failure must never break checkout.
    try {
      await sendOrderCreatedOwnerAlert(order.id);
    } catch (e) {
      console.error("[placeOrder] created-order alert failed (non-fatal):", e);
    }

    // NOTE: no customer email at order CREATION, deliberately. There IS a real
    // gap here — a card declined at 23:40 leaves the buyer with no order number
    // and no way back, and their only recovery is to re-checkout, which mints a
    // second unpaid order and burns one of the five per hour the cap above
    // allows. An attempt to close it by mailing every buyer at creation was
    // reverted before shipping: it fires seconds BEFORE most buyers pay, so a
    // successful buyer receives "ההזמנה ממתינה לתשלום" immediately followed by
    // "התקבל תשלום"; and its /order/{id} link throws for any order carrying
    // user_id, i.e. every signed-in member. The correct shape is a DELAYED send
    // from the unpaid sweep — mail only orders still unpaid after N minutes —
    // which changes what real customers receive and belongs with the owner.

    return { id: order.id as string };
  });
