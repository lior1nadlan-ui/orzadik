// Bundled local photographs for products the catalogue has no image for.
//
// WHY THIS FILE EXISTS
// The seven groom sets (מארזים לחתן) are the store's most expensive line
// (₪1,643-2,000 in the DB) and the ONLY seven active rows in a 4,648-product
// catalogue with `thumbnail_url IS NULL`. They render a bare grey "אין תמונה"
// box. Meanwhile public/groom-sets/ holds 17 genuine product photographs of
// this exact line, and public/product-photos/drive-2026-08/ holds 47 more from
// the owner's own 2026-08-16 shoot. This module is the join between the two.
//
// STATE, 2026-08-19: all seven slugs are now paired and the placeholder is
// gone. One pairing (white-crown) the owner confirmed by eye on 2026-08-09; the
// other six were made on 2026-08-19 on the owner's instruction from the new
// shoot, where the colourways are unambiguous. Each entry carries its evidence.
//
// WHY THE MAP IS STILL GUARDED
// A photograph on a product page is a factual claim about what arrives in the
// box. Pairing a photo with the wrong slug is not a cosmetic slip, it is
// telling a buyer spending ₪1,800 that they are getting a beige suede set when
// they are getting a linen one. So the rule for this map is:
//
//     A pairing states the evidence it rests on, or it does not go in. A slug
//     with no photo keeps the honest "אין תמונה" fallback, which is always
//     better than a confident wrong picture.
//
// That rule is not theoretical caution. The existing slug->photo pairings
// elsewhere in this codebase were checked against the photographs on
// 2026-08-03 and HALF OF THEM ARE WRONG (details under "MEASURED", below).
// Whoever wrote them was guessing from filename order. Do not repeat it.
//
// MEASURED 2026-08-03 (files opened and read, DB read live via the anon REST API)
//   * The 17 files are NOT 17 models. They are repeat angles of a handful of
//     physical sets: groom-04 and groom-05 are the same cream/crown set (same
//     embroidered name "ענג אלגא"), groom-06 is the same grey-melange set as
//     groom-03 (same embroidered name). So "17 photos, 7 products" does not
//     divide, and file numbering carries no model information at all.
//   * File numbers do NOT track the old slug numbers. groom-07.jpeg is a WHITE
//     set with a large silver crown; the old slug `groom-set-07` maps (via
//     src/server.ts RENAMED_PRODUCT_SLUGS) to `groom-set-white-crown`, but
//     src/routes/index.tsx pairs groom-07.jpeg with `groom-set-black-leather-look`
//     — whose own DB photo is a genuinely charcoal/black set. That pairing is
//     live on the homepage and is wrong.
//   * src/routes/index.tsx also pairs groom-05.jpeg (cream/beige quilted suede
//     with a silver crown) with `groom-set-brown-leather-look`, whose DB photo
//     is unambiguously BROWN suede embroidered "ירון ביטון" — the customer name
//     that produced the pre-rename slug. Also wrong.
//   * The two pairings that ARE right: groom-03.jpeg is grey melange fabric and
//     is paired with `groom-set-grey-melange`; groom-02.jpeg is linen-look with
//     the "האש שלי" flame motif and is paired with `groom-set-linen-look-premium`,
//     whose product name names both features.
//   * Several photographs carry a real customer's embroidered name in-frame
//     ("מתן צדוק מוש", "נוריאל דוידוב", "ענג אלגא"). The slugs and card labels
//     were scrubbed of personal names on 2026-07-31; the names inside the
//     PIXELS were not. Worth the owner's decision before any of these are
//     promoted to a product-page hero.
//
// KNOWN COST, now being paid by six of the seven: these files live in public/
// and so do NOT pass through the Supabase render endpoint that src/lib/img.ts
// uses — there is no width/quality transform available for them. A listing tile
// renders at ~200 CSS px, so every paired product ships more image than the tile
// can use: 107-488 KB at 1440x1920 for the groom-sets JPEGs, 120-260 KB at
// ~1200px for the drive-2026-08 WebPs. Only groom-07.jpeg has downscales (see
// RESIZED). The real fix is a build step emitting 400w/800w variants next to
// each original and listing them in RESIZED; until then this is a weight cost,
// never a correctness one, and it beats no photograph on a ₪1,800 product.
//
// Dimensions below are decoded from each file's JPEG SOF marker, not assumed.
// Three of the seventeen are 896x1200, not 1440x1920 — the "every
// public/groom-sets/*.jpeg is 1440×1920" comments in src/routes/index.tsx and
// LuxuryShowcase.tsx are true only of the files those two happen to use today,
// and both invite the owner to swap in any of groom-01..17. Consumers should
// read width/height from here rather than hard-coding a constant.

