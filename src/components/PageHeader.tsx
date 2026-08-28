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
 * `note` is the fourth, quietest slot: ONE short factual line about the offer,
 * rendered as a hairline chip under the sub. It exists because both collection
 * routes needed to say the same true thing — that gift wrap and a printed
 * dedication cost nothing — and the alternative was two hand-rolled banners
 * drifting apart. It is deliberately a chip and not a banner: it must never
 * outrank the title, and it must never grow into a promotional strip. The ✦ is
 * the decorative gold ornament (--gold on a card ground, no text duty); the
 * words themselves are muted ink.
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
  note,
  className,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  note?: string;
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
      {note ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-card/70 px-4 py-2 text-xs md:text-sm text-muted-foreground hairline">
          <span aria-hidden="true" className="text-gold">
            ✦
          </span>
          {note}
        </p>
      ) : null}
    </div>
  );
}
