import { describe, it, expect } from "vitest";
import {
  fitWithin,
  autoSlug,
  slugSuffix,
  nameFromFileName,
  filterCategories,
  galleryFromProduct,
  splitGallery,
  MAX_PHOTO_SIDE,
} from "./admin-catalog";

describe("fitWithin", () => {
  it("scales a phone photo down to the long-side cap, keeping the shape", () => {
    expect(fitWithin(4032, 3024, MAX_PHOTO_SIDE)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, MAX_PHOTO_SIDE)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales and survives bad input", () => {
    expect(fitWithin(800, 600, MAX_PHOTO_SIDE)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 600, MAX_PHOTO_SIDE)).toEqual({ width: 0, height: 0 });
  });
});

describe("autoSlug", () => {
  it("keeps the Latin words of a name, plus a number so a copy never collides", () => {
    expect(autoSlug("Tallit Prestige 60", "talitot", 12345)).toBe("tallit-prestige-60-12345");
    expect(autoSlug("Tallit Prestige 60 (עותק)", "talitot", 54321)).toBe(
      "tallit-prestige-60-54321",
    );
  });

  it("uses the category and a number for a Hebrew name, even one with a size", () => {
    expect(autoSlug("פמוטי קריסטל מהודרים", "candlesticks", 48213)).toBe("candlesticks-48213");
    expect(autoSlug('כיפה סרוגה 16 ס"מ', "kipot-srugot", 50001)).toBe("kipot-srugot-50001");
  });

  it("falls back to 'product' without a usable category slug", () => {
    expect(autoSlug("מזוזה", null, 11111)).toBe("product-11111");
    expect(autoSlug("מזוזה", "מזוזות", 11111)).toBe("product-11111");
  });

  it("draws 5-digit suffixes", () => {
    expect(slugSuffix(() => 0)).toBe(10000);
    expect(slugSuffix(() => 0.99999)).toBe(99999);
  });
});

describe("nameFromFileName", () => {
  it("turns a descriptive file name into a product name", () => {
    expect(nameFromFileName("פמוט_כסף-גדול.jpg")).toBe("פמוט כסף גדול");
    expect(nameFromFileName("kippa-velvet-black.webp")).toBe("kippa velvet black");
  });

  it("ignores what a camera or WhatsApp named the file", () => {
    expect(nameFromFileName("IMG_2034.JPG")).toBe("");
    expect(nameFromFileName("PXL_20260926_101010.jpg")).toBe("");
    expect(nameFromFileName("WhatsApp Image 2026-09-26 at 10.10.10.jpeg")).toBe("");
    expect(nameFromFileName("20260926_101010.jpg")).toBe("");
  });
});

describe("filterCategories", () => {
  const opts = [
    { id: "1", slug: "kipot", name: "כיפות", depth: 0 },
    { id: "2", slug: "kipot-srugot", name: "כיפות סרוגות", depth: 1 },
    { id: "3", slug: "candlesticks", name: "פמוטים", depth: 0 },
  ];

  it("returns the whole tree for an empty query", () => {
    expect(filterCategories(opts, "  ")).toBe(opts);
  });

  it("matches Hebrew names and slugs, flattened", () => {
    expect(filterCategories(opts, "סרוג").map((o) => [o.slug, o.depth])).toEqual([
      ["kipot-srugot", 0],
    ]);
    expect(filterCategories(opts, "candle").map((o) => o.slug)).toEqual(["candlesticks"]);
  });
});

describe("gallery round trip", () => {
  it("puts the main image first and drops the duplicate the catalogue often stores", () => {
    const g = galleryFromProduct("a.webp", [
      { url: "c.webp", sort_order: 2 },
      { url: "a.webp", sort_order: 0 },
      { url: "b.webp", sort_order: 1 },
    ]);
    expect(g).toEqual(["a.webp", "b.webp", "c.webp"]);
  });

  it("splits an edited gallery into the main image and ordered extras", () => {
    expect(splitGallery(["b.webp", "a.webp", "b.webp"])).toEqual({
      thumbnailUrl: "b.webp",
      extra: [{ url: "a.webp", sort_order: 1 }],
    });
    expect(splitGallery([])).toEqual({ thumbnailUrl: null, extra: [] });
  });
});
