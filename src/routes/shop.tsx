import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({
    meta: [
      { title: "כל המוצרים | אור זרוע לצדיק" },
      { name: "description", content: "כל מוצרי תשמישי הקדושה והיודאיקה של אור זרוע לצדיק — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, פמוטים ומארזים לחתנים. כשרות מהודרת ומשלוח עד הבית." },
      { property: "og:title", content: "כל המוצרים | אור זרוע לצדיק" },
      { property: "og:description", content: "טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות ומארזים לחתנים — כל המוצרים במקום אחד." },
      { property: "og:url", content: "https://orzadik.com/shop" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "כל המוצרים | אור זרוע לצדיק" },
      { name: "twitter:description", content: "כל מוצרי תשמישי הקדושה והיודאיקה במקום אחד." },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/shop" }],
  }),
});

// Escape PostgREST `.or()` reserved characters in user input so a search term
// can never inject additional filter clauses.
function sanitizeTerm(raw: string): string {
  return raw.replace(/[,()%\\]/g, " ").replace(/\s+/g, " ").trim();
}

function ShopPage() {
  const { q: qFromUrl } = Route.useSearch();
  const [q, setQ] = useState(qFromUrl || "");
  const [debouncedQ, setDebouncedQ] = useState(qFromUrl || "");
  useEffect(() => { setQ(qFromUrl || ""); }, [qFromUrl]);

  // Debounce keystrokes so we hit the DB at most a few times per search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const term = sanitizeTerm(debouncedQ);

  const { data = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["shop-products", term],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, slug, name, price, sale_price, thumbnail_url, stock_status")
        .eq("is_active", true);

      // Server-side (DB) search across the whole catalog — name, both
      // description fields and SKU — not just the names already loaded.
      if (term) {
        const like = `%${term}%`;
        query = query.or(
          `name.ilike.${like},description.ilike.${like},short_description.ilike.${like},sku.ilike.${like}`,
        );
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as ProductCardData[];
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">כל המוצרים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {term ? `${data.length} תוצאות עבור "${term}"` : `${data.length} מוצרים`}
          </p>
        </div>
        <Input
          placeholder="חיפוש מוצר..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-muted-foreground">אירעה שגיאה בטעינת המוצרים. בדקו את החיבור ונסו שוב.</p>
          <button onClick={() => refetch()} className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors">
            נסו שוב
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          לא נמצאו מוצרים{term ? ` עבור "${term}"` : ""}. נסו מונח חיפוש אחר.
        </div>
      ) : (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {data.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
