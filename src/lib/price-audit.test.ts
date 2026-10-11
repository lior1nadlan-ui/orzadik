import { describe, expect, it } from "vitest";
import { auditPrices, packUnits, type AuditProduct } from "./price-audit";

const p = (o: Partial<AuditProduct>): AuditProduct => ({
  id: o.id ?? Math.random().toString(),
  name: o.name ?? "מוצר",
  sku: o.sku ?? null,
  price: o.price ?? 100,
  salePrice: o.salePrice ?? null,
  nameNorm: o.nameNorm ?? null,
});

describe("packUnits", () => {
  it("reads catalog pack names", () => {
    expect(packUnits("סטנד 100 טבעות- ציפוי כסף")).toBe(100);
    expect(packUnits("סט 50 טבעות נירוסטה מסתובבות")).toBe(50);
    expect(packUnits("סטנד מעורב צמידים עם אורנומנטים - 72 יח על סטנד")).toBe(72);
  });
  it("ignores sizes and single items", () => {
    expect(packUnits('כיפה סרוגה 17 ס"מ')).toBe(0);
    expect(packUnits("סט טלית תפילין")).toBe(0);
    expect(packUnits('כיסוי חלה 45X54 ס"מ')).toBe(0);
  });
});

describe("auditPrices", () => {
  it("flags a pack at a unit price, not at a pack price", () => {
    const kinds = auditPrices([
      p({ id: "a", name: "סטנד 100 טבעות", price: 22 }),
      p({ id: "b", name: "סטנד 100 טבעות", price: 900 }),
    ]).filter((i) => i.kind === "pack_unit_price");
    expect(kinds.map((i) => i.productId)).toEqual(["a"]);
  });

  it("skips a pack the owner confirmed is sold per unit", () => {
    expect(auditPrices([p({ name: "סטנד 100 טבעות (המחיר ליחידה אחת)", price: 22 })])).toEqual([]);
  });

  it("flags a former price the site never shows (not above the customer price)", () => {
    // price 100 -> customer pays 70
    expect(auditPrices([p({ price: 100, salePrice: 70 })]).map((x) => x.kind)).toEqual([
      "former_hidden",
    ]);
    expect(auditPrices([p({ price: 100, salePrice: 90 })])).toEqual([]);
  });

  it("flags an outlier in a name family of 3+", () => {
    const fam = [40, 43, 45, 200].map((price, n) => p({ id: String(n), price, nameNorm: "כיפה" }));
    expect(auditPrices(fam).map((i) => i.productId)).toEqual(["3"]);
  });

  it("flags a sharp recent change once", () => {
    const prod = p({ id: "x", price: 159 });
    const i = auditPrices(
      [prod],
      [
        { productId: "x", oldPrice: 304, newPrice: 159 },
        { productId: "x", oldPrice: 300, newPrice: 100 },
      ],
    );
    expect(i).toHaveLength(1);
    expect(i[0].kind).toBe("sharp_change");
  });

  it("is quiet on normal data", () => {
    expect(auditPrices([p({ price: 69 }), p({ price: 61, salePrice: 61 })])).toEqual([]);
  });
});
