import { Link } from "@tanstack/react-router";
import { describeCoupon, type CouponTerms } from "@/lib/coupons";

/**
 * The site-wide strip while this tab carries a coupon — typically a shopper
 * who came through an influencer's link. It takes the promotion/club strip's
 * place with the same look and height (h-9, which SiteHeader's `-top-9` is
 * calibrated to), so it never shifts the page. The checkout applies the code
 * by itself; the strip just keeps the reason to buy in sight while browsing.
 */
export function CouponStrip({ terms }: { terms: CouponTerms }) {
  const sep = <span aria-hidden="true"> · </span>;
  return (
    <Link
      to="/cart"
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
        <span aria-hidden="true">🎁 </span>
        <span>הקוד </span>
        <bdi dir="ltr" className="font-bold">
          {terms.code}
        </bdi>
        <span> פעיל</span>
        {sep}
        <span className="font-bold text-argaman">{describeCoupon(terms)}</span>
        <span className="hidden sm:inline">{sep}יוחל אוטומטית בקופה</span>
      </span>
    </Link>
  );
}
