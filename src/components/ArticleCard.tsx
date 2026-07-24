import { Link } from "@tanstack/react-router";
import { Clock, ArrowRight } from "lucide-react";

/**
 * A branded stand-in for a missing `featured_image`. Every seeded article has a
 * null image today, so a bare-text card reads as broken. This mirrors the exact
 * composition of --gradient-hero (styles.css) — a gold radial + a cool argaman
 * radial over a near-white base — but scaled to a small panel, so the ✦ ornament
 * (the about-page motif) sits on the same light mesh the rest of the site uses.
 * Kept as a plain string (not a class) so the multi-layer background survives
 * SSR untouched and the identical value can be reused by the article hero.
 */
export const ARTICLE_FALLBACK_BG =
  "radial-gradient(115% 130% at 50% -15%, rgba(194,162,94,0.16), transparent 60%), radial-gradient(90% 120% at 12% 8%, rgba(126,145,190,0.10), transparent 62%), linear-gradient(180deg, #FFFFFF, #F7F8FA)";

interface ArticleCardProps {
  slug: string;
  title_he: string;
  description: string;
  featured_image?: string;
  read_time_minutes: number;
  published_at: string;
  compact?: boolean; // Compact version for sidebars
}

export function ArticleCard({
  slug,
  title_he,
  description,
  featured_image,
  read_time_minutes,
  published_at,
  compact = false,
}: ArticleCardProps) {
  const publishedDate = new Date(published_at).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (compact) {
    return (
      <Link
        to={`/articles/${slug}`}
        className="press group block rounded-xl p-3 hairline"
      >
        <h3 className="font-semibold text-sm leading-snug text-foreground transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-accent line-clamp-2">
          {title_he}
        </h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{publishedDate}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {read_time_minutes} דק׳
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/articles/${slug}`}
      className="glass glass-lift group block h-full overflow-hidden"
    >
      {/* Featured image — or, when none is set, a branded mesh + ✦ panel so the
          card still reads as intentional. Both branches occupy the SAME
          aspect-video box, so a grid mixing imaged and image-less articles stays
          on one baseline. */}
      {featured_image ? (
        <div className="relative overflow-hidden bg-muted aspect-video">
          <img
            src={featured_image}
            alt={title_he}
            className="w-full h-full object-cover transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="relative flex aspect-video items-center justify-center overflow-hidden"
          style={{ backgroundImage: ARTICLE_FALLBACK_BG }}
          aria-hidden="true"
        >
          <span className="flex items-center gap-2.5">
            <span className="gold-rule w-8" />
            <span className="text-gold text-lg tracking-[0.35em]">✦</span>
            <span className="gold-rule w-8" />
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col p-4 md:p-5">
        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <time dateTime={published_at}>{publishedDate}</time>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            קריאה של {read_time_minutes} דקות
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-base md:text-lg leading-snug text-foreground transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-accent mb-2 line-clamp-2">
          {title_he}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed text-muted-foreground mb-4 line-clamp-2 flex-grow">
          {description}
        </p>

        {/* CTA — the arrow is nudged with a transform, never with `gap`
            (a layout property must not be animated). RTL: "away" is -x. */}
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          קרא המשך
          <ArrowRight
            aria-hidden="true"
            className="w-4 h-4 transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-1"
          />
        </div>
      </div>
    </Link>
  );
}
