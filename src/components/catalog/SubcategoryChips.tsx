import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
 * Chips linking to a category's sub-shelves. When the category is a leaf, it
 * shows the parent + sibling categories instead (current highlighted) so
 * shoppers can hop sideways. Renders nothing for a top-level leaf.
 *
 * `initialCats` comes from the category route loader, so the links exist in the
 * server-rendered HTML (crawlable internal linking) instead of appearing only
 * after the client query resolves. The query itself is unchanged, so the strip
 * still refreshes on the client once the cached rows go stale.
 *
 * WHY THIS IS NO LONGER A CAROUSEL
 *
 * The strip used to be an embla `dragFree` carousel with no arrows. Measured on
 * a 390px phone at /category/kipot: 7 of the 9 chips started at a NEGATIVE x —
 * off-screen, with nothing on the page to say they existed and no arrows to
 * reach them. A horizontal scroller with no affordance is a hidden control, and
 * a hidden control is the same defect as a control that cannot change the
 * result set. Nine chips wrap into three rows; three rows are cheaper than the
 * seven links nobody could see.
 *
 * WHY THESE STAY LINKS AND NOT MULTI-SELECT BUTTONS
 *
 * Each chip is a real <a href> to the child category's own indexed page, and
 * that is the only inbound link those ~100 pages get from their parent. Turning
 * them into in-page filter buttons would have deleted that internal linking
 * outright. So the two jobs are split, and the split is the honest one:
 *   • THIS row navigates to a sub-shelf — a page with its own <h1>, its own
 *     prose, its own facets and its own URL;
 *   • the shelf sheet on /category/$slug offers the SAME sub-families as a
 *     multi-select filter (?sub=), for the case a shopper wants two of them at
 *     once — which navigation cannot express.
 *
 * `counts` (slug → number of cards on the parent shelf) is optional. When it is
 * supplied, a chip whose count is 0 is not rendered at all: an empty sub-shelf
 * is a link to a page with nothing on it. When it is absent — sibling mode,
 * where the counts belong to shelves this page never loaded — the chips render
 * bare rather than inventing a number.
 */
export function SubcategoryChips({
  slug,
  parentSlug,
  initialCats,
  counts,
  className,
}: {
  slug: string;
  parentSlug: string | null;
  initialCats?: CategoryChipRow[];
  counts?: Record<string, number>;
  className?: string;
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
  const all = siblingMode ? [...(parent ? [parent] : []), ...siblings] : children;
  // Counts are only meaningful for CHILD shelves (they are strict subsets of
  // the shelf whose cards produced the map). In sibling mode nothing is
  // dropped, because a count of "undefined" is not a count of zero.
  // Drop a child only on a count we actually HAVE. A key missing from a
  // populated map is a real zero and the chip goes; an EMPTY map is missing
  // data, and inferring "all zero" from it would delete every link on the page.
  // The caller already passes undefined in that case — this is the second lock,
  // because the failure mode is invisible in review and expensive in crawl.
  const haveCounts = !!counts && Object.keys(counts).length > 0;
  const chips = haveCounts
    ? all.filter((c) => c.slug === slug || (counts![c.slug] ?? 0) > 0)
    : all;

  if (chips.length === 0) return null;

  return (
    <div className={cn("my-4", className)}>
      <div className="text-sm text-muted-foreground mb-2">
        {siblingMode ? "קטגוריות קשורות:" : "מדפים בתוך הקטגוריה:"}
      </div>
      {/* Wrapped, not scrolled — every chip is on screen. min-h-11 is the 44px
          touch floor; the padding alone left them at 34px. */}
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const n = counts?.[c.slug];
          return (
            /* Glass chip. The hairline is an inset ring rather than a border,
               so active/inactive chips are pixel-identical in size and the row
               never reflows as you move between categories. The active state is
               an opaque ink fill (background on foreground, 16.7:1);
               /category/$slug overrides it to the semantic burgundy. */
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className={`press inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm transition-[background-color,color,box-shadow,transform] duration-150 ease-out ${
                c.slug === slug
                  ? "bg-foreground text-background"
                  : "bg-card/70 text-foreground hairline [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
              }`}
            >
              {c.name}
              {typeof n === "number" && c.slug !== slug ? (
                <span className="text-xs tabular-nums opacity-60">{n}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
