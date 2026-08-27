// Cloudflare cron-trigger wiring.
//
// Two things here were learned the hard way on production, so don't "simplify"
// them back:
//
// 1. This must be a Nitro plugin, not a `scheduled` export on src/server.ts.
//    Nitro owns the top-level Cloudflare module — it logs "[cloudflare]
//    Wrangler config `main` is overridden and will be ignored" at build time
//    and emits its own worker entry, whose scheduled() only fires this hook. A
//    `scheduled` export beside our fetch handler never runs: the trigger fired
//    every 5 minutes with outcome "ok", zero logs, no sub-request.
//
// 2. The jobs are invoked DIRECTLY, not over HTTP. Having the Worker fetch its
//    own public hostname (https://orzadik.com/api/cron/...) returned 522 on
//    every tick — a Worker does not reliably reach itself that way — and
//    nitroApp.localFetch is not exposed on this preset. Calling the functions
//    in-process needs no network and no shared secret, because we are already
//    inside the trusted server.
//
// The /api/cron/* routes still exist and still require CRON_SECRET, so an
// external scheduler remains a supported way to drive the same jobs.

import { runReviewRequests } from "@/lib/review-request.functions";
import { runCampaignTick } from "@/lib/campaigns.functions";
import { runAbandonedCartReminders } from "@/lib/abandoned-cart.functions";
import { runCardcomReconciliation } from "@/lib/cardcom-settle.server";
import { runDataRetentionSweep } from "@/lib/retention.server";

type NitroAppLike = {
  hooks: { hook: (name: string, fn: (payload: any) => unknown) => void };
};

// The keys MUST match wrangler.jsonc `triggers.crons` string-for-string —
// Cloudflare passes the schedule back verbatim in controller.cron, so a
// reformatted expression (e.g. "0 */1 * * *" vs "15 * * * *") silently maps to
// nothing. Keep the two lists edited together.
const JOBS: Record<string, { name: string; run: () => Promise<unknown> }> = {
  "0 7 * * *": { name: "review-requests", run: runReviewRequests },
  "*/5 * * * *": { name: "campaign-tick", run: runCampaignTick },
  "15 * * * *": { name: "abandoned-cart-reminders", run: runAbandonedCartReminders },
  // Safety net for every path that ends CardCom's retry ladder without settling the
  // order — a 200 on order-not-found / ReturnValue mismatch / integrity block, or a
  // plain Worker error. Without this, a charged card can sit against an unpaid order
  // forever and nothing notices. 10 minutes is well clear of the 15-minute grace
  // window inside the job, so it never races a webhook that is merely in flight.
  "*/10 * * * *": { name: "cardcom-reconcile", run: runCardcomReconciliation },
  // The first job here that DELETES. Until it existed nothing in the system ever
  // removed a row, so payment secrets (card token + Israeli ID number) and
  // abandoned carts (email + cart contents) accumulated with no end date.
  // 03:40 UTC is chosen to sit alone: it shares no minute with the */5 and */10
  // ticks, so a slow sweep never contends with a settlement that has money on
  // it. See src/lib/retention.server.ts for what it keeps and why.
  "40 3 * * *": { name: "data-retention", run: runDataRetentionSweep },
};

export default function (nitroApp: NitroAppLike) {
  // Printed once per isolate start. Without it, "no cron ran" is ambiguous
  // between "the plugin was never registered" (the vite.config `plugins` key
  // got dropped) and "the tick fired and the queue was empty" — both look like
  // silence in the Worker log.
  console.log("[cron] plugin loaded, jobs:", Object.keys(JOBS));

  nitroApp.hooks.hook("cloudflare:scheduled", async ({ controller }: any) => {
    const cron: string = controller?.cron ?? "";
    const job = JOBS[cron];
    if (!job) {
      console.error(
        `[cron] no job mapped for "${cron}" — known: ${JSON.stringify(Object.keys(JOBS))}`,
      );
      return;
    }
    try {
      const result = await job.run();
      console.log(`[cron] ${job.name} ok ${JSON.stringify(result)}`);
    } catch (e) {
      console.error(`[cron] ${job.name} failed:`, e);
    }
  });
}