/** A bundled photograph served from public/, with its real intrinsic size. */
export type LocalPhoto = {
  /** Absolute site path, e.g. "/groom-sets/groom-07.jpeg". */
  src: string;
  width: number;
  height: number;
  /** Responsive candidates, when downscales have been generated. See RESIZED. */
  srcSet?: string;
};

/**
 * Downscales generated next to an original, keyed by original filename.
 *
 * THIS IS THE "KNOWN COST" IN THE HEADER, NOW PAID — for the one file that has
 * a confirmed pairing. groom-07.jpeg is 250 KB at 1440x1920 and a listing tile
 * renders it at roughly 200 CSS px; the 400w candidate is 22 KB, so the tile
 * stops paying 91% of a payload it cannot use. These files do not pass through
 * the Supabase render endpoint (they live in public/), so the candidates are
 * real files on disk rather than transform URLs.
 *
 * Regenerate with sharp: resize to width, jpeg quality 82, mozjpeg.
 * A file absent from this map simply ships its original with no srcSet — the
 * behaviour every unconfirmed pairing had before, so adding a pairing without
 * generating downscales degrades in weight, never in correctness.
 */
const RESIZED: Record<string, number[]> = {
  "/groom-sets/groom-07.jpeg": [400, 800],
};

/**
 * Intrinsic size of every bundled photograph, keyed by the site-absolute path
 * it is served from. The groom-sets/*.jpeg entries were decoded from the JPEG
 * SOF marker on 2026-08-03; the drive-2026-08/*.webp entries are the encoder's
 * output sizes from the 2026-08-19 import.
 *
 * Kept separate from the slug map so a pairing can be confirmed by adding ONE
 * line below without also having to measure the file.
 */
const PHOTO_SIZES: Record<string, { width: number; height: number }> = {
  "/groom-sets/groom-01.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-02.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-03.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-04.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-05.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-06.jpeg": { width: 896, height: 1200 },
  "/groom-sets/groom-07.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-08.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-09.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-10.jpeg": { width: 896, height: 1200 },
  "/groom-sets/groom-11.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-12.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-13.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-14.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-15.jpeg": { width: 896, height: 1200 },
  "/groom-sets/groom-16.jpeg": { width: 1440, height: 1920 },
  "/groom-sets/groom-17.jpeg": { width: 1440, height: 1920 },

  // The owner's own shoot of 2026-08-16, shared 2026-08-19 and landed in
  // public/product-photos/drive-2026-08/. Sizes are the encoder's output, not
  // a measurement of the HEIC originals: every file was re-encoded to WebP at
  // max 1200px, so the long edge is 1200 and the short edge is whatever the
  // frame's aspect ratio gives.
  "/product-photos/drive-2026-08/img_0089.webp": { width: 1061, height: 1200 },
  "/product-photos/drive-2026-08/img_0094.webp": { width: 973, height: 1200 },
  "/product-photos/drive-2026-08/img_0097.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0098.webp": { width: 1102, height: 1200 },
  "/product-photos/drive-2026-08/img_0105.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0119.webp": { width: 1200, height: 1143 },
  // Further angles of sets already paired above.
  "/product-photos/drive-2026-08/img_0091.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0092.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0093.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0095.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0096.webp": { width: 1200, height: 1155 },
  "/product-photos/drive-2026-08/img_0099.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0102.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0106.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0120.webp": { width: 900, height: 1200 },
  // Siddur covers from the same shoot, shot one per frame.
  "/product-photos/drive-2026-08/img_0107.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0108.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0109.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0110.webp": { width: 900, height: 1200 },
  "/product-photos/drive-2026-08/img_0111.webp": { width: 900, height: 1200 },
};

