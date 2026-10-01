import { describe, expect, it } from "vitest";
import {
  availableActions,
  confirmKeyboard,
  needsConfirm,
  orderKeyboard,
  parseCallback,
} from "./telegram-actions";

const id = "0b6f3c2a-1d2e-4f5a-9b8c-7d6e5f4a3b2c";
const paid = { id, payment_status: "paid", status: "processing" };

describe("availableActions", () => {
  it("offers prepare / shipped / delivered for a fresh delivery order", () => {
    expect(availableActions(paid)).toEqual(["prep", "ship", "dlvr"]);
  });
  it("drops 'prepare' once preparing", () => {
    expect(availableActions({ ...paid, shipping_status: "preparing" })).toEqual(["ship", "dlvr"]);
  });
  it("offers ready / picked up for pickup", () => {
    expect(availableActions({ ...paid, fulfillment: "pickup" })).toEqual(["ready", "pick"]);
    expect(
      availableActions({ ...paid, fulfillment: "pickup", shipping_status: "ready_for_pickup" }),
    ).toEqual(["pick"]);
  });
  it("offers nothing on unpaid, shipped, cancelled or completed orders", () => {
    expect(availableActions({ ...paid, payment_status: "unpaid" })).toEqual([]);
    expect(availableActions({ ...paid, shipped_at: "2026-10-01T00:00:00Z" })).toEqual([]);
    expect(availableActions({ ...paid, status: "cancelled" })).toEqual([]);
    expect(availableActions({ ...paid, status: "completed" })).toEqual([]);
    expect(orderKeyboard({ ...paid, status: "refunded" })).toBeNull();
  });
});

describe("callback data", () => {
  it("round-trips through the keyboards within Telegram's 64-byte cap", () => {
    for (const row of orderKeyboard(paid)!.inline_keyboard) {
      const data = row[0].callback_data;
      expect(data.length).toBeLessThanOrEqual(64);
      expect(parseCallback(data)).toMatchObject({ step: "o", orderId: id });
    }
    const [yes, no] = confirmKeyboard("ship", id).inline_keyboard[0];
    expect(parseCallback(yes.callback_data)).toEqual({ step: "y", action: "ship", orderId: id });
    expect(parseCallback(no.callback_data)).toEqual({ step: "n", action: "ship", orderId: id });
  });
  it("rejects anything that is not ours", () => {
    expect(parseCallback("o:ship:not-a-uuid")).toBeNull();
    expect(parseCallback(`x:ship:${id}`)).toBeNull();
    expect(parseCallback(`o:delete:${id}`)).toBeNull();
    expect(parseCallback(`o:ship:${id}:extra`)).toBeNull();
    expect(parseCallback(42)).toBeNull();
  });
  it("asks before anything that emails the customer or closes the order", () => {
    expect(needsConfirm("prep")).toBe(false);
    expect(["ship", "dlvr", "ready", "pick"].every((a) => needsConfirm(a as never))).toBe(true);
  });
});
