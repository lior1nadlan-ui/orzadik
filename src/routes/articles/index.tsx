import { createFileRoute } from "@tanstack/react-router";
import { fetchArticlesWithRetry, type Article } from "@/lib/articles.server";
import { ArticleCard } from "@/components/ArticleCard";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/articles/")({
  loader: async () => {
    const articles = await fetchArticlesWithRetry();
    return { articles };
  },
  head: () => ({
    meta: [
      { title: "מאמרים וטיפים | אור זרוע לצדיק" },
      {
        name: "description",
        content: "מאמרים חינוכיים על תשמישי קדושה, טליתות, תפילין, מזוזות, גביעי קידוש וחנוכיות. למדו על הלכות, בחירה וטיפול.",
      },
      { property: "og:title", content: "מאמרים וטיפים | אור זרוע לצדיק" },
      {
        property: "og:description",
        content: "מאמרים חינוכיים על תשמישי קדושה ויודאיקה.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://orzadik.com/articles" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/articles" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": "https://orzadik.com/articles",
          url: "https://orzadik.com/articles",
          name: "מאמרים וטיפים",
          description: "מאמרים חינוכיים על תשמישי קדושה.",
          inLanguage: "he-IL",
          isPartOf: { "@id": "https://orzadik.com/#website" },
        }),
      },
    ],
  }),
  component: ArticlesListPage,
});

function ArticlesListPage() {
  // Cast because the stale generated route tree types the loader as `any` until
  // the next build regenerates it; the loader returns Article[].
  const { articles } = Route.useLoaderData() as { articles: Article[] };
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase();
    return articles.filter(
      (a) =>
        a.title_he.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.seo_keywords?.toLowerCase().includes(q) ?? false),
    );
  }, [articles, searchQuery]);

  return (
    <div className="container mx-auto px-4 py-10 md:py-14 pb-12">
      <PageHeader
        eyebrow="מדריכים ותוכן"
        title="מאמרים וטיפים"
        sub="למדו על תשמישי קדושה, הלכות קדושה, בחירה נכונה וטיפול במוצרים מהודרים."
      />

      <div>
        {/* Search */}
        <div className="max-w-md mx-auto mb-10">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
            />
            <Input
              type="search"
              placeholder="חיפוש מאמרים..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground text-center mb-8">
          {filtered.length} {filtered.length === 1 ? "מאמר" : "מאמרים"}
        </p>

        {/* Articles grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((article) => (
              <ArticleCard
                key={article.id}
                slug={article.slug}
                title_he={article.title_he}
                description={article.description}
                featured_image={article.featured_image}
                read_time_minutes={article.read_time_minutes}
                published_at={article.published_at}
              />
            ))}
          </div>
        ) : (
          <div className="glass max-w-md mx-auto text-center px-6 py-12">
            <p className="text-muted-foreground">לא נמצאו מאמרים התואמים את החיפוש.</p>
          </div>
        )}

        {/* Email capture — readers on the guides index are content-motivated,
            the newsletter's core audience. Value proposition is content, not
            deals. */}
        <section className="mt-14 glass glass-gold [--glass-radius:1.25rem] max-w-xl mx-auto px-6 py-8 text-center">
          <div className="text-xs tracking-[0.35em] text-accent uppercase mb-2">
            רשימת התפוצה
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            מדריכים ותוכן לקראת החגים, ופריטים חדשים לפני כולם — בלי ספאם.
          </p>
          <div className="mx-auto max-w-md">
            <NewsletterSignup source="article" />
          </div>
        </section>
      </div>
    </div>
  );
}
