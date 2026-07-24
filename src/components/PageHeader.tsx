import { cn } from "@/lib/utils";

/**
 * Page-level header — the counterpart to the section-level SectionHeader.
 * Where SectionHeader owns the third display tier and renders an <h2>, this
 * owns a route's single <h1>: the same centered eyebrow → display → gold rule →
 * sub block, sized to the page-title tier (text-3xl md:text-4xl) that
 * contact.tsx and about.tsx established for their hand-rolled headers.
 *
 * Consumers drop their own <h1> and hand it `title` (plus an optional `eyebrow`
 * and `sub`). The eyebrow is optional here — a page title stands on its own —
 * whereas SectionHeader always carries one.
 *
 * Two shared conventions with SectionHeader, per the design system:
 *   • eyebrow tracking is ~0.22em — the calm cadence, not the wider 0.35em/0.4em
 *     of the older bespoke headers.
 *   • no `uppercase` — a no-op on Hebrew glyphs and meaningless for this script,
 *     so the class is dropped to stay honest.
 *
 * Purely presentational and SSR-safe: no browser globals, renders fully visible
 * in the server HTML with no JS and no opacity traps.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  className,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center mb-10 md:mb-14", className)}>
      {eyebrow ? (
        <p className="mb-3 text-[10px] md:text-xs tracking-[0.22em] text-accent">{eyebrow}</p>
      ) : null}
      <h1 className="font-display text-3xl md:text-4xl tracking-wide text-foreground">{title}</h1>
      <span aria-hidden="true" className="gold-rule block w-24 mx-auto mt-4" />
      {sub ? (
        <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">{sub}</p>
      ) : null}
    </div>
  );
}
