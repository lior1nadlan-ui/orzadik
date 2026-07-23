import { createFileRoute } from "@tanstack/react-router";
import { runCampaignTick } from "@/lib/campaigns.functions";
import { handleCronRequest } from "@/lib/cron-auth.server";

/**
 * Sends one batch of the oldest in-flight campaign.
 *
 * Driven every 5 minutes by the Worker's `scheduled` handler: 20 recipients per
 * tick ≈ 240 emails/hour, hands-free. Safe to call concurrently with the admin's
 * "send a batch now" button — recipients are claimed with FOR UPDATE SKIP LOCKED.
 */
export const Route = createFileRoute("/api/cron/campaign-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCronRequest(request, "campaign-tick", runCampaignTick),
      GET: async ({ request }) => handleCronRequest(request, "campaign-tick", runCampaignTick),
    },
  },
});
