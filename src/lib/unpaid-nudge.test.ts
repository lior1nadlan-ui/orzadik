import { describe, expect, it } from "vitest";
import {
  buildNudgeMessage,
  isQuietHour,
  israelHour,
  unpaidNudgeDecision,
  type NudgeOrder,
} from "@/lib/unpaid-nudge";

// 16.11.2026 is winter time: Israel is UTC+2.
const NOON_IL = Date.parse("2026-11-16T10:00:00Z");
const NIGHT_IL = Date.parse("2026-11-16T21:30:00Z"); // 23:30 in Israel
const MIN = 60_000;

const order = (over: Partial<NudgeOrder> = {}): NudgeOrder => ({
  id: "o1",
  order_number: "ORD-1001",
  customer_name: "דוד",
  customer_email: "d@example.com",
  customer_phone: "050-1234567",
  total: 1437,
  status: "pending",
  payment_status: "failed",
  created_at: new Date(NOON_IL - 70 * MIN).toISOString(),
  cardcom_tranzaction_id: null,
  payment_nudge_sent_at: null,
  ...over,
});

const never = () => false;

describe("israelHour / isQuietHour", () => {
  it("reads Israel's clock, summer and winter", () => {
    expect(israelHour(NOON_IL)).toBe(12);
    expect(israelHour(Date.parse("2026-07-01T10:00:00Z"))).toBe(13);
    expect(isQuietHour(NOON_IL)).toBe(false);
    expect(isQuietHour(NIGHT_IL)).toBe(true);
    expect(isQuietHour(Date.parse("2026-11-16T04:30:00Z"))).toBe(true); // 06:30
    expect(isQuietHour(Date.parse("2026-11-16T05:00:00Z"))).toBe(false); // 07:00
  });
});

describe("unpaidNudgeDecision", () => {
  it("nudges an order unpaid for over an hour, in the day", () => {
    expect(unpaidNudgeDecision(order(), { now: NOON_IL, recovered: never })).toBe("send");
  });

  it("waits while the buyer may still be on the card form", () => {
    const fresh = order({ created_at: new Date(NOON_IL - 30 * MIN).toISOString() });
    expect(unpaidNudgeDecision(fresh, { now: NOON_IL, recovered: never })).toBe("too-soon");
  });

  it("leaves old orders to the queue and the briefing", () => {
    const old = order({ created_at: new Date(NOON_IL - 13 * 60 * MIN).toISOString() });
    expect(unpaidNudgeDecision(old, { now: NOON_IL, recovered: never })).toBe("too-late");
  });

  it("holds a nudge due at night", () => {
    const o = order({ created_at: new Date(NIGHT_IL - 70 * MIN).toISOString() });
    expect(unpaidNudgeDecision(o, { now: NIGHT_IL, recovered: never })).toBe("quiet-hours");
  });

  it("never nudges twice, nor a paid, cancelled, charged or recovered order", () => {
    const ctx = { now: NOON_IL, recovered: never };
    expect(unpaidNudgeDecision(order({ payment_nudge_sent_at: "x" }), ctx)).toBe("already-sent");
    expect(unpaidNudgeDecision(order({ payment_status: "paid" }), ctx)).toBe("not-open");
    expect(unpaidNudgeDecision(order({ status: "cancelled" }), ctx)).toBe("not-open");
    expect(unpaidNudgeDecision(order({ cardcom_tranzaction_id: 123 }), ctx)).toBe("money-captured");
    expect(unpaidNudgeDecision(order(), { now: NOON_IL, recovered: () => true })).toBe("recovered");
  });
});

describe("buildNudgeMessage", () => {
  it("names the order, the buyer and the two links", () => {
    const msg = buildNudgeMessage(
      { ...order(), item_names: ["תיק טלית קטיפה", "כיפה", "סידור", "מזוזה"] },
      {
        now: NOON_IL,
        waUrl: "https://wa.me/972501234567?text=a&b",
        adminUrl: "https://orzadik.com/admin/orders?q=ORD-1001&open=1",
      },
    );
    expect(msg).toContain("ORD-1001");
    expect(msg).toContain("1,437");
    expect(msg).toContain("דוד · 050-1234567");
    expect(msg).toContain("ועוד 1");
    expect(msg).toContain('href="https://wa.me/972501234567?text=a&amp;b"');
    expect(msg).toContain("לפני 70 דקות");
  });

  it("escapes what the buyer typed, and says so when there is no phone", () => {
    const msg = buildNudgeMessage(
      { ...order({ customer_name: "<b>x</b>", customer_phone: null }) },
      { now: NOON_IL, waUrl: null, adminUrl: "https://orzadik.com/admin/orders" },
    );
    expect(msg).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(msg).toContain("אין טלפון בהזמנה");
  });
});
