/**
 * Renders a product copy field (description / short_description) as real JSX.
 *
 * WHY THIS EXISTS. Both fields were rendered as
 *   <div className="prose prose-sm" dangerouslySetInnerHTML={{__html: sanitizeHtml(v)}} />
 * and both halves of that were wrong:
 *
 *  1. `prose`/`prose-sm` are dead class names in this project. @tailwindcss/typography
 *     is not a dependency and the shipped stylesheet contains zero `.prose` rules —
 *     articles/$slug.tsx already documents this and fixed it there with scoped
 *     utilities; the product route never got the same treatment.
 *  2. The stored value is PLAIN TEXT on 4,348 of the 4,648 active products, and on
 *     ALL 4,648 short_descriptions. The house format is "prose paragraph, blank
 *     line, pipe-delimited spec line" — and feeding that through
 *     dangerouslySetInnerHTML makes HTML collapse the blank line, so the prose and
 *     the spec block painted as one unbroken run-on sentence across effectively the
 *     whole catalogue.
 *
 * The 300 rows that do carry markup were measured before this was written: they
 * use only <p>, <br> and <strong>, 0 of them with attributes of any kind. That
 * subset is small enough to render as JSX directly, so this component builds NO
 * html string from stored data and the product route needs no
 * dangerouslySetInnerHTML at all — strictly less attack surface than sanitising.
 * Any other tag is dropped and its text kept; a future <a href> would degrade to
 * plain text rather than render, which is the safe direction to fail.
 *
 * It also turns the trailing `חומר: קטיפה | צבע: קרם | מידות: אורך 19 ס"מ` line
 * into a real key/value list instead of a raw pipe dump — that string was shown
 * verbatim as the above-the-fold buy-box blurb on 2,366 products.
 *
 * Pure and deterministic: no window/document, identical on server and client.
 */
import type { ReactNode } from "react";

/** Inline tags we keep; everything else is unwrapped. */
const INLINE_TAG = /^<(\/?)(strong|b|em|i)\s*\/?>$/i;
const INLINE_SPLIT = /(<\/?(?:strong|b|em|i)\s*\/?>)/gi;

/**
 * Collapse block markup into the plain-text conventions this component already
 * understands (blank line = paragraph, newline = soft break), keeping only the
 * inline emphasis tags. Anything else is unwrapped, text intact.
 */
export function normalizeMarkup(raw: string): string {
  return raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>\s*<\s*p[^>]*>/gi, "\n\n")
    .replace(/<\s*\/?\s*(?:p|div|section|h[1-6])[^>]*>/gi, "\n\n")
    .replace(/<\s*\/?\s*(?:li|tr)[^>]*>/gi, "\n")
    // Drop every remaining tag that is not one of the inline four.
    .replace(/<(?!\/?(?:strong|b|em|i)\s*\/?>)[^>]*>/gi, "");
}

/** Decode the handful of entities that appear in supplier copy. &amp; last. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

/**
 * Render inline emphasis without nesting bookkeeping — the measured data has no
 * nested emphasis, and a depth counter degrades gracefully if that ever changes.
 */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let bold = 0;
  let italic = 0;
  let key = 0;

  for (const part of text.split(INLINE_SPLIT)) {
    const tag = part.match(INLINE_TAG);
    if (tag) {
      const delta = tag[1] === "/" ? -1 : 1;
      const isBold = /^(strong|b)$/i.test(tag[2]);
      if (isBold) bold = Math.max(0, bold + delta);
      else italic = Math.max(0, italic + delta);
      continue;
    }
    if (!part) continue;
    const cls = `${bold > 0 ? "font-semibold " : ""}${italic > 0 ? "italic" : ""}`.trim();
    nodes.push(
      cls ? (
        <span key={key++} className={cls}>
          {part}
        </span>
      ) : (
        <span key={key++}>{part}</span>
      ),
    );
  }
  return nodes;
}

type SpecPair = { label: string; value: string };

/**
 * A spec line is the house format's pipe-delimited tail. Require at least two
 * segments AND at least half of them shaped `key: value`, so an ordinary
 * sentence that happens to contain a pipe is never mangled into a table.
 * Returns null when the paragraph is not a spec line.
 */
export function parseSpecLine(paragraph: string): SpecPair[] | null {
  const segments = paragraph.split("|").map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return null;

  const pairs = segments.map((seg) => {
    const at = seg.indexOf(":");
    // Guard the split point: a colon far into the segment is prose punctuation
    // (or a clock time like 09:00), not a spec label.
    if (at <= 0 || at > 24) return { label: "", value: seg };
    return { label: seg.slice(0, at).trim(), value: seg.slice(at + 1).trim() };
  });

  const labelled = pairs.filter((p) => p.label && p.value).length;
  return labelled >= Math.ceil(segments.length / 2) ? pairs : null;
}

function SpecList({ pairs, compact }: { pairs: SpecPair[]; compact?: boolean }) {
  return (
    <dl
      className={
        compact
          ? "flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/90"
          : "mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-glass-line pt-4 text-sm sm:grid-cols-2"
      }
    >
      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-2">
          {pair.label ? (
            <>
              <dt className="shrink-0 text-muted-foreground">{pair.label}:</dt>
              <dd className="font-medium text-foreground">{pair.value}</dd>
            </>
          ) : (
            <dd className="text-foreground">{pair.value}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export function RichCopy({
  text,
  compact,
  className = "",
}: {
  text: string;
  /** Buy-box variant: inline spec chips instead of a bordered grid. */
  compact?: boolean;
  className?: string;
}) {
  if (!text) return null;
  const value = decodeEntities(text.includes("<") ? normalizeMarkup(text) : text).trim();
  if (!value) return null;

  // Blank lines separate paragraphs; a lone newline is a soft break inside one.
  const paragraphs = value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className={`max-w-none text-foreground ${className}`}>
      {paragraphs.map((paragraph, i) => {
        const spec = parseSpecLine(paragraph);
        if (spec) return <SpecList key={i} pairs={spec} compact={compact} />;

        const lines = paragraph.split("\n");
        return (
          <p key={i} className={`leading-[1.85] ${i > 0 ? "mt-4" : ""}`}>
            {lines.map((line, j) => (
              <span key={j}>
                {renderInline(line)}
                {j < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
