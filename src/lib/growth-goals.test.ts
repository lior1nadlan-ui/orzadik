import { describe, expect, it } from "vitest";
import {
  buyerKey,
  emptySearchShare,
  formatGoalValue,
  goalDaysLeft,
  goalProgress,
  goalReached,
  goalTargetLabel,
  GROWTH_GOALS,
  measureOrders,
  type GoalDef,
  type GoalOrder,
} from "@/lib/growth-goals";

const goal = (key: GoalDef["key"]) => GROWTH_GOALS.find((g) => g.key === key)!;

describe("the goals", () => {
  it("each points from its baseline toward its target", () => {
    for (const g of GROWTH_GOALS) {
      if (g.lowerIsBetter) expect(g.target).toBeLessThan(g.baseline);
      else expect(g.target).toBeGreaterThan(g.baseline);
    }
    expect(new Set(GROWTH_GOALS.map((g) => g.key)).size).toBe(GROWTH_GOALS.length);
  });
});

describe("goalProgress and goalReached", () => {
  it("fills from the baseline to the target, and never below empty", () => {
    const orders = goal("paidOrders30d"); // 3 -> 10
    expect(goalProgress(orders, 3)).toBe(0);
    expect(goalProgress(orders, 2)).toBe(0);
    expect(goalProgress(orders, 6.5)).toBeCloseTo(0.5);
    expect(goalReached(orders, 9)).toBe(false);
    expect(goalReached(orders, 10)).toBe(true);
    expect(goalProgress(orders, 14)).toBe(1);
  });

  it("counts a share going down, and only below the target as reached", () => {
    const search = goal("emptySearchPct"); // 9.5% -> below 4%
    expect(goalProgress(search, 9.5)).toBe(0);
    expect(goalProgress(search, 12)).toBe(0);
    expect(goalProgress(search, 6.75)).toBeCloseTo(0.5);
    expect(goalReached(search, 4)).toBe(false);
    expect(goalProgress(search, 4)).toBe(0.99);
    expect(goalReached(search, 3.9)).toBe(true);
    expect(goalProgress(search, 0)).toBe(1);
  });
});

describe("labels", () => {
  it("writes shares with a percent sign and the target of a share as 'below'", () => {
    const search = goal("emptySearchPct");
    expect(formatGoalValue(search, 9.5)).toBe("9.5%");
    expect(formatGoalValue(search, 4)).toBe("4%");
    expect(goalTargetLabel(search)).toBe("פחות מ-4%");
    expect(goalTargetLabel(goal("mailingList"))).toBe("150");
  });

  it("counts the days to the end of 15.2.2027, Israel time", () => {
    expect(goalDaysLeft(Date.parse("2027-02-15T12:00:00Z"))).toBe(1);
    expect(goalDaysLeft(Date.parse("2027-02-15T22:00:00Z"))).toBe(0);
    expect(goalDaysLeft(Date.parse("2027-03-01T00:00:00Z"))).toBe(0);
    expect(goalDaysLeft(Date.parse("2026-11-16T10:00:00Z"))).toBe(92);
  });
});

describe("measureOrders", () => {
  const now = Date.parse("2026-11-16T10:00:00Z");
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const order = (over: Partial<GoalOrder> = {}): GoalOrder => ({
    customer_email: "a@example.com",
    customer_phone: null,
    payment_status: "paid",
    status: "completed",
    paid_at: daysAgo(5),
    created_at: daysAgo(5),
    ...over,
  });

  it("counts the month's standing sales by when they were paid", () => {
    const r = measureOrders(
      [
        order(),
        order({ paid_at: null, created_at: daysAgo(10), customer_email: "b@example.com" }),
        order({ paid_at: daysAgo(31), created_at: daysAgo(31), customer_email: "c@example.com" }),
        order({ payment_status: "unpaid", customer_email: "d@example.com" }),
        order({ status: "refunded", customer_email: "e@example.com" }),
        order({ status: "cancelled", customer_email: "f@example.com" }),
      ],
      now,
    );
    expect(r.paidOrders30d).toBe(2);
    expect(r.repeatCustomers).toBe(0);
  });

  it("finds a buyer who came back, by email in any case or by phone", () => {
    const r = measureOrders(
      [
        order({ customer_email: "Dana@Example.com", paid_at: daysAgo(200) }),
        order({ customer_email: " dana@example.com " }),
        order({ customer_email: null, customer_phone: "+972-54-1234567" }),
        order({ customer_email: "", customer_phone: "054-1234567", paid_at: daysAgo(90) }),
        order({ customer_email: "once@example.com" }),
        // A second order that was refunded is not a second sale.
        order({ customer_email: "back@example.com" }),
        order({ customer_email: "back@example.com", status: "refunded" }),
      ],
      now,
    );
    expect(r.repeatCustomers).toBe(2);
  });

  it("has no buyer without an email or a usable phone", () => {
    expect(buyerKey({ customer_email: null, customer_phone: "123" })).toBeNull();
    expect(buyerKey({ customer_email: null, customer_phone: "0541234567" })).toBe("tel:0541234567");
  });
});

describe("emptySearchShare", () => {
  it("leaves out crawler templates and counts a corrected search as answered", () => {
    expect(
      emptySearchShare([
        { term: "מזוזה", results_count: 12, corrected_to: null },
        { term: "מזוזע", results_count: 0, corrected_to: "מזוזה" },
        { term: "שופר תימני ענק", results_count: 0, corrected_to: null },
        { term: "{search_term_string}", results_count: 0, corrected_to: null },
      ]),
    ).toEqual({ total: 3, empty: 1, pct: 33.3 });
  });

  it("has no share without searches", () => {
    expect(emptySearchShare([]).pct).toBeNull();
  });
});
