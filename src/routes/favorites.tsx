import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { useFavorites, writeFavs } from "@/components/engagement/favorites";

export const Route = createFileRoute("/favorites")({
  // Personal page, no SEO value. No loader — ids are [] on the server, this
  // is a pure client-query page.
  head: () => ({
    meta: [
      { title: "המועדפים שלי | אור זרוע לצדיק" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { ids, hydrated } = useFavorites();

  const { data: rows = [], isLoading, isSuccess } = useQuery({
    queryKey: ["favorites", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, price, sale_price, thumbnail_url, stock_status")
        .in("id", ids)
        .eq("is_active", true);
      if (error) throw error;
      const out = (data ?? []) as ProductCardData[];
      // PostgREST .in() does NOT preserve input order — re-sort so
      // newest-saved-first holds.
      out.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      return out;
    },
  });

  // Products can be deleted/deactivated — after a successful fetch, prune ids
  // that no longer resolve so the header count doesn't permanently overstate.
  // Writing through the favorites module re-syncs every mounted hook instance.
  useEffect(() => {
    if (!isSuccess || !hydrated) return;
    if (rows.length < ids.length) {
      writeFavs(ids.filter((id) => rows.some((r) => r.id === id)));
    }
  }, [isSuccess, rows, ids, hydrated]);

  const showEmpty = hydrated && ids.length === 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold">המועדפים שלי</h1>
        {!showEmpty && (
          <p className="text-sm text-muted-foreground mt-1">
            {(isSuccess ? rows.length : ids.length)} מוצרים שמורים
          </p>
        )}
      </div>

      {showEmpty ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-lg font-medium">עדיין לא שמרת מוצרים</p>
          <p className="text-sm text-muted-foreground">לחצו על הלב שעל כל מוצר כדי לשמור אותו כאן</p>
          <Link
            to="/shop"
            className="inline-block mt-2 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-semibold px-8 py-3 transition-colors"
          >
            לכל המוצרים
          </Link>
        </div>
      ) : !hydrated || isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rows.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
