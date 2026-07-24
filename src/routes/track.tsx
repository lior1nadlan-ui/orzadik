import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { trackOrder } from "@/lib/order.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { Check, Package, CreditCard, ClipboardList, Home } from "lucide-react";

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

  // Four ordered milestones. `done` drives the gold ✓; the timeline renders
  // top-to-bottom with the connector on the RTL start (right) edge.
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
            <div className="mt-4 flex items-start gap-2.5 rounded-lg hairline bg-muted/50 px-4 py-3 text-sm text-foreground">
              <CreditCard className="h-4 w-4 shrink-0 mt-0.5 text-accent" aria-hidden="true" />
              <p className="leading-relaxed">
                <span className="font-semibold text-accent">ההזמנה ממתינה לתשלום.</span>{" "}
                אם ביטלתם בטעות, ניתן לחזור לעגלה ולהשלים את התשלום או ליצור איתנו קשר.
              </p>
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
            <ul className="space-y-1 text-sm text-muted-foreground">
              {(order.order_items ?? []).map((it, i) => (
                <li key={i}>
                  {it.product_name} × {it.quantity}
                </li>
              ))}
            </ul>
            {order.customer_city && (
              <div className="mt-3 text-sm text-muted-foreground">
                יעד המשלוח: {order.customer_city}
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
