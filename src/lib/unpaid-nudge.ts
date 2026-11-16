// A push to the owner when a payment gets stuck, while the buyer is still
// warm: an hour after an order was placed and not paid, one Telegram message
// with a tap-to-WhatsApp link that carries a fresh payment link.
//
// Why: by 16.11.2026, 7 of 18 orders never paid, and 5 of them never came
// back — ₪3,340, about 70% of everything paid so far. Four timed out on
// CardCom's page ("24H time out from creation"): the buyer got as far as the
// card form and left. The owner was told when each order was PLACED (the
// "ממתינה לתשלום" alert), which is the moment nobody can tell yet whether they
// will pay; the queue and the morning briefing surface it later, and the
// automatic email goes at 2 hours. A personal WhatsApp within the hour is the
// one thing that reached none of them in time.
//
// Pure, so the rules are tested; unpaid-nudge.server.ts loads the orders and
// sends. Runs in the 10-minute cron slot (src/nitro/cron.ts).

import { UNPAID_GRACE_MS, type RecoveryOrder } from "@/lib/crm-digest";

const HOUR = 60 * 60 * 1000;

/** Not before the grace hour: until then the buyer may still be on the card form. */
export const NUDGE_AFTER_MS = UNPAID_GRACE_MS;
/** After this the moment has passed; the queue and the briefing still list it. */
export const NUDGE_WINDOW_MS = 12 * HOUR;
/** Quiet hours, Israel time: a nudge due at night waits for 07:00. */
export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 7;

export type NudgeOrder = RecoveryOrder & {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  total: number | string | null;
  cardcom_tranzaction_id: number | string | null;
  payment_nudge_sent_at: string | null;
};

export type NudgeDecision =
  | "send"
  | "already-sent"
  | "not-open"
  | "money-captured"
  | "recovered"
  | "too-soon"
  | "too-late"
  | "quiet-hours";

/** The hour in Israel, 0-23, for a timestamp. */
export function israelHour(now: number): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    hourCycle: "h23",
  }).format(new Date(now));
  return Number(h) % 24;
}

export function isQuietHour(now: number): boolean {
  const h = israelHour(now);
  return h >= QUIET_FROM_HOUR || h < QUIET_UNTIL_HOUR;
}

export function unpaidNudgeDecision(
  o: NudgeOrder,
  ctx: { now: number; recovered: (o: RecoveryOrder) => boolean },
): NudgeDecision {
  // A captured charge against an unpaid order needs the owner to check the
  // terminal, not to send the buyer a second payment link.
  if (Number(o.cardcom_tranzaction_id) > 0) return "money-captured";
  if (!["unpaid", "failed"].includes(o.payment_status)) return "not-open";
  if (["cancelled", "refunded"].includes(String(o.status ?? ""))) return "not-open";
  if (o.payment_nudge_sent_at) return "already-sent";
  if (ctx.recovered(o)) return "recovered";
  const age = ctx.now - Date.parse(o.created_at);
  if (!(age > NUDGE_AFTER_MS)) return "too-soon";
  if (age > NUDGE_WINDOW_MS) return "too-late";
  if (isQuietHour(ctx.now)) return "quiet-hours";
  return "send";
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ils = (n: unknown) => `₪${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;

function agoHe(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 90) return `לפני ${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "לפני שעה" : `לפני ${hours} שעות`;
}

/**
 * The Telegram message (HTML). `waUrl` is the pre-filled WhatsApp chat with a
 * link to the order's payment page, which opens a FRESH CardCom session; null
 * when the order has no phone, in which case the message says so.
 */
export function buildNudgeMessage(
  o: NudgeOrder & { item_names?: string[] },
  ctx: { now: number; waUrl: string | null; adminUrl: string },
): string {
  const items = (o.item_names ?? []).filter(Boolean);
  const itemsLine =
    items.length > 0
      ? `${items.slice(0, 3).map(esc).join(", ")}${items.length > 3 ? ` ועוד ${items.length - 3}` : ""}\n`
      : "";
  const who = [o.customer_name, o.customer_phone]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  const age = agoHe(ctx.now - Date.parse(o.created_at));
  const action = ctx.waUrl
    ? `<a href="${esc(ctx.waUrl)}">שליחת קישור תשלום בוואטסאפ</a> · `
    : "אין טלפון בהזמנה, אפשר לשלוח קישור תשלום במייל מההזמנה בניהול. ";
  return (
    `⏳ <b>התשלום לא הושלם</b> · <b>${esc(o.order_number ?? "")}</b> · ${esc(ils(o.total))}\n` +
    (who.length ? `${who.map(esc).join(" · ")}\n` : "") +
    itemsLine +
    `ההזמנה נוצרה ${age} ולא שולמה. הודעה אישית עכשיו מחזירה יותר הזמנות מהמייל האוטומטי שיוצא אחרי שעתיים.\n` +
    `${action}<a href="${esc(ctx.adminUrl)}">ההזמנה בניהול</a>`
  );
}
