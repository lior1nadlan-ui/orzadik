import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { trackOrder } from "@/lib/order.functions";
import { BUSINESS, CONSUMER_POLICY } from "@/lib/business";
import { waMessage } from "@/lib/wa-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import {
  Check,
  Package,
  PackageOpen,
  CreditCard,
  ClipboardList,
  Home,
  MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/track")({
  component: TrackPage,
  head: () => ({
    meta: [
      { title: "מעקב הזמנה | אור זרוע לצדיק" },
      {
        name: "description",
        content:
          "מעקב אחר סטטוס ההזמנה שלכם באור זרוע לצדיק — הזינו מספר הזמנה וכתובת דוא\"ל וקבלו את מצב התשלום והמשלוח.",
      },
      // Nothing here is worth indexing and the page only ever renders private
      // order data, so keep it out of search results entirely.
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/track" }],
  }),
});

type TrackResult = Awaited<ReturnType<typeof trackOrder>>;

const dt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) : null;

function TrackPage() {
  const lookup = useServerFn(trackOrder);
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation<TrackResult, Error, { order_number: string; email: string }>({
    mutationFn: (vars) => lookup({ data: vars }),
  });

  const order = mutation.data;
  const isPaid = order?.payment_status === "paid";
  const paymentStuck =
    !!order && !isPaid && ["unpaid", "failed"].includes(order.payment_status);

  // Store's own WhatsApp, pre-filled with the order number so a payment
  // question lands with context. Built via the shared wa-templates helper on
  // BUSINESS.whatsapp — never a number from untrusted content.
  const payWaHref = order
    ? waMessage(
        BUSINESS.whatsapp,
        `שלום, יש לי שאלה לגבי התשלום על הזמנה ${order.order_number}`,
      )
    : null;

  // Same store WhatsApp, but for the one thing that becomes unfixable once
  // production starts: a typo in an engraving/embroidery line. Mirrors the
  // prefilled pattern order.$id.tsx uses.
  const textWaHref = order
    ? waMessage(
        BUSINESS.whatsapp,
        `שלום, יש טעות בכיתוב שהזמנתי בהזמנה ${order.order_number}`,
      )
    : null;

  // Any personalised line in this order? Only then is the "wrong wording?"
  // affordance meaningful — showing it on a plain order is noise.
  const hasPersonalisation = (order?.order_items ?? []).some(
    (it) => !!it.custom_text || !!it.variant_label,
  );

  // Five ordered milestones. `done` drives the gold ✓; the timeline renders
  // top-to-bottom with the connector on the RTL start (right) edge.
  //
  // "בהכנה" exists because orders.shipping_status has a 'preparing' value that
  // nothing could ever write, so a paid buyer read "ממתין לטיפול" on /account
  // for the entire fulfilment window. The admin can now set it (markOrderPreparing
  // in admin-crm.functions.ts) and this is where the buyer sees it land.
  const shipStatus = String(order?.shipping_status ?? "");
  const steps = order
    ? [
        {
          key: "created",
          icon: ClipboardList,
          label: "ההזמנה התקבלה",
          at: dt(order.created_at),
          done: true,
        },
        {
          key: "paid",
          icon: CreditCard,
          label: "התשלום אושר",
          at: dt(order.paid_at),
          done: isPaid,
        },
        {
          key: "preparing",
          icon: PackageOpen,
          label: "ההזמנה בהכנה",
          at: null,
          // Shipped implies prepared, so a later stage never leaves this one
          // blank behind it.
          done:
            ["preparing", "shipped", "delivered"].includes(shipStatus) || !!order.shipped_at,
        },
        {
          key: "shipped",
          icon: Package,
          label: "ההזמנה נשלחה",
          at: dt(order.shipped_at),
          done: !!order.shipped_at,
        },
        {
          key: "completed",
          icon: Home,
          label: "ההזמנה הושלמה",
          at: null,
          done: order.status === "completed",
        },
      ]
    : [];

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <PageHeader
        eyebrow="שירות ומעקב"
        title="מעקב הזמנה"
        sub={'הזינו את מספר ההזמנה ואת כתובת הדוא"ל שאיתה בוצעה ההזמנה.'}
      />

      <form
        className="glass p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ order_number: orderNumber.trim(), email: email.trim() });
        }}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="track-order">מספר הזמנה *</Label>
            <Input
              id="track-order"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="למשל: ORD-12345"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="track-email">אימייל *</Label>
            <Input
              id="track-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="press w-full bg-accent text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
        >
          {mutation.isPending ? "מחפש..." : "הצג מצב הזמנה"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          מספר ההזמנה מופיע במייל אישור ההזמנה שנשלח אליכם.
        </p>
      </form>

      {mutation.isError && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground"
        >
          {mutation.error.message}
        </div>
      )}

      {order && (
        <div className="mt-8 glass p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-foreground">
              הזמנה <span className="font-mono">{order.order_number}</span>
            </h2>
            {order.is_gift && <span className="text-sm text-accent">🎁 נארזת כמתנה</span>}
          </div>

          {/* Payment-pending notice — a calm hairline + muted surface, not a
              scarcity colour. Raw amber (border-amber-400 / bg-amber-50 /
              text-amber-900) is off the palette; the emphasis is carried by
              --accent, the only gold allowed for text. */}
          {paymentStuck && (
            <div className="mt-4 rounded-lg hairline bg-muted/50 px-4 py-3 text-sm text-foreground">
              <div className="flex items-start gap-2.5">
                <CreditCard className="h-4 w-4 shrink-0 mt-0.5 text-accent" aria-hidden="true" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-accent">ההזמנה ממתינה לתשלום.</span>{" "}
                  אם ביטלתם בטעות, אפשר להשלים את התשלום על אותה הזמנה בדיוק — בלי למלא
                  שוב את הפרטים — או לפנות אלינו בוואטסאפ ונשמח לעזור.
                </p>
              </div>
              {/* Turn the notice into an action, not a dead end.
                  This USED to point at /cart, with a comment claiming that was
                  "the same as the unpaid state on /order/$id". It is the
                  opposite: /order/$id re-opens CardCom for THIS order and says in
                  writing why (order.$id.tsx:69-76) — sending the buyer to /cart
                  runs placeOrder again, mints a second unpaid order and burns one
                  of the five orders/hour the cap allows, which can lock them out
                  mid-purchase. The link needs order.id, which is why it is now in
                  trackOrder's column allowlist. */}
              {/* asChild so each control is a SINGLE focusable anchor carrying the
                  button styling — no <button> nested inside <a> (invalid HTML +
                  double focus stop), matching the cart.tsx remedy in this batch. */}
              <div className="mt-3 flex flex-wrap gap-2.5 pr-[26px]">
                {/* Gated on is_guest_order (derived server-side in trackOrder;
                    the raw user_id is never sent here). /order/$id is
                    owner-checked — getOrderConfirmation throws for any order
                    carrying user_id when the caller is not that user — and
                    /track is by definition the no-session surface, so for a
                    member's order this link would render a page that retries
                    forever. They keep the /cart route, which is worse UX but
                    reaches somewhere real. */}
                <Button asChild size="sm" className="press">
                  {(order as any).is_guest_order ? (
                    <Link to="/order/$id" params={{ id: order.id }}>
                      להשלמת התשלום המאובטח
                    </Link>
                  ) : (
                    <Link to="/cart">להשלמת התשלום המאובטח</Link>
                  )}
                </Button>
                {payWaHref && (
                  <Button asChild size="sm" variant="outline" className="press gap-1.5">
                    <a href={payWaHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      פנייה בוואטסאפ
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          <ol className="mt-6 space-y-0">
            {steps.map((s, i) => (
              <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Connector: sits under the icon column, hidden on the last row */}
                {i < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-9 right-[17px] h-[calc(100%-2.25rem)] w-px ${
                      steps[i + 1].done ? "bg-accent" : "bg-border"
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                    s.done
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </span>
                <div className="pt-1.5">
                  <div className={s.done ? "font-medium" : "text-muted-foreground"}>{s.label}</div>
                  {s.at && <div className="text-xs text-muted-foreground mt-0.5">{s.at}</div>}
                  {s.key === "shipped" && s.done && order.tracking_number && (
                    <div className="mt-1 text-xs">
                      מספר מעקב: <span className="font-mono">{order.tracking_number}</span>
                      {order.shipping_carrier && <> · {order.shipping_carrier}</>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 border-t border-glass-line pt-4">
            <div className="text-sm font-medium mb-2 text-foreground">פריטים בהזמנה</div>
            {/* Size and engraving/embroidery text are printed here, not just the
                name × qty. These are the two fields that become non-returnable
                the moment production starts (§14ג carve-out for personalised
                goods), so the buyer has to be able to re-read exactly what was
                ordered — the same treatment checkout.tsx gives them before
                paying. */}
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {(order.order_items ?? []).map((it, i) => (
                <li key={i}>
                  <span>
                    {it.product_name} × {it.quantity}
                  </span>
                  {it.variant_label && (
                    <div className="text-xs text-muted-foreground">גודל: {it.variant_label}</div>
                  )}
                  {it.custom_text && (
                    <div className="text-xs text-accent">✦ {it.custom_text}</div>
                  )}
                </li>
              ))}
            </ul>
            {hasPersonalisation && textWaHref && (
              <p className="mt-2 text-xs text-muted-foreground">
                טעות בכיתוב?{" "}
                <a
                  href={textWaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  כתבו לנו בוואטסאפ
                </a>{" "}
                — נתקן לפני שמתחילים בייצור.
              </p>
            )}
            {order.customer_city && (
              <div className="mt-3 text-sm text-muted-foreground">
                יעד המשלוח: {order.customer_city}
              </div>
            )}
            {/* The delivery window, from the same CONSUMER_POLICY constants
                /shipping, TrustBadges and the confirmation email render, so no
                surface can publish a window the store does not honour. ASCII
                hyphen only: U+2013 is bidi class ON and visually REVERSES a
                numeric range in RTL. */}
            {isPaid && !order.shipped_at && (
              <div className="mt-1 text-sm text-muted-foreground">
                <span>זמן אספקה משוער: {CONSUMER_POLICY.deliveryMinDays}-{CONSUMER_POLICY.deliveryMaxDays} ימי עסקים ממועד התשלום.</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-sm">
        <Link
          to="/shop"
          className="text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
        >
          חזרה לחנות
        </Link>
      </div>
    </div>
  );
}
