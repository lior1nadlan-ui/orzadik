import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
 *   • The hairlines are --gold at 70%: decorative, never text.
 *   • The eyebrow is --accent (5.49:1 on the ivory ground). The reference's own
 *     eyebrow is a paler bronze that fails as 12px text; this is the same hue
 *     one step darker.
 *   • tracking-[0.3em] is wider than the house 0.22em on purpose: it is the
 *     single most recognisable trait of the reference. It is safe here because
 *     the eyebrow is a two-word label, not running Hebrew prose. The negative
 *     margin-inline-end cancels the trailing letter-space every engine emits
 *     after the LAST glyph, so the run sits centred between its two lines.
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
      {eyebrow ? (
        <p className="mb-4 flex items-center justify-center gap-4 text-meta md:text-body text-accent">
          <span aria-hidden="true" className="h-px w-10 shrink-0 bg-gold/70 md:w-16" />
          <span className="tracking-[0.3em] [margin-inline-end:-0.3em]">{eyebrow}</span>
          <span aria-hidden="true" className="h-px w-10 shrink-0 bg-gold/70 md:w-16" />
        </p>
      ) : null}
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
