import { Link } from "@tanstack/react-router";

/**
 * A category door on the homepage: a square photograph with a gold inner frame
 * and a white plate over its lower edge carrying an eyebrow, a ✦ rule and the
 * category name.
 *
 * ONE COMPONENT, TWO RAILS. "מה תרצו לגלות?" (7 curated tiles) and
 * "שאר הקטגוריות" (~20 more) render the identical card and route identically;
 * the only thing that differs is the carousel around them. They were two
 * hand-rolled copies before this, which is the same shape SectionHeader was
 * extracted to fix. Owning the <Link> here means the group scope, the tap
 * target and the accessible name cannot drift apart between the two rails.
 *
 * WHY IT IS SIZED BY A CONTAINER QUERY AND NOT BY BREAKPOINTS.
 *
 * The card's rendered width is NOT monotonic in viewport width. Measured
 * against the real track offsets (ui/carousel.tsx:168,190 put -ml-4 on the
 * track and pl-4 on each item, so width = fraction * (content + 16) - 16):
 *
 *   שאר הקטגוריות   1023px viewport -> 234.7px card
 *                   1024px viewport -> 185.6px card   <- 21% NARROWER
 *
 * because the basis steps down a column at lg while the container only steps
 * up 256px. A `md:` or `lg:` tier on the card would therefore fire at 768px
 * (235px, correct) and still be applied at 1024px (186px, wrong), and it would
 * go wrong again silently the next time somebody edits a basis. @container
 * states the condition that is actually true — THIS CARD IS AT LEAST 304px
 * WIDE — and survives any change to the grid above it.
 *
 * The 304px threshold sits deliberately above the 288px the שאר הקטגוריות card
 * reaches at its widest (1536px viewport), so today the expanded tier means
 * "the featured rail from 1024 up". The point is that it stays correct when it
 * stops meaning that.
 *
 * WHAT DROPS ON A NARROW CARD, AND WHY IT IS THE EYEBROW.
 *
 * "קולקציה" is the only pure decoration that costs a whole text line, and the
 * section header directly above already says "הקולקציות שלנו". The ✦ rule
 * costs 12px and is the thing that makes the plate read as a collection plate
 * at all. So the eyebrow goes and the rule stays. Plate height works out at
 * 51px compact / 87px expanded against the 129px the original shipped — 18-28%
 * of the card rather than 29%.
 */
export type CatTile = { slug: string; name: string; img: string; w: number; h: number };

