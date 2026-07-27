import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  fetchArticleWithRetry,
  fetchArticlesByCategoryWithRetry,
  fetchArticlesWithRetry,
  type Article,
} from "@/lib/articles.server";
import { ArticleCard, ARTICLE_FALLBACK_BG } from "@/components/ArticleCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { ProductCardData } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Share2, Calendar, Clock, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";
// Workers-safe sanitiser. isomorphic-dompurify falls back to jsdom on the
// server, which cannot run in the Cloudflare Workers runtime — it threw
// during SSR, so this route shipped NO body HTML to crawlers at all.
import { sanitizeHtml } from "@/lib/sanitize-html";
import { guideFaq, faqJsonLd } from "@/lib/guide-faq";

/** In-stock, imaged products from an article's category — a live rail so a
 *  guide sends real link equity to the shop AND never points at a hidden SKU
 *  (a hardcoded product slug in article HTML would 404 once the item is
 *  deactivated; this always reflects the current catalog). */
async function fetchArticleProducts(categoryId: string): Promise<ProductCardData[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("products!inner(id, slug, name, price, sale_price, thumbnail_url, is_active, stock_status)")
    .eq("category_id", categoryId)
    .limit(24);
  if (error) return [];
  const seen = new Set<string>();
  const out: ProductCardData[] = [];
  for (const r of data ?? []) {
    const p: any = (r as any).products;
    if (!p?.is_active || !p.thumbnail_url || p.stock_status === "outofstock") continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p as ProductCardData);
    if (out.length >= 8) break;
  }
  return out;
}

