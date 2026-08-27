import { describe, it, expect } from "vitest";
import { buildOrderMessage } from "./telegram.server";

const ORDER = {
  order_number: "260827-9708",
  customer_name: "ישראל ישראלי",
  customer_phone: "050-1234567",
  customer_email: "a@b.co.il",
  customer_address: "הרצל 5",
  customer_city: "נצרת",
  subtotal: 1900,
  shipping: 0,
  total: 1900,
  order_items: [
    { product_name: "כיסוי חלה", quantity: 2, line_total: 400, variant_label: "45X55" },
    { product_name: "גביע קידוש", quantity: 1, line_total: 1600, custom_text: "לזכר אבי" },
  ],
};

describe("the owner's Telegram alert", () => {
  it("names the order and every field the owner has to act on", () => {
    const m = buildOrderMessage(ORDER, true);
    for (const needle of [
      "260827-9708",
      "ישראל ישראלי",
      "050-1234567",
      "a@b.co.il",
      "הרצל 5",
      "נצרת",
      "כיסוי חלה",
      "גביע קידוש",
    ]) {
      expect(m).toContain(needle);
    }
  });

  it("carries the per-line detail that decides what gets packed", () => {
    const m = buildOrderMessage(ORDER, true);
    expect(m).toContain("45X55");
    expect(m).toContain("לזכר אבי");
  });

  // A pending order that reads like a paid one is the expensive mistake here:
  // the owner ships against it and never gets the money.
  it("distinguishes a paid order from one still at the payment screen", () => {
    expect(buildOrderMessage(ORDER, true)).toContain("שולם");
    expect(buildOrderMessage(ORDER, false)).toContain("ממתינה לתשלום");
  });

  // orders.subtotal is ALREADY reduced by the 5% member discount while
  // order_items keep pre-discount totals — printing subtotal under the lines
  // would not add up, exactly as it once did not in the receipt.
  it("shows the member benefit as its own line so the numbers add up", () => {
    const m = buildOrderMessage({ ...ORDER, subtotal: 1900, total: 1900 }, true);
    expect(m).toContain("הטבת חבר מועדון");
    // ils() emits RLM marks around the symbol, so match the digits and the sign,
    // not a hand-typed "₪100" that never appears in the real string.
    expect(m).toMatch(/הטבת חבר מועדון:<\/b> -\u200f?100/);
  });

  it("omits the benefit line when there is no discount", () => {
    expect(buildOrderMessage({ ...ORDER, subtotal: 2000 }, true)).not.toContain("הטבת חבר");
  });

  it("says חינם rather than ₪0 for free shipping", () => {
    expect(buildOrderMessage(ORDER, true)).toContain("חינם");
  });

  // Telegram's HTML parse mode 400s on an unescaped `<`, which means NO alert
  // at all — a customer typing a `<` into a dedication would silence the phone.
  it("escapes markup a customer can type", () => {
    const m = buildOrderMessage(
      { ...ORDER, customer_name: "<b>hax</b> & co", order_items: ORDER.order_items },
      true,
    );
    expect(m).toContain("&lt;b&gt;hax&lt;/b&gt; &amp; co");
    expect(m).not.toContain("<b>hax");
  });

  it("keeps the message inside Telegram's 4096-character limit", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      product_name: `מוצר ארוך מאוד עם שם שלא נגמר מספר ${i}`,
      quantity: 1,
      line_total: 100,
    }));
    const m = buildOrderMessage({ ...ORDER, order_items: many }, true);
    expect(m.length).toBeLessThan(4096);
    expect(m).toContain("נקטעה");
  });

  it("renders the gift details, which have to be printed and wrapped", () => {
    const m = buildOrderMessage(
      { ...ORDER, is_gift: true, gift_wrap: true, gift_note: "מזל טוב" },
      true,
    );
    expect(m).toContain("מתנה");
    expect(m).toContain("מזל טוב");
  });

  it("does not print empty rows for fields the order has no value for", () => {
    const m = buildOrderMessage({ ...ORDER, notes: null, customer_city: null }, true);
    expect(m).not.toContain("הערות");
  });

  it("survives an order with no items rather than throwing", () => {
    expect(() => buildOrderMessage({ ...ORDER, order_items: [] }, true)).not.toThrow();
  });
});
