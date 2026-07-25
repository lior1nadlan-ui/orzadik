import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { OCCASION_COLLECTIONS } from "@/lib/collections";

// /categories is the only hub that links all 105 categories. Fetching it in a
// route loader (rather than only in useQuery) is what puts those links into the
// server-rendered HTML — a client-only useQuery renders an empty grid for every
// crawler that does not execute JS.
async function fetchAllCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description, parent_slug, sort_order")
    .order("sort_order")
    .order("name")
    // PostgREST silently caps an unbounded select at 1000 rows. 105 categories
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
      "כל קטגוריות תשמישי הקדושה והיודאיקה: טליתות ותפילין, מזוזות, גביעי קידוש, חנוכיות, פמוטים, מארזים לחתנים, סטי חלאקה ותכשיטי זהב. בחרו עולם תוכן והתחילו לקנות.";
    // Every row is a real /category/<slug> page rendered as a link on this hub,
    // so an ItemList of them is truthful. numberOfItems is the genuine category
    // count (no image nodes — categories carry no image here — so the markup
    // stays lean). Same paged loader data that fills the visible grid.
    const cats = (loaderData?.categories ?? []) as CategoryRow[];
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
        { property: "og:description", content: "טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, מארזים לחתנים וסטי חלאקה — כל הקטגוריות במקום אחד." },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: "קטגוריות המוצרים | אור זרוע לצדיק" },
        { name: "twitter:description", content: "כל קטגוריות תשמישי הקדושה והיודאיקה במקום אחד — בחרו עולם תוכן והתחילו לקנות." },
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

  const { data = [] } = useQuery({
    queryKey: ["all-cats"],
    queryFn: fetchAllCategories,
    // Seed from the SSR loader so the whole category link graph is present in
    // the initial HTML instead of appearing only after hydration.
    initialData: initialCategories as CategoryRow[],
  });

  // Render one card per top-level category with its subcategories inside it.
  // A flat list would interleave the 25 parents and 47 children alphabetically,
  // which reads as noise once the full supplier catalog is loaded.
  const tops = data.filter((c) => !c.parent_slug);
  const childrenOf = (slug: string) => data.filter((c) => c.parent_slug === slug);

  return (
    <div className="container mx-auto px-4 py-10">
      <PageHeader
        eyebrow="קטגוריות"
        title="כל תשמישי הקדושה והיודאיקה, לפי קטגוריה"
        sub="טליתות ותפילין, מזוזות, גביעי קידוש, חנוכיות, פמוטים, מארזים לחתנים, סטי חלאקה ותכשיטי זהב — בחרו עולם תוכן והתחילו לקנות."
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
              to={"/collection/$slug" as any}
              params={{ slug: c.slug } as any}
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
        {tops.map((c) => {
          const kids = childrenOf(c.slug);
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
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="font-medium transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                {c.name}
              </Link>
              {c.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</div>}
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
