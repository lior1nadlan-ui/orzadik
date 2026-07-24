import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared, reusable loading skeletons composed from the base <Skeleton>
 * primitive (components/ui/skeleton.tsx).
 *
 * House vocabulary for a placeholder pane is `rounded-2xl bg-muted hairline
 * animate-pulse` — the same one shop.tsx spells out inline. `rounded-2xl` is
 * 1rem, byte-identical to --glass-radius, so a skeleton pane and a real glass
 * tile share the exact corner. `animate-pulse` (inherited from the base) animates
 * opacity ONLY — nothing translates — so it is already correct under
 * prefers-reduced-motion; do not swap it for a moving shimmer. The base fills
 * with bg-foreground/10 and rounds with rounded-md; twMerge (via cn) lets
 * `bg-muted` and `rounded-2xl`/`rounded-full` here cleanly override both.
 *
 * SSR-safe: pure markup, no hooks, no window/document.
 */

// One tile that reserves EXACTLY the box a real <ProductCard> occupies, so
// swapping cards in for these placeholders reflows nothing. Every measurement
// below is taken from ProductCard.tsx:
//   image  → full-width aspect-square      (its image <Link> is aspect-square, full card width)
//   title  → min-h-[2.75em]                (its line-clamp-2 title floor — 2 × leading-snug)
//   price  → 1.75rem row (h-7)             (a text-lg line box)
//   button → 2.625rem pill (h-[2.625rem])  (text-sm 20px + py-2.5 20px + 1px×2 border)
// plus the caption's px-4 pt-4 pb-5 and the mt-3 / mt-4 gaps between the rows.
function ProductTileSkeleton() {
  return (
    <div className="flex flex-col">
      {/* Image — the branded pane. Full column width, so its rendered height
          equals the real card image's (also full width) → no vertical shift. */}
      <Skeleton className="aspect-square w-full rounded-2xl bg-muted hairline" />

      {/* Caption — the same paddings and inter-row gaps as ProductCard's caption. */}
      <div className="flex flex-col px-4 pt-4 pb-5">
        {/* Title: two lines floored to the real 2.75em. `text-base` pins the em
            so the floor is 44px regardless of inherited font-size. */}
        <div className="min-h-[2.75em] text-base space-y-2">
          <Skeleton className="h-4 w-full rounded-md bg-muted" />
          <Skeleton className="h-4 w-2/3 mx-auto rounded-md bg-muted" />
        </div>

        {/* Price: reserve the 1.75rem text-lg line box; the bar reads as text. */}
        <div className="mt-3 flex h-7 items-center justify-center">
          <Skeleton className="h-4 w-20 rounded-md bg-muted" />
        </div>

        {/* CTA: the full-width pill, sized to the real add-to-cart button. */}
        <Skeleton className="mt-4 h-[2.625rem] w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}

/**
 * A product-grid placeholder. Its columns are IDENTICAL to the live product
 * grid used by shop.tsx, category.$slug.tsx and favorites.tsx
 * (grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4) so real cards drop straight
 * in with zero reflow. `count` defaults to 8 (one–two rows on most widths).
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductTileSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * A single glass-card-shaped block for account / order / admin panels. The
 * min-height floor keeps a panel awaiting data at a card-sized footprint
 * instead of collapsing to a one-line sliver. Pass `className` to retune the
 * size per slot, e.g. <CardSkeleton className="min-h-[16rem]" />.
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("w-full min-h-[9rem] rounded-2xl bg-muted hairline", className)}
      aria-hidden="true"
    />
  );
}
