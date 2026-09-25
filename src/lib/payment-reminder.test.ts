import { describe, it, expect } from "vitest";
import { paymentReminderDecision, type ReminderOrder } from "./payment-reminder";
import { recoveredBy } from "./crm-digest";

// Every "no" below is a way the email would be wrong: money already taken, a
// customer who already paid, someone who asked us to stop, or a second email
// about the same basket. The "yes" is the one shopper it exists for.

const NOW = Date.parse("2026-09-25T10:00:00Z");
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function order(over: Partial<ReminderOrder> = {}): ReminderOrder {
  return {
    id: "o1",
    customer_email: "ruth@example.com",
    customer_phone: "050-1112222",
    payment_status: "unpaid",
    status: "pending",
    created_at: ago(3 * HOUR),
    contact_consent: true,
    payment_reminder_sent_at: null,
    cardcom_tranzaction_id: null,
    ...over,
  };
}

const ctx = (over: Partial<Parameters<typeof paymentReminderDecision>[1]> = {}) => ({
  now: NOW,
  recovered: recoveredBy([]),
  suppressed: new Set<string>(),
  recentlyCartReminded: new Set<string>(),
  ...over,
});

describe("who gets the payment reminder", () => {
  it("sends to a shopper who left the payment page three hours ago", () => {
    expect(paymentReminderDecision(order(), ctx())).toBe("send");
    expect(paymentReminderDecision(order({ payment_status: "failed" }), ctx())).toBe("send");
  });

  it("never offers a second charge when CardCom already captured one", () => {
    const o = order({ payment_status: "failed", cardcom_tranzaction_id: 123456 });
    expect(paymentReminderDecision(o, ctx())).toBe("money-captured");
    expect(paymentReminderDecision(o, ctx({ manual: true }))).toBe("money-captured");
  });

  it("stays silent for someone who paid on a later order", () => {
    const paidLater = {
      customer_email: "RUTH@example.com",
      customer_phone: null,
      payment_status: "paid",
      status: "processing",
      created_at: ago(2 * HOUR),
    };
    const d = paymentReminderDecision(order(), ctx({ recovered: recoveredBy([paidLater]) }));
    expect(d).toBe("not-open");
  });

  it("honours the opt-out list and the order consent, even when pressed by hand", () => {
    expect(
      paymentReminderDecision(order(), ctx({ suppressed: new Set(["ruth@example.com"]) })),
    ).toBe("suppressed");
    expect(paymentReminderDecision(order({ contact_consent: false }), ctx({ manual: true }))).toBe(
      "no-consent",
    );
  });

  it("waits two hours, gives up after three days, and sends once", () => {
    expect(paymentReminderDecision(order({ created_at: ago(90 * 60_000) }), ctx())).toBe(
      "too-soon",
    );
    expect(paymentReminderDecision(order({ created_at: ago(73 * HOUR) }), ctx())).toBe("too-late");
    expect(paymentReminderDecision(order({ payment_reminder_sent_at: ago(HOUR) }), ctx())).toBe(
      "already-sent",
    );
  });

  it("lets the owner's button send outside the window and a second time", () => {
    const old = order({ created_at: ago(28 * 24 * HOUR), payment_reminder_sent_at: ago(HOUR) });
    expect(paymentReminderDecision(old, ctx({ manual: true }))).toBe("send");
  });

  it("does not follow a cart reminder with a second email about the same basket", () => {
    expect(
      paymentReminderDecision(
        order(),
        ctx({ recentlyCartReminded: new Set(["ruth@example.com"]) }),
      ),
    ).toBe("recent-cart-reminder");
  });

  it("leaves cancelled, refunded and paid orders alone", () => {
    expect(paymentReminderDecision(order({ status: "cancelled" }), ctx())).toBe("not-open");
    expect(paymentReminderDecision(order({ payment_status: "paid" }), ctx())).toBe("not-open");
  });
});

describe("the payment reminder email", () => {
  it("links back to the same order, escapes the name and carries no offer", async () => {
    const { renderPaymentReminder } = await import("./payment-reminder.server");
    const { subject, html } = renderPaymentReminder(
      {
        ...order(),
        user_id: null,
        order_number: "260827-0393",
        customer_name: "<b>רות</b>",
        total: 1437,
        order_items: [{ product_name: "טלית", quantity: 1, line_total: 1400, custom_text: "יוסף" }],
      },
      "https://orzadik.com/unsubscribe?x=1",
    );
    expect(subject).toContain("260827-0393");
    expect(html).toContain("/order/o1");
    expect(html).toContain("&lt;b&gt;רות&lt;/b&gt;");
    expect(html).not.toContain("<b>רות</b>");
    expect(html).toContain("להסרה מרשימת התפוצה");
    for (const pitch of ["הנחה", "קופון", "מבצע", "אחרונים"]) expect(html).not.toContain(pitch);
  });
});
