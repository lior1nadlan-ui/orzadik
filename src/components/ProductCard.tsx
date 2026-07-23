import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatILS, useCart, getEffectivePrice, getDisplayOriginal, getDiscountPct } from "@/lib/cart";
import { useFavorites } from "@/components/engagement/favorites";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
  stock_status?: string | null;
};

export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const { add } = useCart();
  const { has, toggle } = useFavorites();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);
  // has(id) is false during SSR/first paint and flips after mount — an
  // acceptable unfilled→filled flash, same class as the header cart badge.
  const saved = has(p.id);
  const isCallOnly = Number(p.price) === 0;
  const isOutOfStock = p.stock_status === "outofstock";
  const effective = getEffectivePrice(p.price);
  const original = getDisplayOriginal(p.price, p.sale_price);
  const discountPct = getDiscountPct(p.price, p.sale_price);
  const hasDiscount = discountPct > 0;

  return (
    <div className="group relative flex flex-col h-full bg-background rounded-2xl shadow-[var(--shadow-card)] overflow-hidden border border-border/40 transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1">
      {/* Discount badge — only when there is a genuine former price */}
      {!isCallOnly && !isOutOfStock && hasDiscount && (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-[#D4AF37] text-white text-xs font-bold px-2.5 py-1 shadow">
          {discountPct}%-
        </div>
      )}
      {isOutOfStock && (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-muted-foreground/90 text-white text-xs font-bold px-2.5 py-1 shadow">
          אזל מהמלאי
        </div>
      )}

      {/* Favorites heart — a sibling of the image link (not inside it) so a
          click never navigates. Top-left is the one corner free both here
          (badges own the top-right) and on the product page. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const wasAdded = toggle(p.id);
          if (wasAdded) {
            toast.success("נשמר במועדפים", {
              action: { label: "למועדפים", onClick: () => navigate({ to: "/favorites" }) },
            });
          }
        }}
        aria-pressed={saved}
        aria-label={saved ? "הסר מהמועדפים" : "הוסף למועדפים"}
        className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white transition-colors"
      >
        <Heart className={`h-4 w-4 ${saved ? "fill-[#D4AF37] text-[#D4AF37]" : "text-foreground/60"}`} />
      </button>

      {/* Image */}
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        className="relative aspect-square overflow-hidden bg-muted block"
      >
        {p.thumbnail_url && !imgError ? (
          <img
            src={p.thumbnail_url}
            alt={p.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">אין תמונה</div>
        )}
      </Link>

      {/* Caption */}
      <div className="flex flex-col flex-1 px-4 pt-4 pb-5 text-center">
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="font-display text-[14px] md:text-[15px] leading-snug text-foreground hover:text-accent transition-colors line-clamp-2 min-h-[2.6em]"
        >
          {p.name}
        </Link>
        {isCallOnly ? (
          <div className="mt-3 text-sm font-semibold text-[#A8862A]">
            מחיר משתנה לפי שער הזהב
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-0.5">
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">{formatILS(original)}</span>
            )}
            <span className="text-base tracking-wide font-bold text-[#A8862A]">
              {formatILS(effective)}
            </span>
          </div>
        )}

        {isOutOfStock ? (
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-4 mx-auto w-full max-w-[200px] rounded-full border border-border text-muted-foreground text-sm py-2.5 text-center hover:bg-muted transition-colors"
          >
            אזל מהמלאי — לפרטים
          </Link>
        ) : isCallOnly ? (
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-4 mx-auto w-full max-w-[200px] rounded-full bg-[#D4AF37] hover:bg-[#A8862A] text-white text-sm py-2.5 text-center transition-colors"
          >
            צרו קשר להזמנה
          </Link>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              add({ productId: p.id, slug: p.slug, name: p.name, price: p.price, salePrice: p.sale_price, thumbnail: p.thumbnail_url });
              toast.success("נוסף לעגלה", { action: { label: "לצפייה בעגלה", onClick: () => navigate({ to: "/cart" }) } });
              setAdded(true);
              window.setTimeout(() => setAdded(false), 1500);
            }}
            disabled={added}
            className={`mt-4 mx-auto w-full max-w-[200px] rounded-full border text-sm py-2.5 transition-colors ${
              added
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/80 text-foreground hover:bg-foreground hover:text-background"
            }`}
          >
            {added ? "נוסף ✓" : "הוסף לעגלה"}
          </button>
        )}
      </div>
    </div>
  );
}
