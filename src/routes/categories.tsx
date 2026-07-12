import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
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
  const { data = [] } = useQuery({
    queryKey: ["all-cats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, description")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-6">קטגוריות</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.map((c) => (
          <Link
            key={c.id}
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="rounded-lg border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:border-accent hover:shadow-[var(--shadow-soft)]"
          >
            <div className="font-medium">{c.name}</div>
            {c.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
