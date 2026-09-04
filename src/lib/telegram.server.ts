// Telegram alert to the shop owner on every order.
//
// WHY IT EXISTS
// The owner asked to hear about an order on their phone, with the PICTURES of
// what was bought — the same problem the order emails just solved, but email is
// not where they look first. A ₪2,001 order sat unread for hours; a Telegram
// message arrives with a push notification and the photos are already open.
//
// SEPARATE FROM EMAIL, DELIBERATELY. It does not run through sendEmail and it
// is not gated on isEmailConfigured(): an expired Resend key must not silently
// take the phone alerts down with it. The two paths fail independently.
//
// NEVER THROWS. Every entry point is wrapped, because both call sites sit in
// the checkout and settlement paths — a Telegram outage must never fail an
// order or release the confirmation latch. A failure logs and returns false.
//
// FAILURE VISIBILITY. A returned `false` used to be logged to the Worker and
// nowhere else — invisible to the owner, who is exactly the person a failed
// "don't miss an order" alert matters to. orders.telegram_created_alert_sent_at
// / telegram_paid_alert_sent_at are stamped on a successful send and stay NULL
// on failure, which is what lets /admin/orders show a warning + resend action,
// mirroring confirmation_email_sent_at for the customer's receipt.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orderItemImageUrl } from "@/lib/order-item-photo";
import { ils } from "@/lib/email.server";

/**
 * Photos are fetched by Telegram's servers, not by the phone, so the URL has to
 * be publicly reachable and absolute. Same origin the emails use.
 */
const ORIGIN = process.env.APP_URL || "https://orzadik.com";

/** Telegram renders a photo at up to ~1280px wide in a chat. 512 is a sharp
 *  preview on a phone without making the fetch slow enough to hit the timeout;
 *  the Supabase render endpoint resizes, so this is a real saving. */
const PHOTO_PX = 512;

/** Hard API limit: a media group holds 2–10 items. A larger order is split
 *  across several groups rather than dropping the extra lines. */
const MEDIA_GROUP_MAX = 10;

/** Telegram truncates a message at 4096 characters. Detail lines are bounded
 *  (an order has a fixed set of fields) but item names are not, so the text is
 *  cut with an explicit marker instead of being silently lost. */
const MESSAGE_MAX = 3900;

const TIMEOUT_MS = 8000;

