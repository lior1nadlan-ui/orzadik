import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatILS, useCart, getEffectivePrice, applyMemberDiscount, lineKey } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { EmptyCartSuggestions } from "@/components/cart/EmptyCartSuggestions";
import { CartCrossSell } from "@/components/cart/CartCrossSell";
import { TrustBadges } from "@/components/cart/TrustBadges";
import { Trash2, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "העגלה שלי" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function CartPage() {
  const { items, remove, setQty, shipping } = useCart();
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
  // Unknown (anonymous, or still loading) ⇒ no benefit, so the quote is never
  // lower than the charge.
  const isMember = !!memberProfile?.is_member;
  // Exactly the sum of the per-line amounts rendered in the cart rows below.
  const itemsTotal = items.reduce((s, i) => s + getEffectivePrice(i.price) * i.quantity, 0);
  const memberSubtotal = applyMemberDiscount(itemsTotal, isMember);
  const memberBenefit = itemsTotal - memberSubtotal;
  const finalTotal = memberSubtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-3">העגלה ריקה</h1>
        <p className="text-muted-foreground mb-6">לא הוספת עדיין מוצרים לעגלה.</p>
        <Link to="/shop"><Button>התחל לקנות</Button></Link>
        <EmptyCartSuggestions />
      </div>
    );
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)));

  return (
    // Three grid children, in the order they must be read on a phone (one
    // column below `lg`): cart lines → summary + CTA → cross-sell. The
    // suggestions used to live inside the lines column, pushing "מעבר לתשלום"
    // up to 8 products down the page. No `order` classes needed — this DOM
    // order also produces the unchanged desktop layout: lines and summary share
    // the first row, the cross-sell wraps to the row beneath them.
    <div className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-3">
        <h1 className="font-display text-3xl font-bold mb-4">העגלה שלי</h1>
        {items.map((item) => {
          const effective = getEffectivePrice(item.price);
          const k = lineKey(item);
          return (
            <div key={k} className="flex gap-3 sm:gap-4 rounded-lg border bg-card p-3 sm:p-4">
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/product/$slug"
                    params={{ slug: item.slug }}
                    className="font-medium hover:text-accent line-clamp-2 text-sm sm:text-base"
                  >
                    {item.name}
                  </Link>
                  <button
                    onClick={() => remove(k)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    aria-label="הסר"
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>

                {item.variantLabel && (
                  <div className="text-xs text-muted-foreground mt-1">גודל: {item.variantLabel}</div>
                )}

                {item.customText && (
                  <div className="text-xs text-[#A8862A] mt-1">
                    ✦ {item.customMethod === "laser" ? "חריטת לייזר" : "רקמה"}: {item.customText}
                  </div>
                )}

                <div className="text-xs sm:text-sm mt-1 flex items-baseline gap-2">
                  <span className="font-semibold text-[#A8862A]">{formatILS(effective)}</span>
                </div>

                <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-md border">
                    <button onClick={() => setQty(k, item.quantity - 1)} className="px-2 py-1 hover:bg-muted" aria-label="הפחת">
                      <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <span className="px-3 text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => setQty(k, item.quantity + 1)} className="px-2 py-1 hover:bg-muted" aria-label="הוסף">
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                  <div className="font-bold text-sm sm:text-base text-[#A8862A]">{formatILS(effective * item.quantity)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Sticky only from lg: on a phone the cross-sell now follows this block,
          and a pinned summary would scroll over it. */}
      <div className="rounded-lg border bg-card p-6 h-fit lg:sticky lg:top-20">
        <h2 className="font-display text-xl font-bold mb-4">סיכום הזמנה</h2>
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
        <div className="flex justify-between text-lg border-t pt-3 mb-4">
          <span className="font-bold">סך הכל</span>
          <span className="font-bold text-[#A8862A] whitespace-nowrap">{formatILS(finalTotal)}</span>
        </div>

        <Link to="/checkout"><Button className="w-full bg-[#D4AF37] hover:bg-[#A8862A] text-white" size="lg">מעבר לתשלום · {formatILS(finalTotal)}</Button></Link>
        <TrustBadges compact />
      </div>
      <div className="lg:col-span-2">
        <CartCrossSell productIds={productIds} />
      </div>
    </div>
  );
}
