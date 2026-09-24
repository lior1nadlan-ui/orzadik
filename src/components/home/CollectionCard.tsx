import { Link } from "@tanstack/react-router";
import { MEMBER_DISCOUNT } from "@/lib/pricing";

/**
 * A curated collection door on the homepage — the large framed card from the
 * owner's reference screenshots (2026-09-24): a square photograph, a double
 * bronze inner frame, a gold medallion in the top corner, and an ivory plate
 * over the lower third carrying a spaced "קולקציה" eyebrow, a ✦ rule and the
 * collection name in the display serif.
 *
 * Used by "הקולקציות שלנו" only. The long "שאר הקטגוריות" rail uses the lighter
 * <CategoryTile> (title on the photo, no plate), which is also what the
 * reference does there — twenty-odd framed plates in a row read as noise.
 *
 * SIZED BY A CONTAINER QUERY, NOT BY BREAKPOINTS. The grid around it hands the
 * card anything from ~290px (two columns at 640px) to ~570px (one column on a
 * large phone), and the viewport says nothing reliable about which. `@container`
 * sizes the type and the medallion from the card's own width instead.
 *
 * THE MEDALLION IS THE CLUB DISCOUNT, NOT A SALE. The reference carries "15%
 * הנחה". This shop has no such sale: prices already include SITE_DISCOUNT, and
 * src/lib/pricing.ts refuses to show any "before" price that is not a real former
 * price (Consumer Protection Law §2). The one percentage the shop genuinely
 * gives on top is MEMBER_DISCOUNT — free club members get it automatically at
 * checkout — so that is the number here, and it says "במועדון" so it cannot be
 * read as an across-the-board sale. aria-hidden: it repeats on every card, and
 * the header's club strip already announces the offer once.
 */
export type CatTile = { slug: string; name: string; img: string; w: number; h: number };

const MEMBER_PCT = Math.round(MEMBER_DISCOUNT * 100);

export function CollectionCard({ cat }: { cat: CatTile }) {
  return (
    <Link
      to="/category/$slug"
      params={{ slug: cat.slug }}
      data-collection-card
      className="group/collection @container block"
    >
      {/*
        A REAL BORDER on the card, not .hairline-gold: .glass-lift:hover REPLACES
        the whole box-shadow (styles.css), so an inset-shadow ring would vanish
        for the length of every hover. The border is immune.
      */}
      <div className="glass-lift relative aspect-square overflow-hidden rounded-[1.5rem] border border-gold/40 bg-muted shadow-[var(--shadow-soft)]">
        {/*
          alt="" on purpose. The collection name is rendered as visible text
          inside this same <Link>, so it is already the link's accessible name;
          repeating it in the alt makes a screen reader announce it twice.
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

        {/* The reference darkens the photograph toward the bottom edge, so the
            plate reads as sitting on a shadow rather than floating on the image. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgb(30_24_18/0.78)_0%,rgb(30_24_18/0.35)_22%,transparent_48%)]"
        />

        {/* The double frame. --gold-bright is the decorative light gold; on a
            photograph it is a line, never text. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-[1.125rem] border border-gold-bright/80"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[1.125rem] rounded-[0.875rem] border border-gold-bright/45"
        />

        {/* The medallion — physically top-left, where the reference puts it. */}
        <span
          aria-hidden="true"
          className="absolute left-[6%] top-[6%] flex size-[clamp(3.75rem,19cqw,5.25rem)] flex-col items-center justify-center rounded-full text-white shadow-[0_8px_18px_-8px_rgb(60_42_22/0.7)] ring-[3px] ring-white/90 [background:radial-gradient(120%_120%_at_30%_20%,#D1B056_0%,#AE8829_35%,#8F6B1A_65%,#7A5B13_100%)] [text-shadow:0_1px_1px_rgb(0_0_0/0.3)]"
        >
          <span className="absolute inset-[4px] rounded-full border border-white/45" />
          <span className="font-display text-[clamp(1.375rem,7cqw,1.875rem)] font-bold leading-none">
            {MEMBER_PCT}%
          </span>
          <span className="mt-1 text-micro leading-none">במועדון</span>
        </span>

        {/* The plate, anchored to the bottom edge of the square. */}
        <div className="absolute inset-x-[5.5%] bottom-[4.5%]">
          {/*
            SOLID, NOT GLASS. An in-flow glass plate on seven cards, each beside
            a scale-105 hover, forces a fresh backdrop snapshot per frame; the
            featured grid is also wrapped in <Reveal>, whose opacity/transform
            make it a backdrop root; and html.a11y-contrast kills backdrop-filter
            outright. The warm off-white gradient is the reference's plate.
          */}
          <div className="relative flex flex-col items-center gap-2 rounded-[1.125rem] bg-[linear-gradient(180deg,#FFFDF9,#F4EFE7)] px-4 py-4 text-center shadow-[0_10px_24px_-14px_rgb(30_24_18/0.6)] ring-1 ring-gold/35 @min-[20rem]:gap-2.5 @min-[20rem]:py-5">
            {/* Inner hairline, and the short gold glint along the top edge. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-1.5 rounded-[0.8rem] border border-gold/35"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-px left-1/2 h-px w-2/5 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,var(--gold),transparent)]"
            />

            <span className="text-meta font-medium tracking-[0.3em] text-accent [margin-inline-end:-0.3em] @min-[20rem]:text-body">
              קולקציה
            </span>

            {/*
              .gold-rule's gradient is symmetric, so it cannot mispaint under
              dir="rtl". The ✦ is text-accent, not gold: an 11px glyph at
              --gold's 2.43:1 reads as dirt where a 1px line reads as a line.
            */}
            <span
              aria-hidden="true"
              className="flex w-full max-w-[11rem] items-center gap-2.5 @min-[20rem]:max-w-[15rem]"
            >
              <span className="gold-rule flex-1" />
              <span className="text-micro leading-none text-accent">✦</span>
              <span className="gold-rule flex-1" />
            </span>

            {/*
              line-clamp-2 with no min-height: the plate is absolutely
              positioned, so a second line grows it UPWARD and card heights stay
              equal — a webfont swap that changes the wrap costs no layout shift.
            */}
            <span className="line-clamp-2 font-display text-[1.625rem] leading-tight text-foreground transition-colors duration-200 ease-out @min-[20rem]:text-[2rem] [@media(hover:hover)_and_(pointer:fine)]:group-hover/collection:text-accent">
              {cat.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
