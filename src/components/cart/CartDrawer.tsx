import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CartCrossSell } from "@/components/cart/CartCrossSell";
import { useCart, formatILS, getEffectivePrice, lineKey } from "@/lib/cart";

// -----------------------------------------------------------------------------
// Mini-cart drawer — the persistent confirmation that replaces the transient
// "added to cart" toast. It opens automatically after any successful add()
// (openCart() is fired centrally inside the cart context) and gives the shopper
// a running subtotal plus a one-tap path to checkout — closing the drop between
// add_to_cart and begin_checkout.
//
// It is a THIN reflection of what is already in the cart: no scarcity, urgency,
// discount or invented data. Prices come straight from the same pricing helpers
// the /cart page and checkout use (getEffectivePrice + the context `shipping`,
// which is the flat ₪37 from getShipping), so the numbers can never disagree.
//
// RTL: the cart icon lives on the inline-end (visual left) of the header, so the
// drawer slides in from the left to sit under it — mirroring the mobile nav
// drawer, which opens from the right under the hamburger.
//
// Rendered ONCE site-wide (from SiteHeader). SSR-safe: it reads only cart state
// and touches window/navigation exclusively inside handlers.
// -----------------------------------------------------------------------------
export function CartDrawer() {
  const { items, remove, setQty, count, subtotal, shipping, grandTotal, isCartOpen, closeCart } = useCart();
  const navigate = useNavigate();

  // Distinct products in the cart — drives the compact cross-sell strip below.
  // Deduped so a product added in two variants doesn't skew the suggestion set.
  const productIds = Array.from(new Set(items.map((i) => i.productId)));

  const goToCheckout = () => {
    closeCart();
    navigate({ to: "/checkout" });
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => { if (!open) closeCart(); }}>
      {/* p-0 + a flex column so the item list scrolls between a fixed header and
          a pinned summary. w-96 (24rem) matches the mobile nav drawer; the base
          sm:max-w-sm cap is lifted so the cart rows have room to breathe. */}
      <SheetContent
        side="left"
        className="flex w-[88vw] flex-col gap-0 p-0 sm:w-96 sm:max-w-none"
      >
        {/* Header — ps-11 clears the built-in close button in the top corner. */}
        <div className="flex items-center gap-2 border-b border-glass-line ps-11 pe-5 py-5">
          <ShoppingBag className="h-5 w-5 text-accent" aria-hidden="true" />
          <SheetTitle className="font-display text-lg text-foreground">העגלה שלי</SheetTitle>
          {count > 0 && (
            <span className="text-sm font-semibold text-muted-foreground">({count})</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-display text-lg text-foreground">העגלה ריקה</p>
            <p className="text-sm text-muted-foreground">עדיין לא הוספת מוצרים לעגלה.</p>
            <Button asChild className="press mt-2">
              <Link to="/shop" onClick={closeCart}>התחל לקנות</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Item list — scrolls; min-h-0 lets it shrink inside the flex column
                so the summary below stays pinned. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {items.map((item) => {
                const effective = getEffectivePrice(item.price);
                const k = lineKey(item);
                return (
                  <div key={k} className="flex gap-3 border-b border-glass-line py-4 last:border-0">
                    <Link
                      to="/product/$slug"
                      params={{ slug: item.slug }}
                      onClick={closeCart}
                      className="shrink-0"
                      aria-label={item.name}
                    >
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="h-16 w-16 rounded-xl object-cover ring-1 ring-glass-line"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-muted ring-1 ring-glass-line" />
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/product/$slug"
                          params={{ slug: item.slug }}
                          onClick={closeCart}
                          className="line-clamp-2 text-sm font-medium transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                        >
                          {item.name}
                        </Link>
                        <button
                          onClick={() => remove(k)}
                          className="press shrink-0 rounded-full p-1 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
                          aria-label={`הסר ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {item.variantLabel && (
                        <div className="mt-0.5 text-xs text-muted-foreground">גודל: {item.variantLabel}</div>
                      )}
                      {item.customText && (
                        <div className="mt-0.5 text-xs text-accent">
                          ✦ {item.customMethod === "laser" ? "חריטת לייזר" : "רקמה"}: {item.customText}
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <div className="inline-flex items-center overflow-hidden rounded-full hairline">
                          <button
                            onClick={() => setQty(k, item.quantity - 1)}
                            className="press px-2.5 py-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
                            aria-label="הפחת"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-3 text-sm font-medium tabular-nums">{item.quantity}</span>
                          <button
                            onClick={() => setQty(k, item.quantity + 1)}
                            className="press px-2.5 py-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
                            aria-label="הוסף"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="text-sm font-bold text-accent">{formatILS(effective * item.quantity)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary + CTAs — pinned below the scroll area. Reconciles as
                סכום פריטים + משלוח = סך הכל, using the same flat ₪37 shipping the
                cart page and checkout charge. The label matches the cart and
                checkout summaries so the wording can't drift between surfaces. */}
            <div className="border-t border-glass-line px-5 py-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">סכום פריטים</span>
                  <span className="whitespace-nowrap">{formatILS(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">משלוח (תעריף אחיד לכל הזמנה)</span>
                  <span className="whitespace-nowrap">{formatILS(shipping)}</span>
                </div>
              </div>
              <div aria-hidden="true" className="gold-rule my-3" />
              <div className="mb-4 flex justify-between text-base">
                <span className="font-bold">סך הכל</span>
                <span className="whitespace-nowrap font-bold text-accent">{formatILS(grandTotal)}</span>
              </div>

              {/* Compact "complete the purchase" strip — genuine companions to
                  what's in the cart, sitting between the total and the checkout
                  CTA so peak-intent shoppers see them. Renders nothing when
                  there are no real complements, so the CTA never gets pushed
                  down for an empty rail. */}
              <CartCrossSell productIds={productIds} variant="compact" onNavigate={closeCart} />

              <Button className="press w-full" size="lg" onClick={goToCheckout}>
                מעבר לתשלום
              </Button>
              <div className="mt-2 flex items-center justify-between text-sm">
                <Link
                  to="/cart"
                  onClick={closeCart}
                  className="text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  צפייה בעגלה המלאה
                </Link>
                <button
                  onClick={closeCart}
                  className="text-muted-foreground transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                >
                  המשך בקנייה
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
