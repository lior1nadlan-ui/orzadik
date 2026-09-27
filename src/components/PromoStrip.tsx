import { Link } from "@tanstack/react-router";
import { usePromoHeadline } from "@/lib/promotions-data";
import { formatPromoEnd } from "@/lib/promotions";

/**
 * The site-wide strip while a CRM promotion is live — it takes the club strip's
 * place (ClubBadge variant="strip") and its exact look and height: h-9 is what
 * SiteHeader's `sticky -top-9` is calibrated to. Links to /mivtzaim, which
 * lists what the promotion covers.
 *
 * Only facts the product pages also show: the label the owner set, the
 * percentage, and the end date. With several promotions it says how many and
 * the biggest percentage ("עד 30%") — never a bigger number than any price on
 * the site carries.
 *
 * Returns null when nothing is live; SiteHeader then shows the club strip.
 */
export function PromoStrip() {
  const h = usePromoHeadline();
  if (!h) return null;

  const pct = (n: number) => <span className="font-bold text-argaman">{n}% הנחה</span>;
  const sep = <span aria-hidden="true"> · </span>;

  let body;
  if (h.single) {
    const end = formatPromoEnd(h.single.endsAt);
    body = (
      <>
        <span className="font-bold">{h.single.label || "מבצע באתר"}</span>
        {sep}
        {pct(h.single.percentOff)}
        <span className="hidden sm:inline">
          {h.single.storeWide ? " על כל האתר" : " על פריטים נבחרים"}
        </span>
        {end ? (
          <>
            {sep}
            <span>עד {end}</span>
          </>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        <span className="font-bold">{h.count} מבצעים באתר</span>
        {sep}
        <span>עד </span>
        {pct(h.maxPercent)}
      </>
    );
  }

  return (
    <Link
      to="/mivtzaim"
      dir="rtl"
      className="group flex h-9 w-full items-center justify-center px-4 text-[13px] tracking-wide text-foreground
        glass-strong
        [--glass-radius:0]
        [--glass-bg-strong:rgba(252,250,243,0.94)]
        [--glass-line-strong:transparent]
        [--glass-highlight:transparent]
        [--glass-shadow-lift:inset_0_-1px_0_var(--glass-line)]"
    >
      <span className="truncate">
        {body}
        {sep}
        <span
          className="font-bold text-accent underline decoration-gold underline-offset-4
            transition-[text-decoration-color] duration-200 ease-out
            [@media(hover:hover)_and_(pointer:fine)]:group-hover:decoration-accent"
        >
          {h.single ? "לפריטים במבצע" : "לכל המבצעים"}
        </span>
      </span>
    </Link>
  );
}
