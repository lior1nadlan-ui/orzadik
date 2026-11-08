import { describe, expect, it } from "vitest";
import { heroTiles, type TileArt } from "./hero-tiles";
import { NAV_DEPARTMENTS, navSlugs, type NavDepartment } from "./nav-taxonomy";
import { HERO_SQUARES, HERO_TILE_ART, HERO_TILE_LABELS } from "@/components/home/hero-tile-art";

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
  ];

  it("keeps the given order and takes the menu labels", () => {
    const art = { a: pic, a2: pic, b1: pic };
    expect(heroTiles(["b1", "a", "a2"], sample, art).map((t) => [t.slug, t.name])).toEqual([
      ["b1", "ב1"],
      ["a", "א"],
      ["a2", "א2"],
    ]);
  });

  it("drops a square the menu no longer lists or has no picture for, and applies overrides", () => {
    const tiles = heroTiles(
      ["gone", "a1", "a2", "a2"],
      sample,
      { gone: pic, a2: pic },
      { a2: "שני" },
    );
    expect(tiles.map((t) => [t.slug, t.name])).toEqual([["a2", "שני"]]);
  });
});

describe("HERO_SQUARES", () => {
  const menu = new Set(navSlugs());

  it("is the featured siddurim plus ten, so the squares fill the grid exactly", () => {
    // 1 featured (two cells) + 10 = 12 cells: 4 full rows of 3, 3 full rows of 4.
    // "לכל המוצרים" is a full row under them.
    expect(HERO_SQUARES[0]).toBe("sidurim");
    expect(HERO_SQUARES).toHaveLength(11);
    expect(HERO_SQUARES).toContain("talitot");
    expect(new Set(HERO_SQUARES).size).toBe(HERO_SQUARES.length);
  });

  it("only names menu categories, each with a picture", () => {
    for (const s of HERO_SQUARES) {
      expect(menu.has(s)).toBe(true);
      expect(HERO_TILE_ART[s]).toBeDefined();
    }
    for (const s of Object.keys(HERO_TILE_ART)) expect(HERO_SQUARES).toContain(s);
    for (const s of Object.keys(HERO_TILE_LABELS)) expect(HERO_SQUARES).toContain(s);
  });

  it("has no square for the mixed טלית ותפילין page (owner, 08.11.2026)", () => {
    expect(HERO_SQUARES).not.toContain("talit-tefilin");
    expect(heroTiles(HERO_SQUARES, NAV_DEPARTMENTS, HERO_TILE_ART)).toHaveLength(11);
  });
});
