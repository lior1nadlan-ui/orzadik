import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { OCCASION_COLLECTIONS } from "@/lib/collections";

// ---------------------------------------------------------------------------
// "Is this category real enough to advertise?" — ONE definition, exported from
// the hub that owns the category link graph and reused by the header drawer,
// /sitemap.xml and the category page's robots tag, so those four surfaces agree.
// (Importing a helper out of a route module is the shape SiteHeader already uses
// for sanitizeTerm from /shop.)
//
// NOT yet routed through this predicate — two surfaces still decide for
// themselves, so "every surface agrees" is not true yet:
//   • src/routes/index.tsx (fetchOtherCategories) keeps a hand-maintained
//     blacklist. It is a strict superset of HIDDEN_CATEGORY_SLUGS: it also drops
//     `aluminum`, `bencher-stands` and `liqueur-sets`, which DO hold active
//     products, as editorial "1 product, duplicate" calls. Replacing it means
//     deciding which of those exclusions are editorial and which were really
//     just stock checks — an owner call, not a mechanical one.
//   • src/components/catalog/SubcategoryChips.tsx filters on parent_slug only,
//     against the unfiltered ["all-cats"] cache. Harmless today only because all
//     nine dead categories happen to be top-level — data luck, not a guarantee.
//
// Measured against prod on 2026-08-01: 9 of the 102 categories hold ZERO active
// products. Four of those nine carry percent-encoded Hebrew slugs (e.g.
// %d7%9e%d7%99%d7%aa%d7%95%d7%92 = מיתוג) whose /category/<slug> URL answers a
// genuine 404 — the router decodes %d7.. back to Hebrew, which never matches
// the literal encoded string stored in categories.slug, the same hazard the
// 2026-07 slug cleanup fixed for the four PRODUCT-BEARING encoded categories.
// All four 404s were nonetheless <loc> entries in the live sitemap AND "url"
// values in this page's own ItemList, and eight of the nine sat in the mobile
// drawer dead-ending on "לא נמצאו מוצרים" (one of them labelled with the
// literal English word "sale").
// ---------------------------------------------------------------------------

/** Never advertised even if they gain products: `uncategorized` is the
 *  importer's catch-all bucket and `sale` is an empty placeholder whose NAME is
 *  the English string "sale" in an otherwise all-Hebrew nav. */
export const HIDDEN_CATEGORY_SLUGS = new Set(["sale", "uncategorized"]);

/** PostgREST embed carrying a category's active-product count. Append it to any
 *  `categories` select and pair it with `.eq("products.is_active", true)`:
 *  PostgREST applies an embedded filter to the aggregate itself (verified on
 *  prod — swap the filter for `price=gt.1000` and the same embed returns 29 for
 *  talitot instead of 55). It resolves the many-to-many through
 *  product_categories, so no view or RPC is needed, and being an aggregate it
 *  is immune to the 1000-row select cap. */
export const CATEGORY_COUNT_EMBED = "products(count)";

export type CountedCategory = {
  slug: string;
  parent_slug?: string | null;
  products?: { count: number }[] | null;
};

/** Active products assigned directly to this row (0 when the embed is absent). */
export const directProductCount = (c: CountedCategory) => Number(c.products?.[0]?.count ?? 0);

/** Single-row form of the test, for a surface that already knows its own count
 *  (the category page decides its own robots tag with it). */
export function isListableCategory(
  slug: string | null | undefined,
  activeProductCount: number,
): boolean {
  if (!slug || HIDDEN_CATEGORY_SLUGS.has(slug)) return false;
  // Any '%' in a stored slug means the URL cannot round-trip through the router
  // — it 404s — so linking it costs a dead tap and a "Submitted URL not found"
  // in Search Console on every sitemap fetch.
  if (slug.includes("%")) return false;
  return activeProductCount > 0;
}

