import { describe, it, expect } from "vitest";
import { localProductPhoto, localProductPhotos, hasLocalProductPhoto } from "./product-photos";

// The map itself is data the owner confirms, so these tests deliberately assert
// the CONTRACT (shape, ordering, totality) rather than which file a given slug
// points at — a pairing being withdrawn is a normal edit and must not break the
// suite. The one exception is the hero-first ordering guarantee, which the
// product gallery depends on for display order.

/** The seven active products that carry no DB photograph of their own. */
const PAIRED_SLUGS = [
  "groom-set-grey-print",
  "groom-set-beige-suede",
  "groom-set-beige-linen-classic",
  "groom-set-white-embroidered",
  "groom-set-blue-denim",
  "groom-set-light-blue",
  "groom-set-white-crown",
];

describe("localProductPhoto", () => {
  it("returns a fully-sized photo for a paired slug", () => {
    const photo = localProductPhoto("groom-set-white-crown");
    expect(photo).not.toBeNull();
    expect(photo!.src.startsWith("/")).toBe(true);
    expect(photo!.width).toBeGreaterThan(0);
    expect(photo!.height).toBeGreaterThan(0);
  });

  it("returns null for anything unpaired or not a slug", () => {
    for (const input of ["", "no-such-product", null, undefined, 42 as unknown as string]) {
      expect(localProductPhoto(input)).toBeNull();
    }
  });
});

describe("localProductPhotos", () => {
  it("puts the hero first and the extra frames after it", () => {
    const all = localProductPhotos("groom-set-grey-print");
    expect(all.length).toBeGreaterThan(1);
    expect(all[0].src).toBe(localProductPhoto("groom-set-grey-print")!.src);
  });

  it("leads with the hero for every paired slug, however many extras it has", () => {
    // Written this way deliberately: an earlier version asserted that one named
    // slug had NO extra frames, and broke the day that set got its gallery. How
    // many frames a product has is data the owner adds to; that the hero comes
    // first is the contract this module owes the gallery.
    for (const slug of PAIRED_SLUGS) {
      expect(localProductPhotos(slug)[0].src).toBe(localProductPhoto(slug)!.src);
    }
  });

  it("returns an empty array, never null, for anything unpaired", () => {
    for (const input of ["", "no-such-product", null, undefined]) {
      expect(localProductPhotos(input)).toEqual([]);
    }
  });

  it("emits no duplicate frames and measures every one", () => {
    for (const slug of PAIRED_SLUGS) {
      const photos = localProductPhotos(slug);
      // Every one of the seven products with no DB image must show something;
      // an empty list here is the "אין תמונה" box coming back.
      expect(photos.length).toBeGreaterThan(0);
      expect(new Set(photos.map((p) => p.src)).size).toBe(photos.length);
      for (const p of photos) {
        expect(p.width).toBeGreaterThan(0);
        expect(p.height).toBeGreaterThan(0);
      }
      expect(hasLocalProductPhoto(slug)).toBe(true);
    }
  });
});
