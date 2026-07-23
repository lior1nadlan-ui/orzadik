import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

/**
 * One row of the shared ["all-cats"] cache. Kept in sync with the select below
 * (and with /categories, which reads the same key).
 */
export type CategoryChipRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_slug: string | null;
  sort_order: number;
};

/**
 * Chips strip linking to a category's subcategories. When the category is a
 * leaf, it shows the parent + sibling categories instead (current highlighted)
 * so shoppers can hop sideways. Renders nothing for a top-level leaf.
 *
 * `initialCats` comes from the category route loader, so the links exist in the
 * server-rendered HTML (crawlable internal linking) instead of appearing only
 * after the client query resolves. The query itself is unchanged, so the strip
 * still refreshes on the client once the cached rows go stale.
 */
export function SubcategoryChips({
  slug,
  parentSlug,
  initialCats,
}: {
  slug: string;
  parentSlug: string | null;
  initialCats?: CategoryChipRow[];
}) {
  // Same queryKey + select as /categories so React Query dedupes the fetch
  // between the two pages — keep the select byte-identical to categories.tsx.
  // 105 categories sit far below the 1000-row PostgREST cap, and this stays a
  // single small select; do not widen it into a paged full-table read.
  const { data = [] } = useQuery({
    queryKey: ["all-cats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, description, parent_slug, sort_order")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data;
    },
    initialData: initialCats?.length ? (initialCats as CategoryChipRow[]) : undefined,
  });

  const children = data.filter((c) => c.parent_slug === slug);
  const siblingMode = children.length === 0 && !!parentSlug;
  const parent = siblingMode ? data.find((c) => c.slug === parentSlug) : undefined;
  const siblings = siblingMode ? data.filter((c) => c.parent_slug === parentSlug) : [];
  const chips = siblingMode ? [...(parent ? [parent] : []), ...siblings] : children;

  if (chips.length === 0) return null;

  return (
    <div className="my-4">
      <div className="text-sm text-muted-foreground mb-2">
        {siblingMode ? "קטגוריות קשורות:" : "סינון לפי תת-קטגוריה:"}
      </div>
      {/* dragFree chips swipe naturally — no Prev/Next arrows needed */}
      <Carousel dir="rtl" opts={{ direction: "rtl", dragFree: true, align: "start" }}>
        <CarouselContent>
          {chips.map((c) => (
            <CarouselItem key={c.id} className="basis-auto">
              {/* Glass chip. The hairline is an inset ring rather than a border,
                  so active/inactive chips are pixel-identical in size and the
                  strip never reflows as you move between categories. The active
                  state is an opaque ink fill (background on foreground, 16.7:1);
                  /category/$slug overrides it to the semantic burgundy. */}
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`press inline-block whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-[background-color,color,box-shadow,transform] duration-150 ease-out ${
                  c.slug === slug
                    ? "bg-foreground text-background"
                    : "bg-card/70 text-foreground hairline [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
                }`}
              >
                {c.name}
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
