import { useEffect, useRef, useState, type CSSProperties } from "react";
import { thumbUrl } from "@/lib/img";
import {
  colorFromName,
  dominantColor,
  nameSize,
  surfaceFor,
  swatchStyle,
  type Rgb,
  type Technique,
} from "@/lib/personalization-surface";
import { cn } from "@/lib/utils";

/**
 * PersonalizationPreview — an honest, live "הדמיה" of the shopper's personal
 * text as it would sit on the product.
 *
 * WHY it renders on a MATERIAL SWATCH and not on the product photo: we cannot
 * know the real placement, scale or perspective on any given item, so overlaying
 * on the photo would be a lie dressed up as accuracy. Instead we show the name on
 * a small panel of the product's OWN material and colour (src/lib/
 * personalization-surface.ts): black velvet for a black velvet bag, a leather
 * cover with gold foil for a stamped siddur, a pale laser mark on dark faux
 * leather. The material and colour come from the product's name; when the name
 * has no colour, from its photo, sampled once in the browser when the panel
 * comes into view. A product the name says nothing about keeps the neutral
 * swatch it always had. Labelled clearly as a simulation either way.
 *
 * SSR-safe by construction: the first render uses only the name, so server and
 * client agree; the photo sample happens after hydration and only fades the
 * panel's colour. The one motion is a short (<300ms) opacity/transform reveal
 * via the global `orz-reveal` keyframe, gated behind `motion-safe:`.
 */

type Method = "embroidery" | "laser";

const SIZE_CLASS = {
  xl: "text-2xl sm:text-3xl",
  lg: "text-xl sm:text-2xl",
  md: "text-lg sm:text-xl",
  sm: "text-base sm:text-lg",
} as const;

/** The photo's colour, read once the panel is near the viewport; null until then or on failure. */
function usePhotoColor(
  panel: React.RefObject<HTMLDivElement | null>,
  imageUrl: string | null | undefined,
  wanted: boolean,
): Rgb | null {
  const [photo, setPhoto] = useState<{ url: string; color: Rgb } | null>(null);

  useEffect(() => {
    const el = panel.current;
    if (!wanted || !imageUrl || !el || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    const sample = () => {
      const img = new Image();
      // The product-images bucket answers with Access-Control-Allow-Origin: *,
      // which is what lets the canvas be read. An image without it taints the
      // canvas, getImageData throws, and the neutral swatch simply stays.
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        try {
          const size = 32;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, size, size);
          const color = dominantColor(ctx.getImageData(0, 0, size, size).data, size, size);
          if (color && !cancelled) setPhoto({ url: imageUrl, color });
        } catch {
          /* tainted canvas: keep the neutral swatch */
        }
      };
      // A 64px rendition: a couple of KB, and only for products whose name
      // gives no colour.
      img.src = thumbUrl(imageUrl, 64) ?? imageUrl;
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          sample();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [panel, imageUrl, wanted]);

  // A colour read for a previous product never paints this one.
  return photo && photo.url === imageUrl ? photo.color : null;
}

export function PersonalizationPreview({
  text,
  method,
  embroideryLabel = "רקמה",
  productName,
  imageUrl,
}: {
  text: string;
  method: Method;
  embroideryLabel?: string;
  /** The product's name: its material, colour and trim are read from it. */
  productName?: string | null;
  /** The product's main photo, for its colour when the name has none. */
  imageUrl?: string | null;
}) {
  const trimmed = text.trim();
  const hasText = trimmed.length > 0;
  const technique: Technique =
    method === "laser" ? "laser" : embroideryLabel === "הטבעה" ? "print" : "embroidery";
  const methodLabel = method === "laser" ? "חריטת לייזר" : embroideryLabel;

  const panelRef = useRef<HTMLDivElement>(null);
  const photoColor = usePhotoColor(panelRef, imageUrl, colorFromName(productName) === null);
  const style = swatchStyle(surfaceFor(productName, technique, photoColor), technique);

  // Re-key the content so the short reveal replays on the two INFREQUENT
  // transitions — first character typed, and switching method (the panel material
  // changes). It deliberately does NOT change per keystroke, so the name updates
  // in place without flickering while the shopper types.
  const revealKey = `${method}:${hasText ? "on" : "off"}`;

  return (
    <div dir="rtl" className="mt-3">
      <div
        ref={panelRef}
        aria-hidden="true"
        style={style.panel as CSSProperties}
        className="relative flex min-h-[104px] items-center justify-center overflow-hidden rounded-xl px-5 py-6 text-center motion-safe:transition-[background-color] motion-safe:duration-300"
      >
        {/* Honesty marker, pinned to the panel corner. In RTL the far corner is
            top-left. Kept quiet so it never competes with the name. */}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent">
          הדמיה · {methodLabel}
          {style.onMaterial ? ` ${style.onMaterial}` : ""}
        </span>

        <span
          key={revealKey}
          style={hasText ? (style.text as CSSProperties) : undefined}
          className={cn(
            "font-display leading-tight [overflow-wrap:anywhere] motion-safe:[animation:orz-reveal_220ms_var(--ease-out)_both]",
            hasText
              ? cn("font-semibold", SIZE_CLASS[nameSize(trimmed)])
              : "rounded-full bg-white/80 px-4 py-1 text-base italic text-muted-foreground",
          )}
        >
          {hasText ? trimmed : "הקלידו שם כדי לראות הדמיה"}
        </span>
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        הדמיה — הפונט והגוון הסופיים יתואמו איתכם
      </p>
    </div>
  );
}
