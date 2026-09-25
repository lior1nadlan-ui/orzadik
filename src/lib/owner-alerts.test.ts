import { describe, it, expect } from "vitest";
import { buildContactAlert, buildReviewAlert } from "./owner-alerts";
import { buildFunnel, pct } from "./funnel";

describe("owner alerts", () => {
  it("escapes the customer's text so one '<' cannot kill the alert", () => {
    const t = buildContactAlert({
      name: "<רות>",
      email: "r@example.com",
      phone: "050-111-2222",
      message: "האם יש <טלית> במידה 60?",
    });
    expect(t).not.toContain("<רות>");
    expect(t).toContain("&lt;רות&gt;");
    expect(t).toContain("&lt;טלית&gt;");
    expect(t).toContain('<a href="https://wa.me/972501112222">וואטסאפ</a>');
  });

  it("leaves out the phone line when none was given", () => {
    const t = buildContactAlert({ name: "רות", email: "r@example.com", message: "שאלה קצרה" });
    expect(t).not.toContain("<b>טלפון:</b>");
  });

  it("marks a verified buyer's review and links to moderation", () => {
    const t = buildReviewAlert(
      {
        productName: "טלית מופת",
        rating: 5,
        title: "מושלם",
        body: "הגיע מהר",
        author: "יוסי",
        verified: true,
      },
      "https://orzadik.com",
    );
    expect(t).toContain("★★★★★ · יוסי · קונה מאומת");
    expect(t).toContain("https://orzadik.com/admin/reviews");
  });
});

describe("sales funnel", () => {
  const NOW = Date.parse("2026-09-25T10:00:00Z");
  const d = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
  const o = (email: string, status: string, total: number, code: string | null, days = 5) => ({
    customer_email: email,
    customer_phone: null,
    payment_status: status,
    status: status === "paid" ? "processing" : "pending",
    created_at: d(days),
    total,
    cardcom_response_code: code,
  });

  // The shop's own shape on 2026-09-25: three paid, two left the payment
  // page, one declined — plus shoppers who never got as far as an order.
  const orders = [
    o("a@x.com", "paid", 61, "0"),
    o("b@x.com", "paid", 2001, "0"),
    o("c@x.com", "paid", 198, "0"),
    o("d@x.com", "failed", 385, "5119", 60),
    o("e@x.com", "failed", 1437, "5118"),
    o("f@x.com", "failed", 955, "60000004"),
  ];
  const carts = [
    { email: "b@x.com", created_at: d(5) },
    { email: "G@x.com", created_at: d(3) },
    { email: "g@x.com", created_at: d(3) },
    { email: "h@x.com", created_at: d(20) },
    { email: "old@x.com", created_at: d(200) },
  ];

  it("counts people, not rows, at every step", () => {
    const f = buildFunnel(carts, orders, NOW);
    expect(f.started).toBe(8); // a-f placed orders, g and h only started; old is outside 90 days
    expect(f.placed).toBe(6);
    expect(f.paid).toBe(3);
  });

  it("splits the unpaid money by what CardCom actually said", () => {
    const f = buildFunnel(carts, orders, NOW);
    expect(f.leftPaymentPage).toEqual({ count: 2, value: 385 + 1437 });
    expect(f.declined).toEqual({ count: 1, value: 955 });
  });

  it("does not count a failure the customer fixed by paying again", () => {
    const f = buildFunnel(
      [],
      [o("z@x.com", "failed", 500, "60000004", 3), o("z@x.com", "paid", 500, "0", 2)],
      NOW,
    );
    expect(f.declined.count).toBe(0);
    expect(f.paid).toBe(1);
  });

  it("formats rates without dividing by zero", () => {
    expect(pct(3, 6)).toBe("50%");
    expect(pct(0, 0)).toBe("—");
  });
});