export const Route = createFileRoute("/articles/$slug")({
  loader: async ({ params }) => {
    const article = await fetchArticleWithRetry(params.slug);
    if (!article) throw notFound(); // real HTTP 404 for non-existent articles
    let relatedArticles: Article[] = [];
    let categoryProducts: ProductCardData[] = [];
    if (article.category_id) {
      // Fetch 3, render 2: the category query also returns the article being
      // read, which is filtered out below.
      [relatedArticles, categoryProducts] = await Promise.all([
        fetchArticlesByCategoryWithRetry(article.category_id, 2, 3),
        fetchArticleProducts(article.category_id),
      ]);
    }

    // Fallback related articles — turns dead-ends into hubs. `category_id` is
    // NULL for every seeded article, so the category query above returns nothing
    // and the guide previously ended with no onward reading. When fewer than two
    // usable links come back (no category, or a thin one), top up from the most
    // recent OTHER published articles. Recency is an honest ordering — no
    // fabricated "popular"/"related" claim — and every link is a real, published
    // page, so a reader always has a next step to another guide.
    const usable = relatedArticles.filter((ra) => ra.id !== article.id);
    if (usable.length < 2) {
      const recent = await fetchArticlesWithRetry();
      const seen = new Set(usable.map((ra) => ra.id));
      seen.add(article.id);
      for (const ra of recent) {
        if (seen.has(ra.id)) continue;
        usable.push(ra);
        seen.add(ra.id);
        if (usable.length >= 2) break;
      }
      relatedArticles = usable;
    }

    return { article, relatedArticles, categoryProducts };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article as any;
    const url = `https://orzadik.com/articles/${params.slug}`;
    if (!a) {
      return { meta: [{ title: "מאמר | אור זרוע לצדיק" }], links: [{ rel: "canonical", href: url }] };
    }

    const plainDesc = (a.description || "").replace(/<[^>]*>/g, "").trim();
    // Tag-free article text. Tags are replaced with a SPACE (not "") so words on
    // either side of a tag boundary — e.g. </p><p> — never fuse into one token;
    // whitespace is then collapsed. Reused for BOTH `articleBody` and an honest
    // `wordCount` (the old count split raw HTML, so every tag inflated the total).
    const plainBody = (a.body_html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // og:image / Article image fallback. `featured_image` is null for every
    // seeded article; without a fallback the card had no image and the Article
    // schema omitted `image` entirely. og-default.jpg is the real 1200×630 brand
    // card used site-wide, so the fallback is truthful.
    const ogImage = a.featured_image || "https://orzadik.com/og-default.jpg";
    // Curated, honest Q&A for this guide (undefined for non-guide slugs). The
    // SAME source renders the visible accordion in the component, so the
    // FAQPage schema and the on-page text are guaranteed to match.
    const faq = guideFaq(params.slug);

    return {
      meta: [
        { title: `${a.title_he} | אור זרוע לצדיק` },
        { name: "description", content: plainDesc || a.title_he },
        { property: "og:title", content: `${a.title_he} | אור זרוע לצדיק` },
        { property: "og:description", content: plainDesc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: a.title_he },
        { property: "article:published_time", content: a.published_at },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${a.title_he} | אור זרוע לצדיק` },
        { name: "twitter:description", content: plainDesc },
        { name: "twitter:image", content: ogImage },
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
            image: ogImage,
            inLanguage: "he-IL",
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
            articleBody: plainBody,
            // Count of the STRIPPED text, so tags no longer inflate the total.
            wordCount: plainBody ? plainBody.split(" ").length : 0,
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
        // FAQPage — only when this guide has curated Q&A. The visible accordion
        // in the component renders from the same `guideFaq(slug)` source, so the
        // structured data and the on-page text are identical (Google's policy).
        ...(faq
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify(faqJsonLd(faq)),
              },
            ]
          : []),
      ],
    };
  },
  component: ArticleDetailPage,
});

function ArticleDetailPage() {
  const { article, relatedArticles, categoryProducts } = Route.useLoaderData();
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

  // Share: native share sheet where the browser exposes one, otherwise copy the
  // URL to the clipboard with a confirmation toast. Every browser global is
  // touched ONLY inside this click handler (never at module/render scope), so
  // the component stays SSR-safe. A dismissed share sheet rejects with
  // AbortError — swallowed, since a cancel is not a failure.
  const handleShare = async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: a.title_he, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("הקישור הועתק");
      }
    } catch {
      /* share dismissed or clipboard blocked — no user-facing error needed */
    }
  };

  // Related articles are pulled by category_id, which also matches the article
  // being read — drop it so a reader is never offered the page they are on.
  const related = (relatedArticles ?? []).filter((ra: any) => ra.id !== a.id).slice(0, 2);

  // Curated, honest FAQ for this guide (undefined for non-guide slugs). Same
  // source as the FAQPage JSON-LD in the route head, so schema ↔ DOM match.
  const faq = guideFaq(a.slug);

  return (
    <article className="pb-12">
      {/* Hero. With a usable `featured_image` it is the photo band; with none —
          the case for every seeded article, and again if the URL 404s — it falls
          back to the same branded mesh + ✦ masthead the cards use, at a calmer
          height so it anchors the page without a half-screen of empty space
          above the headline. */}
      {a.featured_image && !heroFailed ? (
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
      ) : (
        <div
          className="relative flex w-full h-52 md:h-64 items-center justify-center overflow-hidden border-b border-glass-line"
          style={{ backgroundImage: ARTICLE_FALLBACK_BG }}
          aria-hidden="true"
        >
          <span className="flex items-center gap-4">
            <span className="gold-rule w-16 md:w-24" />
            <span className="text-gold text-3xl md:text-4xl tracking-[0.4em]">✦</span>
            <span className="gold-rule w-16 md:w-24" />
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        {/* Header */}
        <header className="mb-8">
          {/* Visible location trail — mirrors the BreadcrumbList JSON-LD emitted
              in head() (בית / מאמרים / this article) and its "מאמרים" crumb is the
              path back to the index, so it replaces the old standalone back-link.
              The shared primitive carries no microdata, so the schema stays the
              single source of truth for crawlers. */}
          <div className="mb-4">
            <Breadcrumb
              items={[
                { label: "בית", to: "/" },
                { label: "מאמרים", to: "/articles" },
                { label: a.title_he },
              ]}
            />
          </div>

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
              onClick={handleShare}
              className="press flex items-center gap-1 rounded-full transition-[color] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
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
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.body_html) }}
        />

        {/* FAQ — AEO surface (voice, "People also ask", AI answer engines).
            Mirrors the FAQPage JSON-LD emitted in the route head, so per
            Google's policy every answer must be present in the server HTML and
            identical to the schema. Native <details>/<summary> keeps each answer
            in the markup while collapsing it visually — no JS, no hydration
            cost, and nothing a crawler can't read. Rendered only for guides that
            have curated, honest Q&A. */}
        {faq && faq.length > 0 && (
          <section className="mb-12 not-prose" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="font-display text-2xl font-bold mb-5 text-foreground">
              שאלות נפוצות
            </h2>
            <div className="w-full border-t border-glass-line">
              {faq.map((item, i) => (
                <details key={i} className="group border-b border-glass-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-right font-display text-base font-medium transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent [&::-webkit-details-marker]:hidden">
                    <span>{item.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-accent transition-[transform,rotate] duration-200 ease-out group-open:rotate-180"
                    />
                  </summary>
                  <p className="pb-4 text-[15px] leading-[1.9] text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Live product rail from the guide's category — the reader's direct
            path from "what to look for" to buyable items. Always current: only
            active, in-stock, imaged products, so it can never link to a hidden
            SKU. Rendered only when the article is category-linked and the
            category has presentable stock. */}
        {(categoryProducts ?? []).length > 0 && (
          <div className="not-prose">
            <ProductCarousel
              eyebrow="מהמדריך אל החנות"
              heading="מוצרים מהקטגוריה"
              items={categoryProducts as ProductCardData[]}
              itemClassName="basis-1/2 md:basis-1/3 lg:basis-1/4"
            />
          </div>
        )}

        {/* More articles — an onward internal-links block so a guide is never a
            dead end. Filled from the article's category when it has one, and
            otherwise topped up with the most recent other guides (see loader), so
            this renders on every article that isn't the site's only one. Heading
            stays "מאמרים נוספים" (additional) rather than "קשורים" (related)
            because the recency fallback isn't necessarily topically related. */}
        {related.length > 0 && (
          <section className="pt-8 border-t border-glass-line">
            <h2 className="font-display text-2xl font-bold mb-6 text-foreground">מאמרים נוספים</h2>
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

        {/* Email capture — a guide reader is high-intent and content-motivated,
            the exact audience the newsletter is FOR, yet the form previously
            rendered only in the footer. Value proposition is content/holidays,
            not deals (see item 3). */}
        <section className="mt-10 text-center">
          <div className="text-xs tracking-[0.35em] text-accent uppercase mb-2">
            רוצים עוד תוכן כזה?
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            מדריכים ותוכן לקראת החגים, ופריטים חדשים לפני כולם — בלי ספאם.
          </p>
          <div className="mx-auto max-w-md">
            <NewsletterSignup source="article" />
          </div>
        </section>
      </div>
    </article>
  );
}
