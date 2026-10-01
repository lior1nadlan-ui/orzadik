// Telegram → shop: the owner taps a button under an order alert and the order
// moves (see telegram-actions.ts for which buttons and why).
//
// WHO MAY PRESS. Two checks, both required:
//   1. The request carries X-Telegram-Bot-Api-Secret-Token equal to a value
//      derived from the bot token (HMAC), which Telegram only knows because we
//      set it with setWebhook. Anyone else POSTing here is refused. Derived, not
//      a new secret, so there is nothing extra to configure in the Worker.
//   2. The button sits in the shop's own chat (TELEGRAM_CHAT_ID) — the chat the
//      alerts go to, and the one place those buttons exist.
//
// ALWAYS ANSWERS 200 to an authenticated request. Telegram retries a non-2xx
// for hours, and a retried "נשלח" must not be the way a bug announces itself.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyMarkPreparing,
  applyMarkShipped,
  applyReadyForPickup,
} from "@/lib/admin-crm.functions";
import {
  ACTION_DONE,
  confirmKeyboard,
  needsConfirm,
  orderKeyboard,
  parseCallback,
  type OrderAction,
} from "@/lib/telegram-actions";
import type { Actor } from "@/lib/order-events.server";

const TIMEOUT_MS = 8000;

/** The secret_token we hand Telegram in setWebhook. Hex, so it fits the
 *  [A-Za-z0-9_-] alphabet Telegram allows. */
export async function telegramWebhookSecret(): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("orzadik-telegram-webhook-v1"),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function tg(method: string, body: unknown): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) console.error(`[telegram-webhook] ${method} HTTP ${res.status}`);
    return json;
  } catch (e) {
    console.error(`[telegram-webhook] ${method} failed:`, e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadOrder(orderId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, fulfillment, payment_status, status, shipping_status, shipped_at")
    .eq("id", orderId)
    .maybeSingle();
  return data;
}

async function runAction(
  a: OrderAction,
  orderId: string,
  actor: Actor,
): Promise<{ emailSent?: boolean }> {
  switch (a) {
    case "prep":
      await applyMarkPreparing({ order_id: orderId }, actor);
      return {};
    case "ship":
      return applyMarkShipped({ order_id: orderId }, actor);
    case "dlvr":
      return applyMarkShipped({ order_id: orderId, delivered: true }, actor);
    case "ready":
      return applyReadyForPickup({ order_id: orderId }, actor);
    case "pick":
      return applyMarkShipped({ order_id: orderId, delivered: true, carrier: "איסוף עצמי" }, actor);
  }
}

/** Handle one webhook POST. Returns the HTTP response for the route. */
export async function handleTelegramWebhook(request: Request): Promise<Response> {
  const expected = await telegramWebhookSecret();
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !timingSafeEqual(got, expected)) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await request.json().catch(() => null);
  const cq = update?.callback_query;
  if (!cq?.id) return new Response("ok");

  const answer = (text: string, alert = false) =>
    tg("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });

  const chatId = String(cq.message?.chat?.id ?? "");
  if (!chatId || chatId !== String(process.env.TELEGRAM_CHAT_ID ?? "")) {
    await answer("אין הרשאה.", true);
    return new Response("ok");
  }
  const parsed = parseCallback(cq.data);
  if (!parsed) {
    await answer("כפתור לא מוכר.");
    return new Response("ok");
  }
  const messageRef = { chat_id: chatId, message_id: cq.message?.message_id };
  const who = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || "מנהל";

  try {
    const order = await loadOrder(parsed.orderId);
    if (!order) {
      await answer("ההזמנה לא נמצאה.", true);
      return new Response("ok");
    }

    // First tap on an action that emails the customer or closes the order:
    // swap the buttons for "בטוח?" and stop.
    if (parsed.step === "o" && needsConfirm(parsed.action)) {
      await tg("editMessageReplyMarkup", {
        ...messageRef,
        reply_markup: confirmKeyboard(parsed.action, order.id),
      });
      await answer("לאשר?");
      return new Response("ok");
    }
    if (parsed.step === "n") {
      await tg("editMessageReplyMarkup", {
        ...messageRef,
        reply_markup: orderKeyboard(order) ?? { inline_keyboard: [] },
      });
      await answer("בוטל");
      return new Response("ok");
    }

    const r = await runAction(parsed.action, order.id, { label: `טלגרם · ${who}` });
    const fresh = (await loadOrder(order.id)) ?? order;
    await tg("editMessageReplyMarkup", {
      ...messageRef,
      reply_markup: orderKeyboard(fresh) ?? { inline_keyboard: [] },
    });
    const mail =
      parsed.action === "ship" || parsed.action === "ready"
        ? r.emailSent
          ? " · מייל נשלח ללקוח"
          : " · המייל ללקוח לא נשלח"
        : "";
    await answer(`✓ ${ACTION_DONE[parsed.action]}`);
    await tg("sendMessage", {
      chat_id: chatId,
      reply_to_message_id: cq.message?.message_id,
      text: `✓ הזמנה ${order.order_number} ${ACTION_DONE[parsed.action]} על ידי ${who}${mail}`,
    });
  } catch (e: any) {
    // The apply* functions throw Hebrew, user-facing reasons ("ההזמנה בוטלה").
    console.error("[telegram-webhook] action failed:", e);
    await answer(String(e?.message ?? "הפעולה נכשלה.").slice(0, 190), true);
  }
  return new Response("ok");
}
