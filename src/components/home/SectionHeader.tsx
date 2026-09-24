import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LinedEyebrow } from "@/components/LinedEyebrow";

/**
 * Shared "section" header — one centered block: a line-flanked eyebrow, then
 * the display title, then an optional sub-line.
 *
 * This replaces four byte-identical hand-rolled copies (src/routes/index.tsx and
 * the header blocks in FeaturedProductsCarousel, LuxuryShowcase and HomeReviews).
 *
 * THE REFERENCE LOOK (owner's screenshots, 2026-09-24): "—— גלו עוד ——" in a
 * spaced bronze eyebrow between two short hairlines, and a large serif title
 * with nothing under it. The gold rule that used to sit below the title is gone
 * — the flanking lines now do that job above it, and a rule on both sides of
 * the title read as a boxed-in heading.
 *
 *   • The eyebrow itself is <LinedEyebrow> — see there for its colour,
 *     tracking and centring.
 *   • An empty eyebrow (ProductCarousel can pass "") renders no eyebrow row at
 *     all rather than two lines around nothing.
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
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-center mb-10 md:mb-14", className)}>
      {eyebrow ? <LinedEyebrow className="mb-4">{eyebrow}</LinedEyebrow> : null}
      <h2 className="font-display text-[2rem] leading-tight md:text-5xl text-foreground">
        {title}
      </h2>
      {sub ? (
        <p className="mt-4 text-sm md:text-base leading-relaxed text-muted-foreground max-w-xl mx-auto">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
