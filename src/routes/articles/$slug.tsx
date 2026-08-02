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

// Named/numeric HTML entities present in stored article HTML. Measured across
// the five live guides: kiddush-cup-guide's body_html carries 11 literal
// `&quot;` and ZERO real quote characters, so the `articleBody` handed to answer
// engines read 'שיעור רביעית (86 מ&quot;ל' while the DOM correctly showed
// 'מ"ל'. Hebrew uses gershayim constantly (ס"מ, מ"ל, סת"ם), so the corruption
// lands exactly on the technical vocabulary that makes a guide quotable. Kept as
// a table rather than a DOM decode because this module is evaluated in the
// Cloudflare Workers runtime too, where there is no document.
const HTML_ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", amp: "&", lt: "<", gt: ">", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  hellip: "…", middot: "·", deg: "°", shy: "",
};

/** Decodes HTML entities in ALREADY tag-stripped text. Single pass, so a stored
 *  `&amp;quot;` correctly yields the literal `&quot;` rather than a quote. */
function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, ref: string) => {
    if (ref[0] === "#") {
      const cp =
        ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      // Reject surrogates and out-of-range values; String.fromCodePoint throws on them.
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
        return whole;
      }
      return String.fromCodePoint(cp);
    }
    const named = HTML_ENTITIES[ref];
    return named === undefined ? whole : named;
  });
}

/** Tag-free, entity-free plain text from stored rich-text HTML. Tags are
 *  replaced with a SPACE (not "") so words on either side of a tag boundary —
 *  e.g. `</p><p>` — never fuse into one token. Entities are decoded AFTER the
 *  tags are gone, so a stored `&lt;p&gt;` can never be decoded into a live tag;
 *  whitespace is collapsed last so a decoded `&nbsp;` collapses too. */
