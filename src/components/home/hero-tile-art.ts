// The homepage squares: which categories, in what order, and their pictures.
//
// OWNER VIDEO 08.11.2026 (Lior): "כל המשבצות האלה ממש מבולבלות, צריך למיין
// אותם ולעשות כמה משבצות". The 36 squares (one per shelf of the menu) became
// the featured siddurim plus nine, and a "לכל המוצרים" square closes the grid:
// 1 featured (two cells) + 9 + 1 = 12 cells, so the grid fills exactly at three
// columns on a phone and at four from sm. The rest of the catalogue is one tap
// away in the menu. "טלית ותפילין" has no square of its own any more (he asked
// for it to go); its two lines are here instead: the covers, and the sets.
//
// Pictures, kept from the squares the owner approved on 27.10.2026:
//   • the shop's own category photographs (src/assets/cat-*.webp);
//   • the warm-lit category artwork (src/assets/other-cats, 760×760);
//   • one real product photograph from the shelf, chosen by eye, where there is
//     neither. Those are catalogue shots on white, so they are shown whole on
//     the linen ground (`contain`) rather than cropped.
import { thumbUrl } from "@/lib/img";
import type { TileArt } from "@/lib/hero-tiles";

import imgSiddur from "@/assets/cat-siddur.webp";
import imgChatan from "@/assets/cat-chatan.webp";
import imgChalaka from "@/assets/cat-chalaka.webp";
import imgTallitTefillinCovers from "@/assets/cat-tallit-tefillin-covers.webp";
import artKippot from "@/assets/other-cats/kippot.webp";
import artMezuza from "@/assets/other-cats/mezuzot.webp";
import artTalitTefillinSet from "@/assets/other-cats/talit-tefillin-set.webp";

/** The squares in order. The first is the featured square (two rows). */
export const HERO_SQUARES: readonly string[] = [
  "sidurim",
  "talit-tefillin-covers",
  "setim-talit-tefilin",
  "kipot",
  "shabbat",
  "chagim",
  "plastic",
  "netilat-yadaim",
  "chatan-kala",
  "chalaka-set",
];

const ART = 760; // every src/assets/other-cats/*.webp
const art = (img: string): TileArt => ({ img, w: ART, h: ART });

const shelfPhoto = (path: string): TileArt => ({
  img:
    thumbUrl(
      `https://whtjslgrrfzehivrknuv.supabase.co/storage/v1/object/public/product-images/${path}.webp`,
      400,
    ) ?? "",
  w: 400,
  h: 400,
  contain: true,
});

export const HERO_TILE_ART: Readonly<Record<string, TileArt>> = {
  sidurim: { img: imgSiddur, w: 800, h: 800 },
  "talit-tefillin-covers": { img: imgTallitTefillinCovers, w: 800, h: 1067 },
  "setim-talit-tefilin": art(artTalitTefillinSet),
  kipot: art(artKippot),
  shabbat: shelfPhoto("catalog/41632"),
  chagim: shelfPhoto("catalog/60992"),
  plastic: art(artMezuza),
  "netilat-yadaim": shelfPhoto("catalog/56159"),
  "chatan-kala": { img: imgChatan, w: 800, h: 1067 },
  "chalaka-set": { img: imgChalaka, w: 800, h: 1067 },
};

/** Square labels that differ from the menu's, where a menu label is too long
 *  for two lines of a phone square. */
export const HERO_TILE_LABELS: Readonly<Record<string, string>> = {
  "netilat-yadaim": "נטלות",
};
