import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type BreadcrumbItemData = {
  label: string;
  to?: string;
  params?: Record<string, string>;
};

// Shared hover treatment for every crumb link — mirrors the hand-rolled trails
// that previously lived inline in product.$slug / category.$slug: a color-only
// transition (never `transition-colors`, which would also animate bg/border)
// and a pointer-gated hover to --accent so touch devices never get a sticky
// hover state. Passed to BreadcrumbLink so cn()/twMerge overrides the
// primitive's default `hover:text-foreground` in one place.
// `inline-block py-1.5 -my-1.5` for the same reason as the footer links: the
// crumbs run at text-xs, so "בית" measured 16px tall on a phone — the smallest
// remaining touch target on the site, and the one a shopper reaches for to get
// back out of a category. The padding grows the hit area to ~28px; the matching
// negative margin returns those pixels to the layout box, so the trail keeps its
// height and its baseline alignment with the separators beside it.
const LINK_CLS =
  "inline-block py-1.5 -my-1.5 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent";

/**
 * RTL-correct breadcrumb trail built on the shadcn breadcrumb primitives.
 *
 * The caller passes the full trail INCLUDING Home ("בית", to "/") as items[0].
 * Every item with a `to` renders as a client-side TanStack Link (with optional
 * `params` for /category/$slug and /product/$slug); the last item is always the
 * current page (BreadcrumbPage, no link). SSR-safe — pure render, no
 * window/document at module or render scope.
 *
 * This is the VISIBLE trail only. The routes keep emitting their own
 * BreadcrumbList JSON-LD from `head()`, so this component intentionally emits
 * no structured data (no itemProp / itemScope) — duplicating it here would give
 * crawlers two competing BreadcrumbList graphs for one page.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItemData[] }) {
  return (
    <BreadcrumbRoot aria-label="ניווט מיקום באתר">
      <BreadcrumbList className="text-xs md:text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && (
                // Plain "/" separator — matches the previous trails and reads
                // correctly in RTL (a slash is direction-neutral, so there is no
                // chevron to flip). BreadcrumbSeparator already sets
                // role="presentation" + aria-hidden.
                <BreadcrumbSeparator className="text-muted-foreground/40">/</BreadcrumbSeparator>
              )}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-medium truncate max-w-[200px]">
                    {item.label}
                  </BreadcrumbPage>
                ) : item.to ? (
                  <BreadcrumbLink asChild className={LINK_CLS}>
                    {/* `to`/`params` are cast: the items array carries plain
                        strings, not the router's literal route-path union. The
                        param shape ({ slug }) is validated by the route at
                        runtime. */}
                    <Link to={item.to as any} params={item.params as any}>
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{item.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  );
}
