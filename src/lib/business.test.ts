import { describe, it, expect } from "vitest";
import { cancellationFee, CONSUMER_POLICY } from "./business";

// Consumer Protection Law §14ה: cancellation fee is the LOWER of 5% of the
// order or 100 ₪.
describe("cancellationFee", () => {
  it("takes 5% when 5% is below the flat cap", () => {
    expect(cancellationFee(1000)).toBe(50); // 5% = 50 < 100
    expect(cancellationFee(200)).toBe(10); // 5% = 10
  });

  it("caps at the flat 100 ₪ when 5% exceeds it", () => {
    expect(cancellationFee(3000)).toBe(100); // 5% = 150 -> capped
    expect(cancellationFee(2001)).toBe(100); // 5% = 100.05 -> 100
  });

  it("uses the configured policy values", () => {
    expect(CONSUMER_POLICY.cancellationFeePct).toBe(5);
    expect(CONSUMER_POLICY.cancellationFeeCapIls).toBe(100);
    expect(CONSUMER_POLICY.cancellationDays).toBe(14);
  });
});
