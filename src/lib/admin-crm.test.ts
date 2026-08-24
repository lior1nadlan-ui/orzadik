import { describe, it, expect } from "vitest";
import {
  aggregateCustomers,
  customerSegment,
  daysSince,
  matchesSegment,
  segmentCounts,
  DORMANT_AFTER_DAYS,
} from "./admin-crm.functions";

// These cover the one pure function behind the customers screen. It decides
// what the owner is told about a person — how much they spent, whether they
// have gone quiet, whether they ever actually paid — so the cases below are
// about those claims being true, not about the shape of the object.

const NOW = Date.parse("2026-08-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

/** Orders arrive newest-first from the DB; these helpers keep that contract. */
function order(over: Record<string, unknown> = {}) {
  return {
    customer_email: "a@example.com",
    customer_name: "אבי",
    customer_phone: "0501234567",
    total: 100,
    payment_status: "paid",
    created_at: daysAgo(1),
    contact_consent: false,
    ...over,
  };
}

describe("daysSince", () => {
  it("floors to whole days and clamps future dates to 0", () => {
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
    expect(daysSince(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0);
  });

  it("returns null rather than NaN for missing or unparseable input", () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince(undefined, NOW)).toBeNull();
    expect(daysSince("not a date", NOW)).toBeNull();
  });
});

describe("customerSegment", () => {
  it("calls someone who never paid a lead, not a customer", () => {
    expect(customerSegment({ paidOrders: 0 })).toBe("lead");
  });

  it("separates a first-time buyer from a returning one", () => {
    expect(customerSegment({ paidOrders: 1 })).toBe("new");
    expect(customerSegment({ paidOrders: 2 })).toBe("repeat");
  });
});

describe("matchesSegment / segmentCounts", () => {
  const rows = [
    { segment: "lead" as const, dormant: true },
    { segment: "new" as const, dormant: false },
    { segment: "repeat" as const, dormant: true },
    { segment: "repeat" as const, dormant: false },
  ];

  it('lets everything through under "all"', () => {
    expect(rows.every((r) => matchesSegment(r, "all"))).toBe(true);
  });

  it("counts a dormant row under BOTH its segment and dormant", () => {
    const counts = segmentCounts(rows);
    expect(counts).toEqual({ all: 4, lead: 1, new: 1, repeat: 2, dormant: 2 });
    // The sum of the three segments is the total; dormant deliberately is not
    // part of that sum, because it overlaps all three.
    expect(counts.lead + counts.new + counts.repeat).toBe(counts.all);
  });

  // The chips promise "click this and see N rows". That only holds while the
  // count and the filter use the same predicate, which is why both go through
  // matchesSegment — this test is what stops them drifting apart.
  it("makes every chip count equal the rows that chip filters to", () => {
    const counts = segmentCounts(rows);
    for (const key of ["all", "lead", "new", "repeat", "dormant"] as const) {
      expect(rows.filter((r) => matchesSegment(r, key))).toHaveLength(counts[key]);
    }
  });
});

