import { describe, expect, it } from "vitest";
import {
  isFriendCode,
  isThanksCode,
  parseReferralSettings,
  referralErrors,
  referralLink,
  referralShareText,
  REWARD_AFTER_MS,
  rewardDecision,
  type RewardOrder,
} from "@/lib/referral";

describe("parseReferralSettings", () => {
  it("is off and at the defaults for a missing or damaged row", () => {
    expect(parseReferralSettings(null)).toEqual({
      enabled: false,
      friendPercent: 10,
      rewardPercent: 10,
      rewardDays: 90,
    });
    expect(parseReferralSettings({ enabled: "true", friendPercent: 99, rewardDays: 2 })).toEqual({
      enabled: false,
      friendPercent: 10,
      rewardPercent: 10,
      rewardDays: 90,
    });
  });

  it("keeps valid values", () => {
    expect(
      parseReferralSettings({ enabled: true, friendPercent: 15, rewardPercent: 5, rewardDays: 60 }),
    ).toEqual({ enabled: true, friendPercent: 15, rewardPercent: 5, rewardDays: 60 });
  });
});

describe("referralErrors", () => {
  it("names each value out of range, in Hebrew", () => {
    expect(referralErrors({ friendPercent: 10, rewardPercent: 10, rewardDays: 90 })).toEqual([]);
    expect(referralErrors({ friendPercent: 0, rewardPercent: 31, rewardDays: 3 })).toHaveLength(3);
    expect(referralErrors({ friendPercent: 7.5, rewardPercent: 10, rewardDays: 90 })[0]).toMatch(
      /חבר/,
    );
  });
});

describe("codes and the message", () => {
  it("tells the two kinds of code apart", () => {
    expect(isFriendCode("FRIEND-AB12CD")).toBe(true);
    expect(isFriendCode("friend-ab12cd")).toBe(true);
    expect(isFriendCode("THANKS-AB12CD")).toBe(false);
    expect(isThanksCode("THANKS-AB12CD")).toBe(true);
    expect(isFriendCode(null)).toBe(false);
  });

  it("links to the home page with the code applied", () => {
    expect(referralLink("https://orzadik.com/", "FRIEND-AB12CD")).toBe(
      "https://orzadik.com/?coupon=FRIEND-AB12CD",
    );
    const text = referralShareText(
      "FRIEND-AB12CD",
      10,
      "https://orzadik.com/?coupon=FRIEND-AB12CD",
    );
    expect(text).toContain("FRIEND-AB12CD");
    expect(text).toContain("10%");
    expect(text).toContain("https://orzadik.com/?coupon=FRIEND-AB12CD");
  });
});

describe("rewardDecision", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const order = (over: Partial<RewardOrder> = {}): RewardOrder => ({
    payment_status: "paid",
    status: "completed",
    paid_at: new Date(now - REWARD_AFTER_MS - 60_000).toISOString(),
    created_at: new Date(now - REWARD_AFTER_MS - 120_000).toISOString(),
    coupon_code: "FRIEND-AB12CD",
    customer_email: "friend@example.com",
    referral_reward_coupon_id: null,
    ...over,
  });

  it("thanks the referrer for a friend's paid order that has stood two days", () => {
    expect(rewardDecision(order(), "Sharer@Example.com", now)).toBe("issue");
  });

  it("waits, and never thanks twice, for an unpaid or cancelled order, or for oneself", () => {
    expect(
      rewardDecision(order({ paid_at: new Date(now - 3600_000).toISOString() }), "s@e.com", now),
    ).toBe("too-soon");
    expect(rewardDecision(order({ referral_reward_coupon_id: "c1" }), "s@e.com", now)).toBe(
      "already",
    );
    expect(rewardDecision(order({ payment_status: "failed" }), "s@e.com", now)).toBe("not-paid");
    expect(rewardDecision(order({ status: "refunded" }), "s@e.com", now)).toBe("closed");
    expect(rewardDecision(order(), "friend@example.com", now)).toBe("self");
  });

  it("ignores orders without a referral code or a known referrer", () => {
    expect(rewardDecision(order({ coupon_code: "DANA10" }), "s@e.com", now)).toBe("not-referral");
    expect(rewardDecision(order(), null, now)).toBe("not-referral");
  });
});
