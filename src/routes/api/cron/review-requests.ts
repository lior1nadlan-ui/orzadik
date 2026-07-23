import { createFileRoute } from "@tanstack/react-router";
import { runReviewRequests } from "@/lib/review-request.functions";
import { handleCronRequest } from "@/lib/cron-auth.server";

/**
 * Scheduled trigger for post-delivery review-request emails.
 *
 * Driven by the Worker's `scheduled` handler (daily, see wrangler.jsonc), and
 * still callable externally with the shared secret:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://orzadik.com/api/cron/review-requests
 */
export const Route = createFileRoute("/api/cron/review-requests")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleCronRequest(request, "review-requests", runReviewRequests),
      GET: async ({ request }) =>
        handleCronRequest(request, "review-requests", runReviewRequests),
    },
  },
});
