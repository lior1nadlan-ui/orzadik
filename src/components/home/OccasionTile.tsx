import { Link } from "@tanstack/react-router";
import type { OccasionCollection } from "@/lib/collections";
import { OCCASION_ART } from "@/components/home/occasion-art";

/**
 * A door into one occasion hub (/collection/<slug>) — the photographic
 * replacement for the text-only glass cards the "קונים לפי אירוע" rail used to
 * render. Portrait (4:5) so the rail reads as a different kind of door from the
 * square category tiles directly above it on the page, with the reference's
 * single bronze inner frame and the eyebrow + serif title on a bottom scrim.
 *
 * NO PHOTO, NO FAKE PHOTO. An occasion with no entry in OCCASION_ART renders an
 * ivory plate instead — same frame, same type, a ✦ in place of the picture —
 * rather than borrowing an image that shows the wrong thing. See occasion-art.ts
 * for why חנוכה is currently one of them.
 *
 * THE SCRIM, and why both lines of text are WHITE. The eyebrow is 11px, and
 * --gold-bright only clears 4.5:1 on the fully opaque --argaman-deep; at the
 * ~0.8 the scrim reaches behind it over a white frame it would fall to ~2.5:1.
 * White there is ~5:1. The title (up to two lines) sits in the bottom ~35%,
 * where the ramp is still >= 0.7, and carries a soft text-shadow for the
 * brightest photographs.
 */
export function OccasionTile({ c }: { c: OccasionCollection }) {
  const art = OCCASION_ART[c.slug];
  return (
    <Link to="/collection/$slug" params={{ slug: c.slug }} className="group/occ block h-full">
      <div
        className={`relative aspect-[4/5] overflow-hidden rounded-2xl border border-gold/35 shadow-[var(--shadow-card)] ${
          art ? "bg-muted" : "bg-[linear-gradient(180deg,#FFFDF9,#F2ECE2)]"
        }`}
      >
        {art ? (
          <>
            {/* alt="" — the visible title below is the link's accessible name. */}
            <img
              src={art.img}
              alt=""
              loading="lazy"
              decoding="async"
              width={art.w}
              height={art.h}
              style={art.position ? { objectPosition: art.position } : undefined}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/occ:scale-105"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(to_top,rgb(30_24_18/0.9)_0%,rgb(30_24_18/0.72)_34%,rgb(30_24_18/0.22)_56%,transparent_72%)]"
            />
          </>
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-[30%] text-center font-display text-5xl leading-none text-gold"
          >
            ✦
          </span>
        )}

        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-2.5 rounded-[0.8rem] border ${
            art ? "border-gold-bright/55" : "border-gold/45"
          }`}
        />

        <div className="absolute inset-x-4 bottom-5 text-center">
          <span
            className={`block text-micro tracking-[0.3em] [margin-inline-end:-0.3em] ${
              art ? "text-white" : "text-accent"
            }`}
          >
            {c.eyebrow}
          </span>
          <span
            className={`mt-1.5 block line-clamp-2 font-display text-xl leading-tight md:text-[1.375rem] ${
              art ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]" : "text-foreground"
            }`}
          >
            {c.title}
          </span>
        </div>
      </div>
    </Link>
  );
}