/**
 * slug -> site-absolute path of its bundled photograph.
 *
 * These are the seven active products that had no photograph in a 4,648-product
 * catalogue, each named for the colour and material it promises:
 *
 *   groom-set-grey-print          אפור עם הדפס      (grey, printed)
 *   groom-set-white-crown         לבן עם עיטור כתר   (white, crown motif)
 *   groom-set-beige-suede         זמש בז'           (beige suede)
 *   groom-set-light-blue          תכלת              (light blue)
 *   groom-set-blue-denim          ג'ינס כחול         (blue denim texture)
 *   groom-set-white-embroidered   לבן, רקמה כסופה    (white, silver embroidery)
 *   groom-set-beige-linen-classic פשתן בז'          (beige linen)
 *
 * All seven now have one, and the per-entry comments below record on what
 * evidence and on whose instruction. Nothing else in the app needs to change
 * when a path here changes — ProductThumb and the product page pick it up.
 *
 * The bar for editing this map has not moved: a photograph on a product page is
 * a factual claim about what arrives in the box, so a pairing states its
 * evidence or it does not go in. Removing a line is always safe — the product
 * falls back to the honest "אין תמונה" placeholder.
 */
const SLUG_TO_PHOTO: Record<string, string> = {
  // OWNER-CONFIRMED 2026-08-09. Both blockers recorded above are cleared:
  //   (a) the double-use is gone — src/routes/index.tsx no longer shows this
  //       file under groom-set-black-leather-look; that entry was one of the two
  //       wrong pairings this file's audit found, and it now points here;
  //   (b) the owner looked at the photograph against the product and confirmed
  //       it, rather than anyone reasoning from filename order again.
  // The white bags, the silver crown repeated on the atara, the tallit corner
  // and the kippah are `groom-set-white-crown` clause for clause, and the
  // pre-rename slug groom-set-07 maps to this product in RENAMED_PRODUCT_SLUGS.
  //
  // The photograph carries a real customer's embroidered name, in four places,
  // unretouched. Raised with the owner twice and published on their explicit
  // instruction — it is their photograph of their own work and their customer
  // relationship. If the customer asks, deleting this one line restores the
  // placeholder.
  //
  // The 2026-08-19 shoot contains a second white-crown set,
  // /product-photos/drive-2026-08/img_0102.webp, with the same crown motif and
  // NO customer name in frame. Left un-swapped because this pairing is the one
  // the owner confirmed by eye; swapping the path below is a one-line change if
  // the name is ever a problem.
  "groom-set-white-crown": "/groom-sets/groom-07.jpeg",

  // ---------------------------------------------------------------------
  // PAIRED 2026-08-19 on the owner's instruction ("תחבר הכל למוצרים"), from
  // their own shoot of 2026-08-16 — 28 flat-lays that between them cover every
  // colourway the six slugs below name.
  //
  // This is a different evidential situation from the 2026-08-03 audit this
  // file was written to prevent, and the difference is why these ship. That
  // audit's pairings were guessed from filename order across public/groom-sets/,
  // where 17 files are repeat angles of a handful of sets and several of those
  // sets are near-identical creams. Each line below is instead a colour-and-
  // material match against the words in the product's own name, checked by
  // opening the file:
  //
  //   grey-print          img_0105  grey melange, flame motif PRINTED on bags,
  //                                 kippah and atara ("האש שלי תוקד")
  //   beige-suede         img_0097  taupe suede-nap bags, same flame motif
  //   light-blue          img_0098  pale blue chambray, crown-motif atara
  //   blue-denim          img_0119  deeper blue denim weave, wreath motif
  //   white-embroidered   img_0089  white/cream, Star-of-David embroidery
  //                                 throughout ("שויתי ה' לנגדי תמיד")
  //   beige-linen-classic img_0094  oatmeal linen, priestly-blessing atara
  //
  // Still an inference, and the honest name for the residual risk is this: the
  // photographs prove which COLOURWAYS were shot, not which shop model name
  // each physical set is sold under. The pair most worth a second look is
  // light-blue vs blue-denim, which differ by depth of blue and weave rather
  // than by any motif. Every line is one string away from the placeholder.
  //
  // None of these six carries a customer's embroidered name in frame — checked
  // per file, unlike groom-07.jpeg above.
  "groom-set-grey-print": "/product-photos/drive-2026-08/img_0105.webp",
  "groom-set-beige-suede": "/product-photos/drive-2026-08/img_0097.webp",
  "groom-set-light-blue": "/product-photos/drive-2026-08/img_0098.webp",
  "groom-set-blue-denim": "/product-photos/drive-2026-08/img_0119.webp",
  "groom-set-white-embroidered": "/product-photos/drive-2026-08/img_0089.webp",
  "groom-set-beige-linen-classic": "/product-photos/drive-2026-08/img_0094.webp",
};

