import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  head: () => ({
    meta: [
      { title: "קטגוריות המוצרים | אור זרוע לצדיק" },
      { name: "description", content: "כל קטגוריות תשמישי הקדושה והיודאיקה: טליתות ותפילין, מזוזות, גביעי קידוש, חנוכיות, פמוטים, מארזים לחתנים, סטי חלאקה ותכשיטי זהב. בחרו עולם תוכן והתחילו לקנות." },
      { property: "og:title", content: "קטגוריות המוצרים | אור זרוע לצדיק" },
      { property: "og:description", content: "טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, מארזים לחתנים וסטי חלאקה — כל הקטגוריות במקום אחד." },
      { property: "og:url", content: "https://orzadik.com/categories" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "קטגוריות המוצרים | אור זרוע לצדיק" },
      { name: "twitter:description", content: "כל קטגוריות תשמישי הקדושה והיודאיקה במקום אחד — בחרו עולם תוכן והתחילו לקנות." },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/categories" }],
  }),
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
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-6">קטגוריות</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tops.map((c) => {
          const kids = childrenOf(c.slug);
          return (
            <div
              key={c.id}
              className="rounded-lg border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:border-accent hover:shadow-[var(--shadow-soft)]"
            >
              <Link to="/category/$slug" params={{ slug: c.slug }} className="font-medium hover:text-accent transition-colors">
                {c.name}
              </Link>
              {c.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</div>}
              {kids.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {kids.map((k) => (
                    <Link
                      key={k.id}
                      to="/category/$slug"
                      params={{ slug: k.slug }}
                      className="text-xs text-muted-foreground hover:text-accent transition-colors"
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
