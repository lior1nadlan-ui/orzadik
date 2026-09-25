import { createFileRoute } from "@tanstack/react-router";
import { runPaymentReminders } from "@/lib/payment-reminder.server";
import { handleCronRequest } from "@/lib/cron-auth.server";

/**
 * Scheduled trigger for the one-per-order "your order is waiting for payment"
 * email. Driven hourly by the Worker's `scheduled` handler (after the cart
 * reminders — see src/nitro/cron.ts), and still callable externally with the
 * shared secret:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://orzadik.com/api/cron/payment-reminders
 */
export const Route = createFileRoute("/api/cron/payment-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleCronRequest(request, "payment-reminders", runPaymentReminders),
      GET: async ({ request }) =>
        handleCronRequest(request, "payment-reminders", runPaymentReminders),
    },
  },
});
