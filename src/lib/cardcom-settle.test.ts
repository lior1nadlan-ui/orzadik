import { describe, it, expect } from "vitest";
import { isUsableCardcomToken } from "./cardcom-settle.server";

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