describe("aggregateCustomers", () => {
  it("folds a person's orders into one row keyed by lowercased email", () => {
    const rows = aggregateCustomers(
      [
        order({ customer_email: "A@Example.com", total: 300, created_at: daysAgo(2) }),
        order({ customer_email: "a@example.com", total: 200, created_at: daysAgo(40) }),
      ],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a@example.com");
    expect(rows[0].orders).toBe(2);
    expect(rows[0].ltv).toBe(500);
    expect(rows[0].segment).toBe("repeat");
  });

  it("keeps an unpaid order out of the money but inside the order count", () => {
    const rows = aggregateCustomers(
      [
        order({ total: 300, payment_status: "unpaid", created_at: daysAgo(1) }),
        order({ total: 200, payment_status: "paid", created_at: daysAgo(5) }),
      ],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    expect(rows[0].orders).toBe(2);
    expect(rows[0].paidOrders).toBe(1);
    expect(rows[0].ltv).toBe(200);
    expect(rows[0].segment).toBe("new");
  });

  // PINS EXISTING BEHAVIOUR, NOT AN ENDORSEMENT. A refunded order counts toward
  // both paidOrders and LTV, here and in getDashboardStats — the convention
  // across this file is "money that arrived", not "money that stayed". It means
  // a customer who returned everything still reads as a paying customer, which
  // is worth the owner's decision rather than a silent flip by me: changing it
  // would move the dashboard revenue figure too. Pinned so the choice is at
  // least visible and deliberate the next time someone reads this.
  it("counts a refunded order toward LTV, matching the dashboard's convention", () => {
    const rows = aggregateCustomers(
      [order({ total: 250, payment_status: "refunded" })],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    expect(rows[0].paidOrders).toBe(1);
    expect(rows[0].ltv).toBe(250);
    expect(rows[0].segment).toBe("new");
  });

  it("takes name, phone and last-order date from the newest order", () => {
    const rows = aggregateCustomers(
      [
        order({ customer_name: "אבי כהן", customer_phone: "0501111111", created_at: daysAgo(2) }),
        order({ customer_name: "אבי", customer_phone: "0509999999", created_at: daysAgo(90) }),
      ],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    expect(rows[0].name).toBe("אבי כהן");
    expect(rows[0].phone).toBe("0501111111");
    expect(rows[0].daysSinceLastOrder).toBe(2);
  });

  it("marks dormant exactly at the threshold, not a day earlier", () => {
    const justInside = aggregateCustomers(
      [order({ created_at: daysAgo(DORMANT_AFTER_DAYS - 1) })],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    const atThreshold = aggregateCustomers(
      [order({ created_at: daysAgo(DORMANT_AFTER_DAYS) })],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    expect(justInside[0].dormant).toBe(false);
    expect(atThreshold[0].dormant).toBe(true);
  });

  it("treats dormant as cutting across segments, not as one of them", () => {
    const orders = [
      order({ customer_email: "quiet@example.com", created_at: daysAgo(200) }),
      order({ customer_email: "active@example.com", created_at: daysAgo(3) }),
    ];
    const dormant = aggregateCustomers(orders, undefined, "ltv", "dormant", NOW);
    const newOnes = aggregateCustomers(orders, undefined, "ltv", "new", NOW);

    expect(dormant.map((c) => c.email)).toEqual(["quiet@example.com"]);
    // Both are single-purchase customers, so both are "new" — including the
    // one the dormant filter also matches.
    expect(newOnes.map((c) => c.email).sort()).toEqual(["active@example.com", "quiet@example.com"]);
  });

  it("filters leads down to people who never paid", () => {
    const rows = aggregateCustomers(
      [
        order({ customer_email: "paid@example.com", payment_status: "paid" }),
        order({ customer_email: "never@example.com", payment_status: "unpaid" }),
      ],
      undefined,
      "ltv",
      "lead",
      NOW,
    );
    expect(rows.map((c) => c.email)).toEqual(["never@example.com"]);
    expect(rows[0].ltv).toBe(0);
  });

  it("applies the search term and the segment filter together", () => {
    const orders = [
      order({ customer_email: "avi@example.com", customer_name: "אבי", created_at: daysAgo(300) }),
      order({ customer_email: "dana@example.com", customer_name: "דנה", created_at: daysAgo(300) }),
    ];
    const rows = aggregateCustomers(orders, "dana", "ltv", "dormant", NOW);
    expect(rows.map((c) => c.email)).toEqual(["dana@example.com"]);
  });

  it("drops rows with no email — they cannot be a CRM record", () => {
    const rows = aggregateCustomers(
      [order({ customer_email: "" }), order({ customer_email: null })],
      undefined,
      "ltv",
      "all",
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it("sorts by the requested key", () => {
    const orders = [
      order({ customer_email: "big@example.com", total: 900, created_at: daysAgo(50) }),
      order({ customer_email: "recent@example.com", total: 100, created_at: daysAgo(1) }),
    ];
    expect(aggregateCustomers(orders, undefined, "ltv", "all", NOW)[0].email).toBe(
      "big@example.com",
    );
    expect(aggregateCustomers(orders, undefined, "recent", "all", NOW)[0].email).toBe(
      "recent@example.com",
    );
  });
});
