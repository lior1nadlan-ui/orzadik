// Supabase Storage image-transform URLs for list/card thumbnails.
//
// Product images live in the `product-images` bucket at their full upload size
// (mostly 500×500 and 1000×1000 WebP). Cards render them at ~200–400 CSS px, so
// serving the original ships 2–3× more bytes than the layout can use. The
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
export function thumbUrl(
  url: string | null | undefined,
  width = 400,
  quality = 75,
): string | null {
  if (!url) return null;
  if (!url.includes(OBJECT_SEGMENT)) return url;
  const base = url.replace(OBJECT_SEGMENT, RENDER_SEGMENT);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${width}&quality=${quality}`;
}