/**
 * Keep only the categories worth linking to / submitting for indexing.
 *
 * Deliberately uses the DIRECT count, with no roll-up of a child's stock into
 * its parent. A roll-up looks kinder — "a category that exists only to group
 * children survives" — but it makes this function disagree with the category
 * PAGE, which is the other half of the same decision: that page loads only the
 * products assigned directly to its own row (fetchCategoryProducts reads
 * product_categories for one category id and never descends), so a grouping
 * parent with stocked children but no direct rows would be submitted in
 * sitemap.xml, tiled here and listed in the drawer while its own page rendered
 * "לא נמצאו מוצרים" and emitted `noindex`. That is "Submitted URL marked
 * noindex" in Search Console plus the dead-end drawer tap — precisely the two
 * symptoms this predicate was written to remove.
 *
 * It is latent rather than live today only because the ART Judaica importer
 * double-assigns every product to BOTH the leaf and the parent, so no parent
 * currently has a zero direct count. One hand-made grouping category, or one
 * importer change that stops writing the parent row, would have reintroduced
 * the bug on three surfaces at once. Matching the page is the invariant that
 * actually holds.
 */
export function listableCategories<T extends CountedCategory>(rows: T[]): T[] {
  return rows.filter((c) => isListableCategory(c.slug, directProductCount(c)));
}

/**
 * The hub's doors, grouped parent → children and ORDERED BY SHELF DEPTH.
 *
 * WHY NOT sort_order. The rows arrive `.order("sort_order").order("name")`, and
 * sort_order is not an order: measured on prod 2026-08-09 it holds 53 DISTINCT
 * values across 102 categories, i.e. it is mostly a per-row id that nobody has
 * curated. What it produced here was a 9.9-phone-screen wall in which a
 * 383-product shelf and a 1-product stub were visually identical and arbitrarily
 * interleaved — so the page answered "what does this shop have?" with noise.
 *
 * Depth is the honest ranking and it is the one the page is missing: the six
 * deepest shelves hold 2,772 of the 4,648 active products between them. The
 * count is rendered beside every door for the same reason, so the ordering is
 * legible rather than mysterious.
 *
 * TIEBREAK IS THE SLUG, not the name. Equal counts are common in the long tail,
 * and localeCompare on Hebrew names depends on the ICU data the runtime ships —
 * which is not the same in the Cloudflare Workers SSR pass and in the browser.
 * A slug is ASCII, so this ordering is byte-identical on both sides of
 * hydration, which is what keeps the rendered grid and the ItemList in head()
 * describing the same page.
 *
 * Returns EVERY listable row exactly once. A child whose parent is not itself
 * listable (its parent holds no direct products, or is hidden) is promoted to
 * its own card rather than dropped: this hub is the fallback for any occasion
 * the shop has not curated, so completeness is the property it exists for.
 * Measured 2026-08-09: 47 tops + 46 children = all 93 listable rows, 0 orphans —
 * the promotion is a guarantee, not a fix for something visible today.
 */
export function groupCategoriesByDepth<T extends CountedCategory>(
  rows: T[],
): Array<{ parent: T; children: T[] }> {
  const listed = listableCategories(rows);
  const byDepth = (a: T, b: T) =>
    directProductCount(b) - directProductCount(a) || a.slug.localeCompare(b.slug);
  const topSlugs = new Set(listed.filter((c) => !c.parent_slug).map((c) => c.slug));
  const roots = listed.filter((c) => !c.parent_slug || !topSlugs.has(c.parent_slug)).sort(byDepth);
  return roots.map((parent) => ({
    parent,
    children: listed.filter((c) => c.parent_slug === parent.slug).sort(byDepth),
  }));
}

// /categories is the only hub that links the whole category graph. Fetching it
// in a route loader (rather than only in useQuery) is what puts those links into
// the server-rendered HTML — a client-only useQuery renders an empty grid for
// every crawler that does not execute JS.
async function fetchAllCategories() {
  const { data, error } = await supabase
    .from("categories")
    // The count embed rides along on the same round-trip: this hub used to
    // render every row it got back, so nine dead-end categories were both
    // linked as tiles and named in the ItemList JSON-LD below.
    .select(`id, slug, name, description, parent_slug, sort_order, ${CATEGORY_COUNT_EMBED}`)
    // Embedded filter — see CATEGORY_COUNT_EMBED. Without it a category whose
    // products were all deactivated would still count as stocked.
    .eq("products.is_active", true)
    .order("sort_order")
    .order("name")
    // PostgREST silently caps an unbounded select at 1000 rows. 102 categories
    // today, but the bound is explicit so growth fails loudly rather than
    // quietly dropping links off the hub page.
    .range(0, 999);
  if (error) throw error;
  return data ?? [];
}

