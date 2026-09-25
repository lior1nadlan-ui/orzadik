import { describe, it, expect } from "vitest";
import { buildHealthReport, sortByUrgency, type HealthInput } from "./system-health";

// The shop as it stood on 2026-09-25: everything configured, instalments off,
// three paid orders unmarked for weeks, nothing ever shipped.
const NOW = Date.parse("2026-09-25T10:00:00Z");
const base = (): HealthInput => ({
  now: NOW,
  config: {
    email: true,
    ownerInbox: "info@orzadik.com",
    telegram: true,
    unsubscribeSecret: true,
    cardcom: true,
    maxPayments: 1,
  },
  activity: {
    lastConfirmationEmail: "2026-09-07T11:39:00Z",
    lastCartReminder: "2026-08-23T11:15:16Z",
    lastPaymentReminder: null,
    lastReviewRequest: null,
    lastCampaignSent: null,
    shippedOrders: 0,
    unshipped: { count: 3, oldestPaidAt: "2026-08-23T09:44:56Z" },
  },
  catalog: { noImage: 0, outOfStock: 12 },
});

const row = (h: HealthInput, id: string) => buildHealthReport(h).find((r) => r.id === id)!;

describe("system health", () => {
  it("flags unshipped paid orders, and says what else they block", () => {
    const r = row(base(), "shipping");
    expect(r.status).toBe("error");
    expect(r.detail).toContain("3 הזמנות");
    expect(r.detail).toContain("בקשת חוות הדעת");
  });

  it("explains why no review request has ever gone out", () => {
    const r = row(base(), "review-requests");
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("אף הזמנה עוד לא סומנה");
  });

  it("shows instalments as switched off, with the two checks to make first", () => {
    const r = row(base(), "installments");
    expect(r.status).toBe("off");
    expect(r.fix).toContain("עמלה על חשבון הלקוח");
    const on = row({ ...base(), config: { ...base().config, maxPayments: 6 } }, "installments");
    expect(on.status).toBe("ok");
    expect(on.detail).toContain("עד 6 תשלומים");
  });

  it("turns every mail-dependent job red when the unsubscribe secret is missing", () => {
    const h = { ...base(), config: { ...base().config, unsubscribeSecret: false } };
    for (const id of ["unsubscribe", "cart-reminders", "review-requests"]) {
      expect(row(h, id).status).toBe("error");
    }
  });

  it("puts what needs doing first", () => {
    const order = sortByUrgency(buildHealthReport(base())).map((r) => r.status);
    const rank = { error: 0, warn: 1, off: 2, ok: 3 } as const;
    expect(order.map((s) => rank[s])).toEqual([...order.map((s) => rank[s])].sort((a, b) => a - b));
    expect(order[0]).toBe("error");
  });

  it("says 'not yet' rather than inventing a date", () => {
    expect(row(base(), "payment-reminders").detail).toContain("עדיין לא");
  });
});
