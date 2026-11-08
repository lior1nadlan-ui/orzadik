import { describe, expect, it } from "vitest";
import { heroTiles, type TileArt } from "./hero-tiles";
import { NAV_DEPARTMENTS, navSlugs, type NavDepartment } from "./nav-taxonomy";
import { HERO_TILE_ART, HERO_TILE_LABELS } from "@/components/home/hero-tile-art";

const pic: TileArt = { img: "x.webp", w: 1, h: 1 };

describe("heroTiles", () => {
  const sample: NavDepartment[] = [
    {
      label: "א",
      slug: "a",
      allLabel: "לכל א",
      children: [
        { slug: "a1", label: "א1" },
        { slug: "a2", label: "א2" },
      ],
    },
    { label: "ב", children: [{ slug: "b1", label: "ב1" }] },
    { label: "ג", slug: "c", allLabel: "לכל ג", children: [{ slug: "c1", label: "ג1" }] },
  ];

  it("puts the departments first, then the shelves, in menu order", () => {
    const art = { a: pic, a1: pic, a2: pic, b1: pic, c: pic, c1: pic };
    expect(heroTiles(sample, art).map((t) => t.slug)).toEqual(["a", "c", "a1", "a2", "b1", "c1"]);
  });

  it("skips a shelf without a picture and uses the menu label unless overridden", () => {
    const tiles = heroTiles(sample, { a1: pic, c1: pic }, { c1: "ג אחד" });
    expect(tiles.map((t) => [t.slug, t.name])).toEqual([
      ["a1", "א1"],
      ["c1", "ג אחד"],
    ]);
  });
});

describe("HERO_TILE_ART", () => {
  const menu = new Set(navSlugs());

  it("only has pictures for categories the menu links to", () => {
    const stray = Object.keys(HERO_TILE_ART).filter((s) => !menu.has(s));
    expect(stray).toEqual([]);
    for (const s of Object.keys(HERO_TILE_LABELS)) expect(menu.has(s)).toBe(true);
  });

  it("gives every department page a square, the featured siddurim included", () => {
    for (const d of NAV_DEPARTMENTS) if (d.slug) expect(HERO_TILE_ART[d.slug]).toBeDefined();
  });

  it("yields each category once", () => {
    const slugs = heroTiles(NAV_DEPARTMENTS, HERO_TILE_ART).map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
