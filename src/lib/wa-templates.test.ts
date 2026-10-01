import { describe, expect, it } from "vitest";
import { orderPaymentUrl, waFollowUpUnpaid } from "./wa-templates";

const order = { customer_name: "דוד", customer_phone: "050-1234567", order_number: "260928-9005" };

describe("waFollowUpUnpaid", () => {
  it("includes the payment link when given", () => {
    const url = orderPaymentUrl("abc-123");
    const link = waFollowUpUnpaid(order, url)!;
    expect(link.startsWith("https://wa.me/972501234567?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("https://orzadik.com/order/abc-123");
  });

  it("stays link-free without one", () => {
    expect(decodeURIComponent(waFollowUpUnpaid(order)!)).not.toContain("/order/");
  });

  it("returns null without a phone", () => {
    expect(waFollowUpUnpaid({ customer_name: "דוד" }, orderPaymentUrl("x"))).toBeNull();
  });
});
