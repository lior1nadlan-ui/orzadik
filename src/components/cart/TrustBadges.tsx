import { Link } from "@tanstack/react-router";

/**
 * Trust signals shown near the payment CTA — single source for both the cart
 * and the checkout so the copy can never drift between the two pages.
 * `compact` renders only the secure-payment and cancellation-rights lines.
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
        <span>זכות ביטול תוך 14 יום מקבלת המוצר (חוק הגנת הצרכן) — ראו <Link to="/terms" className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent">מדיניות ביטול והחזרות</Link>. מוצרים בהתאמה אישית מוגבלים לביטול.</span>
      </li>
      {!compact && (
        <>
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-accent">🚚</span>
            משלוח עד הבית · אספקה משוערת 3–14 ימי עסקים
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
