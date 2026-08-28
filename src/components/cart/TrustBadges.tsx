import { Link } from "@tanstack/react-router";
import { BUSINESS, CONSUMER_POLICY } from "@/lib/business";

/**
 * Maximum instalments the payment page will offer, or 0 when the owner has not
 * confirmed one yet.
 *
 * Read from the SAME `VITE_CARDCOM_MAX_PAYMENTS` that drives
 * AdvancedDefinition.MaxNumOfPayments in src/lib/cardcom.functions.ts. Vite
 * inlines `import.meta.env.VITE_*` as a literal into both bundles, so the number
 * printed here and the number CardCom is told are the same literal and cannot
 * drift. Unset ⇒ 0 ⇒ nothing is printed: a "12 תשלומים" line the payment page
 * then does not offer is worse than silence.
 */
export function maxPaymentsOffered(): number {
  const n = Number(import.meta.env.VITE_CARDCOM_MAX_PAYMENTS);
  if (!Number.isInteger(n) || n < 2) return 0;
  return Math.min(n, 36);
}

/** One-line answer to "אפשר בתשלומים?", or null when there is no honest answer. */
export function instalmentsLine(): string | null {
  const n = maxPaymentsOffered();
  return n > 0 ? `אפשר לפרוס את התשלום עד ${n} תשלומים בכרטיס אשראי` : null;
}

/**
 * Trust signals shown near the payment CTA — single source for both the cart
 * and the checkout so the copy can never drift between the two pages.
 * `compact` drops only the delivery-window line, which /cart already prints in
 * its own summary column.
 *
 * The two policy links point at the dedicated /returns and /shipping summaries
 * rather than deep-linking into the terms: a shopper mid-checkout wants the
 * short answer, and both pages carry a footnote back to the binding clause.
 * The windows themselves come from CONSUMER_POLICY, the same constants those
 * pages render, so no surface can publish a window the store does not honour.
 */
export function TrustBadges({ compact }: { compact?: boolean }) {
  const instalments = instalmentsLine();
  return (
    <ul className="mt-4 space-y-2 border-t border-glass-line pt-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-accent">
          🔒
        </span>
        תשלום מאובטח בכרטיס אשראי בסליקת Cardcom (תקן PCI)
      </li>
      {/* Printed only once the owner confirms what the terminal actually clears
          — see maxPaymentsOffered(). Nothing here is a claim we invent. */}
      {instalments && (
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-accent">
            💳
          </span>
          <span>{instalments}</span>
        </li>
      )}
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-accent">
          ↩️
        </span>
        <span>
          זכות ביטול תוך {CONSUMER_POLICY.cancellationDays} יום מקבלת המוצר (חוק הגנת הצרכן) — ראו{" "}
          <Link
            to="/returns"
            className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
          >
            ביטול והחזרות
          </Link>
          . מוצרים בהתאמה אישית מוגבלים לביטול.
        </span>
      </li>
      {!compact && (
        <li className="flex items-center gap-2">
          <span aria-hidden className="text-accent">
            🚚
          </span>
          <span>
            משלוח עד הבית · אספקה משוערת {CONSUMER_POLICY.deliveryMinDays}-
            {CONSUMER_POLICY.deliveryMaxDays} ימי עסקים — ראו{" "}
            <Link
              to="/shipping"
              className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
            >
              משלוחים ואספקה
            </Link>
            .
          </span>
        </li>
      )}
      {/* Was plain text ("זמינים בוואטסאפ לכל שאלה") AND behind the !compact
          gate, so /cart — the page where a hesitating shopper is most likely to
          want a human — never showed it at all, and /checkout showed a promise
          with nothing to tap. Now a real wa.me link on the store's own number,
          on both pages. Same pattern order.$id.tsx uses; the number comes from
          BUSINESS, never from untrusted content. */}
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-accent">
          💬
        </span>
        <span>
          צריכים עזרה?{" "}
          <a
            href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent("שלום, יש לי שאלה לפני ביצוע הזמנה באתר")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
          >
            כתבו לנו בוואטסאפ
          </a>{" "}
          ונענה לכל שאלה.
        </span>
      </li>
    </ul>
  );
}
