import { describe, it, expect } from "vitest";
import {
  parsePriceInput,
  priceBreakdown,
  slugProblem,
  categoryOptions,
  categoryWithDescendants,
  describePriceBatch,
  type CategoryNode,
} from "./admin-pricing";

describe("parsePriceInput", () => {
  it("reads the ways a price is naturally typed", () => {
    expect(parsePriceInput("120")).toEqual({ ok: true, value: 120 });
    expect(parsePriceInput(" 120.5 ")).toEqual({ ok: true, value: 120.5 });
    expect(parsePriceInput("1,200")).toEqual({ ok: true, value: 1200 });
    expect(parsePriceInput("₪ 99")).toEqual({ ok: true, value: 99 });
    expect(parsePriceInput('120 ש"ח')).toEqual({ ok: true, value: 120 });
    expect(parsePriceInput("120 ש״ח")).toEqual({ ok: true, value: 120 });
  });

  it("refuses empty, zero, negative, text and absurd amounts", () => {
    expect(parsePriceInput("").ok).toBe(false);
    expect(parsePriceInput("0").ok).toBe(false);
    expect(parsePriceInput("-5").ok).toBe(false);
    expect(parsePriceInput("abc").ok).toBe(false);
    expect(parsePriceInput("12.345").ok).toBe(false);
    expect(parsePriceInput("2000000").ok).toBe(false);
  });
});

describe("priceBreakdown", () => {
  it("shows what the customer and a club member pay", () => {
    // 30% site discount, then 5% for members, whole shekels.
    expect(priceBreakdown(100, null)).toEqual({
      catalog: 100,
      customer: 70,
      member: 67,
      struck: null,
    });
  });

  it("shows the struck former price only when it is above what the customer pays", () => {
    expect(priceBreakdown(100, 120).struck).toBe(120);
    expect(priceBreakdown(100, 60).struck).toBeNull();
  });
});

describe("slugProblem", () => {
  it("leaves an untouched existing slug alone, Hebrew included", () => {
    const hebrew = "חנוכייה-קריסטל-אלגנטית-21-סמ";
    expect(slugProblem(hebrew, hebrew)).toBeNull();
  });

  it("requires a Latin slug for new products and edited slugs", () => {
    expect(slugProblem("mezuza-lavan", null)).toBeNull();
    expect(slugProblem("מזוזה", null)).toMatch(/אנגליות/);
    expect(slugProblem("מזוזה-חדשה", "מזוזה-ישנה")).toMatch(/אנגליות/);
    expect(slugProblem("  ", "old")).toMatch(/יש להזין/);
  });
});

const CATS: CategoryNode[] = [
  { id: "1", name: "כיפות", slug: "kipot", parent_slug: null },
  { id: "2", name: "כיפות סרוגות", slug: "kipot-srugot", parent_slug: "kipot" },
  { id: "3", name: "כיפות קטיפה", slug: "kipot-ktifa", parent_slug: "kipot" },
  { id: "4", name: "ברכונים", slug: "birchonim", parent_slug: null },
  { id: "5", name: "יתום", slug: "orphan", parent_slug: "gone" },
];

describe("categoryOptions", () => {
  it("lists each parent followed by its children, A-Z", () => {
    expect(categoryOptions(CATS).map((o) => `${o.depth}:${o.slug}`)).toEqual([
      "0:birchonim",
      "0:orphan",
      "0:kipot",
      "1:kipot-srugot",
      "1:kipot-ktifa",
    ]);
  });

  it("never loops or drops a category on a parent cycle", () => {
    const cyc: CategoryNode[] = [
      { id: "a", name: "א", slug: "a", parent_slug: "b" },
      { id: "b", name: "ב", slug: "b", parent_slug: "a" },
    ];
    expect(categoryOptions(cyc)).toHaveLength(2);
  });
});

describe("categoryWithDescendants", () => {
  it("includes the children, so כיפות covers כיפות סרוגות", () => {
    expect(categoryWithDescendants(CATS, "kipot").map((c) => c.slug)).toEqual([
      "kipot",
      "kipot-srugot",
      "kipot-ktifa",
    ]);
    expect(categoryWithDescendants(CATS, "birchonim")).toHaveLength(1);
    expect(categoryWithDescendants(CATS, "nope")).toEqual([]);
  });
});

describe("describePriceBatch", () => {
  it("describes one inline edit with before and after", () => {
    expect(
      describePriceBatch({
        source: "inline",
        products: 1,
        undone: 0,
        oldTotal: 100,
        newTotal: 120,
        sample: "פמוטי קריסטל",
      }),
    ).toBe('מחיר "פמוטי קריסטל": ₪100 ← ₪120');
  });

  it("describes a percentage change from the totals", () => {
    expect(
      describePriceBatch({
        source: "bulk_pct",
        products: 263,
        undone: 0,
        oldTotal: 1000,
        newTotal: 1100,
      }),
    ).toBe("שינוי של +10% ל-263 מוצרים");
  });

  it("describes a fixed price and an undo", () => {
    expect(
      describePriceBatch({
        source: "bulk_set",
        products: 4,
        undone: 0,
        oldTotal: 400,
        newTotal: 480,
      }),
    ).toBe("מחיר אחיד ₪120 ל-4 מוצרים");
    expect(
      describePriceBatch({ source: "undo", products: 4, undone: 0, oldTotal: 480, newTotal: 400 }),
    ).toBe("ביטול שינוי מחיר (4 מוצרים)");
  });
});
