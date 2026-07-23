import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { fetchArticleWithRetry, fetchArticlesByCategoryWithRetry } from "@/lib/articles.server";
import { ArticleCard } from "@/components/ArticleCard";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Share2, Calendar, Clock, User } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

export const Route = createFileRoute("/articles/$slug")({
  loader: async ({ params }) => {
    const article = await fetchArticleWithRetry(params.slug);
    if (!article) throw notFound(); // real HTTP 404 for non-existent articles
    let relatedArticles: Awaited<ReturnType<typeof fetchArticlesByCategoryWithRetry>> = [];
    if (article.category_id) {
      // Fetch 3, render 2: the category query also returns the article being
      // read, which is filtered out in the component.
      relatedArticles = await fetchArticlesByCategoryWithRetry(article.category_id, 2, 3);
    }
    return { article, relatedArticles };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article as any;
    const url = `https://orzadik.com/articles/${params.slug}`;
    if (!a) {
      return { meta: [{ title: "מאמר | אור זרוע לצדיק" }], links: [{ rel: "canonical", href: url }] };
    }

    const plainDesc = (a.description || "").replace(/<[^>]*>/g, "").trim();

    return {
      meta: [
        { title: `${a.title_he} | אור זרוע לצדיק` },
        { name: "description", content: plainDesc || a.title_he },
        { property: "og:title", content: `${a.title_he} | אור זרוע לצדיק` },
        { property: "og:description", content: plainDesc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(a.featured_image ? [{ property: "og:image", content: a.featured_image }] : []),
        { property: "article:published_time", content: a.published_at },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${a.title_he} | אור זרוע לצדיק` },
        { name: "twitter:description", content: plainDesc },
        ...(a.featured_image ? [{ name: "twitter:image", content: a.featured_image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "@id": url,
            url,
            headline: a.title_he,
            description: plainDesc,
            image: a.featured_image || undefined,
            datePublished: a.published_at,
            dateModified: a.updated_at || a.published_at,
            author: { "@type": "Organization", name: a.author || "אור זרוע לצדיק" },
            publisher: {
              "@type": "Organization",
              "@id": "https://orzadik.com/#organization",
              name: "אור זרוע לצדיק",
              logo: {
                "@type": "ImageObject",
                url: "https://orzadik.com/logo.png",
              },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            articleBody: a.body_html ? a.body_html.replace(/<[^>]*>/g, "") : "",
            wordCount: a.body_html ? a.body_html.split(/\s+/).length : 0,
            isPartOf: { "@id": "https://orzadik.com/#website" },
            // Speakable: lets voice assistants read the headline.
            speakable: {
              "@type": "SpeakableSpecification",
              cssSelector: ["h1"],
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "בית", item: "https://orzadik.com/" },
              { "@type": "ListItem", position: 2, name: "מאמרים", item: "https://orzadik.com/articles" },
              { "@type": "ListItem", position: 3, name: a.title_he, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: ArticleDetailPage,
});

function ArticleDetailPage() {
  const { article, relatedArticles } = Route.useLoaderData();
  // `featured_image` is nullable AND may point at a URL that 404s. The `null`
  // case is handled by the render guard below; this covers the broken-URL case
  // so a dead link doesn't leave a 400px empty grey band above the headline.
  // Declared before the early return so hook order is stable.
  const [heroFailed, setHeroFailed] = useState(false);

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass px-8 py-12 text-center">
          <h1 className="font-display text-3xl font-bold mb-2 text-foreground">מאמר לא נמצא</h1>
          <p className="text-muted-foreground mb-6">המאמר שחיפשת אינו קיים או הוסר.</p>
          <Link
            to="/articles"
            className="press inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/90"
          >
            חזרה למאמרים
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const publishedDate = new Date(article.published_at).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const a = article as any;

  // Related articles are pulled by category_id, which also matches the article
  // being read — drop it so a reader is never offered the page they are on.
  const related = (relatedArticles ?? []).filter((ra: any) => ra.id !== a.id).slice(0, 2);

  return (
    <article className="pb-12">
      {/* Hero section with featured image — skipped entirely while
          `featured_image` is null (true for every seeded article today) and
          removed again if the URL fails to load. */}
      {a.featured_image && !heroFailed && (
        <div className="relative w-full h-[400px] md:h-[500px] bg-muted overflow-hidden border-b border-glass-line">
          <img
            src={a.featured_image}
            alt={a.title_he}
            decoding="async"
            onError={() => setHeroFailed(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      )}

      {/* Main content */}
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        {/* Header */}
        <header className="mb-8">
          <Link
            to="/articles"
            className="inline-flex items-center gap-2 text-sm text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline mb-4"
          >
            <ArrowRight className="w-4 h-4 rotate-180" aria-hidden="true" />
            חזרה למאמרים
          </Link>

          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {a.title_he}
          </h1>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b border-glass-line pb-4 mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <time dateTime={a.published_at}>{publishedDate}</time>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" aria-hidden="true" />
              קריאה של {a.read_time_minutes} דקות
            </div>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" aria-hidden="true" />
              {a.author || "אור זרוע לצדיק"}
            </div>
            <button
              type="button"
              className="press flex items-center gap-1 rounded-full transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              שתף
            </button>
          </div>
        </header>

        {/* Article body. The old `prose-legal prose-he` hooks were never backed
            by a stylesheet (no @tailwindcss/typography in this project), so the
            sanitized HTML rendered unstyled — the Hebrew RTL measure and rhythm
            are now set explicitly with scoped utilities. */}
        <div
          className="mb-12 max-w-none text-[17px] leading-[1.9] text-foreground
            [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-foreground
            [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-foreground
            [&_p]:mb-5
            [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pr-6 [&_ul]:space-y-2
            [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pr-6 [&_ol]:space-y-2
            [&_li]:leading-[1.85]
            [&_strong]:font-semibold
            [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4
            [&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto
            [&_blockquote]:pr-5 [&_blockquote]:border-r-2 [&_blockquote]:border-glass-line [&_blockquote]:text-muted-foreground
            [&_hr]:my-10 [&_hr]:border-0 [&_hr]:h-px [&_hr]:bg-glass-line"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a.body_html) }}
        />

        {/* Related articles — the loader only fills this when the article has a
            category_id, so while that column is null the whole section is
            omitted rather than rendering an empty heading. */}
        {related.length > 0 && (
          <section className="pt-8 border-t border-glass-line">
            <h2 className="font-display text-2xl font-bold mb-6 text-foreground">מאמרים קשורים</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((ra: any) => (
                <ArticleCard
                  key={ra.id}
                  slug={ra.slug}
                  title_he={ra.title_he}
                  description={ra.description}
                  featured_image={ra.featured_image}
                  read_time_minutes={ra.read_time_minutes}
                  published_at={ra.published_at}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        {/* CTA section — the article→catalog bridge.
            `articles.category_id` is the only link an article has to the shop,
            and it is NULL for every seeded article, so the old single /shop
            button dropped readers into a 4,600-product catalog with no way to
            narrow down. Until a category is attached, offer /categories as the
            second step; once one is, related reading appears above instead. */}
        <section className="glass glass-gold mt-12 p-8 md:p-10 [--glass-radius:1.25rem]">
          <h2 className="font-display text-2xl font-bold mb-3 text-foreground">
            מצאו את המוצרים המתאימים בחנות שלנו
          </h2>
          <p className="text-muted-foreground mb-6">
            {a.category_id
              ? "המשיכו מכאן אל הפריטים שעליהם קראתם במאמר."
              : "אפשר לעיין בכל המוצרים, או להתחיל מרשימת הקטגוריות ולצמצם משם."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/shop"
              className="press inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/90 font-medium"
            >
              לעיין בחנות
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/categories"
              className="press inline-flex items-center gap-2 px-6 py-3 rounded-full border border-accent text-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-foreground font-medium"
            >
              לכל הקטגוריות
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