type CategoryRow = Awaited<ReturnType<typeof fetchAllCategories>>[number];

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  loader: async () => ({ categories: await fetchAllCategories() }),
  head: ({ loaderData }) => {
    const url = "https://orzadik.com/categories";
    const description =
      "כל קטגוריות תשמישי הקדושה והיודאיקה: טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות, מארזים לחתנים, סטי חלאקה ותכשיטי זהב. בחרו עולם תוכן והתחילו לקנות.";
    // Every LISTED row is a real /category/<slug> page rendered as a link on
    // this hub, so an ItemList of them is truthful. It stopped being truthful
    // once the raw table was used: four of the rows named here were URLs that
    // answer 404, so the same predicate that filters the visible grid below has
    // to filter the markup too. numberOfItems is the genuine listed count (no
    // image nodes — categories carry no image here — so the markup stays lean).
    //
    // Built from the SAME grouping function the grid renders from, and flattened
    // in the grid's own DOM order (each parent followed by its children), so
    // `position` is the position a reader actually sees. Filtering alone was not
    // enough for that once the grid stopped following the query's sort_order.
    const cats = groupCategoriesByDepth((loaderData?.categories ?? []) as CategoryRow[]).flatMap(
      (g) => [g.parent, ...g.children],
    );
    const collectionLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: "קטגוריות המוצרים | אור זרוע לצדיק",
      description,
      inLanguage: "he-IL",
      isPartOf: { "@id": "https://orzadik.com/#website" },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: cats.length,
        itemListElement: cats.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://orzadik.com/category/${c.slug}`,
          name: c.name,
        })),
      },
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "בית", item: "https://orzadik.com/" },
        { "@type": "ListItem", position: 2, name: "קטגוריות", item: url },
      ],
    };
    return {
      meta: [
        { title: "קטגוריות המוצרים | אור זרוע לצדיק" },
        { name: "description", content: description },
        { property: "og:title", content: "קטגוריות המוצרים | אור זרוע לצדיק" },
        {
          property: "og:description",
          content:
            "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות, מארזים לחתנים וסטי חלאקה — כל הקטגוריות במקום אחד.",
        },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: "קטגוריות המוצרים | אור זרוע לצדיק" },
        {
          name: "twitter:description",
          content: "כל קטגוריות תשמישי הקדושה והיודאיקה במקום אחד — בחרו עולם תוכן והתחילו לקנות.",
        },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(collectionLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
});

