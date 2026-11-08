// Pictures for the homepage squares, keyed by the category slugs of the menu map
// (src/lib/nav-taxonomy.ts). A slug that is not in the map never gets a square,
// and a shelf of the map with no entry here is simply not shown (lib/hero-tiles).
//
// Three kinds of picture, kept from the squares the owner approved on 27.10.2026:
//   • the shop's own category photographs (src/assets/cat-*.webp);
//   • the warm-lit category artwork (src/assets/other-cats, 760×760);
//   • one real product photograph from the shelf itself, chosen by eye, for
//     shelves with neither. These are catalogue shots on white, so they are
//     shown whole on the linen ground (`contain`) rather than cropped.
//
// Moved to the shelf the menu now uses (UI review, 8.11.2026): the tefillin bag,
// the atara and the talit-and-tefillin set used to sit on duplicate rows of the
// categories table (tefillin-cases, atara, a percent-encoded "סט טלית תפילין").
import { thumbUrl } from "@/lib/img";
import type { TileArt } from "@/lib/hero-tiles";

import imgSiddur from "@/assets/cat-siddur.webp";
import imgTallit from "@/assets/cat-tallit.webp";
import imgChatan from "@/assets/cat-chatan.webp";
import imgChalaka from "@/assets/cat-chalaka.webp";
import imgGoldJewelry from "@/assets/cat-gold-jewelry.webp";
import imgTallitTefillinCovers from "@/assets/cat-tallit-tefillin-covers.webp";
import artKippot from "@/assets/other-cats/kippot.webp";
import artMezuza from "@/assets/other-cats/mezuzot.webp";
import artTalitTefillinSet from "@/assets/other-cats/talit-tefillin-set.webp";
import artTefillinBag from "@/assets/other-cats/tefillin-cases.webp";
import artAtara from "@/assets/other-cats/atara.webp";
import artCandlesticks from "@/assets/other-cats/candlesticks.webp";
import artChallahCover from "@/assets/other-cats/challah-cover.webp";
import artHavdalah from "@/assets/other-cats/havdalah.webp";
import artRoshHashana from "@/assets/other-cats/rosh-hashana.webp";
import artPurim from "@/assets/other-cats/purim.webp";
// Not other-cats/passover.webp: that "seder plate" is a platter of cheese slabs.
// This is the table photograph the Pesach occasion tile uses (occasion-art.ts).
import artPassover from "@/assets/occasions/passover-table.webp";
// Not other-cats/hanukkah.webp: its generated חנוכייה has TEN lights. The drawn
// one has eight and a raised shamash, as the occasion tile does.
import artHanukkah from "@/assets/occasions/hanukkah-art.svg";

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
  // Departments
  kipot: art(artKippot),
  "talit-tefilin": shelfPhoto("catalog/60461"),
  sidurim: { img: imgSiddur, w: 800, h: 800 },
  shabbat: shelfPhoto("catalog/41632"),
  chagim: shelfPhoto("catalog/60992"),
  plastic: art(artMezuza),
  "chatan-kala": { img: imgChatan, w: 800, h: 1067 },
  tachshitim: shelfPhoto("catalog/80997"),

  // טלית ותפילין
  talitot: { img: imgTallit, w: 800, h: 1000 },
  "setim-talit-tefilin": art(artTalitTefillinSet),
  "talit-tefillin-covers": { img: imgTallitTefillinCovers, w: 800, h: 1067 },
  "tik-tefilin": art(artTefillinBag),
  "machzikei-talit-atarot": art(artAtara),
  "gufiya-tzitzit-kitelim": shelfPhoto("catalog/66738"),

  // סידורים
  birchonim: shelfPhoto("catalog/42306"),
  "sidurim-tehilim": shelfPhoto("catalog/81689"),
  "beit-knesset-shtenderim": shelfPhoto("catalog/46430"),

  // שבת
  candlesticks: art(artCandlesticks),
  "gviei-kidush": shelfPhoto("catalog/81179"),
  "challah-covers": art(artChallahCover),
  havdalah: art(artHavdalah),
  "netilat-yadaim": shelfPhoto("catalog/56159"),

  // חגים
  "rosh-hashana": art(artRoshHashana),
  hanukkah: { img: artHanukkah, w: 760, h: 950, position: "50% 30%" },
  purim: art(artPurim),
  passover: art(artPassover),

  // נרתיקי מזוזה
  "mezuzot-polyresin-even": shelfPhoto("opt/d009c51df56c0a4915a2e762"),

  // חתן, כלה ושמחות
  "chalaka-set": { img: imgChalaka, w: 800, h: 1067 },
  "karit-labrit": shelfPhoto("catalog/66858"),

  // תכשיטים
  "esh-sheli-gold": { img: imgGoldJewelry, w: 800, h: 1144 },

  // לבית ולמתנה
  // A real "מזמור לתודה" plaque from the shelf. The generated other-cats
  // blessings artwork shows cards lettered in garbled pseudo-English.
  blessings: shelfPhoto("catalog/83127"),
  "kupot-tzedaka": shelfPhoto("catalog/45481"),
  "wall-art": shelfPhoto("opt/a8d5d9bf07af6828f23fecbc"),
  "machzikei-maftechot-magnetim": shelfPhoto("catalog/35856"),
  "chasidim-tzivoniim": shelfPhoto("catalog/56364"),
  yeladim: shelfPhoto("catalog/67087"),
};

/** Square labels that differ from the menu's: where the menu leans on its panel,
 *  or where the menu label does not fit two lines of a phone square. */
export const HERO_TILE_LABELS: Readonly<Record<string, string>> = {
  "mezuzot-polyresin-even": "מזוזות פולירזין ואבן",
  "machzikei-maftechot-magnetim": "מחזיקי מפתחות",
};
