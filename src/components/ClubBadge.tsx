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
    return (
      <Link
        to="/auth"
        dir="rtl"
        className={`relative block w-full overflow-hidden bg-[#FAF6E9] border-y border-[#D4AF37]/30 shadow-[0_2px_15px_rgba(168,134,42,0.08)] py-2.5 group ${className}`}
      >
        {/* Jewel shimmer */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0%,rgba(212,175,55,0.10)_25%,transparent_50%,rgba(212,175,55,0.10)_75%,transparent_100%)] motion-safe:animate-[spin_8s_linear_infinite]" />
        </div>

        <div className="container mx-auto px-6 flex items-center justify-center gap-3 sm:gap-4 relative z-10">
          {/* Left ornament */}
          <svg className="hidden md:block w-4 h-4 text-[#D4AF37] opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
          </svg>

          <p className="text-[#A8862A] text-[12px] sm:text-sm md:text-base tracking-wide flex items-center flex-wrap justify-center gap-x-2">
            <span className="font-light">הצטרפו לחבר מועדון בחינם וקבלו</span>
            <span className="font-bold bg-gradient-to-l from-[#D4AF37] via-[#A8862A] to-[#D4AF37] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
              5% הנחה נוספת
            </span>
            <span className="font-light opacity-80 underline decoration-[#D4AF37]/30 underline-offset-4">
              מעבר ל-15% הקיימים
            </span>
          </p>

          {/* Divider */}
          <div className="h-4 w-px bg-[#D4AF37]/30 hidden sm:block" />

          {/* CTA */}
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="font-bold text-[#8C6F1E] text-[12px] sm:text-sm md:text-base border-b-2 border-[#D4AF37] group-hover:border-[#A8862A] transition-colors">
              הרשמה
            </span>
            <svg className="w-4 h-4 text-[#D4AF37] transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </span>

          {/* Right ornament */}
          <svg className="hidden md:block w-4 h-4 text-[#D4AF37] opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
          </svg>
        </div>

        {/* Fine gold accents */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      </Link>
    );
  }

  return (
    <Link
      to="/auth"
      className={`group flex items-center gap-3 rounded-lg border border-[#D4AF37]/50 bg-gradient-to-br from-[#FAF6E9] to-white px-3.5 py-2.5 hover:shadow-[var(--shadow-card)] transition ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] tracking-[0.18em] text-[#A8862A] font-bold uppercase leading-none mb-1">
          חבר מועדון • חינם
        </div>
        <div className="text-xs text-foreground/85 leading-snug">
          קבלו <strong className="text-[#A8862A]">5% הנחה נוספת</strong> על המוצר הזה ועל כל הזמנה,
          מעבר ל-15% הקיימים
        </div>
      </div>
      <span className="text-xs font-semibold text-[#A8862A] whitespace-nowrap underline group-hover:no-underline">
        הצטרפו
      </span>
    </Link>
  );
}
