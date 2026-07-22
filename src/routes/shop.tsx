import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
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

  // Fetch a page at a time rather than the whole catalog. This used to pull a
  // flat .limit(500) and slice it client-side, which capped /shop at 500 of the
  // 4,672 products and made the header report "500 מוצרים". Paging server-side
  // keeps the DOM light *and* reachable across the full catalog.
  const PAGE = 24;

  const {
    data, isLoading, isFetching, isError, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["shop-products", term],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("products")
        .select("id, slug, name, price, sale_price, thumbnail_url, stock_status", { count: "exact" })
        .eq("is_active", true);

      // Server-side (DB) search across the whole catalog — name, both
      // description fields and SKU — not just the names already loaded.
      if (term) {
        const like = `%${term}%`;
        query = query.or(
          `name.ilike.${like},description.ilike.${like},short_description.ilike.${like},sku.ilike.${like}`,
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as ProductCardData[], total: count ?? 0, next: pageParam + PAGE };
    },
    getNextPageParam: (last) => (last.next < last.total ? last.next : undefined),
  });

  const products = data?.pages.flatMap((p) => p.rows) ?? [];
  // Total across the whole result set, not just what has been loaded.
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">כל המוצרים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {term ? `${total} תוצאות עבור "${term}"` : `${total} מוצרים`}
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
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          לא נמצאו מוצרים{term ? ` עבור "${term}"` : ""}. נסו מונח חיפוש אחר.
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
            {products.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 8} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-10 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full border border-foreground/70 px-8 py-3 text-sm font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-60"
              >
                {isFetchingNextPage ? "טוען..." : `טען עוד מוצרים (${total - products.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
