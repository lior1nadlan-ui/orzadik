import { BUSINESS } from "@/lib/business";

/** The fields the slip prints. Deliberately no price anywhere in the type. */
export type PackingSlipOrder = {
  order_number: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  notes: string | null;
  is_gift: boolean | null;
  gift_note: string | null;
  gift_wrap: boolean | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  cardcom_document_number: string | null;
  order_items:
    | {
        id: string;
        product_name: string;
        product_sku: string | null;
        quantity: number;
        variant_label: string | null;
        custom_text: string | null;
      }[]
    | null;
};

function dateHe(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("he-IL") : "";
}

/**
 * The printable sheet itself — presentational only, so the route can own the
 * fetching and the print chrome. See admin.orders_.$orderId.print.tsx for why
 * it looks the way it does.
 */
export function PackingSlip({ o }: { o: PackingSlipOrder }) {
  const items = o.order_items ?? [];
  const units = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const hasPersonal = items.some((it) => it.custom_text);

  return (
    <article
      dir="rtl"
      className="print-slip mx-auto max-w-[800px] rounded-lg border bg-white p-8 text-[13px] leading-relaxed text-black"
    >
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <div className="font-display text-2xl font-bold">{BUSINESS.name}</div>
          <div className="text-xs">
            {BUSINESS.address} · טל׳ {BUSINESS.phoneDisplay}
          </div>
          <div className="text-xs">orzadik.com</div>
        </div>
        <div className="text-left">
          <div className="text-lg font-bold">דף אריזה</div>
          <div className="font-mono text-base font-bold">{o.order_number}</div>
          <div className="text-xs">הוזמן {dateHe(o.created_at)}</div>
          {o.cardcom_document_number && (
            <div className="text-xs">מסמך {o.cardcom_document_number}</div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b border-black/40 py-4">
        <div>
          <div className="mb-1 text-xs font-bold">משלוח אל</div>
          <div className="text-base font-bold">{o.customer_name}</div>
          <div>{o.customer_address}</div>
          <div>{o.customer_city}</div>
          <div dir="ltr" className="text-right font-mono">
            {o.customer_phone}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-bold">לאריזה</div>
          <div>
            {items.length} שורות · {units} יחידות
          </div>
          {o.is_gift && (
            <div className="mt-1 font-bold">
              🎁 מתנה{o.gift_wrap ? " · לעטוף בעטיפה חגיגית" : " · ללא עטיפה"}
            </div>
          )}
          {o.gift_note && <div className="mt-1">✂ לצרף כרטיס הקדשה (בתחתית הדף)</div>}
          {hasPersonal && <div className="mt-1">✦ יש פריטים עם כיתוב אישי — לבדוק אות באות</div>}
        </div>
      </section>

      {o.notes && (
        <section className="border-b border-black/40 py-3">
          <span className="text-xs font-bold">הערות הלקוח: </span>
          <span className="whitespace-pre-wrap">{o.notes}</span>
        </section>
      )}

      <table className="mt-4 w-full border-collapse text-right">
        <thead>
          <tr className="border-b-2 border-black text-xs">
            <th className="w-8 py-1.5" aria-label="נארז" />
            <th className="py-1.5">פריט</th>
            <th className="py-1.5">מידה / גרסה</th>
            <th className="py-1.5">כיתוב אישי</th>
            <th className="w-14 py-1.5 text-center">כמות</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-black/30 align-top">
              <td className="py-2">
                <span aria-hidden="true" className="inline-block h-4 w-4 border border-black" />
              </td>
              <td className="py-2 pe-2">
                <div className="font-bold">{it.product_name}</div>
                {it.product_sku && (
                  <div className="font-mono text-[11px]">מק״ט {it.product_sku}</div>
                )}
              </td>
              <td className="py-2 pe-2">{it.variant_label ?? "—"}</td>
              <td className="py-2 pe-2">
                {it.custom_text ? (
                  <span className="inline-block whitespace-pre-wrap border border-black px-2 py-1 text-[15px] font-bold">
                    ✦ {it.custom_text}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 text-center text-base font-bold">{it.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
        <div>נארז על ידי: ____________</div>
        <div>
          משלוח: {o.shipping_carrier || "____________"}
          {o.tracking_number ? ` · מעקב ${o.tracking_number}` : " · מעקב ____________"}
        </div>
      </div>

      {o.gift_note && (
        <section className="mt-10">
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <span aria-hidden="true">✂</span>
            <span className="flex-1 border-t border-dashed border-black" />
            <span>כרטיס הקדשה — לגזור ולצרף לחבילה</span>
            <span className="flex-1 border-t border-dashed border-black" />
          </div>
          <div className="mx-auto max-w-[420px] border border-black px-8 py-10 text-center">
            <div className="whitespace-pre-wrap font-display text-xl leading-loose">
              {o.gift_note}
            </div>
            <div className="mt-6 text-[11px]">✦ {BUSINESS.name} ✦</div>
          </div>
        </section>
      )}

      <footer className="mt-10 border-t border-black/40 pt-3 text-center text-xs">
        תודה שבחרתם ב{BUSINESS.name} · orzadik.com · {BUSINESS.phoneDisplay}
      </footer>
    </article>
  );
}
