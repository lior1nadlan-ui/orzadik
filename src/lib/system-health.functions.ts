// Reads what "מצב המערכת" needs: which integrations are configured (booleans
// only — never a key or a value), when each automatic job last actually did
// something, and two catalogue counts. The judgement is in system-health.ts.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { isEmailConfigured } from "@/lib/email.server";
import { isTelegramConfigured } from "@/lib/telegram.server";
import { BUSINESS } from "@/lib/business";
import { buildHealthReport, sortByUrgency, type HealthRow } from "@/lib/system-health";

/** The newest non-null value of one timestamp column. */
async function latest(
  table: "orders" | "abandoned_carts" | "campaigns",
  column: string,
): Promise<string | null> {
  const { data, error } = await (supabaseAdmin.from(table) as any)
    .select(column)
    .not(column, "is", null)
    .order(column, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[system-health] ${table}.${column}:`, error);
    return null;
  }
  return (data?.[column] as string | undefined) ?? null;
}

export const getSystemHealth = createServerFn({ method: "POST" }).handler(
  async (): Promise<HealthRow[]> => {
    await requireAdmin();

    const [
      lastConfirmationEmail,
      lastCartReminder,
      lastPaymentReminder,
      lastReviewRequest,
      lastCampaignSent,
      shipped,
      unshipped,
      noImage,
      outOfStock,
    ] = await Promise.all([
      latest("orders", "confirmation_email_sent_at"),
      latest("abandoned_carts", "reminder_1_sent_at"),
      latest("orders", "payment_reminder_sent_at"),
      latest("orders", "review_request_sent_at"),
      latest("campaigns", "finished_at"),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .not("shipped_at", "is", null),
      supabaseAdmin
        .from("orders")
        .select("paid_at, created_at")
        .eq("payment_status", "paid")
        .is("shipped_at", null)
        .in("status", ["pending", "processing"])
        .order("paid_at", { ascending: true })
        .limit(500),
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .or("thumbnail_url.is.null,thumbnail_url.eq."),
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("stock_status", "outofstock"),
    ]);
    for (const [label, r] of [
      ["shipped", shipped],
      ["unshipped", unshipped],
      ["noImage", noImage],
      ["outOfStock", outOfStock],
    ] as const) {
      if (r.error) console.error(`[system-health] ${label}:`, r.error);
    }

    const waiting = unshipped.data ?? [];
    const maxPayments = Number(import.meta.env.VITE_CARDCOM_MAX_PAYMENTS);

    return sortByUrgency(
      buildHealthReport({
        now: Date.now(),
        config: {
          email: isEmailConfigured(),
          ownerInbox: (process.env.SHOP_OWNER_EMAIL || BUSINESS.email || "").trim() || null,
          telegram: isTelegramConfigured(),
          unsubscribeSecret: !!process.env.UNSUBSCRIBE_SECRET,
          cardcom: !!(process.env.CARDCOM_TERMINAL_NUMBER && process.env.CARDCOM_API_NAME),
          maxPayments: Number.isInteger(maxPayments) && maxPayments > 1 ? maxPayments : 1,
        },
        activity: {
          lastConfirmationEmail,
          lastCartReminder,
          lastPaymentReminder,
          lastReviewRequest,
          lastCampaignSent,
          shippedOrders: shipped.count ?? 0,
          unshipped: {
            count: waiting.length,
            oldestPaidAt: waiting[0] ? (waiting[0].paid_at ?? waiting[0].created_at) : null,
          },
        },
        catalog: { noImage: noImage.count ?? 0, outOfStock: outOfStock.count ?? 0 },
      }),
    );
  },
);
