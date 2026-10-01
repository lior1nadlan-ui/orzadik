import { describe, expect, it } from "vitest";
import { missingTelegramAlert, PHONE_ORDER_TAG } from "./telegram-latch";

const NOW = Date.parse("2026-10-05T12:00:00Z"); // after TELEGRAM_LATCH_SINCE
const base = {
  created_at: "2026-10-05T10:00:00Z",
  status: "pending",
  payment_status: "unpaid",
};

describe("missingTelegramAlert", () => {
  it("ignores orders from before the stamps existed", () => {
    expect(missingTelegramAlert({ ...base, created_at: "2026-09-30T10:00:00Z" }, NOW)).toBeNull();
  });
  it("flags an unpaid order whose created alert never stamped", () => {
    expect(missingTelegramAlert(base, NOW)).toBe("created");
    expect(
      missingTelegramAlert({ ...base, telegram_created_alert_sent_at: base.created_at }, NOW),
    ).toBeNull();
  });
  it("flags a paid order without the paid alert, not one paid offline", () => {
    const paid = { ...base, payment_status: "paid", paid_at: "2026-10-05T10:05:00Z" };
    expect(missingTelegramAlert(paid, NOW)).toBe("paid");
    expect(missingTelegramAlert({ ...paid, payment_provider: "offline" }, NOW)).toBeNull();
    expect(
      missingTelegramAlert({ ...paid, telegram_paid_alert_sent_at: paid.paid_at }, NOW),
    ).toBeNull();
  });
  it("waits a few minutes before calling an alert missing", () => {
    expect(missingTelegramAlert({ ...base, created_at: "2026-10-05T11:59:00Z" }, NOW)).toBeNull();
  });
  it("skips phone orders and closed orders", () => {
    expect(missingTelegramAlert({ ...base, notes: `x\n${PHONE_ORDER_TAG}` }, NOW)).toBeNull();
    expect(missingTelegramAlert({ ...base, status: "cancelled" }, NOW)).toBeNull();
  });
});
