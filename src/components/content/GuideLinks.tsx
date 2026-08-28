import { Link } from "@tanstack/react-router";
import type { GuideRef } from "@/lib/guide-links";

/**
 * Contextual links from a shopping surface into the guides.
 *
 * Renders straight from props — no query, no effect — so the links are in the
 * server HTML rather than appearing after hydration. That is the whole point:
 * a link a crawler never sees passes no authority, and these are the first
 * internal links the guides have ever had from the catalog.
 *
 * Three densities so every surface can reuse one component:
 *   chip   — a single pill, for above the fold on a category page
 *   inline — 1-2 bare links, for the PDP buy column
 *   card   — a glass panel with blurbs, for below a product grid
 */
export function GuideLinks({
  guides,
  variant = "chip",
  className = "",
  heading = "לפני שקונים",
}: {
  guides: GuideRef[];
  variant?: "chip" | "inline" | "card";
  className?: string;
  heading?: string;
}) {
  if (guides.length === 0) return null;

  if (variant === "chip") {
    return (
      <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
        {guides.map((g) => (
          <Link
            key={g.slug}
            to="/articles/$slug"
            params={{ slug: g.slug }}
            className="press inline-flex items-center gap-1.5 rounded-full bg-card/70 px-3.5 py-1.5 text-xs text-accent shadow-[inset_0_0_0_1px_var(--glass-line-gold)] transition-[color,box-shadow] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
          >
            {/* Decorative gold mark, never the only carrier of meaning. */}
            <span aria-hidden="true" className="text-gold">
              ✦
            </span>
            {g.title}
          </Link>
        ))}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${className}`}>
        {guides.map((g) => (
          <Link
            key={g.slug}
            to="/articles/$slug"
            params={{ slug: g.slug }}
            className="text-accent underline-offset-4 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
          >
            {g.title} ←
          </Link>
        ))}
      </div>
    );
  }

  return (
    <section className={`glass p-6 md:p-8 [--glass-radius:1.5rem] ${className}`}>
      <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-3">{heading}</p>
      <div className="gold-rule mb-5 w-16" aria-hidden="true" />
      <ul className="space-y-4">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              to="/articles/$slug"
              params={{ slug: g.slug }}
              className="font-display text-lg md:text-xl text-foreground transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
            >
              {g.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">{g.blurb}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
