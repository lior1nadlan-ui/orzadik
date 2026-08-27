import { describe, it, expect } from "vitest";
import { orderItemImageUrl, ORDER_ITEM_PRODUCT_JOIN } from "./order-item-photo";

const SUPABASE_THUMB =
  "https://whtjslgrrfzehivrknuv.supabase.co/storage/v1/object/public/product-images/opt/abc.webp";

describe("order line photographs", () => {
  it("uses the product's own thumbnail when it has one", () => {
    const url = orderItemImageUrl({ products: { slug: "x", thumbnail_url: SUPABASE_THUMB } }, "");
    expect(url).toContain("/render/image/public/");
    expect(url).toContain("width=96");
  });

  // Thirteen full-size thumbnails would make a receipt a multi-megabyte message.
  it("honours the requested width, so a long order stays a small email", () => {
    const url = orderItemImageUrl({ products: { thumbnail_url: SUPABASE_THUMB } }, "", 112);
    expect(url).toContain("width=112");
  });

  // The groom sets have no thumbnail_url in the DB — they are exactly the lines
  // most likely to appear on a large order, so they must not be the ones that
  // show nothing.
  it("falls back to a bundled photograph for a product with no DB thumbnail", () => {
    const url = orderItemImageUrl(
      { products: { slug: "groom-set-white-crown", thumbnail_url: null } },
      "https://orzadik.com",
    );
    expect(url).toBe("https://orzadik.com/groom-sets/groom-07.jpeg");
  });

  // A mail client has no page to resolve a root-relative src against, so the
  // absolute origin is not cosmetic — without it the image is simply broken.
  it("prefixes the bundled path with the origin it is given", () => {
    const url = orderItemImageUrl(
      { products: { slug: "groom-set-white-crown" } },
      "https://x.test",
    );
    expect(url?.startsWith("https://x.test/")).toBe(true);
  });

  it("tolerates a trailing slash on the origin", () => {
    const url = orderItemImageUrl(
      { products: { slug: "groom-set-white-crown" } },
      "https://x.test/",
    );
    expect(url).not.toContain("//groom-sets");
  });

  // In the admin the page itself supplies the origin, so "" is correct there.
  it("returns a root-relative path when given an empty origin", () => {
    expect(orderItemImageUrl({ products: { slug: "groom-set-white-crown" } }, "")).toBe(
      "/groom-sets/groom-07.jpeg",
    );
  });

  it.each([
    ["no products join", {}],
    ["null products", { products: null }],
    ["no slug and no thumbnail", { products: {} }],
    ["a slug with no bundled photo", { products: { slug: "not-a-real-slug" } }],
    ["null item", null],
    ["undefined item", undefined],
  ])("returns null for %s rather than throwing", (_label, item) => {
    expect(orderItemImageUrl(item as never, "https://orzadik.com")).toBeNull();
  });

  // Both surfaces select through this constant. If one drifts, the drawer and
  // the receipt start disagreeing about which picture a line has.
  it("names both columns the resolver reads", () => {
    expect(ORDER_ITEM_PRODUCT_JOIN).toContain("slug");
    expect(ORDER_ITEM_PRODUCT_JOIN).toContain("thumbnail_url");
  });
});
