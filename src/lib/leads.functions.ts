// /admin/leads data: carts and unpaid orders in the window, plus the paid
// orders that clear them. The rules live in leads.ts.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { buildLeads, LEAD_WINDOW_DAYS, type Lead } from "@/lib/leads";

export const listLeads = createServerFn({ method: "POST" }).handler(async (): Promise<Lead[]> => {
  await requireAdmin();
  const now = Date.now();
  const since = new Date(now - LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [cartsRes, ordersRes] = await Promise.all([
    supabaseAdmin
      .from("abandoned_carts")
      .select(
        "id, email, name, phone, items, subtotal, converted_order_id, unsubscribed, reminder_1_sent_at, reminder_2_sent_at, created_at",
      )
      .gte("created_at", since)
      .is("converted_order_id", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, payment_reminder_sent_at, cardcom_description, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (cartsRes.error || ordersRes.error) {
    console.error("[listLeads]:", cartsRes.error ?? ordersRes.error);
    throw new Error("שגיאה בטעינת הלידים.");
  }

  const orders = ordersRes.data ?? [];
  const unpaidIds = orders
    .filter((o) => o.payment_status === "unpaid" || o.payment_status === "failed")
    .map((o) => o.id);
  const itemsByOrder = new Map<string, string[]>();
  if (unpaidIds.length) {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("order_id, product_name")
      .in("order_id", unpaidIds);
    for (const it of items ?? []) {
      itemsByOrder.set(it.order_id, [...(itemsByOrder.get(it.order_id) ?? []), it.product_name]);
    }
  }

  return buildLeads(cartsRes.data ?? [], orders, itemsByOrder, now);
});
