import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

/**
 * Chips strip linking to a category's subcategories. When the category is a
 * leaf, it shows the parent + sibling categories instead (current highlighted)
 * so shoppers can hop sideways. Renders nothing for a top-level leaf.
 */
export function SubcategoryChips({ slug, parentSlug }: { slug: string; parentSlug: string | null }) {
  // Same queryKey + select as /categories so React Query dedupes the fetch
  // between the two pages — keep the select byte-identical to categories.tsx.
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
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`inline-block whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  c.slug === slug
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted"
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
