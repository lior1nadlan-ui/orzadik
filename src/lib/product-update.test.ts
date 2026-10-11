import { describe, expect, it } from "vitest";
import { productUpdatePatch } from "./product-update";

const row = {
  id: "1",
  name: "גופיה ציצית",
  slug: "tzitzit",
  price: "94.00",
  sale_price: null,
  sku: "UK1",
  is_active: true,
  name_norm: "גופיה ציצית",
  search_blob: "גופיה ציצית uk1",
  created_at: "2026-01-01",
};

describe("productUpdatePatch", () => {
  it("never sends generated or unknown columns", () => {
    const patch = productUpdatePatch(row, { ...row, name: "חדש", price: 80 });
    expect(Object.keys(patch).sort()).toEqual(["name", "price"]);
    expect(patch).not.toHaveProperty("name_norm");
    expect(patch).not.toHaveProperty("search_blob");
    expect(patch).not.toHaveProperty("id");
  });

  it("sends only the price when only the price changed", () => {
    expect(productUpdatePatch(row, { ...row, price: 80 })).toEqual({ price: 80 });
  });

  it("does not resend an unchanged numeric price", () => {
    expect(productUpdatePatch(row, { ...row, price: 94 })).toEqual({});
  });

  it("leaves untouched fields out so a concurrent price change survives", () => {
    expect(productUpdatePatch(row, { ...row, sku: "UK2" })).toEqual({ sku: "UK2" });
  });

  it("can clear a value", () => {
    expect(
      productUpdatePatch({ ...row, sale_price: "120.00" }, { ...row, sale_price: null }),
    ).toEqual({
      sale_price: null,
    });
  });
});
