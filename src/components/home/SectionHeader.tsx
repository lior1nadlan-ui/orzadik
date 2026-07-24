import { cn } from "@/lib/utils";

/**
 * Shared "section" header — the third tier of the homepage display ramp
 * (hero h1 md:text-6xl / flagship md:text-5xl / SECTION md:text-4xl / sub-panel
 * md:text-3xl). One centered block: eyebrow → display title → gold rule → sub.
 *
 * This replaces four byte-identical hand-rolled copies (src/routes/index.tsx and
 * the header blocks in FeaturedProductsCarousel, LuxuryShowcase and HomeReviews).
 * The container spacing (mb-10 md:mb-14), eyebrow gap (mb-3), rule offset (mt-4)
 * and sub offset (mt-4) match those copies exactly, so it drops in without
 * layout shift.
 *
 * Two deliberate departures from the old copies, per the design system:
 *   • eyebrow tracking is ~0.22em (was 0.35em) — the calmer "section" cadence.
 *   • no `uppercase` — a no-op on Hebrew glyphs (so no visual/layout change) and
 *     meaningless for this script; dropping it keeps the class honest.
 *
 * Purely presentational and SSR-safe: no browser globals, renders fully visible
 * in the server HTML with no JS and no opacity traps.
 */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  className,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center mb-10 md:mb-14", className)}>
      <p className="mb-3 text-[10px] md:text-xs tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="font-display text-3xl md:text-4xl tracking-wide text-foreground">{title}</h2>
      <span aria-hidden="true" className="gold-rule block w-24 mx-auto mt-4" />
      {sub ? (
        <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">{sub}</p>
      ) : null}
    </div>
  );
}