function toPlainText(html: string | null | undefined): string {
  return decodeEntities(String(html ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** JSON-LD serialiser that rewrites every "<" to its JSON unicode escape.
 *  Required now that `articleBody` is entity-DECODED: a stored `&lt;/script&gt;`
 *  would otherwise decode into a real closing tag inside this <script> block and
 *  truncate every node after it. The escape is plain JSON — byte-identical value
 *  to a consumer, inert to an HTML parser. (Verified this route emits script
 *  children RAW: the live page ships a literal `&quot;`, not `&amp;quot;`, so
 *  nothing downstream is escaping this string for us.) */
const ldJson = (node: unknown): string => JSON.stringify(node).replace(/</g, "\\u003c");

/** Removes the `<h2>שאלות נפוצות</h2>` block that every stored guide body also
 *  carries, so the page shows ONE FAQ section instead of two. Measured live:
 *  /articles/kiddush-cup-guide rendered two "שאלות נפוצות" headings, and the
 *  FAQPage schema described only the accordion — while the body set answered
 *  some of the same questions ~200 words earlier. Those questions now live in
 *  guide-faq.ts, which drives BOTH the accordion and the schema, so nothing is
 *  lost. Stops at the next <h2> or at the guide's category-link paragraph
 *  (kiddush-cup-guide's FAQ is its last section, and that link must survive).
 *  Runs on the RAW body_html because the sanitiser strips data-* attributes.
 *  Applied only when a curated FAQ exists to replace it — see call sites. */
const IN_BODY_FAQ =
  /<h2[^>]*>\s*שאלות נפוצות\s*<\/h2>[\s\S]*?(?=<h2\b|<p[^>]*\bdata-guide-cat-link\b|$)/;
function stripInBodyFaq(bodyHtml: string | null | undefined): string {
  return String(bodyHtml ?? "").replace(IN_BODY_FAQ, "");
}

/** The single body-HTML pipeline. Both call sites — the rendered DOM and
 *  head()'s `articleBody` — MUST go through this, or schema and page drift. */
function articleBodyHtml(bodyHtml: string | null | undefined, hasFaq: boolean): string {
  const html = hasFaq ? stripInBodyFaq(bodyHtml) : String(bodyHtml ?? "");
  // U+2013 between digits renders the range BACKWARDS in an RTL paragraph:
  // it is bidi class ON, which UBA rule N1 resolves to R and splits the two
  // numbers into separate runs, so "24–36" displays as "36-24". U+002D is class
  // ES, which binds two European Numbers into one LTR run and displays
  // correctly. Five stored ranges hit this — bechira-talit "24–36" and "45–50",
  // tefillin-guide "27–31", kiddush-cup-guide "100–150" and "200–400" — and the
  // rest of the site (about, PDPs, llms.txt) already serves ASCII, so the guides
  // were the last surface contradicting it. Fixed at render because body_html is
  // DB content: the stored rows still need the same one-line correction.
  // U+00D7 MULTIPLICATION SIGN is in the same class as the dashes and fails the
  // same way: it is bidi class ON, so in an RTL paragraph N1 hands it the
  // paragraph level and the two number runs around it swap — a guide that reads
  // "מידה 30×40 ס\"מ" paints as "40×30", silently transposing a dimension a
  // shopper is using to decide whether an item fits. The guides are the site's
  // best-ranking content, so this is also the text answer engines quote.
  // Replaced with ASCII "x", which is bidi class L and never reorders.
  return html
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
    .replace(/(\d)\s*×\s*(\d)/g, "$1x$2");
}

/** The article's author, for BOTH the JSON-LD and the visible byline.
 *
 *  All five guides store "צוות אור זרוע לצדיק". Google's Article guidance says
 *  `author.name` must hold the author's name and nothing else — explicitly
 *  "don't add the name of the publisher, use the publisher property" — and that
 *  string is a generic staff label wrapped around the publisher's own name, so
 *  it breaks both halves of that rule at once. `Organization` itself is a
 *  legitimate author type (Google's own example is an organisation author), and
 *  it is the honest one here: these guides are house-written and no individual
 *  is credited anywhere. Naming a person would be inventing a credential.
 *  So the house label resolves to the organisation, bound by @id to the node
 *  that already publishes the article; any other stored value is a real byline
 *  and is published as a Person, as written. */
const ORG_NAME = "אור זרוע לצדיק";
function articleAuthor(stored: string | null | undefined) {
  const v = String(stored ?? "").trim();
  const isHouse = !v || v === ORG_NAME || v === "צוות" || v === `צוות ${ORG_NAME}`;
  return isHouse
    ? { name: ORG_NAME, isOrganization: true as const }
    : { name: v, isOrganization: false as const };
}

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

    // Curated, honest Q&A for this guide (undefined for non-guide slugs). The
    // SAME source renders the visible accordion in the component, so the
    // FAQPage schema and the on-page text are guaranteed to match. Read before
    // the body text because it also decides whether the body's own duplicate FAQ
    // section is stripped — head() and the component must strip identically.
    const faq = guideFaq(params.slug);

    const plainDesc = toPlainText(a.description);
    // Tag-free, entity-free article text — see toPlainText. Reused for BOTH
    // `articleBody` and an honest `wordCount` (the old count split raw HTML, so
    // every tag inflated the total).
    //
    // Built to be a faithful transcript of what the page renders, in DOM order:
    // the body with its duplicate in-body FAQ removed (the component removes the
    // same block), then the curated Q&A the accordion renders in its place. Both
    // halves matter — dropping the second would make articleBody describe less
    // than the page shows, and keeping the body's stripped block would make it
    // describe text that is no longer there. Q&A also appears in the FAQPage
    // node; that is the same page quoting its own content twice for two
    // different consumers, not a claim about anything the page lacks.
    const faqText = faq ? faq.map((f) => `${f.q} ${f.a}`).join(" ") : "";
    const plainBody = [toPlainText(articleBodyHtml(a.body_html, !!faq)), faqText]
      .filter(Boolean)
      .join(" ");
    // og:image / Article image fallback. `featured_image` is null for every
    // seeded article; without a fallback the card had no image and the Article
    // schema omitted `image` entirely. og-default.jpg is the real 1200×630 brand
    // card used site-wide, so the fallback is truthful.
    const ogImage = a.featured_image || "https://orzadik.com/og-default.jpg";
    const author = articleAuthor(a.author);

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
          children: ldJson({
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
            // See articleAuthor: the organisation is the author of the house
            // guides, so it is bound by @id to the publisher node rather than
            // re-declared as a second, nameless Organization. `url` and `name`
            // are repeated (not a bare @id) because that node ships from a
            // DIFFERENT <script> block, and cross-block @id merging is not
            // something Google's parser guarantees — both values are byte-equal
            // to the ones it declares, so nothing can contradict.
            author: author.isOrganization
              ? {
                  "@type": "Organization",
                  "@id": "https://orzadik.com/#organization",
                  name: author.name,
                  url: "https://orzadik.com/",
                }
              : { "@type": "Person", name: author.name },
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
          children: ldJson({
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
        // It is now the page's ONLY FAQ: the competing in-body block is stripped
        // above and below, so no question on the page is left unschema'd and no
        // question is answered twice.
        ...(faq
          ? [
              {
                type: "application/ld+json",
                children: ldJson(faqJsonLd(faq)),
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
              {/* Same normalisation as the Article schema's `author`, so the
                  visible byline and the structured data name one author. */}
              {articleAuthor(a.author).name}
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
          /* Same pipeline head() feeds `articleBody` from, so DOM and schema can
             never drift: the stored body's own "שאלות נפוצות" block is dropped
             when this guide has a curated FAQ (otherwise the page shows the
             heading twice — measured live on every guide — and answers some
             questions twice), and RTL-reversing numeric ranges are repaired. */
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(articleBodyHtml(a.body_html, !!faq)) }}
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
