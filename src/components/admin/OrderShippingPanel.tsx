// The "משלוח" block of the admin order dialog: "בהכנה", the ship form, and the
// "כבר נמסרה ללקוח" path for an order marked late.
//
// Marking an order weeks late used to mail "ההזמנה שלך בדרך!" about a parcel
// opened long ago, and stamp today as the ship date, pushing the review
// request a further week out. The "delivered" mode records the day it actually
// left and sends nothing; the review-request line says what the morning job
// will then do. The rules live in src/lib/fulfilment.ts, shared with the
// server, so the button is disabled for exactly the dates the server refuses.
//
// Owns its own form state; the parent renders it with key={order.id} so a new
// order always starts from that order's values.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateInputValue } from "@/lib/crm-tasks";
import {
  LIKELY_DELIVERED_AFTER_DAYS,
  daysSince,
  reviewOutlookText,
  reviewRequestOutlook,
  shippedAtFromDateInput,
} from "@/lib/fulfilment";

export type ShippingOrder = {
  created_at: string;
  paid_at: string | null;
  payment_status: string;
  shipped_at: string | null;
  shipping_status: string | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  contact_consent: boolean | null;
  review_request_sent_at: string | null;
};

export type ShipRequest = {
  tracking_number?: string;
  carrier?: string;
  delivered?: boolean;
  shipped_on?: string;
};

/** The date check and review-request line for a picked "left on" date. */
export function deliveredPreview(
  order: Pick<ShippingOrder, "created_at" | "contact_consent" | "review_request_sent_at">,
  ymd: string,
  now = Date.now(),
): { ok: boolean; text: string } {
  const picked = shippedAtFromDateInput(ymd, { notBefore: Date.parse(order.created_at), now });
  if (!picked.ok) return { ok: false, text: picked.error };
  const outlook = reviewRequestOutlook(
    {
      shippedAt: picked.iso,
      contactConsent: order.contact_consent,
      reviewRequestSentAt: order.review_request_sent_at,
    },
    now,
  );
  return { ok: true, text: reviewOutlookText(outlook, now) };
}

const MODES = [
  ["ship", "📦 יוצאת עכשיו"],
  ["delivered", "✓ כבר נמסרה ללקוח"],
] as const;

export function OrderShippingPanel({
  order,
  busy,
  onShip,
  preparing,
  onPreparing,
}: {
  order: ShippingOrder;
  busy: boolean;
  onShip: (req: ShipRequest) => void;
  preparing: boolean;
  onPreparing: () => void;
}) {
  const now = Date.now();
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [carrier, setCarrier] = useState(order.shipping_carrier ?? "");
  const [mode, setMode] = useState<"ship" | "delivered">("ship");
  // Defaults to the payment day: a late-marked order most often went out
  // within a day of it, and the owner corrects it if not.
  const [shipDate, setShipDate] = useState(() => {
    const from = Date.parse(order.paid_at ?? order.created_at);
    return dateInputValue(Number.isFinite(from) ? from : now);
  });

  const paid = order.payment_status === "paid";
  const unshipped = paid && !order.shipped_at;
  const paidDaysAgo = daysSince(order.paid_at, now);
  const preview = mode === "delivered" ? deliveredPreview(order, shipDate, now) : null;
  const fields = {
    tracking_number: tracking || undefined,
    carrier: carrier || undefined,
  };

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="font-semibold">משלוח</div>
      {order.shipped_at && (
        <div className="text-xs text-emerald-700">
          {order.shipping_status === "delivered"
            ? "✓ נמסרה ללקוח · יצאה ב-"
            : "✓ סומנה כנשלחה ללקוח ב-"}
          {new Date(order.shipped_at).toLocaleDateString("he-IL")}
        </div>
      )}
      {/* What the morning job will do with it — so "did the review request go
          out?" has an answer on the order itself. */}
      {order.shipped_at && paid && (
        <div className="text-xs text-muted-foreground">
          {reviewOutlookText(
            reviewRequestOutlook(
              {
                shippedAt: order.shipped_at,
                contactConsent: order.contact_consent,
                reviewRequestSentAt: order.review_request_sent_at,
              },
              now,
            ),
            now,
          )}
        </div>
      )}
      {/* "בהכנה" — the write that makes orders.shipping_status='preparing'
          reachable at all. Without it a paid buyer read "ממתין לטיפול" on
          /account for the whole fulfilment window, which is what a forgotten
          order looks like. Offered only before the order ships and only once
          paid. */}
      {unshipped && (
        <div className="flex flex-wrap items-center gap-2">
          {order.shipping_status === "preparing" ? (
            <span className="text-xs text-emerald-700">✓ מסומנת כבהכנה — הלקוח רואה זאת במעקב</span>
          ) : (
            <Button size="sm" variant="outline" disabled={preparing} onClick={onPreparing}>
              {preparing ? "מעדכן..." : "סמן כבהכנה 🛠"}
            </Button>
          )}
        </div>
      )}
      {unshipped && (
        <div className="space-y-2">
          <div
            className="flex flex-wrap gap-1.5 text-xs"
            role="group"
            aria-label="מה קרה עם ההזמנה"
          >
            {MODES.map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full border px-3 py-1 transition-colors duration-150 ${
                  mode === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "ship" && paidDaysAgo >= LIKELY_DELIVERED_AFTER_DAYS && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              ההזמנה שולמה לפני {paidDaysAgo} ימים. אם היא כבר אצל הלקוח, בחרו "כבר נמסרה ללקוח" —
              אחרת הוא יקבל עכשיו מייל "ההזמנה שלך בדרך".
            </div>
          )}
          {preview && (
            <div className="space-y-1 text-xs">
              <label className="flex flex-wrap items-center gap-2">
                <span>היום שבו ההזמנה יצאה:</span>
                <Input
                  type="date"
                  value={shipDate}
                  min={dateInputValue(Date.parse(order.created_at))}
                  max={dateInputValue(now)}
                  onChange={(e) => setShipDate(e.target.value)}
                  className="h-8 w-auto"
                />
              </label>
              <div className={preview.ok ? "text-muted-foreground" : "text-destructive"}>
                {preview.ok
                  ? `ההזמנה תסומן כהושלמה, והלקוח לא יקבל מייל "בדרך אליך". ${preview.text}`
                  : preview.text}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="מספר מעקב"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          className="max-w-[180px]"
        />
        <Input
          placeholder="חברת שילוח"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="max-w-[150px]"
        />
        {preview ? (
          <Button
            size="sm"
            disabled={busy || !preview.ok}
            onClick={() => onShip({ ...fields, delivered: true, shipped_on: shipDate })}
          >
            {busy ? "מעדכן..." : "סמן כנמסרה (בלי מייל) ✓"}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => onShip(fields)}>
            {busy ? "שולח..." : order.shipped_at ? "עדכן משלוח" : "סמן כנשלחה ושלח מייל ללקוח 📦"}
          </Button>
        )}
        {/* Shipped earlier and now with the customer: close it out. Keeps the
            original ship date; sends nothing. */}
        {order.shipped_at && order.shipping_status !== "delivered" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onShip({ ...fields, delivered: true })}
          >
            סמן כנמסרה ✓
          </Button>
        )}
      </div>
    </div>
  );
}
