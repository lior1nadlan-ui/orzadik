import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getOrderConfirmation } from "@/lib/order.functions";
import { createCardcomPayment } from "@/lib/cardcom.functions";
import { formatILS, useCart } from "@/lib/cart";
import { BUSINESS } from "@/lib/business";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/Skeletons";
import { CheckCircle2, Clock, Mail, Truck, Package, MessageCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/order/$id")({
  component: OrderConfirmationPage,
  // CardCom redirects to /order/{id}?paid=1 (success) or ?paid=0 (failure).
  validateSearch: (s: Record<string, unknown>): { paid?: "0" | "1" } =>
    s.paid === "1" ? { paid: "1" } : s.paid === "0" ? { paid: "0" } : {},
  head: () => ({
    meta: [
      { title: "אישור הזמנה — אור זרוע לצדיק" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function OrderConfirmationPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const loadOrder = useServerFn(getOrderConfirmation);
  const { clear } = useCart();

  // The webhook that flips payment_status to 'paid' races the browser redirect
  // back here. When we just came from a successful charge (?paid=1) but the
  // order isn't paid yet, poll so the buyer sees "מאמתים את התשלום…" instead of a
  // false "payment not received" that invites a double charge.
  //
  // 90s, not the 15s this used to be. The old window was SHORTER than CardCom's
  // own retry interval: if their first delivery fails, the second lands about a
  // minute later — so at t=15s a buyer who really had paid was shown the pending
  // copy, 45 seconds before the payment would have confirmed itself on screen.
  // 90s outlasts that second attempt. Anything still unconfirmed after it is
  // caught by the reconciliation sweep within ~10 minutes, so no order is lost
  // either way; this window is only about what the buyer is told meanwhile.
  const justPaid = search.paid === "1";
  const [pollWindowOpen, setPollWindowOpen] = useState(justPaid);
  useEffect(() => {
    if (!justPaid) return;
    const t = setTimeout(() => setPollWindowOpen(false), 90000);
    return () => clearTimeout(t);
  }, [justPaid]);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => loadOrder({ data: { order_id: id } }),
    // Was retry:false — the strictest setting in the app, on its most important
    // page, so one transient blip showed a false "order not found". Allow a few.
    retry: 2,
    refetchInterval: (q) => {
      const o = q.state.data as { payment_status?: string } | undefined;
      if (o?.payment_status === "paid") return false;
      return justPaid && pollWindowOpen ? 1500 : false;
    },
  });

  const isPaid = order?.payment_status === "paid";
  // Just paid, webhook not caught up yet, still inside the poll window.
  const verifying = justPaid && !isPaid && pollWindowOpen;

  // Re-open the Cardcom payment page for THIS SAME order (declined / cancelled /
  // never-paid). createCardcomPayment re-verifies the amount from the DB and
  // refuses if already paid, so no duplicate order is created and no re-fill of
  // the checkout form is needed — unlike sending the buyer back to /cart, which
  // runs placeOrder again (new unpaid order + burns the 5-orders/hour cap and
  // can lock them out mid-purchase). Gated on !justPaid at the call site so a
  // just-paid-but-webhook-lagging buyer is never shown "pay again".
  const retryPay = useServerFn(createCardcomPayment);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const onRetryPayment = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const { url } = await retryPay({ data: { order_id: id } });
      window.location.href = url;
    } catch (e) {
      // Surface the server's Hebrew message when it sent one; otherwise a
      // friendly fallback. (e.g. "ההזמנה כבר שולמה" if it paid in a race.)
      const msg = e instanceof Error ? e.message : "";
      setRetryError(
        /[֐-׿]/.test(msg)
          ? msg
          : "לא הצלחנו לפתוח את עמוד התשלום כרגע. נסו שוב או צרו קשר בוואטסאפ.",
      );
      setRetrying(false);
    }
  };

  // Clear the cart only once payment is confirmed — never before.
  useEffect(() => {
    if (isPaid) clear();
  }, [isPaid, clear]);

  // Fire the `purchase` conversion once when payment is confirmed — to BOTH GA4
  // (`gtag`) and the Meta Pixel (`fbq`) — so Analytics and the ad platforms
  // (Google Ads once the GA4 event is imported; Meta Ads via the Pixel) can
  // measure real revenue, not just clicks. Consent Mode / fbq-consent decide
  // whether cookies are used. Guarded per order id so a refresh never
  // double-counts; each tag fires only if it's actually loaded.
  useEffect(() => {
    if (!isPaid || !order) return;
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag !== "function" && typeof w.fbq !== "function") return;
    const key = `purchase_tracked_${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // storage blocked — still fire (at most once per page load)
    }
    const value = Number(order.total) || 0;
    const items = (order.order_items ?? []) as any[];
    const unitPrice = (it: any) =>
      Number(it.quantity) > 0
        ? Number(it.line_total) / Number(it.quantity)
        : Number(it.line_total) || 0;
    if (typeof w.gtag === "function") {
      // GA4 ecommerce purchase (also importable into Google Ads as a conversion).
      w.gtag("event", "purchase", {
        transaction_id: order.order_number ?? id,
        value,
        currency: "ILS",
        items: items.map((it: any) => ({
          // item_id ties the purchase line to the same id used by view_item /
          // add_to_cart, so GA4 can attribute revenue to a product across the
          // whole funnel. product_id is the display-safe id on order_items.
          item_id: String(it.product_id ?? ""),
          item_name: it.product_name,
          quantity: Number(it.quantity) || 1,
          price: unitPrice(it),
        })),
      });
      // Google Ads conversion action (the "רכישה" event snippet). transaction_id
      // dedupes so each order counts once; value/currency feed conversion value.
      if (BUSINESS.googleAdsId && BUSINESS.googleAdsPurchaseLabel) {
        w.gtag("event", "conversion", {
          send_to: `${BUSINESS.googleAdsId}/${BUSINESS.googleAdsPurchaseLabel}`,
          value,
          currency: "ILS",
          transaction_id: order.order_number ?? id,
        });
      }
    }
    if (typeof w.fbq === "function") {
      w.fbq("track", "Purchase", {
        value,
        currency: "ILS",
        num_items: items.reduce((n, it) => n + (Number(it.quantity) || 1), 0),
        content_type: "product",
        contents: items.map((it: any) => ({
          id: String(it.product_id ?? it.product_name ?? ""),
          quantity: Number(it.quantity) || 1,
          item_price: unitPrice(it),
        })),
      });
    }
  }, [isPaid, order, id]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-14 max-w-2xl space-y-6">
        <CardSkeleton className="min-h-[12rem]" />
        <CardSkeleton className="min-h-[16rem]" />
      </div>
    );
  }
  if (isError || !order) {
    // A null order is a true not-found / no-permission (a retry won't help); an
    // actual query error is transient, so offer a retry instead of a dead end.
    const notFound = !isError && !order;
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="glass mx-auto max-w-lg space-y-4 px-6 py-12 text-center">
          <p className="text-muted-foreground">
            {notFound
              ? "ההזמנה לא נמצאה או שאין לך הרשאה לצפות בה."
              : "לא הצלחנו לטעון את ההזמנה כרגע. נסו שוב בעוד רגע."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {!notFound && (
              <Button className="press" onClick={() => refetch()}>
                נסה שוב
              </Button>
            )}
            <Link to="/shop">
              <Button variant="outline" className="press">
                חזרה לחנות
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Contact affordance — the store's own WhatsApp, pre-filled with the order
  // number so a question lands with context. wa.me is the store's number, not a
  // destination taken from untrusted content.
  const waHref = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
    `שלום, יש לי שאלה לגבי הזמנה ${order.order_number}`,
  )}`;

  return (
    <div className="container mx-auto px-4 py-14 max-w-2xl">
      <div className="text-center mb-8">
        {isPaid ? (
          <>
            {/* Glass disc + gold hairline: the status mark reads as a pane of
                glass on the light ground, not a bare icon. */}
            <div className="glass glass-gold [--glass-radius:9999px] mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-accent" />
            </div>
            <h1 className="font-display text-3xl font-bold">תודה על ההזמנה!</h1>
            <p className="text-muted-foreground mt-2">
              מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              קיבלנו את התשלום. אישור הזמנה יישלח לדוא"ל שלך, וכשההזמנה תישלח נעדכן אותך בדוא"ל.
            </p>
          </>
        ) : verifying ? (
          <>
            <div className="glass glass-gold [--glass-radius:9999px] mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <Loader2 className="h-12 w-12 text-accent animate-spin" aria-hidden="true" />
            </div>
            <h1 className="font-display text-3xl font-bold">מאמתים את התשלום…</h1>
            <p className="text-muted-foreground mt-2">
              מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              רק רגע — אנחנו מאשרים את קליטת התשלום מול חברת הסליקה. העמוד יתעדכן אוטומטית; אין צורך
              לרענן או לשלם שוב.
            </p>
          </>
        ) : (
          <>
            <div className="glass glass-gold [--glass-radius:9999px] mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <Clock className="h-12 w-12 text-accent" />
            </div>
            {/* Two very different people land here, and they must not be told the
                same thing. `justPaid` completed a charge at CardCom and is simply
                waiting on a slow webhook — telling them "טרם נקלט תשלום" is false
                from their point of view, frightening, and the single most likely
                way to provoke a second payment. Everyone else genuinely has an
                unpaid order and needs the pay button. */}
            <h1 className="font-display text-3xl font-bold">
              {justPaid ? "התשלום התקבל — ממתין לאישור סופי" : "ההזמנה התקבלה — ממתינה לתשלום"}
            </h1>
            <p className="text-muted-foreground mt-2">
              מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {justPaid
                ? 'קיבלנו את התשלום, והאישור מחברת הסליקה עדיין בדרך. זה קורה לפעמים ונסגר מעצמו תוך דקות ספורות — אין צורך לשלם שוב. נשלח אישור בדוא"ל ברגע שהתשלום ייקלט, ואם משהו לא יסתדר ניצור איתכם קשר.'
                : "טרם נקלט תשלום עבור הזמנה זו. אפשר להשלים את התשלום המאובטח כאן, או ליצור איתנו קשר בוואטסאפ."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {/* !justPaid so a just-paid buyer whose webhook is still lagging
                  (poll window closed) is never offered "pay again" — that would
                  re-introduce the double-charge the poll fix removed. */}
              {!justPaid && (
                <Button className="press" onClick={onRetryPayment} disabled={retrying}>
                  {retrying ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    "להשלמת התשלום המאובטח"
                  )}
                </Button>
              )}
              {/* The copy has always offered WhatsApp; there was never a link.
                  Someone who just paid and sees an unconfirmed order wants a human
                  immediately, so this is the one action that must be present. */}
              <a
                href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, ביצעתי תשלום להזמנה ${order.order_number} והאישור עדיין לא נקלט.`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant={justPaid ? "default" : "outline"} className="press">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  שאלה בוואטסאפ
                </Button>
              </a>
              {!justPaid && (
                <Link to="/cart">
                  <Button variant="outline" className="press">
                    חזרה לעגלה
                  </Button>
                </Link>
              )}
            </div>
            {retryError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {retryError}
              </p>
            )}
          </>
        )}
      </div>
      <div className="glass p-6">
        <h2 className="font-display text-xl font-bold mb-4">פירוט ההזמנה</h2>
        {/* Size and engraving/embroidery text, not just "name × qty".
            getOrderConfirmation has always SELECTed custom_text and
            variant_label and this page threw both away — on exactly the two
            fields that stop being changeable once production starts (they are
            what triggers the §14ג personalised-goods carve-out the product page
            spells out), on the one artifact the buyer definitely opens.
            checkout.tsx:566-575 already has this treatment; this is the same
            one, so the wording a buyer approved before paying is the wording
            they can re-read after. */}
        <div className="space-y-2 mb-4">
          {order.order_items.map((it: any) => (
            <div key={it.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                {it.product_name} × {it.quantity}
                {it.variant_label && (
                  <span className="block text-xs text-muted-foreground">
                    גודל: {it.variant_label}
                  </span>
                )}
                {it.custom_text && (
                  <span className="block text-xs text-accent break-words">✦ {it.custom_text}</span>
                )}
              </span>
              <span className="font-medium whitespace-nowrap">
                {formatILS(Number(it.line_total))}
              </span>
            </div>
          ))}
        </div>
        {/* A typo in an engraving is unfixable after production and NOT
            cancellable under §14ג(ד)(4), so the moment to catch it is now.
            Reuses the prefilled store WhatsApp already built above. */}
        {order.order_items.some((it: any) => it.custom_text || it.variant_label) && (
          <p className="-mt-2 mb-4 text-xs text-muted-foreground">
            טעות בכיתוב?{" "}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              כתבו לנו בוואטסאפ
            </a>{" "}
            — נתקן לפני שמתחילים בייצור.
          </p>
        )}
        {order.is_gift && (
          /* Inset well inside the glass panel: a gold hairline chip, no second
             shadow stacking on the panel it sits in. */
          <div className="mb-4 rounded-xl hairline-gold bg-secondary/70 px-4 py-3 text-sm">
            <p>
              🎁 סימנת את ההזמנה כמתנה{order.gift_wrap ? " — נארוז אותה בעטיפת מתנה חגיגית" : ""}.
              ללא תוספת מחיר.
            </p>
            {order.gift_note && (
              <p className="mt-2 text-muted-foreground">
                ההקדשה שתודפס: <span className="text-foreground">"{order.gift_note}"</span>
              </p>
            )}
          </div>
        )}
        {/* Reconcile the total: סכום פריטים (− הטבת מועדון) + משלוח = סך הכל —
            the same three-row shape the checkout summary shows before paying.
            orders.subtotal is stored ALREADY reduced by the member discount
            while order_items keep their pre-discount line_total, so printing
            `subtotal` against the item rows above made a signed-in buyer's
            receipt fail to add up, and never named the 5% benefit /club had
            promised them. The CardCom invoice does name it, so this surface was
            the least transparent of the three. Derived from data already
            fetched — no query change, no pricing.ts change. */}
        {(() => {
          const itemsSum = order.order_items.reduce(
            (s: number, it: any) => s + Number(it.line_total),
            0,
          );
          const memberBenefit = itemsSum - Number(order.subtotal);
          return (
            <div className="space-y-2 border-t border-glass-line pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סכום פריטים</span>
                <span className="whitespace-nowrap">{formatILS(itemsSum)}</span>
              </div>
              {memberBenefit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">הטבת מועדון</span>
                  <span className="whitespace-nowrap">{formatILS(-memberBenefit)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">משלוח (תעריף אחיד לכל הזמנה)</span>
                <span className="whitespace-nowrap">{formatILS(Number(order.shipping))}</span>
              </div>
            </div>
          );
        })()}
        <div className="gold-rule my-4" aria-hidden="true" />
        <div className="flex justify-between text-lg">
          <span className="font-bold">סך הכל</span>
          <span className="font-bold text-accent">{formatILS(Number(order.total))}</span>
        </div>
      </div>
      {isPaid && (
        /* What happens next — the paid buyer's orientation panel: the email
           they'll get, the delivery window (same copy as cart/TrustBadges so it
           can't drift), how to track, and a WhatsApp path for questions. */
        <div className="glass mt-6 p-6">
          <h2 className="font-display text-xl font-bold mb-4">מה קורה עכשיו?</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>אישור הזמנה מפורט נשלח לכתובת הדוא"ל שלך.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>נארוז את ההזמנה ונשלח אותה עד הבית · אספקה משוערת 3-14 ימי עסקים.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                אפשר לעקוב אחר מצב ההזמנה בכל עת עם מספר ההזמנה וכתובת הדוא"ל שאיתה בוצעה.
              </span>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/track">
              <Button variant="outline" className="press">
                מעקב הזמנה
              </Button>
            </Link>
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="press gap-1.5">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                שאלה בוואטסאפ
              </Button>
            </a>
          </div>
        </div>
      )}
      <div className="mt-6 text-center">
        <Link to="/shop">
          <Button variant="outline" className="press">
            המשך לקנות
          </Button>
        </Link>
      </div>
    </div>
  );
}
