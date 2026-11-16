// Sends the stuck-payment nudge (src/lib/unpaid-nudge.ts has the rules and
// the why). Telegram only: it is a push to the owner's phone, and an email an
// hour late would defeat the point. Runs in the 10-minute cron slot.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recoveredBy, type RecoveryOrder } from "@/lib/crm-digest";
import { isTelegramConfigured, sendTelegramText } from "@/lib/telegram.server";
import {
  buildNudgeMessage,
  NUDGE_AFTER_MS,
  NUDGE_WINDOW_MS,
  unpaidNudgeDecision,
  type NudgeOrder,
} from "@/lib/unpaid-nudge";
import { orderPaymentUrl, waFollowUpUnpaid } from "@/lib/wa-templates";

const ORIGIN = process.env.APP_URL || "https://orzadik.com";
const BATCH = 20;

export async function runUnpaidNudges(): Promise<{ nudged: number; waiting: number }> {
  if (!isTelegramConfigured()) return { nudged: 0, waiting: 0 };
  const now = Date.now();
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, created_at, cardcom_tranzaction_id, payment_nudge_sent_at, order_items(product_name)",
    )
    .in("payment_status", ["unpaid", "failed"])
    .is("payment_nudge_sent_at", null)
    .lte("created_at", new Date(now - NUDGE_AFTER_MS).toISOString())
    .gte("created_at", new Date(now - NUDGE_WINDOW_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("[unpaid-nudge] load:", error.message);
    return { nudged: 0, waiting: 0 };
  }
  if (!orders?.length) return { nudged: 0, waiting: 0 };

  // Did the same person pay since (another order, a retyped email or phone)?
  const since = orders[0].created_at;
  const { data: paid } = await supabaseAdmin
    .from("orders")
    .select("customer_email, customer_phone, payment_status, created_at, status")
    .eq("payment_status", "paid")
    .gte("created_at", since);
  const recovered = recoveredBy((paid ?? []) as RecoveryOrder[]);

  let nudged = 0;
  let waiting = 0;
  for (const raw of orders) {
    const o = raw as unknown as NudgeOrder & { order_items?: { product_name: string }[] };
    const decision = unpaidNudgeDecision(o, { now, recovered });
    if (decision === "quiet-hours") {
      waiting += 1;
      continue;
    }
    if (decision !== "send") continue;
    const msg = buildNudgeMessage(
      { ...o, item_names: (o.order_items ?? []).map((i) => i.product_name) },
      {
        now,
        waUrl: waFollowUpUnpaid(o, orderPaymentUrl(o.id)),
        adminUrl: `${ORIGIN}/admin/orders?q=${encodeURIComponent(o.order_number ?? "")}&open=1`,
      },
    );
    const sent = await sendTelegramText(msg);
    if (!sent) continue; // try again on the next tick
    const { error: stampErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_nudge_sent_at: new Date(now).toISOString() })
      .eq("id", o.id)
      .is("payment_nudge_sent_at", null);
    if (stampErr) console.error("[unpaid-nudge] stamp:", stampErr.message);
    nudged += 1;
  }
  return { nudged, waiting };
}
