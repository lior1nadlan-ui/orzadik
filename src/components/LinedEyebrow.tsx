import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The reference-style eyebrow: a short spaced bronze label between two gold
 * hairlines — "—— גלו עוד ——". One component so every header on the site
 * (SectionHeader, PageHeader, PolicyHeader and the hand-rolled headers on
 * /contact, /terms, /privacy, /accessibility, /about) draws the same thing
 * rather than eight copies drifting apart.
 *
 *   • The label is --accent (5.49:1 on the ivory ground); the lines are --gold
 *     at 70%, decorative only.
 *   • tracking-[0.3em] is wider than the house 0.22em on purpose — it is the
 *     single most recognisable trait of the reference — and safe because this
 *     is always a one- or two-word label, never running Hebrew prose.
 *   • The negative margin-inline-end cancels the trailing letter-space that
 *     every engine emits after the LAST glyph, so the run sits centred between
 *     its two lines.
 *   • No `uppercase`: a no-op on Hebrew glyphs.
 *
 * `align="start"` is for start-aligned headers (the pasuk page): the label
 * sits at the start edge with one line trailing after it, the same shape the
 * product page's category eyebrow uses. A leading line there would point at
 * the page margin.
 *
 * The caller owns the spacing below it (`className="mb-4"` etc.).
 */
export function LinedEyebrow({
  children,
  className,
  align = "center",
}: {
  children: ReactNode;
  className?: string;
  align?: "center" | "start";
}) {
  const line = <span aria-hidden="true" className="h-px w-10 shrink-0 bg-gold/70 md:w-16" />;
  return (
    <p
      className={cn(
        "flex items-center gap-4 text-meta md:text-body text-accent",
        align === "center" ? "justify-center" : "justify-start",
        className,
      )}
    >
      {align === "center" ? line : null}
      <span className={cn("tracking-[0.3em]", align === "center" && "[margin-inline-end:-0.3em]")}>
        {children}
      </span>
      {line}
    </p>
  );
}
