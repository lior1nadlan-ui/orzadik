import { describe, expect, it } from "vitest";
import {
  isWelcomeCode,
  parseWelcomeCouponSettings,
  welcomeCouponErrors,
  welcomeOfferLine,
  WELCOME_COUPON_DEFAULTS,
} from "@/lib/welcome-coupon";
import { generateCouponCode, isValidCouponCode } from "@/lib/coupons";

describe("parseWelcomeCouponSettings", () => {
  it("is off with no row, or with a damaged one", () => {
    expect(parseWelcomeCouponSettings(null)).toEqual(WELCOME_COUPON_DEFAULTS);
    expect(parseWelcomeCouponSettings("yes")).toEqual(WELCOME_COUPON_DEFAULTS);
    expect(parseWelcomeCouponSettings({ enabled: "true", percent: 10, days: 30 }).enabled).toBe(
      false,
    );
  });

  it("reads a saved offer", () => {
    expect(parseWelcomeCouponSettings({ enabled: true, percent: 15, days: 14 })).toEqual({
      enabled: true,
      percent: 15,
      days: 14,
    });
  });

  it("never lets a stored value outgrow the caps", () => {
    const s = parseWelcomeCouponSettings({ enabled: true, percent: 80, days: 999 });
    expect(s.percent).toBe(WELCOME_COUPON_DEFAULTS.percent);
    expect(s.days).toBe(WELCOME_COUPON_DEFAULTS.days);
    expect(parseWelcomeCouponSettings({ enabled: true, percent: 12.5 }).percent).toBe(10);
  });
});

describe("welcomeCouponErrors", () => {
  it("accepts whole numbers inside the caps", () => {
    expect(welcomeCouponErrors({ percent: 10, days: 30 })).toEqual([]);
    expect(welcomeCouponErrors({ percent: 30, days: 180 })).toEqual([]);
  });
  it("explains what is wrong, in Hebrew", () => {
    expect(welcomeCouponErrors({ percent: 31, days: 30 })[0]).toContain("בין 1 ל-30");
    expect(welcomeCouponErrors({ percent: 10, days: 0 })[0]).toContain("ימים");
  });
});

describe("welcome codes", () => {
  it("are valid coupon codes and recognisable", () => {
    const code = generateCouponCode("WELCOME");
    expect(isValidCouponCode(code)).toBe(true);
    expect(isWelcomeCode(code)).toBe(true);
    expect(isWelcomeCode("welcome-abc123")).toBe(true);
    expect(isWelcomeCode("DANA10")).toBe(false);
    expect(isWelcomeCode(null)).toBe(false);
  });
  it("are promised in plain words", () => {
    expect(welcomeOfferLine(10)).toBe("הצטרפו וקבלו 10% הנחה על ההזמנה הבאה");
  });
});
