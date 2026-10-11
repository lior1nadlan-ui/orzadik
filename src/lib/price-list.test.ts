import { describe, expect, it } from "vitest";
import { parsePriceList } from "./price-list";

describe("parsePriceList", () => {
  it("reads Excel tab-separated rows", () => {
    expect(parsePriceList("UK82172\t69\nUK11631\t43.5").rows).toEqual([
      { line: 1, sku: "UK82172", price: 69 },
      { line: 2, sku: "UK11631", price: 43.5 },
    ]);
  });

  it("accepts comma, spaces, shekel signs and price-first order", () => {
    const { rows, errors } = parsePriceList("uk1, 120\nUK2 ₪1,200\n59 UK3");
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.sku, r.price])).toEqual([
      ["UK1", 120],
      ["UK2", 1200],
      ["UK3", 59],
    ]);
  });

  it("skips a header row and blank lines", () => {
    const { rows, errors } = parsePriceList("מק״ט\tמחיר\n\nUK1\t10\n");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("reports bad lines with their line number", () => {
    const { errors } = parsePriceList("UK1\t10\nUK2\tabc\nUK3");
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it("refuses a zero price", () => {
    expect(parsePriceList("UK1\t0").errors).toHaveLength(1);
  });

  it("drops a SKU listed twice with different prices", () => {
    const r = parsePriceList("UK1\t10\nUK1\t12\nUK2\t5\nUK2\t5");
    expect(r.conflicts).toEqual(["UK1"]);
    expect(r.rows.map((x) => x.sku)).toEqual(["UK2"]);
  });
});
