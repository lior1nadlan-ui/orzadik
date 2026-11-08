import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_COUNT_EMBED, listableCategories } from "@/routes/categories";
import { NAV_DEPARTMENTS, pruneEmptyNav, type NavDepartment } from "@/lib/nav-taxonomy";

type CountedCategory = {
  id: string;
  slug: string;
  name: string;
  // parent_slug and the count embed are fetched only so listableCategories()
  // can do its job; neither is rendered.
  parent_slug: string | null;
  products?: { count: number }[] | null;
};

/**
 * The category map (src/lib/nav-taxonomy.ts) with its empty shelves removed.
 *
 * The map itself is static, so it is in the server HTML and never reflows. The
 * live list of categories that hold active products only REMOVES entries (via
 * pruneEmptyNav), so a shelf that empties out cannot become a dead end.
 * listableCategories() is the same predicate the category pages and the sitemap
 * use, so nothing offered here answers "לא נמצאו מוצרים".
 *
 * Shared by the header menus and the homepage squares: one query, one cache
 * entry, so the two can never disagree about which shelves exist.
 */
export function useNavDepartments(): NavDepartment[] {
  const { data: listableSlugs } = useQuery({
    queryKey: ["header-category-slugs"],
    // Effectively static across a session: it changes only when the owner edits
    // the catalog. A generous staleTime (10m) plus a long gcTime keeps the nav
    // out of the refetch path between pages.
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select(`id, slug, name, parent_slug, ${CATEGORY_COUNT_EMBED}`)
        .eq("products.is_active", true);
      if (error) throw error;
      return listableCategories((data ?? []) as CountedCategory[]).map((c) => c.slug);
    },
  });
  return useMemo(
    () => pruneEmptyNav(NAV_DEPARTMENTS, listableSlugs ? new Set(listableSlugs) : undefined),
    [listableSlugs],
  );
}
