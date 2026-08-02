import { Link } from "@tanstack/react-router";
import { CONSUMER_POLICY } from "@/lib/business";

/**
 * Trust signals shown near the payment CTA — single source for both the cart
 * and the checkout so the copy can never drift between the two pages.
 * `compact` renders only the secure-payment and cancellation-rights lines.
 *
 * The two policy links point at the dedicated /returns and /shipping summaries
 * rather than deep-linking into the terms: a shopper mid-checkout wants the
 * short answer, and both pages carry a footnote back to the binding clause.
 * The windows themselves come from CONSUMER_POLICY, the same constants those
 * pages render, so no surface can publish a window the store does not honour.
 */
export function TrustBadges({ compact }: { compact?: boolean }) {
  return (
    <ul className="mt-4 space-y-2 border-t border-glass-line pt-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-accent">🔒</span>
        תשלום מאובטח בכרטיס אשראי בסליקת Cardcom (תקן PCI)
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-accent">↩️</span>
        <span>זכות ביטול תוך {CONSUMER_POLICY.cancellationDays} יום מקבלת המוצר (חוק הגנת הצרכן) — ראו <Link to="/returns" className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent">ביטול והחזרות</Link>. מוצרים בהתאמה אישית מוגבלים לביטול.</span>
      </li>
      {!compact && (
        <>
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-accent">🚚</span>
            <span>משלוח עד הבית · אספקה משוערת {CONSUMER_POLICY.deliveryMinDays}-{CONSUMER_POLICY.deliveryMaxDays} ימי עסקים — ראו <Link to="/shipping" className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent">משלוחים ואספקה</Link>.</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-accent">💬</span>
            צריכים עזרה? זמינים בוואטסאפ לכל שאלה
          </li>
        </>
      )}
    </ul>
  );
}
