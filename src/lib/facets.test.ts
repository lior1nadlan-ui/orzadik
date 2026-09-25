import { describe, it, expect } from "vitest";
import {
  buildFacetGroups,
  kippaDiameter,
  kippaSizeBucket,
  parseAttributeTail,
  KIPPA_SIZE_BUCKETS,
} from "./facets";

// Names and tails below are copied from live kippa rows (2026-09-25).

describe("kippa diameter", () => {
  it("reads the supplier's size tail first", () => {
    const tail = parseAttributeTail('חומר: קטיפה | צבע: שחור | מידות: אורך 19 ס"מ')?.s;
    expect(kippaDiameter('כיפה קטיפה "ארט-מן" 17 ס"מ - ירוק', tail)).toBe(19);
  });

  it("treats אורך and רוחב alike — a kippa has one dimension", () => {
    expect(kippaDiameter("", 'רוחב 16 ס"מ')).toBe(16);
    expect(kippaDiameter("", 'אורך 16 ס"מ, רוחב 16 ס"מ')).toBe(16);
  });

  it("falls back to the name, including half sizes and gershayim", () => {
    expect(kippaDiameter('כיפה ד.מ.צ. אפור 18 ס"מ')).toBe(18);
    expect(kippaDiameter('כיפה פריק לבן "נחמן מאומן" 19.5 ס"מ')).toBe(19.5);
    expect(kippaDiameter("כיפה עור אפור כהה 14 ס״מ")).toBe(14);
  });

  it("ignores numbers that cannot be a kippa's diameter", () => {
    // Tallit-sized rows that sit on the kippot shelf.
    expect(kippaDiameter("טלית", 'אורך 63 ס"מ, רוחב 155 ס"מ')).toBeUndefined();
    // A size NUMBER is not centimetres.
    expect(kippaDiameter('כיפה טרילין "ארט מן" שחור גודל 5 - 6 חלקים')).toBeUndefined();
  });
});

describe("kippa size ranges", () => {
  it("puts each diameter in exactly one range", () => {
    expect(kippaSizeBucket(13)).toBe('עד 16 ס"מ');
    expect(kippaSizeBucket(16)).toBe('עד 16 ס"מ');
    expect(kippaSizeBucket(16.5)).toBe('17-18 ס"מ');
    expect(kippaSizeBucket(18)).toBe('17-18 ס"מ');
    expect(kippaSizeBucket(18.5)).toBe('19-20 ס"מ');
    expect(kippaSizeBucket(20)).toBe('19-20 ס"מ');
    expect(kippaSizeBucket(21)).toBe('21 ס"מ ומעלה');
    expect(kippaSizeBucket(undefined)).toBeUndefined();
  });

  it("labels ranges with an ASCII hyphen, never an en dash", () => {
    for (const label of KIPPA_SIZE_BUCKETS) expect(label).not.toMatch(/[–—]/);
  });

  it("orders the chips smallest-first, not by count", () => {
    const rows = [
      ...Array(5).fill({ attrs: { s: '19-20 ס"מ' } }),
      ...Array(3).fill({ attrs: { s: 'עד 16 ס"מ' } }),
      ...Array(2).fill({ attrs: { s: '21 ס"מ ומעלה' } }),
    ];
    const size = buildFacetGroups(rows, KIPPA_SIZE_BUCKETS).find((g) => g.key === "s");
    expect(size?.buckets.map((b) => b.value)).toEqual(['עד 16 ס"מ', '19-20 ס"מ', '21 ס"מ ומעלה']);
    // Without an order the generic count order is unchanged.
    const generic = buildFacetGroups(rows).find((g) => g.key === "s");
    expect(generic?.buckets[0].value).toBe('19-20 ס"מ');
  });
});
