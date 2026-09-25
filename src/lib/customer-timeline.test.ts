import { describe, it, expect } from "vitest";
import { buildCustomerTimeline } from "./customer-timeline";

// The timeline tells the owner the story of one customer. The cases below are
// about the story being TRUE: nothing claimed that did not happen (a payment
// that failed, a campaign that never went out), nothing out of order.

describe("customer timeline", () => {
  const order = {
    order_number: "260827-9708",
    total: 2001,
    payment_status: "paid",
    status: "shipped",
    created_at: "2026-08-27T10:42:34Z",
    paid_at: "2026-08-27T10:43:27Z",
    shipped_at: "2026-08-29T09:00:00Z",
    shipping_carrier: "דואר ישראל",
    tracking_number: "RR123456789IL",
    review_request_sent_at: "2026-09-05T07:00:00Z",
  };

  it("tells an order's story newest first, each step linked to the order", () => {
    const t = buildCustomerTimeline({ orders: [order] });
    expect(t.map((e) => e.kind)).toEqual(["review_request", "shipped", "paid", "order"]);
    expect(t.every((e) => e.orderNumber === "260827-9708")).toBe(true);
    expect(t[1].text).toBe("נשלחה בדואר ישראל · מעקב RR123456789IL");
    expect(t[3].text).toBe("הזמנה 260827-9708 · ₪2,001");
  });

  it("never claims a payment for a failed order", () => {
    const t = buildCustomerTimeline({
      orders: [
        { ...order, payment_status: "failed", paid_at: "2026-08-27T11:00:00Z", shipped_at: null },
      ],
    });
    expect(t.some((e) => e.kind === "paid")).toBe(false);
    expect(t.find((e) => e.kind === "order")?.text).toContain("התשלום נכשל");
  });

  it("interleaves carts, reminders, notes and the order in time order", () => {
    const t = buildCustomerTimeline({
      orders: [{ ...order, paid_at: null, shipped_at: null, review_request_sent_at: null }],
      carts: [
        {
          created_at: "2026-08-25T18:00:00Z",
          subtotal: 540,
          converted_order_id: "x",
          reminder_1_sent_at: "2026-08-26T19:15:00Z",
        },
      ],
      notes: [{ note: "ביקש הקדשה עד חמישי", created_at: "2026-08-27T12:00:00Z" }],
    });
    expect(t.map((e) => e.kind)).toEqual(["note", "order", "cart_reminder", "cart"]);
    expect(t[3].text).toBe("השאיר/ה עגלה · ₪540 · הפכה להזמנה");
  });

  it("lists only campaigns that actually reached the customer", () => {
    const t = buildCustomerTimeline({
      campaigns: [
        { status: "sent", sent_at: "2026-09-10T08:00:00Z", subject: "שנה טובה" },
        { status: "failed", sent_at: null, subject: "לא הגיע" },
        { status: "pending", sent_at: null, subject: "בתור" },
      ],
    });
    expect(t).toEqual([
      { at: "2026-09-10T08:00:00Z", kind: "campaign", text: "קיבל/ה דיוור: שנה טובה" },
    ]);
  });

  it("records membership, consent, the newsletter and reminders", () => {
    const t = buildCustomerTimeline({
      profile: {
        created_at: "2026-07-01T10:00:00Z",
        is_member: true,
        member_since: "2026-07-01T10:00:00Z",
        marketing_consent: true,
        marketing_consent_at: "2026-07-01T10:01:00Z",
      },
      newsletter: { consented_at: "2026-07-02T10:00:00Z", unsubscribed_at: "2026-09-01T10:00:00Z" },
      followUps: [
        {
          title: "להתקשר",
          created_at: "2026-09-20T10:00:00Z",
          due_at: "2026-09-24T05:00:00Z",
          done_at: "2026-09-24T09:00:00Z",
        },
      ],
      reviews: [{ rating: 5, created_at: "2026-09-12T10:00:00Z" }],
    });
    expect(t.map((e) => e.kind)).toEqual([
      "followup_done",
      "followup",
      "review",
      "newsletter_off",
      "newsletter",
      "consent",
      "member",
    ]);
    expect(t.find((e) => e.kind === "review")?.text).toBe("כתב/ה חוות דעת · ★★★★★");
  });

  it("drops undated or unparseable events instead of sorting them anywhere", () => {
    const t = buildCustomerTimeline({
      notes: [
        { note: "a", created_at: "not a date" },
        { note: "b", created_at: "2026-09-01T00:00:00Z" },
      ],
    });
    expect(t.map((e) => e.text)).toEqual(["הערה: b"]);
  });
});
