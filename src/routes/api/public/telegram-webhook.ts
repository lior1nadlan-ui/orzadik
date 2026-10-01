import { createFileRoute } from "@tanstack/react-router";
import { handleTelegramWebhook } from "@/lib/telegram-webhook.server";

/**
 * Button presses from the shop's Telegram chat (order alerts). Registered with
 * setWebhook from /admin/telegram; authenticated by Telegram's secret-token
 * header and the chat id — see src/lib/telegram-webhook.server.ts.
 */
export const Route = createFileRoute("/api/public/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleTelegramWebhook(request),
    },
  },
});
