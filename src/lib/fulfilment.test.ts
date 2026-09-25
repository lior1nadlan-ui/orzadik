import { describe, it, expect } from "vitest";
import {
  shippedAtFromDateInput,
  reviewRequestOutlook,
  reviewOutlookText,
  daysSince,
} from "./fulfilment";

// 13:00 in Israel (summer time, UTC+3).
const NOW = Date.parse("2026-09-25T10:00:00Z");
const ORDERED = Date.parse("2026-08-27T11:00:00Z"); // 14:00 Israel

describe("the ship date the owner types", () => {
  it("becomes noon Israel time on that day", () => {
    expect(shippedAtFromDateInput("2026-09-01", { notBefore: ORDERED, now: NOW })).toEqual({
      ok: true,
      iso: "2026-09-01T09:00:00.000Z",
    });
  });

  it("follows the winter clock", () => {
    const r = shippedAtFromDateInput("2026-12-01", {
      notBefore: ORDERED,
      now: Date.parse("2027-01-10T10:00:00Z"),
    });
    expect(r).toEqual({ ok: true, iso: "2026-12-01T10:00:00.000Z" });
  });

  it("never lands before the order or after now", () => {
    // The order day, but the order came in at 14:00 — noon would predate it.
    expect(shippedAtFromDateInput("2026-08-27", { notBefore: ORDERED, now: NOW })).toEqual({
      ok: true,
      iso: new Date(ORDERED).toISOString(),
    });
    // Today, marked at 09:00 Israel — noon has not happened yet.
    const early = Date.parse("2026-09-25T06:00:00Z");
    expect(shippedAtFromDateInput("2026-09-25", { notBefore: ORDERED, now: early })).toEqual({
      ok: true,
      iso: new Date(early).toISOString(),
    });
  });

  it("refuses a future date, a date before the order, and garbage", () => {
    expect(shippedAtFromDateInput("2026-09-26", { notBefore: ORDERED, now: NOW }).ok).toBe(false);
    expect(shippedAtFromDateInput("2026-08-26", { notBefore: ORDERED, now: NOW }).ok).toBe(false);
    expect(shippedAtFromDateInput("1.9.2026", { notBefore: ORDERED, now: NOW }).ok).toBe(false);
  });
});

describe("when the review request will go out", () => {
  const o = (shippedAt: string, over: Partial<Parameters<typeof reviewRequestOutlook>[0]> = {}) =>
    reviewRequestOutlook(
      { shippedAt, contactConsent: true, reviewRequestSentAt: null, ...over },
      NOW,
    );

  it("goes out at the next morning run once seven days have passed", () => {
    const r = reviewRequestOutlook(
      { shippedAt: "2026-09-01T09:00:00Z", contactConsent: true, reviewRequestSentAt: null },
      NOW,
    );
    expect(r).toEqual({ kind: "scheduled", at: Date.parse("2026-09-26T07:00:00Z") });
    expect(reviewOutlookText(r, NOW)).toBe("בקשת חוות דעת תצא ללקוח אוטומטית מחר ב-10:00.");
  });

  it("says today when the run is still ahead this morning", () => {
    const early = Date.parse("2026-09-25T05:00:00Z");
    const r = reviewRequestOutlook(
      { shippedAt: "2026-09-10T09:00:00Z", contactConsent: true, reviewRequestSentAt: null },
      early,
    );
    expect(reviewOutlookText(r, early)).toBe("בקשת חוות דעת תצא ללקוח אוטומטית היום ב-10:00.");
  });

  it("waits for the first run a full week after a recent ship date", () => {
    const r = o("2026-09-24T09:00:00Z");
    // The 1.10 run is two hours short of seven days; the 2.10 run is the first.
    expect(r).toEqual({ kind: "scheduled", at: Date.parse("2026-10-02T07:00:00Z") });
    expect(reviewOutlookText(r, NOW)).toBe("בקשת חוות דעת תצא ללקוח אוטומטית ב-2.10 ב-10:00.");
  });

  it("will not go out past thirty days, without consent, or twice", () => {
    expect(o("2026-08-24T09:00:00Z").kind).toBe("too-old");
    expect(o("2026-09-01T09:00:00Z", { contactConsent: false }).kind).toBe("no-consent");
    expect(o("2026-09-01T09:00:00Z", { reviewRequestSentAt: "2026-09-08T07:00:00Z" }).kind).toBe(
      "sent",
    );
  });

  it("counts whole days since payment", () => {
    expect(daysSince("2026-09-20T10:00:01Z", NOW)).toBe(4);
    expect(daysSince(null, NOW)).toBe(0);
  });
});
