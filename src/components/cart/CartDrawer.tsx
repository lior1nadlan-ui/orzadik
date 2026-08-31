import { useState, useRef, useEffect } from "react";
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
  const { items, remove, setQty, count, subtotal, shipping, grandTotal, isCartOpen, closeCart } =
    useCart();
  const navigate = useNavigate();

  // Distinct products in the cart — drives the compact cross-sell strip below.
  // Deduped so a product added in two variants doesn't skew the suggestion set.
  const productIds = Array.from(new Set(items.map((i) => i.productId)));

  // A11y: a single polite live region (rendered below, near the summary) that
  // announces cart edits to screen-reader users. A quantity change and a removal
  // both alter `count`, so the intent is captured synchronously in the click
  // handlers and consumed by the effect once the NEW totals have committed —
  // that way the announced total is always the fresh one the drawer displays
  // (no separate math to drift). SSR-safe: state/ref/effect only.
  const [announcement, setAnnouncement] = useState("");
  const pendingAnnounce = useRef<"update" | "remove" | null>(null);

  useEffect(() => {
    const action = pendingAnnounce.current;
    if (!action) return;
    pendingAnnounce.current = null;
    // Removal text carries the fresh remaining count so two consecutive removals
    // never produce the SAME string — a live region that repeats identical text is
    // dropped by most screen readers, silently swallowing the second removal.
    setAnnouncement(
      action === "remove"
        ? count > 0
          ? `הוסר מהעגלה — נותרו ${count} פריטים, סך הכל ${formatILS(grandTotal)}`
          : "העגלה רוקנה"
        : `העגלה עודכנה — ${count} פריטים, סך הכל ${formatILS(grandTotal)}`,
    );
  }, [count, grandTotal]);

  const handleSetQty = (k: string, qty: number) => {
    pendingAnnounce.current = "update";
    setQty(k, qty);
  };
  const handleRemove = (k: string) => {
    pendingAnnounce.current = "remove";
    remove(k);
  };

  const goToCheckout = () => {
    closeCart();
    navigate({ to: "/checkout" });
  };

  return (
    <Sheet
      open={isCartOpen}
      onOpenChange={(open) => {
        if (!open) closeCart();
      }}
    >
      {/* p-0 + a flex column so the item list scrolls between a fixed header and
          a pinned summary. w-96 (24rem) matches the mobile nav drawer; the base
          sm:max-w-sm cap is lifted so the cart rows have room to breathe. */}
      <SheetContent side="left" className="flex w-[88vw] flex-col gap-0 p-0 sm:w-96 sm:max-w-none">
        {/* A11y live region — the ONE polite status node for the mini-cart. Kept
            here, OUTSIDE the empty/non-empty branch below, so it stays mounted
            even as the last item is removed (a node unmounted in the same commit
            would never announce). Driven purely by cart values via the effect
            above: a quantity change reads "העגלה עודכנה — N פריטים, סך הכל ₪X",
            a removal reads "הוסר מהעגלה". Empty until the first edit, so nothing
            is announced on open. */}
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>

        {/* Header — ps-11 clears the built-in close button in the top corner. */}
        <div className="flex items-center gap-2 border-b border-glass-line ps-11 pe-5 py-5">
          <ShoppingBag className="h-5 w-5 text-accent" aria-hidden="true" />
          <SheetTitle className="font-display text-section text-foreground">העגלה שלי</SheetTitle>
          {count > 0 && (
            <span className="text-body font-semibold text-muted-foreground">({count})</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-display text-section text-foreground">העגלה ריקה</p>
            <p className="text-body text-muted-foreground">עדיין לא הוספת מוצרים לעגלה.</p>
            <Button asChild className="press mt-2">
              <Link to="/shop" onClick={closeCart}>
                התחל לקנות
              </Link>
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
                          className="line-clamp-2 text-body font-medium transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                        >
                          {item.name}
                        </Link>
                        {/* Identical hit-area expansion to /cart — see the long
                            note at src/routes/cart.tsx. Invisible ::before takes
                            24x24 (exactly the WCAG 2.5.8 floor, no margin) to
                            44x44 without moving a pixel of the visible icon;
                            8px on the start side is the gap-2, so it stops at the
                            title link and never steals a tap from it. */}
                        <button
                          onClick={() => handleRemove(k)}
                          className="press relative shrink-0 rounded-full p-1 text-muted-foreground before:absolute before:-inset-y-2.5 before:-start-2 before:-end-3 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
                          aria-label={`הסר ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {item.variantLabel && (
                        <div className="mt-0.5 text-meta text-muted-foreground">
                          גודל: {item.variantLabel}
                        </div>
                      )}
                      {item.customText && (
                        <div className="mt-0.5 text-meta text-accent">
                          ✦ {item.customMethod === "laser" ? "חריטת לייזר" : "רקמה"}:{" "}
                          {item.customText}
                        </div>
                      )}

                      {/* flex-wrap for the same reason as /cart: without
                          `overflow-hidden` the pill's automatic minimum size is
                          min-content, and the NBSP-joined currency string beside
                          it cannot shrink, so a narrow drawer would overflow
                          sideways instead of wrapping. */}
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                        {/* Same 34x26 -> 46x46 expansion as the /cart stepper, and
                            it matters MORE here: this drawer is what opens after
                            every single add-to-cart on the site. Invisible
                            ::before only — the pill stays 26px tall so the drawer
                            rows keep their density. `overflow-hidden` removed for
                            the same two reasons as on /cart (it clipped both the
                            hit areas and the buttons' :focus-visible outline);
                            rounded-s/e-full on the end buttons draws exactly what
                            the clip used to. */}
                        <div className="inline-flex items-center rounded-full hairline">
                          <button
                            onClick={() => handleSetQty(k, item.quantity - 1)}
                            className="press relative rounded-s-full px-2.5 py-1.5 before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
                            aria-label="הפחת"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-3 text-body font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleSetQty(k, item.quantity + 1)}
                            className="press relative rounded-e-full px-2.5 py-1.5 before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
                            aria-label="הוסף"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="text-body font-bold text-accent">
                          {formatILS(effective * item.quantity)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary + CTAs — pinned below the scroll area. Reconciles as
                סכום פריטים + משלוח = סך הכל, using the same flat ₪37 shipping the
                cart page and checkout charge.
                LABEL PARITY, STATED HONESTLY: this drawer and /cart now both say
                "משלוח" with the flat-rate sentence underneath, while
                src/routes/checkout.tsx:652 and src/routes/order.$id.tsx:372 still
                carry the older "משלוח (תעריף אחיד לכל הזמנה)" parenthetical. The
                NUMBER cannot drift — all four read the same getShipping() — and
                the two wordings make the same claim, but the two files above
                should be brought to this wording when their owner next touches
                them. Do not "fix" it by reverting these two: the parenthetical
                names a tariff, this one answers "does it multiply?". */}
            <div className="border-t border-glass-line px-5 py-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-body">
                  <span className="text-muted-foreground">סכום פריטים</span>
                  <span className="whitespace-nowrap">{formatILS(subtotal)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-muted-foreground">משלוח</span>
                  <span className="whitespace-nowrap">{formatILS(shipping)}</span>
                </div>
                {/* Same sentence, same reasoning, same wording as the /cart
                    summary — the drawer is the surface most shoppers will see
                    this number on, because it opens on every add-to-cart. One
                    flat charge per ORDER is the shop's only basket mechanic and
                    it is true; there is no threshold to progress toward, so
                    nothing here counts down or fills up. */}
                {shipping > 0 && (
                  <p className="text-micro text-muted-foreground">
                    תעריף אחיד לכל ההזמנה, לא לפריט. הוספת עוד פריט לא מגדילה אותו.
                  </p>
                )}
              </div>
              <div aria-hidden="true" className="gold-rule my-3" />
              {/* --text-total, the reserved figure step. Same treatment as the
                  /cart summary so the two surfaces present the same number the
                  same way. */}
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <span className="text-body font-bold">סך הכל</span>
                <span className="whitespace-nowrap text-total font-bold text-accent">
                  {formatILS(grandTotal)}
                </span>
              </div>

              {/* The two free gift affordances — see the long note at the same
                  spot in src/routes/cart.tsx. Compact here: one capability line
                  and one sentence, no panel, because this block sits directly
                  above the checkout CTA in a 384px drawer and the density budget
                  is the thing keeping this direction from reading as a wholesale
                  catalogue. */}
              <div className="mb-3 text-start">
                <p className="text-meta font-semibold text-foreground">
                  <span className="text-accent" aria-hidden="true">
                    ✦
                  </span>{" "}
                  עטיפה והקדשה אישית - ללא עלות
                </p>
                <p className="mt-0.5 text-micro leading-relaxed text-muted-foreground">
                  אפשר לבחור בשלב התשלום. אינן משפיעות על סכום ההזמנה.
                </p>
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
              <div className="mt-2 flex items-center justify-between text-body">
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
