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
 * The homepage squares, built from the menu's category map: the departments
 * first, then their shelves, in menu order, each slug once and under its menu
 * label. `labels` overrides a label that leans on the menu panel around it
 * ("פולירזין ואבן" reads as a mezuza case only under "נרתיקי מזוזה"). A shelf
 * with no picture is left out rather than shown as a blank square.
 */
export function heroTiles(
  departments: readonly NavDepartment[],
  art: Readonly<Record<string, TileArt>>,
  labels: Readonly<Record<string, string>> = {},
): HeroTile[] {
  const out: HeroTile[] = [];
  const seen = new Set<string>();
  const add = (slug: string, label: string) => {
    const a = art[slug];
    if (!a || seen.has(slug)) return;
    seen.add(slug);
    out.push({ ...a, slug, name: labels[slug] ?? label });
  };
  for (const d of departments) if (d.slug) add(d.slug, d.label);
  for (const d of departments) for (const c of d.children) add(c.slug, c.label);
  return out;
}
