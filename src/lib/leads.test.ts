import { describe, expect, it } from "vitest";
import { buildLeads, type LeadCartRow, type LeadOrderRow } from "./leads";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const cart = (p: Partial<LeadCartRow>): LeadCartRow => ({
  id: "c1",
  email: "a@x.com",
  name: "אבי",
  phone: null,
  items: [{ name: "טלית" }],
  subtotal: 300,
  converted_order_id: null,
  unsubscribed: false,
  reminder_1_sent_at: null,
  reminder_2_sent_at: null,
  created_at: ago(5),
  ...p,
});
const order = (p: Partial<LeadOrderRow>): LeadOrderRow => ({
  id: "o1",
  order_number: "260930-0001",
  customer_name: "אבי",
  customer_email: "a@x.com",
  customer_phone: "050-1234567",
  total: 337,
  status: "pending",
  payment_status: "failed",
  payment_reminder_sent_at: null,
  created_at: ago(3),
  ...p,
});

describe("buildLeads", () => {
  it("lists an open cart as a lead with its items and phone", () => {
    const [l] = buildLeads([cart({ phone: "0501234567" })], [], new Map(), NOW);
    expect(l).toMatchObject({ kind: "cart", value: 300, items: ["טלית"], phone: "0501234567" });
  });

  it("merges a person's cart and unpaid order into one row, order first", () => {
    const leads = buildLeads([cart({})], [order({})], new Map([["o1", ["טלית"]]]), NOW);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ kind: "unpaid_order", orderId: "o1", alsoCart: true });
  });

  it("drops a lead once the same person paid afterwards (by email or phone)", () => {
    const paid = order({ id: "o2", payment_status: "paid", created_at: ago(1) });
    expect(buildLeads([cart({})], [order({}), paid], new Map(), NOW)).toEqual([]);
    const paidByPhone = order({
      id: "o3",
      customer_email: "other@x.com",
      payment_status: "paid",
      created_at: ago(1),
    });
    expect(buildLeads([], [order({}), paidByPhone], new Map(), NOW)).toEqual([]);
  });

  it("keeps a lead when the only payment came BEFORE the attempt", () => {
    const earlier = order({ id: "o0", payment_status: "paid", created_at: ago(100) });
    expect(buildLeads([], [order({}), earlier], new Map(), NOW)).toHaveLength(1);
  });

  it("ignores converted carts, cancelled orders and anything past the window", () => {
    expect(buildLeads([cart({ converted_order_id: "x" })], [], new Map(), NOW)).toEqual([]);
    expect(buildLeads([], [order({ status: "cancelled" })], new Map(), NOW)).toEqual([]);
    expect(buildLeads([cart({ created_at: ago(24 * 31) })], [], new Map(), NOW)).toEqual([]);
  });

  it("sorts newest first", () => {
    const leads = buildLeads(
      [
        cart({ id: "c1", email: "old@x.com", created_at: ago(10) }),
        cart({ id: "c2", email: "new@x.com", created_at: ago(1) }),
      ],
      [],
      new Map(),
      NOW,
    );
    expect(leads.map((l) => l.email)).toEqual(["new@x.com", "old@x.com"]);
  });
});
