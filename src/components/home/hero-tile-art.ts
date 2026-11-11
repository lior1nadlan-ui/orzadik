// The homepage squares: which categories, in what order, and their pictures.
//
// OWNER VIDEO 08.11.2026 (Lior): "כל המשבצות האלה ממש מבולבלות, צריך למיין
// אותם ולעשות כמה משבצות". The 36 squares (one per shelf of the menu) became
// the featured siddurim plus ten: 1 featured (two cells) + 10 = 12 cells, so
// the grid fills exactly at three columns on a phone and at four from sm, and
// a "לכל המוצרים" row closes it. The rest of the catalogue is one tap away in
// the menu. "טלית ותפילין" has no square of its own any more (he asked for it to
// go); its lines are here instead: the covers, the tallitot and the sets.
//
// טליתות came back on 09.11.2026 (Ariel: "ריבוע זה חשוב, טליתות נמכר הרבה").
// It is the tenth square rather than a swap, which is why "לכל המוצרים" became
// a full row instead of the twelfth cell.
//
// Pictures, kept from the squares the owner approved on 27.10.2026:
//   • the shop's own category photographs (src/assets/cat-*.webp);
//   • the warm-lit category artwork (src/assets/other-cats, 760×760);
//   • (09.11.2026) the catalogue shots on white that stood in for Shabbat,
//     holidays and washing cups gave way to the same warm-lit artwork, and the
//     tallit square to a studio shot of an embroidered tallit, so the wall
//     reads as one formal set;
//   • (11.11.2026) the owner asked for nicer tallit and chalaka pictures: the
//     tallit square is a golden-hour frame from the shop's own shoot, the
//     chalaka square the embroidered crown-and-wreath cape with its scissors.
import type { TileArt } from "@/lib/hero-tiles";

import imgSiddur from "@/assets/cat-siddur.webp";
import imgTallit from "@/assets/cat-tallit-golden.webp";
import imgChalaka from "@/assets/cat-chalaka-wreath.webp";
import imgTallitTefillinCovers from "@/assets/cat-tallit-tefillin-bag.webp";
import artKippot from "@/assets/other-cats/kippot.webp";
import artMezuza from "@/assets/other-cats/mezuzot.webp";
import artTalitTefillinSet from "@/assets/other-cats/talit-tefillin-set.webp";
import artCandlesticks from "@/assets/other-cats/candlesticks.webp";
import artHolidays from "@/assets/other-cats/holidays.webp";
import artWedding from "@/assets/other-cats/wedding.webp";
import artWashingCups from "@/assets/other-cats/washing-cups.webp";

/** The squares in order. The first is the featured square (two rows). */
export const HERO_SQUARES: readonly string[] = [
  "sidurim",
  "talit-tefillin-covers",
  "talitot",
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

export const HERO_TILE_ART: Readonly<Record<string, TileArt>> = {
  sidurim: { img: imgSiddur, w: 800, h: 800 },
  // 09.11.2026: a white embroidered tallit bag on marble (one of the shop's
  // own photos) instead of a shot with a white patch in its corner.
  "talit-tefillin-covers": { img: imgTallitTefillinCovers, w: 800, h: 800 },
  // 11.11.2026: a man wrapped in a white tallit at golden hour (the shop's
  // own shoot, public/product-photos/drive-2026-08/…17-39-56_5, a frame the
  // hero slides don't use) instead of the close-up of an embroidered tallit.
  talitot: { img: imgTallit, w: 800, h: 800 },
  "setim-talit-tefilin": art(artTalitTefillinSet),
  kipot: art(artKippot),
  // 09.11.2026: the warm-lit studio artwork, like the other squares, in place
  // of catalogue shots on white, so the wall reads as one set.
  shabbat: art(artCandlesticks),
  chagim: art(artHolidays),
  plastic: art(artMezuza),
  "netilat-yadaim": art(artWashingCups),
  // 09.11.2026: the warm-lit artwork; the busy photo of a full set read as clutter.
  "chatan-kala": art(artWedding),
  // 11.11.2026: the white chalaka cape with the embroidered crown and wreath,
  // and the scissors (public/product-photos/drive-2026-11/
  // chalaka-white-quilted-cream-wreath-4). The customer's child's name that
  // was embroidered inside the wreath has been removed from the picture, so
  // no customer's name sits on the homepage.
  "chalaka-set": { img: imgChalaka, w: 800, h: 800 },
};

/** Square labels that differ from the menu's, where a menu label is too long
 *  for two lines of a phone square. */
export const HERO_TILE_LABELS: Readonly<Record<string, string>> = {
  "netilat-yadaim": "נטלות",
  // 09.11.2026: the menu's names ran to three lines on a phone and were cut
  // off with "..." ("כיסויים לטלית...", "סטים של תיקי טלי...").
  "talit-tefillin-covers": "תיקי טלית ותפילין",
  "setim-talit-tefilin": "סטי טלית ותפילין",
};
