// Shipping-company notifier.
// Currently stubbed: logs the order and updates `shipping_notified_at`.
// When you tell me which carrier (Shlicha / Cheetah / Israel Post / HFD / ...),
// I'll wire either:
//   (a) the carrier's REST API to open a shipment and write back tracking_number, OR
//   (b) an automatic email to the carrier with the order details.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function notifyShippingCompany(orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("order not found");

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_name, product_sku, quantity, custom_text")
    .eq("order_id", orderId);

  const payload = {
    order_number: order.order_number ?? order.id,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address: order.customer_address,
      city: order.customer_city,
    },
    items: items ?? [],
    notes: order.notes,
    total: order.total,
    // Carrier/packing instructions: the parcel needs wrapping and the printed
    // dedication before it ships.
    gift: {
      is_gift: order.is_gift ?? false,
      gift_wrap: order.gift_wrap ?? false,
      gift_note: order.gift_note ?? null,
    },
  };

  // TODO: replace with real carrier API call or transactional email.
  // Log the order id only — customer PII must not persist in Worker logs (CWE-532).
  console.log(
    "[shipping] would notify carrier for order:",
    orderId,
    "items:",
    payload.items.length,
  );

  await supabaseAdmin
    .from("orders")
    .update({ shipping_notified_at: new Date().toISOString() })
    .eq("id", orderId);
}
