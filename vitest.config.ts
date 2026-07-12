import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone Vitest config — intentionally does NOT load vite.config.ts (which
// pulls in the Tailwind/Cloudflare plugins). Unit tests here cover pure logic
// (price math, cart line totals) and run in a plain node environment.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
