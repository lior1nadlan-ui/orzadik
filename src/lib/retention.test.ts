import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  cutoffIso,
  FAILED_SECRETS_GRACE_HOURS,
  ABANDONED_CART_RETENTION_DAYS,
} from "./retention.server";
import { shouldPersistPaymentSecrets } from "./cardcom-settle.server";

describe("payment secrets are only written for a payment that succeeded", () => {
  const TOKEN = "a-real-looking-token";

  it("persists on success with a usable token", () => {
    expect(shouldPersistPaymentSecrets(TOKEN, 0)).toBe(true);
  });

  // The defect this replaces: the write sat ABOVE the responseCode check, so a
  // decline that still carried a token wrote a row holding an Israeli ID number
  // and the next statement marked the order failed.
  it.each([1, 2, 57, 901, -1])("does NOT persist on decline code %i", (code) => {
    expect(shouldPersistPaymentSecrets(TOKEN, code)).toBe(false);
  });

  // CreateTokenOnly is a deliberate token with no charge. It reports 0 like any
  // other success and must keep working — this is the case a naive "only when
  // money moved" rule would break.
  it("persists a CreateTokenOnly result, which also reports code 0", () => {
    expect(shouldPersistPaymentSecrets(TOKEN, 0)).toBe(true);
  });

  it.each([null, undefined, "", "   ", "00000000-0000-0000-0000-000000000000"])(
    "rejects the non-token %p even on success",
    (t) => {
      expect(shouldPersistPaymentSecrets(t, 0)).toBe(false);
    },
  );
});

describe("retention cutoffs", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("counts back the right number of hours", () => {
    expect(cutoffIso(now, 24)).toBe("2026-08-26T12:00:00.000Z");
  });

  it("counts back the cart TTL in whole days", () => {
    expect(cutoffIso(now, ABANDONED_CART_RETENTION_DAYS * 24)).toBe("2026-05-29T12:00:00.000Z");
  });

  // A zero grace would race CardCom's webhook retry ladder and the 72h
  // reconciliation window: a decline can still flip to paid while those run.
  it("keeps a non-zero grace before clearing a failed order's secrets", () => {
    expect(FAILED_SECRETS_GRACE_HOURS).toBeGreaterThan(0);
  });

  // The cart TTL must stay clear of the reminder job's own 30-day scan window,
  // or the sweep starts deleting rows that job still intends to act on.
  it("keeps the cart TTL well past the 30-day reminder window", () => {
    expect(ABANDONED_CART_RETENTION_DAYS).toBeGreaterThanOrEqual(60);
  });
});

// cron.ts says it in a comment — "The keys MUST match wrangler.jsonc
// triggers.crons string-for-string" — because Cloudflare hands the schedule back
// verbatim and a reformatted expression maps to no job at all. A comment cannot
// enforce that. This can: it reads both files and compares the two sets.
describe("every cron schedule is wired on both sides", () => {
  const cronSrc = readFileSync("src/nitro/cron.ts", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");

  const jobKeys = [...cronSrc.matchAll(/^\s*"([^"]+)":\s*\{\s*name:/gm)].map((m) => m[1]);

  const cronsLine = wrangler.match(/"crons":\s*\[([^\]]*)\]/);
  const triggers = cronsLine ? [...cronsLine[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

  it("finds both lists", () => {
    expect(jobKeys.length).toBeGreaterThan(0);
    expect(triggers.length).toBeGreaterThan(0);
  });

  it.each(jobKeys)("job %s has a matching wrangler trigger", (k) => {
    expect(triggers, `"${k}" is in cron.ts JOBS but not in wrangler.jsonc crons`).toContain(k);
  });

  it.each(triggers)("trigger %s has a matching job", (t) => {
    expect(jobKeys, `"${t}" fires but cron.ts maps it to no job — the tick is a no-op`).toContain(
      t,
    );
  });
});
