import { Link } from "@tanstack/react-router";
import { ProductThumb } from "@/components/ProductThumb";
import { formatILS, getEffectivePrice } from "@/lib/cart";
import { useCrossSellSuggestions } from "@/components/cart/cross-sell-query";

/**
 * The mini-cart's "מומלץ להשלמה" strip — the compact sibling of CartCrossSell.
 * A separate component, not a variant prop, because the drawer is in the main
 * bundle: importing CartCrossSell here pulled the whole carousel (embla, ~19 KB
 * minified) onto every page for a strip that never renders one.
 */
export function CartCrossSellCompact({
  productIds,
  onNavigate,
}: {
  productIds: string[];
  /** Fired when a suggestion is tapped — lets the drawer close itself. */
  onNavigate?: () => void;
}) {
  const suggestions = useCrossSellSuggestions(productIds);
  if (suggestions.length < 3) return null;

  // Compact strip for the mini-cart drawer: a 3-up row of small tiles that link
  // to the product page (the drawer stays the checkout surface — we don't add to
  // cart from here). Sits between the order total and the checkout button.
  return (
    <div className="mt-4 border-t border-glass-line pt-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">מומלץ להשלמה</p>
      <div className="grid grid-cols-3 gap-2">
        {suggestions.slice(0, 3).map((p) => {
          const effective = getEffectivePrice(p.price);
          return (
            <Link
              key={p.id}
              to="/product/$slug"
              params={{ slug: p.slug }}
              onClick={onNavigate}
              className="group/cs block text-center"
              aria-label={p.name}
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-glass-line">
                <ProductThumb
                  url={p.thumbnail_url}
                  alt={p.name}
                  width={200}
                  className="h-full w-full object-cover transition-[transform,scale] duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/cs:scale-105"
                />
              </div>
              <div className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-foreground transition-colors duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover/cs:text-accent">
                {p.name}
              </div>
              {effective > 0 && (
                <div className="text-xs font-bold text-accent">{formatILS(effective)}</div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
