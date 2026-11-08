import { describe, expect, it } from "vitest";
import { NAV_DEPARTMENTS, navSlugs, pruneEmptyNav, type NavDepartment } from "./nav-taxonomy";

describe("NAV_DEPARTMENTS", () => {
  it("links every category exactly once", () => {
    const slugs = navSlugs();
    const repeated = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(repeated).toEqual([]);
  });

  it("has unique department labels and unique labels inside each panel", () => {
    const labels = NAV_DEPARTMENTS.map((d) => d.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const d of NAV_DEPARTMENTS) {
      const inner = d.children.map((c) => c.label);
      expect(new Set(inner).size).toBe(inner.length);
    }
  });

  it("gives every department a panel worth opening and a 'לכל' label for its page", () => {
    for (const d of NAV_DEPARTMENTS) {
      expect(d.children.length).toBeGreaterThanOrEqual(3);
      if (d.slug) expect(d.allLabel).toMatch(/^לכל /);
    }
  });

  it("leaves out the shelves the owner removed and the top-level duplicates", () => {
    const slugs = new Set(navSlugs());
    for (const gone of [
      "etim",
      "sakinim",
      "mazkarot-eretz-israel",
      "tefillin-cases",
      "atara",
      "talit-clips",
      "washing-cups",
      "maim-achronim",
      "metal-kiddush-cups",
      "crystal-ceramic-kiddush-cups",
      "polyrasin-stone",
      "aluminum",
      "wedding",
      "yehudaika",
      // Owner videos 08.11.2026: the mixed parent page, and the shelves taken
      // off the site.
      "talit-tefilin",
      "machzikei-maftechot-magnetim",
      "chasidim-tzivoniim",
      "yeladim",
    ]) {
      expect(slugs.has(gone)).toBe(false);
    }
  });

  it("uses plain slugs (no percent-encoded Hebrew rows)", () => {
    for (const s of navSlugs()) expect(s).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("pruneEmptyNav", () => {
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
    { label: "ב", slug: "b", allLabel: "לכל ב", children: [{ slug: "b1", label: "ב1" }] },
    { label: "ג", children: [{ slug: "c1", label: "ג1" }] },
  ];

  it("returns the full map until the live list has loaded", () => {
    expect(pruneEmptyNav(sample, undefined)).toBe(sample);
  });

  it("drops empty shelves and departments with nothing left", () => {
    const out = pruneEmptyNav(sample, new Set(["a", "a2", "c1"]));
    expect(out.map((d) => d.label)).toEqual(["א", "ג"]);
    expect(out[0].children.map((c) => c.slug)).toEqual(["a2"]);
  });

  it("keeps a department whose own page is empty, without its 'לכל' link", () => {
    const out = pruneEmptyNav(sample, new Set(["a1"]));
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBeUndefined();
    expect(out[0].allLabel).toBeUndefined();
    expect(out[0].children.map((c) => c.slug)).toEqual(["a1"]);
  });
});
