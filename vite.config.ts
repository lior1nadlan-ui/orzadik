// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Outside the Lovable sandbox the nitro deploy plugin is skipped unless
  // explicitly enabled. These options mirror the sandbox defaults so a local
  // `npm run build` produces the same Cloudflare Workers bundle + deploy config.
  nitro: {
    preset: "cloudflare-module",
    output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
    cloudflare: { nodeCompat: true, deployConfig: true },
    // Cron triggers. Nitro generates its own Cloudflare worker entry (it
    // overrides wrangler's `main`), so a `scheduled` export on src/server.ts is
    // never invoked — the only hook that runs is `cloudflare:scheduled`, which
    // this plugin registers. See src/nitro/cron.ts.
    //
    // DO NOT DELETE THIS LINE TO "FIX THE TYPE ERROR": deleting it silently
    // disables EVERY cron job (review requests, campaign batches, abandoned-cart
    // reminders) with no build or runtime failure to notice.
    // @ts-expect-error — @lovable.dev/vite-tanstack-config types `nitro` as a
    // closed object (preset/output/cloudflare only), but it forwards the whole
    // object to Nitro via an unfiltered spread, so `plugins` does reach Nitro at
    // build time. The value is correct; only the wrapper's type is too narrow.
    plugins: ["./src/nitro/cron.ts"],
  },
});
