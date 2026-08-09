import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatILS,
  useCart,
  getEffectivePrice,
  applyMemberDiscount,
  getShipping,
  lineKey,
  type CartItem,
} from "@/lib/cart";
import { useCartRevalidation, isBlocking, noticeText } from "@/lib/cart-revalidation";
import { trackViewCart } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { EmptyCartSuggestions } from "@/components/cart/EmptyCartSuggestions";
import { CartCrossSell } from "@/components/cart/CartCrossSell";
import { TrustBadges, instalmentsLine } from "@/components/cart/TrustBadges";
import { Trash2, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "העגלה שלי" }, { name: "robots", content: "noindex, nofollow" }] }),
});

// Cart revalidation — the CartSnapshot / LineCheck types, evaluateLine,
// noticeText, isBlocking, and the useCartRevalidation hook — now lives in
// src/lib/cart-revalidation.ts, shared with /checkout so the two surfaces
// can never diverge from placeOrder()'s authoritative per-line validation.

function CartPage() {
  const { items, remove, setQty } = useCart();
  const { user } = useAuth();

  // Same authoritative flag the server prices on (profiles.is_member, read by
  // placeOrder() in src/lib/checkout.functions.ts). Assuming "signed in ⇒ member"
  // quoted a total lower than the customer is actually charged.
  const { data: memberProfile } = useQuery({
    queryKey: ["cart-membership", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_member")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Client-side price/stock revalidation (shared with /checkout). Empty during
  // SSR and on any read failure, so the page behaves exactly as it did before —
  // a flaky read must never stand between a shopper and checkout. productIds is
  // reused below for the cross-sell strip.
  const { productIds, checks, blockedCount, repricedCount } = useCartRevalidation(items);

  // GA4 view_cart once the cart contents are known. Keyed on item count so it
  // fires on a real cart, not on the empty first paint. no-ops on SSR.
  useEffect(() => {
    if (items.length === 0) return;
    trackViewCart(
      items.map((i) => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Unknown (anonymous, or still loading) ⇒ no benefit, so the quote is never
  // lower than the charge.
  const isMember = !!memberProfile?.is_member;
  // The charged price of a line: the revalidated one once known, the stored one
  // until then.
  const linePrice = (item: CartItem) => {
    const c = checks.get(lineKey(item));
    return c?.kind === "price" ? c.current : getEffectivePrice(item.price);
  };
  // Exactly the sum of the per-line amounts rendered in the cart rows below —
  // minus the lines placeOrder() would reject, which cannot be part of any
  // amount the customer could be charged.
  const itemsTotal = items.reduce((s, i) => {
    const c = checks.get(lineKey(i));
    if (c && isBlocking(c)) return s;
    return s + linePrice(i) * i.quantity;
  }, 0);
  const memberSubtotal = applyMemberDiscount(itemsTotal, isMember);
  const memberBenefit = itemsTotal - memberSubtotal;
  // Same helper, same input as the server (`subtotal > 0 ? SHIPPING_FLAT : 0`
  // on the post-member subtotal), so a cart with nothing orderable in it does
  // not quote a shipping fee for an order that cannot be placed.
  const shipping = getShipping(memberSubtotal);
  const finalTotal = memberSubtotal + shipping;
  // Nothing in this cart can actually be ordered: every line is one placeOrder()
  // would reject, so itemsTotal — and with it משלוח and סך הכל — collapses to 0.
  // Printing "סך הכל ₪0" above a cart that visibly holds products quotes a price
  // that is not on offer, and reads as "free". The summary numbers are withheld
  // instead. Like the CTA below, this needs a POSITIVE, resolved answer:
  // blockedCount is 0 while the check is loading and if it failed, so the
  // fail-open path renders the ordinary summary exactly as before.
  const nothingOrderable = blockedCount > 0 && itemsTotal === 0;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20">
        {/* Glass panel over the light ground — the empty state is a surface, not
            a hole in the page. */}
        <div className="glass mx-auto max-w-lg px-6 py-14 text-center">
          <h1 className="font-display text-page font-bold mb-3">העגלה ריקה</h1>
          <p className="text-muted-foreground mb-6">לא הוספת עדיין מוצרים לעגלה.</p>
          <Button asChild className="press">
            <Link to="/shop">התחל לקנות</Link>
          </Button>
        </div>
        <EmptyCartSuggestions />
      </div>
    );
  }

  return (
    // Three grid children, in the order they must be read on a phone (one
    // column below `lg`): cart lines → summary + CTA → cross-sell. The
    // suggestions used to live inside the lines column, pushing "מעבר לתשלום"
    // up to 8 products down the page. No `order` classes needed — this DOM
    // order also produces the unchanged desktop layout: lines and summary share
    // the first row, the cross-sell wraps to the row beneath them.
    <div className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
      {/* min-w-0: a grid item defaults to min-width:auto, so the cross-sell
          carousel's intrinsic track width (3000px+ of slides) would push this
          column — and the whole page — wider than the viewport, causing
          horizontal scroll on mobile. min-w-0 lets the column shrink so the
          carousel's own overflow-hidden clip does its job. */}
      <div className="lg:col-span-2 space-y-3 min-w-0">
        {/* The named scale, not a twelfth arbitrary size: --text-page is THE h1
            step (28px). See the type-scale block in src/styles.css. */}
        <h1 className="font-display text-page font-bold mb-4">העגלה שלי</h1>
        {items.map((item) => {
          const k = lineKey(item);
          const check = checks.get(k);
          const blocked = !!check && isBlocking(check);
          const effective = linePrice(item);
          return (
            <div key={k} className="flex gap-3 sm:gap-4 glass p-3 sm:p-4">
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover flex-shrink-0 ring-1 ring-glass-line"
                />
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/product/$slug"
                    params={{ slug: item.slug }}
                    className="font-medium line-clamp-2 text-sm sm:text-base transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
                  >
                    {item.name}
                  </Link>
                  {/* The touch target is grown by an INVISIBLE ::before, not by
                      padding: the icon, the row rhythm and the gap to the title
                      stay pixel-identical, while the hit box goes 24x24 -> 44x44
                      (WCAG 2.5.5 / Apple HIG). 24x24 sat exactly on the 2.5.8
                      floor with zero margin, and a missed tap on it landed on the
                      product link and navigated the shopper out of the cart.
                      The reach is deliberately asymmetric: 8px on the start side
                      is exactly the gap-2 to the title, so it stops at that link's
                      edge and never steals a tap meant for the product; 12px on
                      the end side spends the card's own p-3 padding. */}
                  <button
                    onClick={() => remove(k)}
                    className="press relative flex-shrink-0 rounded-full p-1 text-muted-foreground before:absolute before:-inset-y-2.5 before:-start-2 before:-end-3 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
                    aria-label={`הסר ${item.name} מהעגלה`}
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>

                {item.variantLabel && (
                  <div className="text-xs text-muted-foreground mt-1">גודל: {item.variantLabel}</div>
                )}

                {item.customText && (
                  <div className="text-xs text-accent mt-1">
                    ✦ {item.customMethod === "laser" ? "חריטת לייזר" : "רקמה"}: {item.customText}
                  </div>
                )}

                <div className="text-xs sm:text-sm mt-1 flex items-baseline gap-2">
                  {/* A line that cannot be ordered is left out of the summary,
                      so its price stops being presented as money to be paid. */}
                  <span
                    className={cn(
                      "font-semibold",
                      blocked ? "text-muted-foreground" : "text-accent",
                    )}
                  >
                    {formatILS(effective)}
                  </span>
                </div>

                {/* Revalidation notice — appears only once the check resolves and
                    only for the lines it actually found a difference on. */}
                {check && (
                  <div className="mt-2 rounded-xl bg-secondary/70 hairline px-3 py-2 text-meta leading-relaxed text-foreground">
                    <p>{noticeText(check, item)}</p>
                    {blocked && (
                      // The other remove control, and the smallest thing on the
                      // page at 60x20. Same invisible ::before treatment, sized
                      // to the room it actually has: 12px up (6px of margin, then
                      // only the paragraph's leading — nothing tappable) and 6px
                      // down, which stays inside the notice's own py-2 and so
                      // never reaches the stepper's expanded area below. 76x38
                      // is past the 24x24 floor of WCAG 2.5.8 with real margin.
                      <button
                        onClick={() => remove(k)}
                        className="press relative mt-1.5 font-semibold text-accent underline underline-offset-2 before:absolute before:-inset-x-2 before:-top-3 before:-bottom-1.5 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                      >
                        הסר מהעגלה
                      </button>
                    )}
                  </div>
                )}

                {/* flex-wrap: dropping `overflow-hidden` from the stepper pill
                    below (needed so the expanded hit areas are not clipped) also
                    changed its automatic minimum size from 0 to min-content —
                    per CSS Flexbox 4.5, a flex item stops being a scroll
                    container and `min-width: auto` no longer resolves to 0. The
                    price beside it cannot absorb the squeeze either, because
                    Intl.NumberFormat emits one unbreakable NBSP-joined token. So
                    at very narrow widths this row could no longer shrink and
                    would push the page sideways — the same horizontal-overflow
                    failure the `min-w-0` note earlier in this file exists to
                    prevent. Wrapping lets the price drop to its own line
                    instead. */}
                <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-2">
                  {/* Quantity stepper. The two buttons measured 34x26 — 59% of the
                      44x44 the design system hits everywhere else (the CTAs on
                      this very page are 271x44) — on the one control a shopper
                      touches right before paying. Each one now carries an
                      invisible 46x46 ::before, so the visible pill, the icons and
                      the desktop density are untouched and only the touch box
                      grows: 10px on each vertical edge (26 -> 46) and 6px on each
                      horizontal edge (34 -> 46). 6px inward leaves ~20px of the
                      quantity span uncovered, so tapping the NUMBER still does
                      nothing rather than silently stepping the count.

                      `overflow-hidden` had to go: it clipped those hit areas, and
                      it was already clipping the global :focus-visible outline
                      (2px at 2px offset, styles.css) of both buttons — an outline
                      is clipped by an overflow ancestor like any other paint. The
                      logical rounded-s/e-full on the end buttons reproduces
                      exactly what the clip drew, since a rounded-full pill and a
                      full-rounded child both clamp to half the same height. */}
                  <div className="inline-flex items-center rounded-full hairline">
                    <button onClick={() => setQty(k, item.quantity - 1)} className="press relative rounded-s-full px-2.5 py-1.5 before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary" aria-label={`הפחת כמות ${item.name}`}>
                      <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <span className="px-3 text-sm font-medium tabular-nums">{item.quantity}</span>
                    <button onClick={() => setQty(k, item.quantity + 1)} className="press relative rounded-e-full px-2.5 py-1.5 before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary" aria-label={`הוסף כמות ${item.name}`}>
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                  <div
                    className={cn(
                      "font-bold text-sm sm:text-base",
                      blocked ? "text-muted-foreground" : "text-accent",
                    )}
                  >
                    {formatILS(effective * item.quantity)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Sticky only from lg: on a phone the cross-sell now follows this block,
          and a pinned summary would scroll over it. */}
      {/* `glass-strong` (94% white + blur), not `glass`: this panel pins to the
          viewport and scrolls over unknown content, and it carries live prices. */}
      <div className="glass-strong p-6 h-fit lg:sticky lg:top-20">
        <h2 className="font-display text-section font-bold mb-4">סיכום הזמנה</h2>
        {nothingOrderable ? (
          // No numbers at all here — a summary of an order that cannot be placed
          // would be three zeros over a cart full of products. The per-line
          // notices above say what happened to each item; this says what it adds
          // up to, without naming a sum.
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            אין כרגע פריטים שניתן להזמין בעגלה.
          </p>
        ) : (
          <>
            {/* Every component of the amount that will be charged, so the column
                reconciles: סכום פריטים (− הטבת מועדון) + משלוח = סך הכל. */}
            <div className="space-y-2">
              <div className="flex justify-between text-body">
                <span className="text-muted-foreground">סכום פריטים</span>
                <span className="whitespace-nowrap">{formatILS(itemsTotal)}</span>
              </div>
              {memberBenefit > 0 && (
                <div className="flex justify-between text-body">
                  <span className="text-muted-foreground">הטבת מועדון</span>
                  <span className="whitespace-nowrap">{formatILS(-memberBenefit)}</span>
                </div>
              )}
              <div className="flex justify-between text-body">
                <span className="text-muted-foreground">משלוח</span>
                <span className="whitespace-nowrap">{formatILS(shipping)}</span>
              </div>
              {/* THE FLAT FEE, SAID AS ARITHMETIC. It was a parenthetical inside
                  the label ("תעריף אחיד לכל הזמנה"), which reads as a tariff
                  name and answers nothing. The question a shopper actually has
                  in front of a shipping line is "does this multiply?" — and the
                  answer here is the shop's single basket mechanic: one flat
                  charge per ORDER, whatever is in it. It is also the ONLY basket
                  mechanic there is. There is no threshold to progress toward
                  (FREE_SHIPPING_THRESHOLD is Infinity in src/lib/pricing.ts), so
                  there is deliberately no progress bar, no "add ₪X more", and no
                  countdown anywhere near this number.
                  Rendered only when a fee is actually charged — getShipping()
                  returns 0 for an empty/unorderable subtotal, and a sentence
                  about a flat rate under "₪0" would be describing nothing. */}
              {shipping > 0 && (
                <p className="text-micro text-muted-foreground">
                  תעריף אחיד לכל ההזמנה, לא לפריט. הוספת עוד פריט לא מגדילה אותו.
                </p>
              )}
            </div>
            <p className="text-meta text-muted-foreground mt-2 mb-3">
              זמן אספקה משוער: 3-14 ימי עסקים
            </p>
            {/* "אפשר בתשלומים?" answered where the amount is, not three
                scrolls away in the trust list — and only when the owner has
                confirmed what the terminal clears (instalmentsLine returns null
                otherwise). Same literal that reaches CardCom's
                AdvancedDefinition. */}
            {instalmentsLine() && (
              <p className="-mt-2 mb-3 text-meta text-accent">{instalmentsLine()}</p>
            )}
            {/* Decorative gold hairline — the rule is a gradient image, never text. */}
            <div className="gold-rule my-4" aria-hidden="true" />
            {/* --text-total (34px) is one of the two RESERVED figure steps in the
                type scale, and this is the number it was reserved for: the last
                amount a shopper reads before card details. It is bought with
                SIZE here rather than with a colour or a box because everything
                above it in this column is 15px and 12px — the jump alone says
                "this is the one". items-baseline so the 15px label sits on the
                34px figure's baseline instead of floating at its cap height. */}
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <span className="text-body font-bold">סך הכל</span>
              <span className="text-total font-bold text-accent whitespace-nowrap">{formatILS(finalTotal)}</span>
            </div>
          </>
        )}

        {/* Rendered from the first paint (empty) so the notices below are
            announced when the revalidation resolves into an existing live
            region, rather than appearing as a silent new one. */}
        <div role="status" aria-live="polite">
          {blockedCount > 0 && (
            <p
              id="cart-blocked-note"
              className="mb-3 rounded-xl bg-secondary/70 hairline px-3 py-2 text-meta leading-relaxed"
            >
              {blockedCount === 1
                ? "פריט אחד בעגלה אינו זמין כעת להזמנה ואינו נכלל בסכום. יש להסיר אותו כדי להמשיך לתשלום."
                : `${blockedCount} פריטים בעגלה אינם זמינים כעת להזמנה ואינם נכללים בסכום. יש להסיר אותם כדי להמשיך לתשלום.`}
            </p>
          )}
          {repricedCount > 0 && (
            <p className="mb-3 rounded-xl bg-secondary/70 hairline px-3 py-2 text-meta leading-relaxed">
              {repricedCount === 1
                ? "מחיר של פריט אחד בעגלה עודכן למחיר הנוכחי באתר."
                : `מחירים של ${repricedCount} פריטים בעגלה עודכנו למחירים הנוכחיים באתר.`}
              {/* Only while there IS a sum above to point at — with nothing
                  orderable the summary rows are withheld, and this sentence
                  would refer to a number the page no longer shows. */}
              {!nothingOrderable && " הסכום שלמעלה כבר כולל את העדכון."}
            </p>
          )}
        </div>

        {/* THE TWO FREE GIFT AFFORDANCES, SURFACED WHERE THEY CAN STILL MATTER.
            Both of these already work in src/routes/checkout.tsx — a 300-character
            dedication that is printed and attached, and festive wrapping — and
            until now the first time a shopper heard about either of them was
            AFTER she had committed to paying. This cart and the mini-cart are the
            last two screens before card details, and neither said a word.

            It is stated as capability, not as a promotion: no exclamation, no
            "limited", no urgency, and no number that could be mistaken for a
            price. The only claim made is the one checkout.tsx already makes
            verbatim ("ניתנות ללא עלות ואינן משפיעות על סכום ההזמנה"), and the
            300 is the literal maxLength on that textarea, so the two surfaces
            cannot drift.

            The gold here is the decorative hairline (.hairline-gold) and the ✦,
            both of which are legal decorative uses; the only gold carrying text
            is --accent on the ornament itself. Withheld when nothing in the cart
            can be ordered — there is no gift to wrap. */}
        {!nothingOrderable && (
          <div className="mb-4 rounded-xl hairline-gold bg-secondary/60 px-3 py-2.5 text-start">
            <p className="text-body font-semibold text-foreground">
              <span className="text-accent" aria-hidden="true">✦</span> עטיפה והקדשה אישית - ללא עלות
            </p>
            <p className="mt-1 text-micro leading-relaxed text-muted-foreground">
              בשלב התשלום אפשר לסמן שזו מתנה, לכתוב הקדשה של עד 300 תווים שתודפס ותצורף למשלוח,
              ולבקש עטיפה חגיגית. שתיהן ללא עלות ואינן משפיעות על סכום ההזמנה.
            </p>
          </div>
        )}

        {/* The CTA is withheld only on a POSITIVE, resolved answer that a line
            would be rejected — the same read the server makes. While the check
            is loading, or if it failed, blockedCount is 0 and checkout proceeds
            exactly as before. */}
        {blockedCount > 0 ? (
          // aria-disabled rather than `disabled`, exactly as the resend button in
          // src/routes/auth.tsx: a natively disabled button leaves the tab order,
          // so a keyboard/AT user would never reach this control AND never hear
          // #cart-blocked-note explaining why checkout is withheld. Kept
          // focusable, the reason stays discoverable; the handler is the thing
          // that no-ops.
          <Button
            type="button"
            className="w-full aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
            size="lg"
            onClick={(e) => {
              if (blockedCount > 0) e.preventDefault();
            }}
            aria-disabled={true}
            aria-describedby="cart-blocked-note"
          >
            מעבר לתשלום
          </Button>
        ) : (
          <Button asChild className="press w-full" size="lg">
            <Link to="/checkout">מעבר לתשלום · {formatILS(finalTotal)}</Link>
          </Button>
        )}
        <TrustBadges compact />
      </div>
      <div className="lg:col-span-2 min-w-0">
        <CartCrossSell productIds={productIds} />
      </div>
    </div>
  );
}
