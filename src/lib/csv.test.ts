import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("starts with a BOM and uses CRLF", () => {
    expect(toCsv(["מק״ט", "מחיר"], [["UK1", 69]])).toBe("﻿מק״ט,מחיר\r\nUK1,69");
  });
  it("quotes commas and quotes", () => {
    expect(csvCell('כיפה "ארט מן", שחור')).toBe('"כיפה ""ארט מן"", שחור"');
  });
  it("neutralises formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
  });
  it("leaves empty cells for null", () => {
    expect(csvCell(null)).toBe("");
  });
});
