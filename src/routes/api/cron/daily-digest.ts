import { createFileRoute } from "@tanstack/react-router";
import { runDailyDigest } from "@/lib/crm-digest.server";
import { handleCronRequest } from "@/lib/cron-auth.server";

/**
 * Scheduled trigger for the owner's morning briefing (Telegram + email).
 *
 * Driven by the Worker's `scheduled` handler (daily, alongside the review
 * requests — see src/nitro/cron.ts), and still callable externally with the
 * shared secret:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://orzadik.com/api/cron/daily-digest
 */
const run = () => runDailyDigest();

export const Route = createFileRoute("/api/cron/daily-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCronRequest(request, "daily-digest", run),
      GET: async ({ request }) => handleCronRequest(request, "daily-digest", run),
    },
  },
});
