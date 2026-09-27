// How an email states a product's price — the campaign cards and the
// abandoned-cart rows. Priced at the moment the email is SENT, from the same
// promotion index the storefront and placeOrder use, so a message sent during
// a promotion quotes the price the site charges and says until when.
//
// An email is read later than it is sent, so a promotional price always
// carries its end date. Without a live promotion the output is exactly what
// the emails printed before promotions existed.
import { esc, ils } from "@/lib/email.server";
import { formatPromoEnd, priceView, type ActivePromo } from "@/lib/promotions";

/** "מבצע חגים · בתוקף עד 02.10" — or null with no promotion. */
function promoNote(promo: ActivePromo | null): string | null {
  if (!promo) return null;
  const end = formatPromoEnd(promo.endsAt);
  const label = promo.label || "מחיר מבצע";
  return end ? `${label} · בתוקף עד ${end}` : label;
}

/** One product card's price (campaign email), as HTML. */
export function emailPriceHtml(price: number, promo: ActivePromo | null): string {
  if (Number(price) === 0) return `<div style="font-size:13px;color:#A8862A;">לפי שער הזהב</div>`;
  const v = priceView(Number(price), promo);
  if (!v.promo) {
    return `<div style="font-size:13px;"><strong style="color:#A8862A;">${ils(v.pays)}</strong></div>`;
  }
  return `<div style="font-size:13px;"><strong style="color:#A8862A;">${ils(v.pays)}</strong> <s style="color:#999;">${ils(v.regular)}</s> <span dir="ltr" style="display:inline-block;background:#5B1F27;color:#ffffff;border-radius:4px;padding:0 5px;font-size:11px;font-weight:bold;">-${v.pct}%</span></div>
        <div style="font-size:11px;color:#5B1F27;margin-top:2px;">${esc(promoNote(v.promo))}</div>`;
}

/** The same price as plain text (the text/plain part). */
export function emailPriceText(price: number, promo: ActivePromo | null): string {
  if (Number(price) === 0) return "לפי שער הזהב";
  const v = priceView(Number(price), promo);
  if (!v.promo) return ils(v.pays);
  // "20% הנחה" rather than "-20%": a leading minus next to Hebrew reorders in
  // a plain-text RTL line, and there is no markup here to isolate it.
  return `${ils(v.pays)} (במקום ${ils(v.regular)}, ${v.pct}% הנחה — ${promoNote(v.promo)})`;
}

/** What one cart line costs now, and what it would without the promotion. */
export function emailLine(
  price: number,
  quantity: number,
  promo: ActivePromo | null,
): { total: number; regularTotal: number; pct: number; note: string | null } {
  const qty = Number(quantity) || 0;
  const v = priceView(Number(price) || 0, promo);
  return {
    total: v.pays * qty,
    regularTotal: v.regular * qty,
    pct: v.pct,
    note: v.promo ? promoNote(v.promo) : null,
  };
}
