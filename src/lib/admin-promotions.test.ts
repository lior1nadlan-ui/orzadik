import { describe, it, expect } from "vitest";
import {
  promotionStatus,
  scopeSummary,
  promotionInputErrors,
  toLocalInput,
  fromLocalInput,
  defaultWindow,
  previewRange,
  type PromotionInput,
} from "./admin-promotions";

const NOW = new Date("2026-10-01T10:00:00Z");
const base: PromotionInput = {
  name: "חנוכה 2026",
  badge_label: "מבצע חנוכה",
  percent_off: 20,
  scope: "categories",
  category_ids: ["c1"],
  product_ids: [],
  starts_at: "2026-10-01T09:00:00Z",
  ends_at: "2026-10-10T21:59:00Z",
};

describe("promotionStatus", () => {
  const w = { starts_at: "2026-10-01T09:00:00Z", ends_at: "2026-10-10T21:59:00Z" };
  it("reads the window and the switch", () => {
    expect(promotionStatus({ ...w, is_active: true }, NOW)).toBe("active");
    expect(promotionStatus({ ...w, is_active: false }, NOW)).toBe("disabled");
    expect(promotionStatus({ ...w, is_active: true }, new Date("2026-09-30T00:00:00Z"))).toBe(
      "scheduled",
    );
    expect(promotionStatus({ ...w, is_active: true }, new Date("2026-10-11T00:00:00Z"))).toBe(
      "ended",
    );
  });
});

describe("scopeSummary", () => {
  it("says what the promotion covers", () => {
    expect(scopeSummary({ scope: "all", category_ids: [], product_ids: [] })).toBe("כל החנות");
    expect(scopeSummary({ scope: "categories", category_ids: ["a", "b"], product_ids: [] })).toBe(
      "2 קטגוריות",
    );
    expect(scopeSummary({ scope: "products", category_ids: [], product_ids: ["a"] })).toBe(
      "מוצר אחד",
    );
  });
});

describe("promotionInputErrors", () => {
  it("accepts a normal promotion", () => {
    expect(promotionInputErrors(base, { isNew: true, now: NOW })).toEqual([]);
  });

  it("requires a name, a target, and an end after the start", () => {
    const errs = promotionInputErrors(
      { ...base, name: " ", category_ids: [], ends_at: base.starts_at },
      { isNew: true, now: NOW },
    );
    expect(errs).toContain("חסר שם למבצע.");
    expect(errs).toContain("בחרו לפחות קטגוריה אחת.");
    expect(errs).toContain("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.");
  });

  it("caps the percent and asks for a second yes above 50", () => {
    expect(promotionInputErrors({ ...base, percent_off: 75 }, { isNew: true, now: NOW })).toContain(
      "אחוז ההנחה המרבי הוא 70.",
    );
    expect(
      promotionInputErrors({ ...base, percent_off: 60 }, { isNew: true, now: NOW })[0],
    ).toMatch(/דורשת אישור/);
    expect(
      promotionInputErrors(
        { ...base, percent_off: 60, confirm_high_discount: true },
        { isNew: true, now: NOW },
      ),
    ).toEqual([]);
    expect(promotionInputErrors({ ...base, percent_off: 0 }, { isNew: true, now: NOW })[0]).toMatch(
      /גדול מ-0/,
    );
  });

  it("requires an end date, and a future one only for a new promotion", () => {
    expect(promotionInputErrors({ ...base, ends_at: "" }, { isNew: true, now: NOW })).toContain(
      "חסר תאריך סיום — מבצע חייב להסתיים.",
    );
    const past = { ...base, starts_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-10T00:00:00Z" };
    expect(promotionInputErrors(past, { isNew: true, now: NOW })).toContain("תאריך הסיום כבר עבר.");
    expect(promotionInputErrors(past, { isNew: false, now: NOW })).toEqual([]);
  });
});

describe("dates", () => {
  it("round-trips through the datetime-local input", () => {
    const iso = "2026-10-10T19:30:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(fromLocalInput("")).toBe("");
    expect(toLocalInput("nope")).toBe("");
  });

  it("defaults to a week, ending at 23:59", () => {
    const w = defaultWindow(NOW);
    const end = new Date(w.ends_at);
    expect(new Date(w.starts_at).getTime()).toBe(NOW.getTime());
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getTime() - NOW.getTime()).toBeGreaterThan(6 * 86_400_000);
  });
});

describe("previewRange", () => {
  it("shows what the cheapest and dearest covered product will cost", () => {
    // catalogue 100 → regular 70 → 20% off → 56; catalogue 1000 → 700 → 560
    expect(previewRange(100, 1000, 20)).toEqual({
      from: { regular: 70, pays: 56 },
      to: { regular: 700, pays: 560 },
    });
    expect(previewRange(null, null, 20)).toBeNull();
  });
});
