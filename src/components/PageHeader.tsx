import { cn } from "@/lib/utils";
import { LinedEyebrow } from "@/components/LinedEyebrow";

/**
 * Page-level header — the counterpart to the section-level SectionHeader.
 * Where SectionHeader renders an <h2>, this owns a route's single <h1>.
 * Consumers drop their own <h1> and hand it `title` (plus an optional `eyebrow`
 * and `sub`). The eyebrow is optional here — a page title stands on its own —
 * whereas SectionHeader always carries one.
 *
 * THE REFERENCE LOOK (owner's screenshots, 2026-09-24), kept in step with
 * SectionHeader so a page title and a section title read as one family: a
 * spaced bronze eyebrow between two hairlines (<LinedEyebrow>), then the
 * display title. With no eyebrow there are no flanking lines to
 * anchor the title, so the ✦ rule goes under it instead; a bare serif line
 * floating on the ivory reads as unfinished.
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
      {eyebrow ? <LinedEyebrow className="mb-4">{eyebrow}</LinedEyebrow> : null}
      <h1 className="font-display text-[2rem] leading-tight md:text-5xl text-foreground">
        {title}
      </h1>
      {eyebrow ? null : (
        <span aria-hidden="true" className="mx-auto mt-4 flex w-40 items-center gap-2.5">
          <span className="gold-rule flex-1" />
          <span className="text-micro leading-none text-accent">✦</span>
          <span className="gold-rule flex-1" />
        </span>
      )}
      {sub ? (
        <p className="mt-4 text-sm md:text-base leading-relaxed text-muted-foreground max-w-xl mx-auto">
          {sub}
        </p>
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
