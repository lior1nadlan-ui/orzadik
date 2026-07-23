import { Link } from "@tanstack/react-router";
import { Clock, ArrowRight } from "lucide-react";

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
      {/* Featured image */}
      {featured_image && (
        <div className="relative overflow-hidden bg-muted aspect-video">
          <img
            src={featured_image}
            alt={title_he}
            className="w-full h-full object-cover transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
            loading="lazy"
          />
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