/**
 * slug -> further bundled frames, shown after the hero in the product gallery.
 *
 * Two kinds of frame, in this order: more ANGLES of the same physical set, then
 * that set's own SIDDUR shot on its own.
 *
 * ANGLES are only listed where the frame is unmistakably the same physical set
 * as the hero — same colourway, same motif, and the same wording embroidered on
 * the atara, which is the detail that actually distinguishes two sets of similar
 * colour. Frames of a similar-looking but differently-lettered set are left out
 * rather than padded in:
 *
 *   grey-print          img_0106  grey melange, "האש שלי תוקד", flame motif
 *   beige-suede         img_0096  taupe suede, "האש שלי תוקד עד ביאת המשיח"
 *   beige-linen-classic img_0095  oatmeal linen, same long priestly-blessing
 *                                 atara and crown motif as the hero
 *   white-embroidered   img_0091  white/cream, "שויתי ה'", Star of David
 *   blue-denim          img_0120  blue-grey, wreath motif, same long atara text
 *   light-blue          img_0099, img_0092, img_0093  pale blue chambray with
 *                                 the pale blue siddur in frame
 *   white-crown         img_0102  white with the crown motif, "שמע ישראל" atara,
 *                                 and — unlike the groom-07.jpeg hero — no
 *                                 customer name anywhere in the frame
 *
 * SIDDURIM rest on the owner's rule for the line, in their words on 2026-08-19:
 * "כל סידור בצבע של הטלית" — each siddur is bound in the colour of its tallit.
 * That is what makes a colour match evidence here rather than a guess, and each
 * was additionally checked against the siddur visible inside the set's own
 * flat-lay:
 *
 *   grey-print          img_0108  pale grey linen, blind-stamped "סידור"
 *   beige-suede         img_0111  cream linen carrying the SAME flame motif as
 *                                 the set's bags, kippah and atara — the motif
 *                                 is what makes this one certain, not the colour
 *   beige-linen-classic img_0109  oatmeal linen, same weave as the set's bags
 *   white-embroidered   img_0110  white, blind-embossed "סידור"
 *   blue-denim          img_0107  blue-grey quilted with a gold crown
 *
 * NO SIDDUR FRAME, each for a stated reason rather than for lack of a candidate:
 *
 *   light-blue      No standalone cover in the shoot is pale blue. Its siddur is
 *                   visible inside the angles listed above, so the book exists —
 *                   it was just never shot on its own.
 *   white-crown     img_0116 matches the set's silver crown motif exactly, and
 *                   is the obvious pairing on looks alone. It is left out
 *                   because its cover reads "סידור הודו לשם לבת ישראל" — a
 *                   women's siddur, on a חתן product. If the shop really does
 *                   ship that book with the groom set, this is a one-line add;
 *                   if not, adding it would have put the wrong book on the page.
 *
 * Three charcoal covers (img_0113, img_0114, img_0115) are also unplaced. No
 * charcoal set is among these seven — they most likely belong to
 * groom-set-black-leather-look, -grey-melange or -linen-look-premium, which
 * already carry DB photographs, and which of the three is which is not
 * something these frames settle.
 */
