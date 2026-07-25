import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
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
import { trackViewCart } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { EmptyCartSuggestions } from "@/components/cart/EmptyCartSuggestions";
import { CartCrossSell } from "@/components/cart/CartCrossSell";
import { TrustBadges } from "@/components/cart/TrustBadges";
import { Trash2, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "העגלה שלי" }, { name: "robots", content: "noindex, nofollow" }] }),
});

/**
 * What the catalog says about the cart's products RIGHT NOW.
 *
 * The cart lives in localStorage, so a line can sit for days while the product
 * is re-priced, deactivated, or marked out of stock. placeOrder() re-reads all
 * of this authoritatively and THROWS on a mismatch — which, without this pass,
 * the shopper only discovers after filling in the whole checkout form.
 */
type CartSnapshot = {
  products: Map<string, { price: number; isActive: boolean; outOfStock: boolean }>;
  variants: Map<string, { productId: string; price: number | null; inStock: boolean }>;
};

/** Everything a single cart line can be wrong about. `null` ⇒ the line is fine. */
type LineCheck =
  | { kind: "unavailable" }
  | { kind: "outofstock" }
  | { kind: "size-outofstock" }
  | { kind: "size-unavailable" }
  | { kind: "price"; previous: number; current: number };

/** A line the shopper cannot order at all — placeOrder() would reject it. */
const isBlocking = (c: LineCheck) => c.kind !== "price";

/**
 * Mirrors placeOrder()'s per-line validation exactly (see the lineItems map in
 * src/lib/checkout.functions.ts), so the cart never reports a problem the
 * server would not raise, and never stays silent about one it would:
 *
 *   • product missing / inactive          → "מוצר לא זמין"
 *   • stock_status === "outofstock"       → "מוצר אזל מהמלאי"
 *   • variant missing or for another product → "גודל לא תקין"
 *   • variant in_stock === false          → "הגודל אזל מהמלאי"
 *   • base price = variant price when set, else the product price
 *
 * A missing product row is the same signal as is_active=false: the public RLS
 * policy on `products` is `USING (is_active = true)`, so a deactivated product
 * simply stops being returned to a shopper. (An admin's session CAN see it, and
 * then the explicit flag catches it.)
 */
function evaluateLine(item: CartItem, snap: CartSnapshot): LineCheck | null {
  const p = snap.products.get(item.productId);
  if (!p || !p.isActive) return { kind: "unavailable" };
  if (p.outOfStock) return { kind: "outofstock" };

  let base = p.price;
  if (item.variantId) {
    const v = snap.variants.get(item.variantId);
    if (!v || v.productId !== item.productId) return { kind: "size-unavailable" };
    if (!v.inStock) return { kind: "size-outofstock" };
    if (v.price !== null) base = v.price;
  }
  // Never claim a price change from a value we could not parse — fail open.
  if (!Number.isFinite(base) || !Number.isFinite(item.price)) return null;

  // Compare what the customer is CHARGED, via the shared pricing helper the
  // server itself uses, so a difference here is a real difference in money.
  const current = getEffectivePrice(base);
  const previous = getEffectivePrice(item.price);
  return current === previous ? null : { kind: "price", previous, current };
}

/**
 * Neutral, factual copy — states what changed and what follows from it. No
 * urgency, no scarcity, no "hurry": a price that moved and a size that ran out
 * are facts, not levers.
 */
