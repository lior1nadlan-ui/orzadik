import { describe, it, expect } from "vitest";
import {
  buildDigest,
  businessDaysBetween,
  digestSubject,
  renderDigestEmailInner,
  renderDigestTelegram,
  shipUrgency,
  type DigestCart,
  type DigestOrder,
} from "./crm-digest";

// The briefing tells the owner who to call and what to pack. Each case below
// is about one of those claims being TRUE — an order listed that should not
// be, or missing that should be, sends someone to the wrong customer.

// Thursday 24.9.2026, 07:00 UTC — the moment the cron fires.
const NOW = Date.parse("2026-09-24T07:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

let seq = 0;
function order(over: Partial<DigestOrder> = {}): DigestOrder {
  seq += 1;
  return {
    id: `o${seq}`,
    order_number: `2609-${seq}`,
    customer_name: "דוד",
    customer_email: `c${seq}@example.com`,
    customer_phone: `05000000${seq}`,
    total: 100,
    status: "processing",
    payment_status: "paid",
    created_at: ago(2 * DAY),
    paid_at: ago(2 * DAY),
    shipped_at: null,
    ...over,
  };
}

function cart(over: Partial<DigestCart> = {}): DigestCart {
  seq += 1;
  return {
    id: `c${seq}`,
    email: `cart${seq}@example.com`,
    name: "שרה",
    subtotal: 250,
    created_at: ago(2 * DAY),
    converted_order_id: null,
    unsubscribed: false,
    ...over,
  };
}

describe("business days", () => {
  it("skips Friday and Saturday", () => {
    // Thu 17.9 07:00 → Thu 24.9 07:00: Sun, Mon, Tue, Wed, Thu = 5.
    expect(businessDaysBetween(NOW - 7 * DAY, NOW)).toBe(5);
  });

  it("is zero on the day itself and never negative", () => {
    expect(businessDaysBetween(NOW - HOUR, NOW)).toBe(0);
    expect(businessDaysBetween(NOW, NOW - DAY)).toBe(0);
  });

  it("ties urgency to the 3-14 business days the site promises", () => {
    expect(shipUrgency(2)).toBe("ok");
    expect(shipUrgency(3)).toBe("late");
    expect(shipUrgency(13)).toBe("late");
    expect(shipUrgency(14)).toBe("overdue");
  });
});

describe("orders waiting to ship", () => {
  it("lists paid, unshipped orders oldest first", () => {
    const newer = order({ paid_at: ago(1 * DAY) });
    const older = order({ paid_at: ago(10 * DAY) });
    const d = buildDigest([newer, older], [], 0, NOW);
    expect(d.toShip.map((o) => o.orderNumber)).toEqual([older.order_number, newer.order_number]);
    expect(d.toShip[0].urgency).toBe("late");
  });

  it("marks the shop's real 32-day-old order as overdue", () => {
    const d = buildDigest([order({ paid_at: "2026-08-23T09:44:56Z" })], [], 0, NOW);
    expect(d.toShip[0].urgency).toBe("overdue");
  });

  it("leaves out shipped, cancelled and unpaid orders", () => {
    const d = buildDigest(
      [
        order({ shipped_at: ago(DAY), status: "shipped" }),
        order({ status: "cancelled" }),
        order({ payment_status: "failed", status: "pending", paid_at: null }),
      ],
      [],
      0,
      NOW,
    );
    expect(d.toShip).toEqual([]);
  });
});

describe("payments that did not complete", () => {
  it("lists a failed card older than an hour, biggest first", () => {
    const small = order({ payment_status: "failed", status: "pending", total: 385, paid_at: null });
    const big = order({ payment_status: "failed", status: "pending", total: 1437, paid_at: null });
    const d = buildDigest([small, big], [], 0, NOW);
    expect(d.failedPayments.map((o) => o.total)).toEqual([1437, 385]);
  });

  it("gives a customer still on the payment page an hour", () => {
    const d = buildDigest(
      [order({ payment_status: "unpaid", status: "pending", created_at: ago(20 * 60_000) })],
      [],
      0,
      NOW,
    );
    expect(d.failedPayments).toEqual([]);
  });

  it("drops an attempt the customer already fixed by paying again", () => {
    const failed = order({
      payment_status: "failed",
      status: "pending",
      customer_email: "Ruth@Example.com",
      customer_phone: "050-111-2222",
      created_at: ago(3 * DAY),
      paid_at: null,
    });
    // Same person, retyped with a different case and the phone in +972 form.
    const byEmail = order({
      customer_email: "ruth@example.com",
      created_at: ago(3 * DAY - 600_000),
    });
    expect(buildDigest([failed, byEmail], [], 0, NOW).failedPayments).toEqual([]);

    const byPhone = order({ customer_phone: "+972 50 111 2222", created_at: ago(2 * DAY) });
    expect(buildDigest([failed, byPhone], [], 0, NOW).failedPayments).toEqual([]);
  });

  it("still lists it when the only paid order came BEFORE the failure", () => {
    const paidEarlier = order({ customer_email: "x@example.com", created_at: ago(10 * DAY) });
    const failedLater = order({
      customer_email: "x@example.com",
      payment_status: "failed",
      status: "pending",
      created_at: ago(2 * DAY),
      paid_at: null,
    });
    expect(buildDigest([paidEarlier, failedLater], [], 0, NOW).failedPayments).toHaveLength(1);
  });

  it("stops nagging about attempts older than 30 days", () => {
    const d = buildDigest(
      [
        order({
          payment_status: "failed",
          status: "pending",
          created_at: ago(31 * DAY),
          paid_at: null,
        }),
      ],
      [],
      0,
      NOW,
    );
    expect(d.failedPayments).toEqual([]);
  });
});

describe("open carts", () => {
  it("counts only recoverable carts and sums their value", () => {
    const d = buildDigest(
      [],
      [
        cart({ subtotal: 300 }),
        cart({ subtotal: 120 }),
        cart({ converted_order_id: "o1" }),
        cart({ unsubscribed: true }),
        cart({ subtotal: 0 }),
        cart({ created_at: ago(15 * DAY) }),
        cart({ created_at: ago(10 * 60_000) }),
      ],
      0,
      NOW,
    );
    expect(d.openCarts.count).toBe(2);
    expect(d.openCarts.value).toBe(420);
    expect(d.openCarts.top[0].value).toBe(300);
  });
});

describe("when there is nothing to do", () => {
  it("is not actionable, so the scheduled run stays silent", () => {
    const d = buildDigest([order({ shipped_at: ago(DAY), status: "shipped" })], [], 0, NOW);
    expect(d.actionable).toBe(false);
    expect(digestSubject(d)).toContain("אין משימות");
  });

  it("a review awaiting approval is enough to send", () => {
    expect(buildDigest([], [], 1, NOW).actionable).toBe(true);
  });
});

describe("rendering", () => {
  const d = buildDigest(
    [
      order({ customer_name: "<script>", paid_at: ago(25 * DAY), total: 2001 }),
      order({ payment_status: "failed", status: "pending", paid_at: null, total: 955 }),
    ],
    [cart()],
    2,
    NOW,
  );

  it("escapes customer text in the Telegram HTML", () => {
    const m = renderDigestTelegram(d, NOW, "https://orzadik.com");
    expect(m).not.toContain("<script>");
    expect(m).toContain("&lt;script&gt;");
  });

  it("carries every section and the admin link", () => {
    const m = renderDigestTelegram(d, NOW, "https://orzadik.com");
    for (const needle of [
      "ממתינות למשלוח",
      "₪2,001",
      "🔴",
      "תשלום שלא הושלם",
      "₪955",
      "עגלות פתוחות",
      "חוות דעת",
      "https://orzadik.com/admin",
    ]) {
      expect(m).toContain(needle);
    }
  });

  it("offers the already-delivered option for an order waiting weeks, not a new one", () => {
    expect(renderDigestTelegram(d, NOW, "https://orzadik.com")).toContain("כבר נמסרה ללקוח");
    expect(renderDigestEmailInner(d, NOW, "https://orzadik.com")).toContain("כבר נמסרה ללקוח");
    const fresh = buildDigest([order({ paid_at: ago(2 * HOUR) })], [], 0, NOW);
    expect(fresh.toShip).toHaveLength(1);
    expect(renderDigestTelegram(fresh, NOW, "https://orzadik.com")).not.toContain(
      "כבר נמסרה ללקוח",
    );
  });

  it("puts the same facts in the email and the subject line", () => {
    const html = renderDigestEmailInner(d, NOW, "https://orzadik.com");
    expect(html).toContain("₪2,001");
    expect(html).not.toContain("<script>");
    expect(digestSubject(d)).toBe(
      "סיכום בוקר: הזמנה אחת ממתינה למשלוח · תשלום אחד לא הושלם · עגלה פתוחה אחת · 2 חוות דעת לאישור",
    );
  });
});

describe("the owner's own decisions and reminders", () => {
  it("leaves out what the owner snoozed or dismissed in the admin", () => {
    const ship = order();
    const failed = order({ payment_status: "failed", status: "pending", paid_at: null });
    const c = cart();
    const d = buildDigest([ship, failed], [c], 0, NOW, {
      hidden: new Set([
        `ready_to_ship:${ship.id}`,
        `stuck_unpaid:${failed.id}`,
        `recover_cart:${c.id}`,
      ]),
    });
    expect(d.toShip).toEqual([]);
    expect(d.failedPayments).toEqual([]);
    expect(d.openCarts.count).toBe(0);
    expect(d.actionable).toBe(false);
  });

  it("puts due reminders first, and one is enough to send", () => {
    const d = buildDigest([], [], 0, NOW, {
      followUps: [{ title: "להתקשר לגבי הכיתוב", who: "רות", daysOverdue: 2 }],
    });
    expect(d.actionable).toBe(true);
    const m = renderDigestTelegram(d, NOW, "https://orzadik.com");
    expect(m).toContain("תזכורות להיום (1)");
    expect(m).toContain("להתקשר לגבי הכיתוב · רות · באיחור 2 ימים");
    expect(digestSubject(d)).toBe("סיכום בוקר: תזכורת אחת");
  });

  it("escapes a reminder's text like any customer text", () => {
    const d = buildDigest([], [], 0, NOW, {
      followUps: [{ title: "<b>x</b>", who: "a@b.co", daysOverdue: 0 }],
    });
    expect(renderDigestTelegram(d, NOW, "https://orzadik.com")).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(renderDigestEmailInner(d, NOW, "https://orzadik.com")).not.toContain("<b>x</b>");
  });
});
