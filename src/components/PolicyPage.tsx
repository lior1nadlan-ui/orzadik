import type { ReactNode } from "react";

/**
 * Shared shell for the short, customer-facing policy pages (/shipping, /returns).
 *
 * These pages SUMMARISE the binding text in /terms — they never restate it in
 * competing words — so the layout is deliberately lighter than the legal pages:
 * a centred crest and hairline-separated sections, with no table of contents and
 * no "last updated" chip (the canonical date lives on /terms, which every one of
 * these pages links to). The section chrome is identical to terms/accessibility
 * so the three read as one family.
 */
export function PolicyHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
}) {
  return (
    <header className="mb-10 md:mb-14 text-center">
      <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase mb-3">
        {eyebrow}
      </p>
      <h1 className="font-display text-3xl md:text-5xl tracking-wide text-foreground">{title}</h1>
      <div className="gold-rule mx-auto mt-5 w-24" aria-hidden="true" />
      <p className="mt-5 mx-auto max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        {intro}
      </p>
    </header>
  );
}

export function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="mb-9 border-t border-glass-line pt-8 last:mb-0 scroll-mt-24 lg:scroll-mt-32"
    >
      <h2 className="font-display text-xl md:text-2xl mb-3 text-foreground">{title}</h2>
      <div className="text-[15px] leading-[1.85] text-foreground space-y-4 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-2 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}

/**
 * Closing note that sends the reader to the binding clause in /terms. Every
 * policy summary ends with one, so a customer is never left thinking the short
 * page is the whole agreement.
 */
export function PolicyFootnote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-10 border-t border-glass-line pt-8 text-center text-sm leading-relaxed text-muted-foreground [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4">
      {children}
    </p>
  );
}
