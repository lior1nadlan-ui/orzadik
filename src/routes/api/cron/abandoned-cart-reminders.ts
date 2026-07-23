import { createFileRoute } from "@tanstack/react-router";
import { runAbandonedCartReminders } from "@/lib/abandoned-cart.functions";
import { handleCronRequest } from "@/lib/cron-auth.server";

/**
 * Scheduled trigger for abandoned-cart reminder emails.
 *
 * Protected by the shared CRON_SECRET gate (see src/lib/cron-auth.server.ts).
 * Callable from any scheduler, e.g. hourly:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://orzadik.com/api/cron/abandoned-cart-reminders
 */
export const Route = createFileRoute("/api/cron/abandoned-cart-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleCronRequest(request, "abandoned-cart-reminders", runAbandonedCartReminders),
      GET: async ({ request }) =>
        handleCronRequest(request, "abandoned-cart-reminders", runAbandonedCartReminders),
    },
  },
});
