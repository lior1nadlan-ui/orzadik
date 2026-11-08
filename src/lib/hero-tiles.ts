import type { NavDepartment } from "@/lib/nav-taxonomy";

/** A homepage square's picture. */
export type TileArt = {
  img: string;
  w: number;
  h: number;
  /** A catalogue photograph on white: shown whole on the linen ground instead
   *  of cropped edge to edge (see HeroCategoryTiles). */
  contain?: boolean;
  /** object-position for a picture whose subject is not centred. */
  position?: string;
};

export type HeroTile = TileArt & { slug: string; name: string };

/**
 * The homepage squares: a short, curated list of menu categories in a fixed
 * order (owner video 08.11.2026: "צריך למיין אותם ולעשות כמה משבצות", a few
 * clear squares with one topic each, not one per shelf). Each square takes its
 * menu label unless `labels` overrides it. A category the menu no longer lists
 * (a shelf that emptied out, see pruneEmptyNav) or one with no picture is
 * dropped rather than shown as a dead end or a blank.
 */
export function heroTiles(
  order: readonly string[],
  departments: readonly NavDepartment[],
  art: Readonly<Record<string, TileArt>>,
  labels: Readonly<Record<string, string>> = {},
): HeroTile[] {
  const menuLabel = new Map<string, string>();
  for (const d of departments) {
    if (d.slug) menuLabel.set(d.slug, d.label);
    for (const c of d.children) menuLabel.set(c.slug, c.label);
  }
  const out: HeroTile[] = [];
  const seen = new Set<string>();
  for (const slug of order) {
    const a = art[slug];
    const label = menuLabel.get(slug);
    if (!a || label === undefined || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ ...a, slug, name: labels[slug] ?? label });
  }
  return out;
}
