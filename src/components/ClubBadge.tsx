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
    // Announcement strip: argaman-deep ground, cream text (13.2:1), emphasis
    // words in gold-bright (7.4:1) — the site-wide dark-band idiom.
    return (
      <Link
        to="/auth"
        dir="rtl"
        className={`group flex h-9 w-full items-center justify-center bg-argaman-deep px-4 text-[13px] tracking-wide text-cream ${className}`}
      >
        <span className="truncate">
          <span className="hidden sm:inline">הצטרפו לחבר מועדון בחינם וקבלו </span>
          <span className="font-bold text-gold-bright">5% הנחה נוספת</span>
          <span className="sm:hidden"> לחברי מועדון</span>
          <span className="hidden md:inline"> מעבר ל-<span className="font-bold text-gold-bright">15%</span> הקיימים</span>
          <span aria-hidden="true"> · </span>
          <span className="font-bold text-gold-bright underline decoration-gold-bright/50 underline-offset-4 group-hover:decoration-gold-bright transition-colors">
            הרשמה
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/auth"
      className={`group flex items-center gap-3 rounded-lg border border-gold/50 bg-gradient-to-br from-cream to-white px-3.5 py-2.5 hover:shadow-[var(--shadow-card)] transition ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] tracking-[0.18em] text-accent font-bold uppercase leading-none mb-1">
          חבר מועדון • חינם
        </div>
        <div className="text-xs text-foreground/85 leading-snug">
          קבלו <strong className="text-accent">5% הנחה נוספת</strong> על המוצר הזה ועל כל הזמנה,
          מעבר ל-15% הקיימים
        </div>
      </div>
      <span className="text-xs font-semibold text-accent whitespace-nowrap underline group-hover:no-underline">
        הצטרפו
      </span>
    </Link>
  );
}
