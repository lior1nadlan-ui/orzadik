import imgBarMitzva from "@/assets/other-cats/talit-tefillin-set.webp";
import imgWedding from "@/assets/other-cats/wedding.webp";
import imgChalaka from "@/assets/cat-chalaka.webp";
import imgNewHome from "@/assets/other-cats/mezuzot.webp";
import imgRoshHashana from "@/assets/other-cats/rosh-hashana.webp";
import imgPassover from "@/assets/occasions/passover-table.webp";
import imgHanukkah from "@/assets/occasions/hanukkah-art.svg";

/**
 * Photograph for each occasion hub's homepage tile, keyed by the slug in
 * OCCASION_COLLECTIONS. `w`/`h` are the file's intrinsic pixels; the tile's
 * aspect box + object-cover own the layout.
 *
 * An image only goes in here if it shows the occasion CORRECTLY. Two stock
 * images in this repo do not, and both were checked by eye on 2026-09-24:
 *
 *   • other-cats/hanukkah.webp (and .jpg) is a generated חנוכייה with TEN
 *     candles. A kosher חנוכייה holds eight plus the שמש. The tile now uses
 *     occasions/hanukkah-art.svg instead: a drawn (not photographed) gold
 *     חנוכייה with exactly eight lights in a row and the שמש raised in the
 *     middle — an illustration claims nothing about stock, so it can stand in
 *     until the shop supplies a real photograph.
 *   • other-cats/passover.webp is a "seder plate" of cheese slabs. The Pesach
 *     tile uses occasions/passover-table.webp instead: a square crop of
 *     category-banners/passover-hero.jpg (matza, a kiddush cup, candles),
 *     re-encoded at 760px (52KB, against the banner's 209KB).
 */
export const OCCASION_ART: Record<
  string,
  { img: string; w: number; h: number; position?: string }
> = {
  "bar-mitzva": { img: imgBarMitzva, w: 760, h: 760 },
  "chatan-kala": { img: imgWedding, w: 760, h: 760 },
  chalaka: { img: imgChalaka, w: 800, h: 1067 },
  "bait-chadash": { img: imgNewHome, w: 760, h: 760 },
  "matanot-rosh-hashana": { img: imgRoshHashana, w: 760, h: 760 },
  "matanot-pesach": { img: imgPassover, w: 760, h: 760, position: "60% 50%" },
  "matanot-hanukkah": { img: imgHanukkah, w: 760, h: 950, position: "50% 30%" },
};
