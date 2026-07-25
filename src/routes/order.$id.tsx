import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getOrderConfirmation } from "@/lib/order.functions";
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
  // order isn't paid yet, poll briefly so the buyer sees "מאמתים את התשלום…"
  // instead of a false "payment not received" that invites a double charge.
  // The window closes after ~15s, after which the honest pending copy shows.
  const justPaid = search.paid === "1";
  const [pollWindowOpen, setPollWindowOpen] = useState(justPaid);
  useEffect(() => {
    if (!justPaid) return;
    const t = setTimeout(() => setPollWindowOpen(false), 15000);
    return () => clearTimeout(t);
  }, [justPaid]);

  const { data: order, isLoading, isError, refetch } = useQuery({
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
            {!notFound && <Button className="press" onClick={() => refetch()}>נסה שוב</Button>}
            <Link to="/shop"><Button variant="outline" className="press">חזרה לחנות</Button></Link>
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
            <p className="text-muted-foreground mt-2">מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span></p>
            <p className="text-sm text-muted-foreground mt-1">קיבלנו את התשלום. אישור הזמנה יישלח לדוא"ל שלך, וניצור עמך קשר לתיאום המשלוח.</p>
          </>
        ) : verifying ? (
          <>
            <div className="glass glass-gold [--glass-radius:9999px] mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <Loader2 className="h-12 w-12 text-accent animate-spin" aria-hidden="true" />
            </div>
            <h1 className="font-display text-3xl font-bold">מאמתים את התשלום…</h1>
            <p className="text-muted-foreground mt-2">מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span></p>
            <p className="text-sm text-muted-foreground mt-1">רק רגע — אנחנו מאשרים את קליטת התשלום מול חברת הסליקה. העמוד יתעדכן אוטומטית; אין צורך לרענן או לשלם שוב.</p>
          </>
        ) : (
          <>
            <div className="glass glass-gold [--glass-radius:9999px] mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <Clock className="h-12 w-12 text-accent" />
            </div>
            <h1 className="font-display text-3xl font-bold">ההזמנה התקבלה — ממתינה לתשלום</h1>
            <p className="text-muted-foreground mt-2">מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span></p>
            <p className="text-sm text-muted-foreground mt-1">טרם נקלט תשלום עבור הזמנה זו. אם ביטלת בטעות, ניתן לחזור לעגלה ולהשלים את התשלום, או ליצור איתנו קשר בוואטסאפ.</p>
            <div className="mt-4">
              <Link to="/cart"><Button className="press">חזרה לעגלה להשלמת התשלום</Button></Link>
            </div>
          </>
        )}
      </div>
      <div className="glass p-6">
        <h2 className="font-display text-xl font-bold mb-4">פירוט ההזמנה</h2>
        <div className="space-y-2 mb-4">
          {order.order_items.map((it: any) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>{it.product_name} × {it.quantity}</span>
              <span className="font-medium">{formatILS(Number(it.line_total))}</span>
            </div>
          ))}
        </div>
        {order.is_gift && (
          /* Inset well inside the glass panel: a gold hairline chip, no second
             shadow stacking on the panel it sits in. */
          <div className="mb-4 rounded-xl hairline-gold bg-secondary/70 px-4 py-3 text-sm">
            <p>🎁 סימנת את ההזמנה כמתנה{order.gift_wrap ? " — נארוז אותה בעטיפת מתנה חגיגית" : ""}. ללא תוספת מחיר.</p>
            {order.gift_note && (
              <p className="mt-2 text-muted-foreground">
                ההקדשה שתודפס: <span className="text-foreground">"{order.gift_note}"</span>
              </p>
            )}
          </div>
        )}
        {/* Reconcile the total: סכום פריטים + משלוח = סך הכל — the same breakdown
            shown in the checkout summary, so the paid confirmation no longer
            reads as a bare total the line items can't add up to. */}
        <div className="space-y-2 border-t border-glass-line pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">סכום פריטים</span>
            <span className="whitespace-nowrap">{formatILS(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">משלוח (תעריף אחיד לכל הזמנה)</span>
            <span className="whitespace-nowrap">{formatILS(Number(order.shipping))}</span>
          </div>
        </div>
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
              <span>נארוז את ההזמנה ונשלח אותה עד הבית · אספקה משוערת 3–14 ימי עסקים.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>אפשר לעקוב אחר מצב ההזמנה בכל עת עם מספר ההזמנה וכתובת הדוא"ל שאיתה בוצעה.</span>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/track">
              <Button variant="outline" className="press">מעקב הזמנה</Button>
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
        <Link to="/shop"><Button variant="outline" className="press">המשך לקנות</Button></Link>
      </div>
    </div>
  );
}
