import { Link } from "@tanstack/react-router";
import { formatILS, useCart, getEffectivePrice, getDisplayOriginal, getDiscountPct } from "@/lib/cart";
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

export function ProductCard({ p }: { p: ProductCardData }) {
  const { add } = useCart();
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

      {/* Image */}
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        className="relative aspect-square overflow-hidden bg-muted block"
      >
        {p.thumbnail_url ? (
          <img
            src={p.thumbnail_url}
            alt={p.name}
            loading="lazy"
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
              toast.success("נוסף לעגלה");
            }}
            className="mt-4 mx-auto w-full max-w-[200px] rounded-full border border-foreground/80 text-foreground text-sm py-2.5 hover:bg-foreground hover:text-background transition-colors"
          >
            הוסף לעגלה
          </button>
        )}
      </div>
    </div>
  );
}
