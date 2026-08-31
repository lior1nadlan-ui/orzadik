import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * PersonalizationPreview — an honest, live "הדמיה" of the shopper's personal
 * text as it would sit on the product.
 *
 * WHY it renders on a MATERIAL SWATCH and not on the product photo: we cannot
 * know the real placement, scale or perspective on any given item, so overlaying
 * on the photo would be a lie dressed up as accuracy. Instead we show the name on
 * a small, neutral material panel — fabric-toned for embroidery, wood/metal-toned
 * for laser — and label it clearly as a simulation. The site already tells the
 * buyer "we'll coordinate font + colour after the order"; this panel echoes that
 * in its caption so nothing here is oversold.
 *
 * SSR-safe by construction: no window / document / canvas at module or render
 * scope. The whole thing is pure CSS — static gradients + text-shadow — computed
 * from props. The one motion is a short (<300ms) opacity/transform reveal via the
 * global `orz-reveal` keyframe, gated behind `motion-safe:` so it stays still for
 * users who ask for reduced motion.
 */

type Method = "embroidery" | "laser";

// Per-method material styling. Kept as static style objects (not canvas, not a
// generated image) so it renders identically on the server and the client.
const MATERIAL: Record<Method, { panel: CSSProperties; text: CSSProperties }> = {
  // Soft linen / fabric. The name reads as raised gold thread: a top highlight
  // and a soft drop below give the stitch its lift. A faint cross-hatch stands
  // in for the weave.
  embroidery: {
    panel: {
      backgroundColor: "#EEE7D6",
      backgroundImage: [
        "repeating-linear-gradient(45deg, rgba(126,97,30,0.05) 0 1px, transparent 1px 5px)",
        "repeating-linear-gradient(-45deg, rgba(126,97,30,0.04) 0 1px, transparent 1px 5px)",
        "linear-gradient(160deg, #F2EBDC, #E5D9C0)",
      ].join(", "),
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 0 0 1px rgba(126,97,30,0.14), 0 10px 30px -16px rgba(22,24,29,0.18)",
    },
    text: {
      color: "var(--accent)",
      textShadow: "0 -1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(75,58,34,0.42)",
    },
  },
  // Warm wood. Laser marking burns darker than the surface, so the name is a
  // deep espresso incised INTO the grain: a light bottom highlight + a dark inner
  // top edge read as a carved groove. Vertical lines suggest the grain.
  laser: {
    panel: {
      backgroundColor: "#CDB389",
      backgroundImage: [
        "repeating-linear-gradient(90deg, rgba(74,58,34,0.06) 0 1px, transparent 1px 7px)",
        "linear-gradient(160deg, #DAC6A2, #C1A578)",
      ].join(", "),
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 0 0 1px rgba(74,58,34,0.18), 0 10px 30px -16px rgba(22,24,29,0.2)",
    },
    text: {
      color: "#43341E",
      textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 -1px 1px rgba(0,0,0,0.3)",
    },
  },
};

export function PersonalizationPreview({
  text,
  method,
  embroideryLabel = "רקמה",
}: {
  text: string;
  method: Method;
  embroideryLabel?: string;
}) {
  const trimmed = text.trim();
  const hasText = trimmed.length > 0;
  const material = MATERIAL[method];
  const methodLabel = method === "laser" ? "חריטת לייזר" : embroideryLabel;

  // Re-key the content so the short reveal replays on the two INFREQUENT
  // transitions — first character typed, and switching method (the panel material
  // changes). It deliberately does NOT change per keystroke, so the name updates
  // in place without flickering while the shopper types.
  const revealKey = `${method}:${hasText ? "on" : "off"}`;

  return (
    <div dir="rtl" className="mt-3">
      <div
        aria-hidden="true"
        style={material.panel}
        className="relative flex min-h-[104px] items-center justify-center overflow-hidden rounded-xl px-5 py-6 text-center"
      >
        {/* Honesty marker, pinned to the panel corner. In RTL the far corner is
            top-left. Kept quiet so it never competes with the name. */}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent">
          הדמיה · {methodLabel}
        </span>

        <span
          key={revealKey}
          style={hasText ? material.text : undefined}
          className={cn(
            "font-display leading-tight [overflow-wrap:anywhere] motion-safe:[animation:orz-reveal_220ms_var(--ease-out)_both]",
            hasText
              ? "text-2xl font-semibold sm:text-3xl"
              : "px-6 text-lg italic text-muted-foreground/70",
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
