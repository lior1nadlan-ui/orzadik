import { useState } from "react";
import { thumbUrl } from "@/lib/img";
import { localProductPhoto } from "@/lib/product-photos";

/**
 * Product thumbnail with a two-stage fallback.
 *
 *   stage 0 → the Supabase render-endpoint transform (smaller, right-sized)
 *   stage 1 → the original object URL, if the transform 404s or is disabled
 *   stage 2 → the branded "אין תמונה" placeholder
 *
 * The middle stage is the point: image transforms are a storage feature that
 * can be turned off or fail per-object, and without it a single bad transform
 * would show the placeholder for an image that exists perfectly well.
 *
 * Before stage 2 the component consults src/lib/product-photos.ts for a
 * bundled local photograph, which is how the groom sets (the only products in
 * the catalogue with no `thumbnail_url`) can show a real picture. That map is
 * owner-confirmed-only and currently empty, so today this path is inert by
 * design — see the comment in product-photos.ts for why an empty map is the
 * correct state and not an oversight. Wiring it now means confirming a pairing
 * is a one-line edit in that file with no component change.
 */
export function ProductThumb({
  url,
  slug,
  alt,
  width = 400,
  className = "",
  sizes,
  priority = false,
  eager,
  highPriority,
  placeholderClassName = "flex h-full items-center justify-center text-muted-foreground text-sm",
}: {
  url: string | null | undefined;
  /**
   * Product slug. Optional: only used to look up a bundled local photograph
   * when `url` is empty, so every existing caller keeps its exact behaviour.
   */
  slug?: string | null;
  alt: string;
  width?: number;
  className?: string;
  /** srcset `sizes` hint; only used when a responsive srcSet is actually emitted. */
  sizes?: string;
  /**
   * Legacy single knob: sets BOTH eager loading and high fetchPriority. Kept so
   * existing callers keep their exact behaviour; `eager`/`highPriority` below
   * each override it independently when a caller wants to decouple the two.
   */
  priority?: boolean;
  /** Load eagerly (an above-the-fold row). Falls back to `priority` when unset. */
  eager?: boolean;
  /** fetchPriority="high" (only the 1-2 LCP tiles). Falls back to `priority` when unset. */
  highPriority?: boolean;
  placeholderClassName?: string;
}) {
  const [stage, setStage] = useState(0);

  if (!url || stage >= 2) {
    // No catalogue image (or both remote stages failed): a bundled photograph
    // is better than the placeholder, and it is a local static asset so there
    // is no third failure mode to fall back FROM.
    const local = localProductPhoto(slug);
    if (local) {
      return (
        <img
          src={local.src}
          // Present only for files with generated downscales. `sizes` is the
          // caller's own tile width, the same number the remote stages pass to
          // thumbUrl — without it the browser assumes 100vw and picks the
          // original, which is the entire cost this srcSet exists to avoid.
          srcSet={local.srcSet}
          sizes={local.srcSet ? `${width}px` : undefined}
          alt={alt}
          // Real decoded dimensions, not the square `width` the remote stages
          // assume — these photographs are 3:4 portrait. The container's
          // object-fit still drives display size; these only reserve the box.
          width={local.width}
          height={local.height}
          loading={(eager ?? priority) ? "eager" : "lazy"}
          fetchPriority={(highPriority ?? priority) ? "high" : "auto"}
          decoding="async"
          className={className}
        />
      );
    }
    return <div className={placeholderClassName}>אין תמונה</div>;
  }

  // stage 0 serves the width-capped render transform; stage 1 falls back to the
  // original object URL. thumbUrl returns the input untouched for anything that
  // is not a Supabase public-object URL, so `didTransform` is the SAME guard
  // LuxuryShowcase uses before offering a srcSet.
  const rendered = thumbUrl(url, width);
  const didTransform = rendered != null && rendered !== url;
  const src = stage === 0 ? (rendered ?? url) : url;

  // Only offer a responsive srcSet on the transform stage and only when the URL
  // was actually rewritten — otherwise every candidate would be the same
  // original at one size. The width=400 transform stays as the plain src
  // fallback for browsers that ignore srcset.
  const srcSet =
    stage === 0 && didTransform
      ? [200, 400, 600, 800].map((w) => `${thumbUrl(url, w)} ${w}w`).join(", ")
      : undefined;

  // eager and fetchPriority are decoupled: an above-the-fold ROW can load eager
  // while only the first 1-2 tiles claim high fetchPriority. Both default to the
  // legacy `priority` flag so untouched callers keep their current behaviour.
  const isEager = eager ?? priority;
  const isHigh = highPriority ?? priority;

  return (
    <img
      // Remount on stage change so the browser actually refetches rather than
      // reusing the errored image element.
      key={stage}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? (sizes ?? "(max-width:640px) 45vw, (max-width:1024px) 30vw, 220px") : undefined}
      alt={alt}
      // Catalogue thumbnails are square; the intrinsic dims reserve the box and
      // kill layout shift. The container's own sizing still drives display size.
      width={width}
      height={width}
      loading={isEager ? "eager" : "lazy"}
      fetchPriority={isHigh ? "high" : "auto"}
      decoding="async"
      onError={() => setStage((s) => s + 1)}
      className={className}
    />
  );
}
