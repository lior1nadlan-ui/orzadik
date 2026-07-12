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
        className="group block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition"
      >
        <h3 className="font-semibold text-sm leading-snug text-foreground group-hover:text-primary transition line-clamp-2">
          {title_he}
        </h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{publishedDate}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {read_time_minutes} דק׳
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/articles/${slug}`}
      className="group block h-full overflow-hidden rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition bg-background"
    >
      {/* Featured image */}
      {featured_image && (
        <div className="relative overflow-hidden bg-muted aspect-video">
          <img
            src={featured_image}
            alt={title_he}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
            <Clock className="w-3.5 h-3.5" />
            קריאה של {read_time_minutes} דקות
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-base md:text-lg leading-snug text-foreground group-hover:text-primary transition mb-2 line-clamp-2">
          {title_he}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed text-foreground/75 mb-4 line-clamp-2 flex-grow">
          {description}
        </p>

        {/* CTA */}
        <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
          קרא המשך
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
