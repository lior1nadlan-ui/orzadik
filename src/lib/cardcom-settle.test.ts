import { describe, it, expect } from "vitest";
import { isUsableCardcomToken, settlementAlreadyRecorded } from "./cardcom-settle.server";

// The point of this guard is not tidiness. Writing the secrets row stores the
// cardholder's identity number; doing that for a transaction that produced no
// token is retention of sensitive data with no purpose. So the case that
// matters most below is the all-zeros GUID — the exact shape CardCom returns
// on a decline, which a plain truthiness test lets through.
describe("isUsableCardcomToken", () => {
  it("rejects CardCom's all-zeros 'no token' sentinel", () => {
    expect(isUsableCardcomToken("00000000-0000-0000-0000-000000000000")).toBe(false);
    // Case and surrounding whitespace must not smuggle it past the guard.
    expect(isUsableCardcomToken("  00000000-0000-0000-0000-000000000000  ")).toBe(false);
    expect(isUsableCardcomToken("00000000-0000-0000-0000-000000000000".toUpperCase())).toBe(false);
  });

  it("rejects absent, blank and non-string values", () => {
    for (const v of [null, undefined, "", "   ", 0, 123, {}, []]) {
      expect(isUsableCardcomToken(v)).toBe(false);
    }
  });

  it("accepts a real token", () => {
    // The token from the same CardCom payload whose TokenInfo.Token was zeros —
    // TranzactionInfo carried a genuine one, so the two must not be confused.
    expect(isUsableCardcomToken("56bd7b07-fab5-46e6-bec7-b67930b80cef")).toBe(true);
  });
});

// The sweep's window is `updated_at > now - 72h`, and orders_updated_at bumps
// updated_at on ANY update — including one that writes back the values already
// there. So a permanently declined order that the sweep re-writes every ten
// minutes never ages out, and with the query's limit of 50 it can hold a slot
// that a genuinely stuck payment needs. These tests are about that starvation,
// not about saving a database round-trip.
describe("settlementAlreadyRecorded", () => {
  const fields = {
    cardcom_response_code: "60000004",
    cardcom_description: "כרטיס חסום",
    cardcom_document_type: null,
    cardcom_document_number: null,
    payment_provider: "cardcom",
  };
  const recorded = { payment_status: "failed", ...fields };

  it("recognises a decline that is already on the row", () => {
    expect(settlementAlreadyRecorded(recorded, fields, "failed")).toBe(true);
  });

  it("still writes when the order has not been marked failed yet", () => {
    expect(
      settlementAlreadyRecorded({ ...recorded, payment_status: "unpaid" }, fields, "failed"),
    ).toBe(false);
  });

  it("still writes when CardCom now reports a different outcome", () => {
    expect(
      settlementAlreadyRecorded({ ...recorded, cardcom_response_code: "500" }, fields, "failed"),
    ).toBe(false);
  });

  // The DB columns are text; CardCom sends numbers. Without normalising, every
  // tick would see 60000004 !== "60000004" and write anyway — reintroducing the
  // exact bump this guard exists to prevent.
  it("does not treat a numeric response code as a change", () => {
    expect(
      settlementAlreadyRecorded({ ...recorded, cardcom_response_code: 60000004 }, fields, "failed"),
    ).toBe(true);
  });

  it("treats null and undefined alike, so an absent column is not a change", () => {
    const order = { payment_status: "failed", ...fields, cardcom_document_type: undefined };
    expect(settlementAlreadyRecorded(order, fields, "failed")).toBe(true);
  });

  // The blocked path writes a prefixed description and a TranzactionId. It must
  // compare against what it would write, not against the raw CardCom text.
  it("recognises an already-blocked order by its prefixed description", () => {
    const blockFields = {
      ...fields,
      cardcom_tranzaction_id: 998877,
      cardcom_description: "[חסום: סכום לא תואם] כרטיס חסום",
    };
    expect(
      settlementAlreadyRecorded(
        { payment_status: "failed", ...blockFields },
        blockFields,
        "failed",
      ),
    ).toBe(true);
    expect(
      settlementAlreadyRecorded({ payment_status: "failed", ...fields }, blockFields, "failed"),
    ).toBe(false);
  });
});
