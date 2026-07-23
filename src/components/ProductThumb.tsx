import { useState } from "react";
import { thumbUrl } from "@/lib/img";

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
 */
export function ProductThumb({
  url,
  alt,
  width = 400,
  className = "",
  priority = false,
  placeholderClassName = "flex h-full items-center justify-center text-muted-foreground text-sm",
}: {
  url: string | null | undefined;
  alt: string;
  width?: number;
  className?: string;
  priority?: boolean;
  placeholderClassName?: string;
}) {
  const [stage, setStage] = useState(0);

  if (!url || stage >= 2) {
    return <div className={placeholderClassName}>אין תמונה</div>;
  }

  const src = stage === 0 ? (thumbUrl(url, width) ?? url) : url;

  return (
    <img
      // Remount on stage change so the browser actually refetches rather than
      // reusing the errored image element.
      key={stage}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setStage((s) => s + 1)}
      className={className}
    />
  );
}
