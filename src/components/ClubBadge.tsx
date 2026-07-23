import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Props = {
  variant?: "inline" | "strip";
  className?: string;
};

/**
 * Small "Join the club" promo badge.
 * - inline: rounded card, used at top of product pages and similar spots.
 * - strip: full-width thin strip, used as a site-wide banner.
 * Hidden when the user is already logged in (already a member).
 */
export function ClubBadge({ variant = "inline", className = "" }: Props) {
  const { user } = useAuth();
  if (user) return null;

  if (variant === "strip") {
    // Announcement strip: a barely-tinted glass band on the white ground, body
    // in --foreground and emphasis in --accent. The old dark-band idiom is gone
    // with the argaman ground, and so are its text colours: text-cream is 1.08:1
    // on light and text-gold-bright is 1.84:1 — both exist ONLY for dark image
    // scrims and are illegal here.
    //
    // .glass-strong, not .glass: the header pins at -top-9 and this strip scrolls
    // up over live page content on the way out, so its backdrop is briefly
    // unknown. At 94% the worst case (pure black behind it) still leaves --accent
    // at 4.87:1 and --foreground at 14.89:1; at rest over the page ground they
    // are 5.56:1 and 16.99:1.
    //
    // The utility's variables are retuned instead of fighting it with bg-*/
    // rounded-*/shadow-* (which .glass-strong wins against): square corners, no
    // ring, no top highlight, and the third shadow slot repurposed into the
    // single hairline bottom edge.
    //
    // HEIGHT IS LOAD-BEARING: h-9 must stay exactly 36px — SiteHeader's
    // `sticky -top-9` is calibrated to it.
    return (
      // The strip is the site-wide banner: send it to the club landing page,
      // which explains the offer before asking for a signup. The inline variant
      // appears next to a specific product and still goes straight to /auth.
      <Link
        to="/club"
        dir="rtl"
        className={`group flex h-9 w-full items-center justify-center px-4 text-[13px] tracking-wide text-foreground
          glass-strong
          [--glass-radius:0]
          [--glass-bg-strong:rgba(252,250,243,0.94)]
          [--glass-line-strong:transparent]
          [--glass-highlight:transparent]
          [--glass-shadow-lift:inset_0_-1px_0_var(--glass-line)]
          ${className}`}
      >
        <span className="truncate">
          <span className="hidden sm:inline">הצטרפו למועדון הלקוחות שלנו — </span>
          <span className="font-bold text-accent">חברות חינם</span>
          <span className="hidden md:inline"> · מעקב הזמנות והטבות לחברי מועדון</span>
          <span aria-hidden="true"> · </span>
          <span
            className="font-bold text-accent underline decoration-gold underline-offset-4
              transition-[text-decoration-color] duration-200 ease-out
              [@media(hover:hover)_and_(pointer:fine)]:group-hover:decoration-accent"
          >
            הרשמה
          </span>
        </span>
      </Link>
    );
  }

  // Inline card: a real glass pane with a gold hairline ring instead of the old
  // cream→white gradient. .glass supplies the fill, the blur, the radius and the
  // ring, and .glass-gold swaps that ring to gold — so no bg-*/rounded-*/shadow-*
  // utility is fighting it. Hover crisps the hairline rather than moving the
  // panel (a discrete custom-property swap, so nothing tries to tween a
  // non-animatable value), and .press supplies the tactile 0.97 on activation.
  // The bg-accent/text-accent internals below are already correct — untouched.
  return (
    <Link
      to="/auth"
      className={`group flex items-center gap-3 glass glass-gold press [--glass-radius:0.75rem] px-3.5 py-2.5
        [@media(hover:hover)_and_(pointer:fine)]:hover:[--glass-line:rgba(194,162,94,0.75)]
        ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] tracking-[0.18em] text-accent font-bold uppercase leading-none mb-1">
          חבר מועדון • חינם
        </div>
        <div className="text-xs text-foreground/85 leading-snug">
          הצטרפו <strong className="text-accent">בחינם</strong> ותיהנו ממעקב הזמנות באזור האישי
          ומהטבות לחברי מועדון
        </div>
      </div>
      <span className="text-xs font-semibold text-accent whitespace-nowrap underline [@media(hover:hover)_and_(pointer:fine)]:group-hover:no-underline">
        הצטרפו
      </span>
    </Link>
  );
}
