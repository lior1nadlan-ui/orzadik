// /admin/leads data: carts and unpaid orders in the window, plus the paid
// orders that clear them. The rules live in leads.ts; the "טופל / 3 ימים /
// לא רלוונטי" decisions are the action queue's own (crm_action_state), so a
// lead set aside in either place is set aside in both.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { buildLeads, LEAD_WINDOW_DAYS, type Lead } from "@/lib/leads";
import { actionVisibility, type ActionVisibility } from "@/lib/crm-tasks";

export type LeadRow = Lead & {
  state: ActionVisibility;
  snoozedUntil: string | null;
  /** An open "חזור אליו" reminder already exists for this person. */
  hasFollowUp: boolean;
};

export const listLeads = createServerFn({ method: "POST" }).handler(
  async (): Promise<LeadRow[]> => {
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

    const leads = buildLeads(cartsRes.data ?? [], orders, itemsByOrder, now);
    if (leads.length === 0) return [];

    const [statesRes, followRes] = await Promise.all([
      supabaseAdmin
        .from("crm_action_state")
        .select("action_key, snoozed_until, dismissed_at")
        .in(
          "action_key",
          leads.map((l) => l.actionKey),
        ),
      supabaseAdmin
        .from("crm_followups")
        .select("customer_email")
        .is("done_at", null)
        .in(
          "customer_email",
          leads.map((l) => l.email),
        ),
    ]);
    // Decisions and reminders are additions: if either read fails, every lead
    // simply shows as open.
    const stateByKey = new Map((statesRes.data ?? []).map((r) => [r.action_key, r]));
    const followUps = new Set((followRes.data ?? []).map((r) => r.customer_email.toLowerCase()));

    return leads.map((l) => {
      const st = stateByKey.get(l.actionKey);
      const state = actionVisibility(st, now);
      return {
        ...l,
        state,
        snoozedUntil: state === "snoozed" ? (st?.snoozed_until ?? null) : null,
        hasFollowUp: followUps.has(l.email),
      };
    });
  },
);