function CategoriesPage() {
  const { categories: initialCategories } = Route.useLoaderData();

  // Deliberately NOT the shared ["all-cats"] key. SubcategoryChips owns that
  // key with a select that has no count embed, and it fills the cache on every
  // /category/<slug> visit — the most common way in here. Sharing the key would
  // hand this page rows with no counts, listableCategories would read every one
  // as zero, and the whole grid would vanish. One extra small select is the
  // cheap side of that trade.
  const { data = [] } = useQuery({
    queryKey: ["all-cats-counted"],
    queryFn: fetchAllCategories,
    // Seed from the SSR loader so the whole category link graph is present in
    // the initial HTML instead of appearing only after hydration.
    initialData: initialCategories as CategoryRow[],
  });

  // Render one card per top-level category with its subcategories inside it.
  // A flat list would interleave the 47 parents and 46 children, which reads as
  // noise once the full supplier catalog is loaded.
  //
  // Filtered and ORDERED in one place — see groupCategoriesByDepth. Filtering
  // first, and once, is what holds parents and child chips to the same test:
  // this hub was rendering all 102 rows with no product-count filter, so a
  // shopper on the store's main browse page could tap "מוצרי חגים" or
  // "סט טלית תפילין" — headline categories for this exact store — and get a
  // 404 or an empty "לא נמצאו מוצרים" page.
  const groups = groupCategoriesByDepth(data);

  return (
    <div className="container mx-auto px-4 py-10">
      <PageHeader
        eyebrow="קטגוריות"
        title="כל תשמישי הקדושה והיודאיקה, לפי קטגוריה"
        // The last clause is the legend for the numbers, said ONCE here rather
        // than repeated as a unit beside each of the 93 doors.
        sub="טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות, פמוטים, מארזים לחתנים, סטי חלאקה ותכשיטי זהב. המספר לצד כל קטגוריה הוא מספר הפריטים שבה, והרשימה מסודרת מהגדולה לקטנה."
      />

      {/* Shop-by-occasion — Judaica is calendar- and lifecycle-driven, so surface
          the curated occasion/holiday hubs (/collection/<slug>) right under the
          header. Tasteful glass pills, gold reserved for text/accents only, RTL.
          The links are the discovery path into the config-driven collections. */}
      <section className="mb-10 md:mb-12">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span aria-hidden="true" className="gold-rule block w-8" />
          <h2 className="font-display text-lg md:text-xl text-foreground">קונים לפי אירוע</h2>
          <span aria-hidden="true" className="gold-rule block w-8" />
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {OCCASION_COLLECTIONS.map((c) => (
            // New /collection/$slug route — `to` is cast like the shared
            // Breadcrumb does, so the link does not depend on the router's
            // literal path union being regenerated before type-check.
            <Link
              key={c.slug}
              to="/collection/$slug"
              params={{ slug: c.slug }}
              className="press inline-flex min-h-[44px] items-center rounded-full bg-card/70 px-4 text-sm text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
            >
              {c.title}
            </Link>
          ))}
          {/* The proven bespoke hub — the store's real differentiator. */}
          <Link
            to="/collection/personalized"
            className="press inline-flex min-h-[44px] items-center gap-2 rounded-full bg-card/70 px-4 text-sm text-accent hairline transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
          >
            <span aria-hidden="true">✦</span>
            רקמה וחריטה אישית
          </Link>
        </div>
      </section>

      {/* Deliberately NOT .stagger here. Its keyframe ends on `transform: none`
          with `both` fill, and a filled animation applies at the animation
          origin — which outranks author declarations — so every card would be
          permanently pinned to `transform: none` and both the hover lift and
          .press would silently stop working after the reveal finished. The
          cards' ongoing interaction feedback is worth more than a one-shot
          flourish; .stagger belongs on rows that are not pressable. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map(({ parent: c, children: kids }) => {
          return (
            // .glass owns background/radius/shadow. The hover raise is a plain
            // gated transform rather than .glass-lift, because glass-lift swaps
            // the whole box-shadow and would blink the inset hairline off on
            // hover; .press already supplies the transform transition (160ms
            // ease-out) and the reduced-motion opt-out.
            <div
              key={c.id}
              className="glass press p-5 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5"
            >
              {/* The count lives INSIDE the link, so it is part of the
                  accessible name ("כיפות 743") — the only way the number means
                  anything to a screen-reader user. tabular-nums keeps the
                  column of them optically aligned down the grid. */}
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="font-medium transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                {c.name}
                <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                  {directProductCount(c)}
                </span>
              </Link>
              {c.description && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {c.description}
                </div>
              )}
              {kids.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {kids.map((k) => (
                    // Each child is a real tap target now: min-h-[44px] + px-3
                    // clears the 44px floor, and the hover pill (accent tint +
                    // accent text, pointer-gated) gives clear affordance. Only
                    // colour/background transition — never layout.
                    <Link
                      key={k.id}
                      to="/category/$slug"
                      params={{ slug: k.slug }}
                      className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm text-muted-foreground transition-[color,background-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent/10 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                    >
                      {k.name}
                      <span className="ms-1.5 text-xs opacity-70 tabular-nums">
                        {directProductCount(k)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
