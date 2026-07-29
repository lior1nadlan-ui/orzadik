import { createFileRoute } from "@tanstack/react-router";
import { runCardcomReconciliation } from "@/lib/cardcom-settle.server";
import { handleCronRequest } from "@/lib/cron-auth.server";

/**
 * Settles CardCom payments the webhook never landed.
 *
 * Driven every 10 minutes by the Nitro cron plugin (src/nitro/cron.ts); this route
 * exists so an external scheduler — or a human debugging a specific incident — can
 * drive the same job, gated on CRON_SECRET like every other cron route.
 *
 * It matters because the webhook answers CardCom with HTTP 200 on order-not-found,
 * ReturnValue mismatch and both integrity blocks, and a 200 permanently ends
 * CardCom's retry ladder. Any of those — plus a plain Worker error — can leave a
 * CHARGED card attached to an order that stays unpaid, with no confirmation email,
 * no stock decrement and no shipping notification, and nothing to notice it. The
 * sweep re-asks CardCom about such orders and settles them through the very same
 * settleCardcomOrder the webhook uses, so the double-send latches still hold.
 */
export const Route = createFileRoute("/api/cron/cardcom-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleCronRequest(request, "cardcom-reconcile", runCardcomReconciliation),
      GET: async ({ request }) =>
        handleCronRequest(request, "cardcom-reconcile", runCardcomReconciliation),
    },
  },
});