export function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Telegram's HTML parse mode. Only these three need escaping — but they need
 *  it absolutely: a customer name containing `<` makes the whole message a
 *  400 from the API, i.e. no alert at all. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function callTelegram(method: string, body: unknown): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      // The body carries Telegram's own reason ("chat not found", "wrong file
      // identifier") and is the only way to tell a bad chat id from a bad photo
      // URL. It contains no card data and no secret — the token is in the URL,
      // which is not logged.
      const text = await res.text().catch(() => "");
      console.error(`[telegram] ${method} HTTP ${res.status}: ${text.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[telegram] ${method} failed:`, e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function line(label: string, value: unknown): string {
  const v = String(value ?? "").trim();
  return v ? `<b>${esc(label)}:</b> ${esc(v)}\n` : "";
}

/** The order details, as one HTML message. Split out so it is testable without
 *  a network or a database. */
export function buildOrderMessage(order: any, paid: boolean): string {
  const items: any[] = (order.order_items as any[]) ?? [];

  const head = paid ? `✅ <b>הזמנה חדשה — שולם</b>\n` : `🕐 <b>הזמנה חדשה — ממתינה לתשלום</b>\n`;

  let msg = `${head}<b>${esc(order.order_number)}</b>\n\n`;

  msg += line("לקוח", order.customer_name);
  msg += line("טלפון", order.customer_phone);
  msg += line("אימייל", order.customer_email);
  msg += line("כתובת", [order.customer_address, order.customer_city].filter(Boolean).join(", "));
  msg += line("הערות", order.notes);

  if (order.is_gift) {
    msg += `\n🎁 <b>מתנה</b>\n`;
    if (order.gift_wrap) msg += `עטיפת מתנה חגיגית\n`;
    if (order.gift_note) msg += `הקדשה: ${esc(order.gift_note)}\n`;
  }

  msg += `\n<b>פריטים (${items.length}):</b>\n`;
  for (const it of items) {
    msg += `• ${esc(it.product_name)} × ${esc(it.quantity)} — ${esc(ils(it.line_total))}\n`;
    if (it.variant_label) msg += `   גודל: ${esc(it.variant_label)}\n`;
    if (it.custom_text) msg += `   ✦ ${esc(it.custom_text)}\n`;
  }

  // Same arithmetic the receipt prints: orders.subtotal is ALREADY reduced by
  // the 5% member discount while order_items keep their pre-discount totals, so
  // printing subtotal straight under the lines would not add up.
  const itemsSum = items.reduce((s, it) => s + Number(it.line_total ?? 0), 0);
  const memberBenefit = itemsSum - Number(order.subtotal ?? itemsSum);

  msg += `\n<b>סכום פריטים:</b> ${esc(ils(itemsSum))}\n`;
  if (memberBenefit > 0) msg += `<b>הטבת חבר מועדון:</b> -${esc(ils(memberBenefit))}\n`;
  msg += `<b>משלוח:</b> ${Number(order.shipping) === 0 ? "חינם" : esc(ils(order.shipping))}\n`;
  msg += `<b>סך הכל:</b> ${esc(ils(order.total))}\n`;

  if (msg.length > MESSAGE_MAX) {
    msg = `${msg.slice(0, MESSAGE_MAX)}\n…(ההודעה נקטעה — הפירוט המלא בניהול)`;
  }

  msg += `\n${ORIGIN}/admin/orders`;
  return msg;
}

/** Chunk into groups Telegram will accept. A group of ONE is rejected by
 *  sendMediaGroup, so a lone leftover photo goes out via sendPhoto. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Alert the owner about an order, with the product photographs.
 *
 * `paid` distinguishes a settled order from one still at the payment screen —
 * the same distinction the two owner emails make, so a pending order can never
 * be mistaken for money in.
 *
 * Returns whether the DETAILS message went out. The photos are a bonus: they
 * are sent after, and a photo failure never turns a delivered alert into a
 * reported failure.
 *
 * On success, stamps telegram_created_alert_sent_at (paid=false) or
 * telegram_paid_alert_sent_at (paid=true) — the latch /admin/orders reads to
 * show a warning + resend button when this returns false. The stamp write
 * itself is best-effort: its failure is logged but must not turn a delivered
 * alert into a reported one, so it never affects the return value.
 */
export async function sendOrderTelegramAlert(orderId: string, paid: boolean): Promise<boolean> {
  try {
    if (!isTelegramConfigured()) {
      console.log("[telegram] not configured — skipping alert for order", orderId);
      return false;
    }
    const chatId = process.env.TELEGRAM_CHAT_ID!;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, customer_name, customer_email, customer_phone, customer_address, customer_city, notes, subtotal, shipping, total, is_gift, gift_note, gift_wrap, order_items(product_name, quantity, line_total, variant_label, custom_text, products(slug, thumbnail_url))",
      )
      .eq("id", orderId)
      .single();
    if (!order) {
      console.error(`[telegram] order ${orderId} not found — cannot send alert`);
      return false;
    }

    // TEXT FIRST, PHOTOS SECOND, and the order matters. The details are the part
    // the owner cannot get anywhere else on their phone; a rejected photo URL
    // must not be able to take them down with it.
    const sent = await callTelegram("sendMessage", {
      chat_id: chatId,
      text: buildOrderMessage(order, paid),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    if (sent) {
      const now = new Date().toISOString();
      // Two literal branches, not a computed key: the generated Supabase types
      // reject an { [x: string]: string } update object outright.
      const { error: stampErr } = paid
        ? await supabaseAdmin
            .from("orders")
            .update({ telegram_paid_alert_sent_at: now })
            .eq("id", orderId)
        : await supabaseAdmin
            .from("orders")
            .update({ telegram_created_alert_sent_at: now })
            .eq("id", orderId);
      if (stampErr) {
        const column = paid ? "telegram_paid_alert_sent_at" : "telegram_created_alert_sent_at";
        console.error(`[telegram] failed to stamp ${column} for order ${orderId}:`, stampErr);
      }
    }

    const items = (order.order_items as any[]) ?? [];
    const photos = items
      .map((it) => ({ url: orderItemImageUrl(it, ORIGIN, PHOTO_PX), name: it.product_name }))
      .filter((p): p is { url: string; name: string } => !!p.url);

    for (const group of chunk(photos, MEDIA_GROUP_MAX)) {
      if (group.length === 1) {
        await callTelegram("sendPhoto", {
          chat_id: chatId,
          photo: group[0].url,
          caption: group[0].name?.slice(0, 1000),
        });
        continue;
      }
      const ok = await callTelegram("sendMediaGroup", {
        chat_id: chatId,
        // One bad URL fails the WHOLE group — Telegram validates them together.
        // The per-photo retry below is why a single unreachable image costs one
        // picture instead of all ten.
        media: group.map((p) => ({
          type: "photo",
          media: p.url,
          caption: p.name?.slice(0, 1000),
        })),
      });
      if (!ok) {
        for (const p of group) {
          await callTelegram("sendPhoto", {
            chat_id: chatId,
            photo: p.url,
            caption: p.name?.slice(0, 1000),
          });
        }
      }
    }

    if (sent) console.log("[telegram] order alert sent for", order.order_number);
    return sent;
  } catch (e) {
    // A Telegram outage must never fail an order or release the confirmation
    // latch, so nothing escapes this function.
    console.error("[telegram] alert failed:", e);
    return false;
  }
}
