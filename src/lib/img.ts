// Supabase Storage image-transform URLs for list/card thumbnails.
//
// Product images live in the `product-images` bucket at their full upload size
// (mostly 500×500 and 1000×1000 WebP). Cards render them at ~200-400 CSS px, so
// serving the original ships 2-3× more bytes than the layout can use. The
// storage render endpoint resizes on the fly and content-negotiates the output
// format from the request's Accept header.
//
// Measured against the live bucket (cache-busted, browser-realistic
// `Accept: image/webp,image/avif,image/*`):
//   500×500  catalog/53322.webp  14,314 B → 10,316 B  (-28%)
//   1000×1000 catalog/83298.webp 37,706 B → 21,486 B  (-43%)
//   14-image sample @ width=400:        -25.8% in aggregate, smaller in 14/14
// Note the Accept header matters: with `*/*` the endpoint falls back to JPEG,
// which is LARGER than the original WebP. Every real browser sends image/webp,
// so this is a win in the browser — but it is why a bare `curl -I` check looks
// like a regression. Don't "verify" this with curl unless you set Accept.
//
// The product-page gallery deliberately keeps the original URLs: those images
// are displayed near full size and are the page's LCP element.
//
// ---------------------------------------------------------------------------
// `resize=contain` is REQUIRED, and its absence was a silent bug (fixed
// 2026-08-03). The byte measurements above were all correct; what nobody had
// checked was the DIMENSIONS of what came back. Supabase Storage defaults to
// `resize=cover`, and `cover` with a width but no height targets a box of
// (width × SOURCE height) — so it scales nothing and CENTRE-CROPS the width.
//
// Re-measured by decoding the returned bytes (not by eye), same browser-realistic
// Accept header:
//   catalog/15624.webp        source 500×500
//     ?width=400&quality=75                 → 400×500  3,744 B   (crop)
//     ?width=400&quality=75&resize=contain  → 400×400  2,962 B   (whole image)
//     ?width=96 &quality=75                 →  96×500    974 B   (81% of the
//                                                        width thrown away)
//   category hero            source 1536×1024
//     ?width=400&quality=75                 → 400×1024 48,042 B  (a vertical
//                                              slice of a landscape photo)
//     ?width=400&quality=75&resize=contain  → 400×267  16,130 B
//
// Proof it is a crop and not a squeeze: `?width=400&quality=75` returns bytes
// IDENTICAL (sha256 ca6f4eaca638fc3d) to an explicit
// `?width=400&height=500&resize=cover`, and different from the `resize=fill`
// stretch. So the endpoint was handing every listing tile, every search-dropdown
// row and every category hero a centre-cropped sliver of the product.
//
// contain is also strictly SMALLER in every case measured — it is the rare fix
// that costs nothing. It never upscales past the source (width=600 and width=800
// both still return the 500×500 original), so the srcSet candidates above the
// source size collapse to one entry, exactly as before.
//
// Presentation cropping stays in CSS, where it belongs: the card markup already
// puts an `object-cover` image inside an `aspect-square` box, so the server
// sending the whole photograph is what lets that CSS make a correct decision.

/** Supabase public-object path segment we rewrite to the render endpoint. */
const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/**
 * Rewrite a Supabase Storage public URL to a width-constrained transform.
 *
 * Returns the input unchanged for anything that isn't a Supabase public-object
 * URL (external hosts, data: URIs, already-transformed URLs, null/empty), so it
 * is always safe to wrap a `thumbnail_url` with it.
 */
export function thumbUrl(url: string | null | undefined, width = 400, quality = 75): string | null {
  if (!url) return null;
  if (!url.includes(OBJECT_SEGMENT)) return url;
  const base = url.replace(OBJECT_SEGMENT, RENDER_SEGMENT);
  const sep = base.includes("?") ? "&" : "?";
  // resize=contain is load-bearing, not a tweak — see the measurement block at
  // the top of this file. Without it the endpoint centre-crops instead of
  // scaling, and every caller of this function gets a sliver.
  return `${base}${sep}width=${width}&quality=${quality}&resize=contain`;
}