export function CollectionCard({ cat }: { cat: CatTile }) {
  return (
    <Link
      to="/category/$slug"
      params={{ slug: cat.slug }}
      data-collection-card
      className="group/collection @container block"
    >
      {/*
        A REAL BORDER, NOT .hairline-gold. Both draw a 1px gold edge, but
        .hairline-gold is an inset box-shadow and styles.css:455-457 makes bare
        .glass-lift:hover REPLACE the whole box-shadow (box-shadow is one
        property) — the ring would vanish for the length of every hover. The
        border is immune, and .border-gold\/30 is already in the a11y-contrast
        clamp list at styles.css:631-633, so it hardens to #5c4300 for free.

        .glass-lift and nothing else for motion. Do NOT add .press here: it is
        emitted at styles.css:488, after .glass-lift at :449 and at equal
        specificity, so it would win transition-property, cut it down to
        `transform`, and the shadow swap below would snap instead of easing.
      */}
      <div className="glass-lift relative aspect-square overflow-hidden rounded-[1.25rem] border border-gold/30 bg-muted shadow-[var(--glass-shadow)]">
        {/*
          alt="" on purpose. The category name is rendered as visible text
          inside this same <Link>, so it is already the link's accessible name;
          repeating it in the alt makes a screen reader announce the category
          twice. Do not "restore" it.
        */}
        <img
          src={cat.img}
          alt=""
          loading="lazy"
          decoding="async"
          width={cat.w}
          height={cat.h}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/collection:scale-105"
        />

        {/* Cool-ink photo scrim — the one dark surface the direction keeps. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-argaman-deep/70 via-transparent to-transparent"
        />

        {/*
          The gold frame. --gold is the decorative gold and a frame is exactly
          its documented job (styles.css:202). The original wrote these as
          border-accent/60, which today renders --accent #7E611E — a dark brown
          box, not the gold line in the reference. Both alphas used here are in
          the a11y-contrast clamp list; picking an alpha outside that list would
          leave a pale gold line in high-contrast mode.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-[0.9rem] border border-gold/40"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[0.625rem] hidden rounded-[0.75rem] border border-gold/30 @min-[19rem]:block"
        />

        {/* The plate, anchored to the bottom edge of the square. */}
        <div className="absolute inset-x-2.5 bottom-2.5 @min-[19rem]:inset-x-4 @min-[19rem]:bottom-4">
          {/*
            SOLID WHITE, NOT .glass-strong. Three reasons, in order of weight:
            (1) an in-flow glass plate here is ~4.3x the filtered area of the
            pill it replaces, times 27 cards on one page, each sitting beside a
            scale-105 transform that forces a fresh backdrop snapshot per frame;
            (2) the featured rail is wrapped in <Reveal>, whose opacity and
            transform (styles.css:531-538) make it a BACKDROP ROOT — the glass
            would sample the wrong backdrop for the whole reveal transition;
            (3) html.a11y-contrast kills backdrop-filter outright
            (styles.css:597-598), so it has to be legible opaque anyway.
            White is also, literally, what was asked for.
          */}
          <div className="flex flex-col items-center gap-1 rounded-[0.625rem] bg-white px-2.5 py-2 text-center ring-1 ring-gold/25 @min-[19rem]:gap-1.5 @min-[19rem]:rounded-[0.875rem] @min-[19rem]:px-4 @min-[19rem]:py-3">
            {/*
              tracking-[0.22em] is the house eyebrow value (SectionHeader:35),
              not the 0.45em the original used — styles.css:111-115 records that
              heavy letter-spacing on Hebrew "reads as a defect, not as
              refinement". The negative margin-inline-end cancels the trailing
              letter-space, which every engine emits after the LAST character
              too and which otherwise pushes the visible run ~2.5px off centre
              above a centred rule and a centred title.
            */}
            <span className="hidden text-micro font-medium tracking-[0.22em] text-accent [margin-inline-end:-0.22em] @min-[19rem]:block">
              קולקציה
            </span>

            {/*
              .gold-rule is the house hairline (styles.css:439-443) and its
              gradient is symmetric, so it cannot mispaint under dir="rtl" the
              way a hand-rolled bg-gradient-to-r would. The ✦ itself is
              text-accent, NOT gold: an 11px glyph at --gold's 2.44:1 reads as
              dirt where a 1px line at the same ratio reads as a deliberate
              line. Same treatment ProductCard gives the same glyph.
            */}
            <span
              aria-hidden="true"
              className="flex w-full max-w-[9rem] items-center gap-2 @min-[19rem]:max-w-[11rem] @min-[19rem]:gap-2.5"
            >
              <span className="gold-rule flex-1" />
              <span className="text-micro leading-none text-accent">✦</span>
              <span className="gold-rule flex-1" />
            </span>

            {/*
              line-clamp-2 with no min-height. The plate is absolutely
              positioned against a fixed-height square, so a second line grows
              it UPWARD: card heights stay equal, nothing below it moves, and a
              webfont swap that changes the wrap costs zero layout shift. An
              in-flow plate would have reintroduced both problems on 27 cards.
            */}
            <span className="line-clamp-2 font-display text-body leading-tight text-foreground transition-colors duration-200 ease-out @min-[19rem]:text-lead [@media(hover:hover)_and_(pointer:fine)]:group-hover/collection:text-accent">
              {cat.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