const SLUG_TO_EXTRA_PHOTOS: Record<string, string[]> = {
  "groom-set-grey-print": [
    "/product-photos/drive-2026-08/img_0106.webp",
    "/product-photos/drive-2026-08/img_0108.webp",
  ],
  "groom-set-beige-suede": [
    "/product-photos/drive-2026-08/img_0096.webp",
    "/product-photos/drive-2026-08/img_0111.webp",
  ],
  "groom-set-beige-linen-classic": [
    "/product-photos/drive-2026-08/img_0095.webp",
    "/product-photos/drive-2026-08/img_0109.webp",
  ],
  "groom-set-white-embroidered": [
    "/product-photos/drive-2026-08/img_0091.webp",
    "/product-photos/drive-2026-08/img_0110.webp",
  ],
  "groom-set-blue-denim": [
    "/product-photos/drive-2026-08/img_0120.webp",
    "/product-photos/drive-2026-08/img_0107.webp",
  ],
  "groom-set-light-blue": [
    "/product-photos/drive-2026-08/img_0099.webp",
    "/product-photos/drive-2026-08/img_0092.webp",
    "/product-photos/drive-2026-08/img_0093.webp",
  ],
  "groom-set-white-crown": ["/product-photos/drive-2026-08/img_0102.webp"],
};

/**
 * The bundled photograph for a product slug, or null when there isn't one.
 *
 * Deliberately total and defensive: any slug that is not a confirmed key —
 * including null, undefined, a non-string, or a filename whose measurement is
 * missing — returns null, which callers render as their normal no-image state.
 * This is imported read-only by the product page and by ProductThumb, so it
 * must never throw and must never return a half-populated object.
 */
export function localProductPhoto(slug: string | null | undefined): LocalPhoto | null {
  if (typeof slug !== "string" || slug === "") return null;
  const file = Object.prototype.hasOwnProperty.call(SLUG_TO_PHOTO, slug)
    ? SLUG_TO_PHOTO[slug]
    : undefined;
  if (!file) return null;
  return photoFor(file);
}

/**
 * Every bundled frame for a slug, hero first: the SLUG_TO_PHOTO photograph
 * followed by any SLUG_TO_EXTRA_PHOTOS frames, in the order listed there.
 *
 * Same defensiveness as localProductPhoto — an unmeasured path is skipped
 * rather than emitting an <img> with no intrinsic size, and a slug with nothing
 * bundled returns an empty array, never null. Callers spread it into a gallery,
 * so element order is the display order.
 *
 * A product with extra frames but no hero returns just the extras; that is a
 * mistake in the maps rather than a state to design for, but it degrades to
 * "shows what we have" instead of throwing.
 */
export function localProductPhotos(slug: string | null | undefined): LocalPhoto[] {
  if (typeof slug !== "string" || slug === "") return [];
  const extras = Object.prototype.hasOwnProperty.call(SLUG_TO_EXTRA_PHOTOS, slug)
    ? SLUG_TO_EXTRA_PHOTOS[slug]
    : [];
  const hero = localProductPhoto(slug);
  const rest = extras.map(photoFor).filter((p): p is LocalPhoto => p !== null);
  return hero ? [hero, ...rest] : rest;
}

/** Resolve one bundled path to a sized photo, or null if it has no measurement. */
function photoFor(src: string): LocalPhoto | null {
  const dims = Object.prototype.hasOwnProperty.call(PHOTO_SIZES, src)
    ? PHOTO_SIZES[src]
    : undefined;
  // A pairing pointing at a file we have no measurement for is a typo. Fall
  // back to no-photo rather than emitting an <img> with no intrinsic size,
  // which would reintroduce the layout shift the width/height attrs prevent.
  if (!dims) return null;
  const widths = Object.prototype.hasOwnProperty.call(RESIZED, src) ? RESIZED[src] : undefined;
  // The original is always the last candidate at its true width, so a viewport
  // that wants more than the largest downscale still has somewhere to go.
  const srcSet = widths?.length
    ? [
        ...widths.map((w) => `${src.replace(/\.jpe?g$/i, "")}-${w}w.jpg ${w}w`),
        `${src} ${dims.width}w`,
      ].join(", ")
    : undefined;
  return { src, width: dims.width, height: dims.height, srcSet };
}

/** True when the slug has a confirmed bundled photograph. */
export function hasLocalProductPhoto(slug: string | null | undefined): boolean {
  return localProductPhoto(slug) !== null;
}
