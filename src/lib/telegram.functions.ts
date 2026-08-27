// Admin-only setup screen for the Telegram alerts.
//
// WHY IT EXISTS
// The bot token lives in the Worker, but a bot also needs a CHAT ID before it
// can send anything — and the documented way to find one is to open
// api.telegram.org/bot<TOKEN>/getUpdates in a browser. That asks the owner to
// paste a live credential into a URL bar, which is both awkward and the exact
// habit nobody should build. The Worker already holds the token; it can make
// that call itself and just report the number.
//
// Everything here is gated on requireAdmin(). The token is never returned to
// the browser — only whether one is present, the bot's public username, and the
// chat ids that have talked to it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-authz.server";

const TIMEOUT_MS = 8000;

async function telegram(method: string, body?: unknown): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("no-token");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export type TelegramChatCandidate = { id: string; label: string };

export type TelegramSetupStatus = {
  hasToken: boolean;
  /** Whether TELEGRAM_CHAT_ID is set in the Worker — the last missing piece. */
  hasChatId: boolean;
  configuredChatId: string | null;
  botUsername: string | null;
  candidates: TelegramChatCandidate[];
  /** A human-readable reason when discovery found nothing. */
  note: string | null;
};

export const getTelegramSetup = createServerFn({ method: "GET" }).handler(
  async (): Promise<TelegramSetupStatus> => {
    await requireAdmin();

    const out: TelegramSetupStatus = {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasChatId: !!process.env.TELEGRAM_CHAT_ID,
      configuredChatId: process.env.TELEGRAM_CHAT_ID ?? null,
      botUsername: null,
      candidates: [],
      note: null,
    };
    if (!out.hasToken) {
      out.note = "לא הוגדר TELEGRAM_BOT_TOKEN ב-Worker.";
      return out;
    }

    const me = await telegram("getMe").catch(() => null);
    if (me?.ok) out.botUsername = me.result?.username ?? null;
    else {
      // A token that getMe rejects is a wrong or revoked token, and saying so
      // here saves an hour of looking for the chat id that was never the problem.
      out.note = "הטוקן נדחה על ידי טלגרם — כנראה שגוי או בוטל.";
      return out;
    }

    // getUpdates returns NOTHING while a webhook is registered — the two
    // delivery modes are mutually exclusive. Without this check an empty list
    // reads as "the bot never got a message", which would be the wrong fix.
    const hook = await telegram("getWebhookInfo").catch(() => null);
    if (hook?.ok && hook.result?.url) {
      out.note = `לבוט מוגדר webhook (${hook.result.url}), ולכן getUpdates ריק תמיד. צריך להסיר אותו כדי לגלות כך את המזהה.`;
      return out;
    }

    const updates = await telegram("getUpdates", { limit: 100 }).catch(() => null);
    if (!updates?.ok) {
      out.note = "טלגרם לא החזירה עדכונים.";
      return out;
    }

    const seen = new Map<string, string>();
    for (const u of updates.result ?? []) {
      const chat = u?.message?.chat ?? u?.channel_post?.chat ?? u?.my_chat_member?.chat;
      if (!chat?.id) continue;
      const label =
        chat.title ??
        [chat.first_name, chat.last_name].filter(Boolean).join(" ") ??
        chat.username ??
        String(chat.type ?? "");
      seen.set(String(chat.id), label || String(chat.id));
    }
    out.candidates = [...seen].map(([id, label]) => ({ id, label }));

    if (out.candidates.length === 0) {
      // Telegram keeps updates for about 24 hours, so an old /start is gone.
      out.note = "לא נמצאו שיחות. שלח לבוט הודעה כלשהי בטלגרם ורענן את הדף.";
    }
    return out;
  },
);

/**
 * Send a test message to a chat id, so the number can be proven right BEFORE it
 * is saved into the Worker. Getting this wrong is otherwise silent: the alert
 * simply never arrives and nothing says why.
 */
export const sendTelegramTest = createServerFn({ method: "POST" })
  .validator(z.object({ chatId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }): Promise<{ ok: boolean; error: string | null }> => {
    await requireAdmin();
    if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "אין טוקן ב-Worker." };
    const res = await telegram("sendMessage", {
      chat_id: data.chatId,
      text: "✅ בדיקה מאור זרוע לצדיק — התראות ההזמנות יגיעו לכאן.",
    }).catch(() => null);
    if (res?.ok) return { ok: true, error: null };
    return { ok: false, error: res?.description ?? "השליחה נכשלה." };
  });
