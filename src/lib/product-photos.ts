// Bundled local photographs for products the catalogue has no image for.
//
// WHY THIS FILE EXISTS
// The seven groom sets (מארזים לחתן) are the store's most expensive line
// (₪1,643-2,000 in the DB) and the ONLY seven active rows in a 4,648-product
// catalogue with `thumbnail_url IS NULL`. They render a bare grey "אין תמונה"
// box. Meanwhile public/groom-sets/ holds 17 genuine product photographs of
// this exact line. This module is the join between the two.
//
// WHY IT SHIPS ALMOST EMPTY
// A photograph on a product page is a factual claim about what arrives in the
// box. Pairing a photo with the wrong slug is not a cosmetic slip, it is
// telling a buyer spending ₪1,800 that they are getting a beige suede set when
// they are getting a linen one. So the rule for this map is absolute:
//
//     ONLY pairings the owner has confirmed. A slug with no confirmed photo
//     stays absent and keeps the honest "אין תמונה" fallback.
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
// KNOWN COST, to be paid when the first pairing is confirmed: these files live
// in public/ and so do NOT pass through the Supabase render endpoint that
// src/lib/img.ts uses — there is no width/quality transform available for them.
// They are 107-488 KB each at 1440x1920, and a listing tile renders at ~200 CSS
// px. Confirming a pairing therefore ships a full-size JPEG into a thumbnail
// slot. That is still far better than no photograph on a ₪1,800 product, but the
// real fix is a build step emitting 400w/800w variants next to each original and
// a srcSet here. Latent today: the map is empty, so nothing pays this yet.
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
  "groom-07.jpeg": [400, 800],
};

/**
 * Intrinsic size of every file in public/groom-sets/, decoded from the JPEG
 * SOF marker on 2026-08-03. Kept separate from the slug map so a pairing can be
 * confirmed by adding ONE line below without also having to measure the file.
 */
const GROOM_SET_PHOTOS: Record<string, { width: number; height: number }> = {
  "groom-01.jpeg": { width: 1440, height: 1920 },
  "groom-02.jpeg": { width: 1440, height: 1920 },
  "groom-03.jpeg": { width: 1440, height: 1920 },
  "groom-04.jpeg": { width: 1440, height: 1920 },
  "groom-05.jpeg": { width: 1440, height: 1920 },
  "groom-06.jpeg": { width: 896, height: 1200 },
  "groom-07.jpeg": { width: 1440, height: 1920 },
  "groom-08.jpeg": { width: 1440, height: 1920 },
  "groom-09.jpeg": { width: 1440, height: 1920 },
  "groom-10.jpeg": { width: 896, height: 1200 },
  "groom-11.jpeg": { width: 1440, height: 1920 },
  "groom-12.jpeg": { width: 1440, height: 1920 },
  "groom-13.jpeg": { width: 1440, height: 1920 },
  "groom-14.jpeg": { width: 1440, height: 1920 },
  "groom-15.jpeg": { width: 896, height: 1200 },
  "groom-16.jpeg": { width: 1440, height: 1920 },
  "groom-17.jpeg": { width: 1440, height: 1920 },
};

/**
 * slug -> filename in public/groom-sets/. OWNER-CONFIRMED PAIRINGS ONLY.
 *
 * To confirm one: open the photograph, open the product page, check that the
 * colour and material in the picture are the ones the product name and
 * description promise, then uncomment the line. Nothing else in the app needs
 * to change — ProductThumb picks it up automatically.
 *
 * The seven slugs below are every active product in the catalogue with no
 * photograph. Each is listed with what its own DB description promises, so the
 * check is a colour/material comparison and nothing more. NONE is confirmed
 * yet, so all seven stay commented and keep the honest placeholder.
 *
 *   groom-set-grey-print          אפור עם הדפס      (grey, printed)
 *   groom-set-white-crown         לבן עם עיטור כתר   (white, crown motif)
 *   groom-set-beige-suede         זמש בז'           (beige suede)
 *   groom-set-light-blue          תכלת              (light blue)
 *   groom-set-blue-denim          ג'ינס כחול         (blue denim texture)
 *   groom-set-white-embroidered   לבן, רקמה כסופה    (white, silver embroidery)
 *   groom-set-beige-linen-classic פשתן בז'          (beige linen)
 *
 * A note on the two that look easy: groom-07.jpeg really does show white bags
 * with a silver crown repeated on the atara, the tallit corner and the kippah,
 * which is `groom-set-white-crown` clause for clause. It is still commented out,
 * because (a) it is the file src/routes/index.tsx currently shows under a
 * DIFFERENT product, so enabling it here would put one photograph under two
 * products at once, and (b) the last person to reason this way from photographs
 * got two of four wrong. Owner confirms, then we ship.
 */
const SLUG_TO_GROOM_PHOTO: Record<string, string> = {
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
  "groom-set-white-crown": "groom-07.jpeg",
  // "groom-set-grey-print": "",
  // "groom-set-beige-suede": "",
  // "groom-set-light-blue": "",
  // "groom-set-blue-denim": "",
  // "groom-set-white-embroidered": "",
  // "groom-set-beige-linen-classic": "",
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
  const file = Object.prototype.hasOwnProperty.call(SLUG_TO_GROOM_PHOTO, slug)
    ? SLUG_TO_GROOM_PHOTO[slug]
    : undefined;
  if (!file) return null;
  const dims = Object.prototype.hasOwnProperty.call(GROOM_SET_PHOTOS, file)
    ? GROOM_SET_PHOTOS[file]
    : undefined;
  // A pairing pointing at a file we have no measurement for is a typo. Fall
  // back to no-photo rather than emitting an <img> with no intrinsic size,
  // which would reintroduce the layout shift the width/height attrs prevent.
  if (!dims) return null;
  const src = `/groom-sets/${file}`;
  const widths = Object.prototype.hasOwnProperty.call(RESIZED, file) ? RESIZED[file] : undefined;
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
