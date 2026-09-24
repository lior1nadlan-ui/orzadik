import { Link } from "@tanstack/react-router";
import type { CatTile } from "@/components/home/CollectionCard";

/**
 * A category door in the long "שאר הקטגוריות" rail — the reference's lighter
 * card: a square photograph, a deep bottom scrim, and the category name in
 * white display serif directly on the photo. No plate and no frame; the framed
 * <CollectionCard> is reserved for the seven curated collections above it.
 *
 * THE SCRIM IS SIZED FOR THE TEXT, NOT FOR LOOKS. A one-line name sits in the
 * bottom ~22% of the square, where the gradient is still >= 0.8 of
 * --argaman-deep (#1E1812): over a pure-white frame that leaves white glyphs at
 * ~4.1:1, and the soft text-shadow closes the rest. A two-line name climbs to
 * ~35%, which is why the ramp only lets go above the middle. Lightening the
 * bottom stops to "show more photo" is a contrast decision, not a taste one.
 */
export function CategoryTile({ cat }: { cat: CatTile }) {
  return (
    <Link to="/category/$slug" params={{ slug: cat.slug }} className="group/tile block">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-gold/30 bg-muted shadow-[var(--shadow-card)]">
        {/* alt="" — the visible name below is the link's accessible name. */}
        <img
          src={cat.img}
          alt=""
          loading="lazy"
          decoding="async"
          width={cat.w}
          height={cat.h}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/tile:scale-105"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgb(30_24_18/0.88)_0%,rgb(30_24_18/0.74)_26%,rgb(30_24_18/0.3)_46%,transparent_64%)]"
        />
        <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-center font-display text-lg leading-tight text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.45)] md:bottom-4 md:text-xl">
          {cat.name}
        </span>
      </div>
    </Link>
  );
}
