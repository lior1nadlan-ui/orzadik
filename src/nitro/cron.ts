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

type NitroAppLike = {
  hooks: { hook: (name: string, fn: (payload: any) => unknown) => void };
};

const JOBS: Record<string, { name: string; run: () => Promise<unknown> }> = {
  "0 7 * * *": { name: "review-requests", run: runReviewRequests },
  "*/5 * * * *": { name: "campaign-tick", run: runCampaignTick },
};

export default function (nitroApp: NitroAppLike) {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ controller }: any) => {
    const cron: string = controller?.cron ?? "";
    const job = JOBS[cron];
    if (!job) {
      console.error(`[cron] no job mapped for "${cron}"`);
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
