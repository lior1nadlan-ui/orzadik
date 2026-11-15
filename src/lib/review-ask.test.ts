import { describe, expect, it } from "vitest";
import { reviewAskContext, type ReviewAskOrder } from "@/lib/review-ask";
import { waReviewRequest } from "@/lib/wa-templates";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

const delivered = (over: Partial<ReviewAskOrder> = {}): ReviewAskOrder => ({
  payment_status: "paid",
  status: "completed",
  shipped_at: daysAgo(19),
  review_request_sent_at: null,
  review_whatsapp_at: null,
  ...over,
});

describe("reviewAskContext", () => {
  it("asks for an order delivered days ago that was never emailed", () => {
    expect(reviewAskContext(delivered(), false, NOW)).toContain("נמסרה לפני 19 ימים");
  });

  it("follows up five days after an email that got no review", () => {
    const line = reviewAskContext(delivered({ review_request_sent_at: daysAgo(12) }), false, NOW);
    expect(line).toContain("קיבלו בקשה במייל לפני 12 ימים");
  });

  it("gives a fresh email its chance first", () => {
    expect(
      reviewAskContext(delivered({ review_request_sent_at: daysAgo(2) }), false, NOW),
    ).toBeNull();
  });

  it("never asks twice, or after a review", () => {
    expect(reviewAskContext(delivered({ review_whatsapp_at: daysAgo(1) }), false, NOW)).toBeNull();
    expect(reviewAskContext(delivered(), true, NOW)).toBeNull();
  });

  it("waits five days after delivery and stops after sixty", () => {
    expect(reviewAskContext(delivered({ shipped_at: daysAgo(3) }), false, NOW)).toBeNull();
    expect(reviewAskContext(delivered({ shipped_at: daysAgo(61) }), false, NOW)).toBeNull();
    expect(reviewAskContext(delivered({ shipped_at: daysAgo(60) }), false, NOW)).not.toBeNull();
  });

  it("skips unpaid, undelivered and cancelled orders", () => {
    expect(reviewAskContext(delivered({ payment_status: "failed" }), false, NOW)).toBeNull();
    expect(reviewAskContext(delivered({ status: "processing" }), false, NOW)).toBeNull();
    expect(reviewAskContext(delivered({ status: "cancelled" }), false, NOW)).toBeNull();
    expect(reviewAskContext(delivered({ shipped_at: null }), false, NOW)).toBeNull();
  });
});

describe("waReviewRequest", () => {
  const row = { customerName: "רחל", orderNumber: "261021-5856", customerPhone: "050-1234567" };

  it("carries the signed review link when there is one", () => {
    const link = waReviewRequest(row, "https://orzadik.com/review?order=abc&token=sig")!;
    expect(link.startsWith("https://wa.me/972501234567?text=")).toBe(true);
    const text = decodeURIComponent(link.split("?text=")[1]);
    expect(text).toContain("שלום רחל");
    expect(text).toContain("261021-5856");
    expect(text).toContain("https://orzadik.com/review?order=abc&token=sig");
  });

  it("speaks to anyone, not to a man only", () => {
    const text = decodeURIComponent(waReviewRequest(row)!.split("?text=")[1]);
    expect(text).not.toMatch(/אתה|נהנה ממנה/);
  });

  it("needs a phone number", () => {
    expect(waReviewRequest({ customerName: "רחל" })).toBeNull();
  });
});
