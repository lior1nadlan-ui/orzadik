import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toast surface, in the white/glass system.
 *
 * WHY VARIABLES AND NOT UTILITY CLASSES: sonner injects its own stylesheet as an
 * UNLAYERED <style> in <head>, and unlayered CSS beats every rule inside a
 * cascade layer no matter how specific. All of Tailwind v4 — including the
 * `.glass-strong` / `.hairline` helpers in styles.css — lives in
 * `@layer utilities`, so `group-[.toaster]:bg-background` and friends never had
 * any effect on the toast's background, radius or shadow. The supported seam is
 * sonner's own custom properties, which its unlayered rules read directly. They
 * are pointed at the design tokens rather than at literal colours, so the panel
 * follows the system — including `html.a11y-contrast`, which re-points
 * --glass-bg-strong to opaque #FFF and --glass-line-strong to #000 and therefore
 * hardens the toast for free.
 *
 * MOTION: sonner's own entry/exit is already CSS transitions on transform and
 * opacity (`transition: transform 400ms, opacity 400ms, …` on
 * [data-sonner-toast]), i.e. interruptible — no keyframes are involved except
 * its swipe-out and the loading spinner. It also ships its own
 * `@media (prefers-reduced-motion)` block. Nothing added here animates, so the
 * standard holds without fighting the library.
 */
const GLASS_TOAST_VARS = {
  // 94% white + the strong hairline: the only glass that is contrast-safe over
  // an unknown backdrop, which is what a toast always floats on.
  "--normal-bg": "var(--glass-bg-strong)",
  "--normal-border": "var(--glass-line-strong)",
  "--normal-text": "var(--foreground)", // 15.9:1 worst case on glass-strong
  "--border-radius": "var(--glass-radius)",
} as React.CSSProperties;

const Toaster = ({ style, toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={{ ...GLASS_TOAST_VARS, ...style }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          // `glass-strong` is kept for the two things utilities CAN still win
          // here — backdrop-filter (sonner never sets it) and the
          // html.a11y-contrast !important override that flattens every pane to
          // opaque white with a solid black ring.
          toast: "toast group glass-strong",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