function noticeText(check: LineCheck, item: CartItem): string {
  switch (check.kind) {
    case "unavailable":
      return "הפריט אינו זמין להזמנה כרגע, ולכן אינו נכלל בסיכום ההזמנה.";
    case "outofstock":
      return "הפריט אזל מהמלאי, ולכן אינו נכלל בסיכום ההזמנה.";
    case "size-outofstock":
      return `${item.variantLabel ? `הגודל שנבחר (${item.variantLabel}) אזל מהמלאי` : "הגודל שנבחר אזל מהמלאי"}, ולכן הפריט אינו נכלל בסיכום ההזמנה. אפשר לבחור גודל אחר בעמוד המוצר.`;
    case "size-unavailable":
      return "הגודל שנבחר אינו זמין יותר, ולכן הפריט אינו נכלל בסיכום ההזמנה. אפשר לבחור גודל אחר בעמוד המוצר.";
    // States the fact and stops there. It deliberately does NOT promise "this is
    // also what will be charged": the line amount is pre-member-discount (a club
    // member's 5% comes off the subtotal, see the הטבת מועדון row in the summary),
    // and /checkout still prices from the stored cart, so that promise would be
    // contradicted on the very next screen. The summary column below is the one
    // place that reconciles into the amount actually due.
    case "price":
      return `המחיר עודכן מאז שהפריט נוסף לעגלה — קודם ${formatILS(check.previous)}, כעת ${formatILS(check.current)}. הסכום המוצג כאן הוא המחיר הנוכחי.`;
  }
}

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

  // Sorted so the query key is stable regardless of the order lines were added.
  const productIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.productId))).sort(),
    [items],
  );
  const variantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of items) if (i.variantId) ids.add(i.variantId);
    return Array.from(ids).sort();
  }, [items]);

  // CART REVALIDATION — client-side only (the cart itself is localStorage-backed,
  // so `items` is empty during SSR and this query is disabled there). The page
  // renders immediately from the stored cart; the notices appear when this
  // resolves. On ANY failure `fresh` stays undefined and the page behaves exactly
  // as it did before — a flaky read must never stand between a shopper and
  // checkout.
  const { data: fresh } = useQuery<CartSnapshot>({
    queryKey: ["cart-revalidate", productIds.join(","), variantIds.join(",")],
    enabled: productIds.length > 0,
    // Shorter than the app-wide 60s default: this is a freshness check, and a
    // stale answer to "is this still the price?" is the bug we are fixing.
    staleTime: 30_000,
    queryFn: async () => {
      const [pRes, vRes] = await Promise.all([
        supabase.from("products").select("id, price, is_active, stock_status").in("id", productIds),
        variantIds.length > 0
          ? supabase
              .from("product_variants")
              .select("id, product_id, price, in_stock")
              .in("id", variantIds)
          : null,
      ]);
      if (pRes.error) throw pRes.error;
      if (vRes && vRes.error) throw vRes.error;

      const products: CartSnapshot["products"] = new Map();
      for (const p of pRes.data ?? []) {
        products.set(p.id, {
          price: Number(p.price),
          isActive: p.is_active !== false,
          outOfStock: p.stock_status === "outofstock",
        });
      }

      const variants: CartSnapshot["variants"] = new Map();
      for (const v of vRes?.data ?? []) {
        variants.set(v.id, {
          productId: v.product_id,
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          // Tri-state on purpose, exactly like the server: most rows never set
          // in_stock, and an unset size must stay purchasable. Only an explicit
          // false blocks the line.
          inStock: v.in_stock !== false,
        });
      }

      return { products, variants };
    },
  });

  // One entry per problematic line, keyed by lineKey. Empty until the check
  // resolves (and forever, if it fails) — so nothing below changes shape.
  const checks = useMemo(() => {
    const m = new Map<string, LineCheck>();
    if (!fresh) return m;
    for (const item of items) {
      const c = evaluateLine(item, fresh);
      if (c) m.set(lineKey(item), c);
    }
    return m;
  }, [items, fresh]);

  const blockedCount = useMemo(
    () => Array.from(checks.values()).filter(isBlocking).length,
    [checks],
  );
  const repricedCount = useMemo(
    () => Array.from(checks.values()).filter((c) => c.kind === "price").length,
    [checks],
  );

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
          <h1 className="font-display text-3xl font-bold mb-3">העגלה ריקה</h1>
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
        <h1 className="font-display text-3xl font-bold mb-4">העגלה שלי</h1>
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
                  <button
                    onClick={() => remove(k)}
                    className="press flex-shrink-0 rounded-full p-1 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
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
                  <div className="mt-2 rounded-xl bg-secondary/70 hairline px-3 py-2 text-xs leading-relaxed text-foreground">
                    <p>{noticeText(check, item)}</p>
                    {blocked && (
                      <button
                        onClick={() => remove(k)}
                        className="press mt-1.5 font-semibold text-accent underline underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                      >
                        הסר מהעגלה
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center overflow-hidden rounded-full hairline">
                    <button onClick={() => setQty(k, item.quantity - 1)} className="press px-2.5 py-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary" aria-label={`הפחת כמות ${item.name}`}>
                      <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <span className="px-3 text-sm font-medium tabular-nums">{item.quantity}</span>
                    <button onClick={() => setQty(k, item.quantity + 1)} className="press px-2.5 py-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary" aria-label={`הוסף כמות ${item.name}`}>
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
        <h2 className="font-display text-xl font-bold mb-4">סיכום הזמנה</h2>
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סכום פריטים</span>
                <span className="whitespace-nowrap">{formatILS(itemsTotal)}</span>
              </div>
              {memberBenefit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">הטבת מועדון</span>
                  <span className="whitespace-nowrap">{formatILS(-memberBenefit)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">משלוח (תעריף אחיד לכל הזמנה)</span>
                <span className="whitespace-nowrap">{formatILS(shipping)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 mb-3">
              זמן אספקה משוער: 3–14 ימי עסקים
            </p>
            {/* Decorative gold hairline — the rule is a gradient image, never text. */}
            <div className="gold-rule my-4" aria-hidden="true" />
            <div className="flex justify-between text-lg mb-4">
              <span className="font-bold">סך הכל</span>
              <span className="font-bold text-accent whitespace-nowrap">{formatILS(finalTotal)}</span>
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
              className="mb-3 rounded-xl bg-secondary/70 hairline px-3 py-2 text-xs leading-relaxed"
            >
              {blockedCount === 1
                ? "פריט אחד בעגלה אינו זמין כעת להזמנה ואינו נכלל בסכום. יש להסיר אותו כדי להמשיך לתשלום."
                : `${blockedCount} פריטים בעגלה אינם זמינים כעת להזמנה ואינם נכללים בסכום. יש להסיר אותם כדי להמשיך לתשלום.`}
            </p>
          )}
          {repricedCount > 0 && (
            <p className="mb-3 rounded-xl bg-secondary/70 hairline px-3 py-2 text-xs leading-relaxed">
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
