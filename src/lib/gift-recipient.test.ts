import { describe, expect, it } from "vitest";
import { giftRecipientFor, isRecipientPhone, recipientLine } from "@/lib/gift-recipient";

describe("giftRecipientFor", () => {
  it("keeps a delivered gift's recipient, trimmed", () => {
    expect(
      giftRecipientFor({
        isGift: true,
        fulfillment: "delivery",
        name: "  רחל כהן ",
        phone: " 050-1234567 ",
      }),
    ).toEqual({ recipient_name: "רחל כהן", recipient_phone: "050-1234567" });
  });

  it("stores nothing for an order that is not a gift, or a pickup", () => {
    const none = { recipient_name: null, recipient_phone: null };
    expect(
      giftRecipientFor({
        isGift: false,
        fulfillment: "delivery",
        name: "רחל",
        phone: "0501234567",
      }),
    ).toEqual(none);
    expect(
      giftRecipientFor({ isGift: true, fulfillment: "pickup", name: "רחל", phone: "0501234567" }),
    ).toEqual(none);
  });

  it("drops an empty name and a phone that is too short", () => {
    expect(
      giftRecipientFor({ isGift: true, fulfillment: "delivery", name: "   ", phone: "12345" }),
    ).toEqual({ recipient_name: null, recipient_phone: null });
  });
});

describe("isRecipientPhone", () => {
  it("asks only for 9 digits, like the buyer's phone", () => {
    expect(isRecipientPhone("050-123-4567")).toBe(true);
    expect(isRecipientPhone("+972 50 123 4567")).toBe(true);
    expect(isRecipientPhone("04-8123456")).toBe(true);
    expect(isRecipientPhone("1234")).toBe(false);
    expect(isRecipientPhone(null)).toBe(false);
  });
});

describe("recipientLine", () => {
  it("joins what is there", () => {
    expect(recipientLine({ recipient_name: "רחל", recipient_phone: "0501234567" })).toBe(
      "רחל · 0501234567",
    );
    expect(recipientLine({ recipient_name: "רחל" })).toBe("רחל");
    expect(recipientLine({})).toBeNull();
  });
});
