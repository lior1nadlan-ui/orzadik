import { describe, expect, it } from "vitest";
import { normalizeSearchTerm, summarizeSearches } from "./search-terms";

describe("normalizeSearchTerm", () => {
  it("collapses spacing, case and Hebrew quote marks", () => {
    expect(normalizeSearchTerm("  טלית   חתן ")).toBe("טלית חתן");
    expect(normalizeSearchTerm("Tefillin")).toBe("tefillin");
    expect(normalizeSearchTerm("חב״ד")).toBe('חב"ד');
  });

  it("caps the length", () => {
    expect(normalizeSearchTerm("א".repeat(150))).toHaveLength(100);
  });
});

describe("summarizeSearches", () => {
  const row = (term: string, results_count: number, created_at: string) => ({
    term,
    results_count,
    created_at,
  });

  it("groups spellings and ranks by count", () => {
    const s = summarizeSearches([
      row("טלית", 40, "2026-10-01T10:00:00Z"),
      row(" טלית ", 40, "2026-10-01T11:00:00Z"),
      row("מזוזה", 12, "2026-10-01T09:00:00Z"),
    ]);
    expect(s.total).toBe(3);
    expect(s.top.map((t) => [t.term, t.count])).toEqual([
      ["טלית", 2],
      ["מזוזה", 1],
    ]);
    expect(s.missed).toEqual([]);
  });

  it("judges a term by its latest search, so a fixed gap drops off", () => {
    const s = summarizeSearches([
      row("כיפה סרוגה", 0, "2026-09-20T10:00:00Z"),
      row("כיפה סרוגה", 6, "2026-09-25T10:00:00Z"),
      row("שופר תימני", 3, "2026-09-20T10:00:00Z"),
      row("שופר תימני", 0, "2026-09-26T10:00:00Z"),
    ]);
    expect(s.missed.map((t) => t.term)).toEqual(["שופר תימני"]);
  });
});
