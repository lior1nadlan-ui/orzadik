import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * SSR-safe scroll reveal wrapper.
 *
 * The server render — and the very first client render — emit the children in
 * their FINAL, visible state. No `opacity:0` is ever baked into the SSR HTML, so
 * the content is present for crawlers and survives a slow, failed, or disabled
 * hydration. The reveal is "armed" only AFTER mount, in a client effect:
 *
 *   • Elements not yet on screen get the hidden `.reveal-in` class and are
 *     observed; once they scroll into view they gain `.is-in` and the observer
 *     is dropped — it fires exactly once, mirroring LazyReel's pattern in
 *     src/routes/index.tsx.
 *   • Elements already in view at mount are deliberately NOT armed, so there is
 *     no visible → hidden → shown flicker above the fold.
 *   • When IntersectionObserver is unavailable, or the user prefers reduced
 *     motion, arming is skipped entirely and the content simply stays visible.
 *
 * Never wrap the hero in this — the hero is bespoke and above the fold.
 *
 * The hidden/shown styling lives on the `.reveal-in` / `.reveal-in.is-in` rules
 * in styles.css; if those rules are absent the effect is a harmless no-op and
 * the content stays visible.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Leave content fully visible when we can't — or shouldn't — animate.
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof IntersectionObserver === "undefined") return;

    // Already on screen at mount? Don't arm — adding `.reveal-in` now would
    // flash it hidden for a frame before the observer could reveal it again.
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) return;

    // Below the fold: hide it, then reveal once it scrolls into view (once).
    el.classList.add("reveal-in");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { rootMargin: "-10% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
