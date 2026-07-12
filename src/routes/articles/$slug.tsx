import { createFileRoute, notFound } from "@tanstack/react-router";
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
      relatedArticles = await fetchArticlesByCategoryWithRetry(article.category_id, 2, 2);
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

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">מאמר לא נמצא</h1>
          <p className="text-muted-foreground mb-6">המאמר שחיפשת אינו קיים או הוסר.</p>
          <Link
            to="/articles"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            חזרה למאמרים
            <ArrowRight className="w-4 h-4" />
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

  return (
    <article className="pb-12">
      {/* Hero section with featured image */}
      {a.featured_image && (
        <div className="relative w-full h-[400px] md:h-[500px] bg-muted overflow-hidden border-b">
          <img
            src={a.featured_image}
            alt={a.title_he}
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
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-4"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            חזרה למאמרים
          </Link>

          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {a.title_he}
          </h1>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b border-border pb-4 mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <time dateTime={a.published_at}>{publishedDate}</time>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              קריאה של {a.read_time_minutes} דקות
            </div>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {a.author || "אור זרוע לצדיק"}
            </div>
            <button className="flex items-center gap-1 hover:text-foreground transition">
              <Share2 className="w-4 h-4" />
              שתף
            </button>
          </div>
        </header>

        {/* Article body */}
        <div
          className="prose-legal prose-he mb-12 max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a.body_html) }}
        />

        {/* Related articles section */}
        {relatedArticles && relatedArticles.length > 0 && (
          <section className="pt-8 border-t border-border">
            <h2 className="font-display text-2xl font-bold mb-6">מאמרים קשורים</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedArticles.map((ra: any) => (
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

        {/* CTA section */}
        <section className="mt-12 p-8 md:p-10 rounded-xl bg-gradient-to-b from-primary/5 to-background border border-primary/20">
          <h2 className="font-display text-2xl font-bold mb-3">
            היישום זה בחנותנו
          </h2>
          <p className="text-muted-foreground mb-6">
            גלו את המוצרים המומלצים בעת קריאת מאמר זה.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
          >
            לעיין בחנות
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </article>
  );
}
