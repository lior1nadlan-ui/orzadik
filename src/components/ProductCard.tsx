import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatILS, useCart, getEffectivePrice } from "@/lib/cart";
import { useFavorites } from "@/components/engagement/favorites";
import { ProductThumb } from "@/components/ProductThumb";
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
  /** How many same-name models this tile stands for. >1 collapses the group. */
  model_count?: number | null;
};

export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const { add } = useCart();
  const { has, toggle } = useFavorites();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  // has(id) is false during SSR/first paint and flips after mount — an
  // acceptable unfilled→filled flash, same class as the header cart badge.
  const saved = has(p.id);
  const isCallOnly = Number(p.price) === 0;
  const isOutOfStock = p.stock_status === "outofstock";
  const effective = getEffectivePrice(p.price);
  // The supplier gives many distinct SKUs the same name. Listings show one tile
  // per name; this says how many real models sit behind it.
  const modelCount = Number(p.model_count ?? 1);
  const hasModels = modelCount > 1;

  return (
    <div className="group relative flex flex-col h-full bg-card rounded-lg shadow-[var(--shadow-card)] overflow-hidden border border-border transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1">
      {isOutOfStock ? (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-muted text-muted-foreground text-xs font-bold px-2.5 py-1 shadow">
          אזל מהמלאי
        </div>
      ) : hasModels ? (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-argaman text-white text-xs font-bold px-2.5 py-1 shadow">
          {modelCount} דגמים
        </div>
      ) : null}

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
        <Heart className={`h-4 w-4 ${saved ? "fill-accent text-accent" : "text-foreground/60"}`} />
      </button>

      {/* Image */}
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        className="relative aspect-square overflow-hidden bg-muted block"
      >
        <ProductThumb
          url={p.thumbnail_url}
          alt={p.name}
          width={400}
          priority={priority}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </Link>

      {/* Caption */}
      <div className="flex flex-col flex-1 px-4 pt-4 pb-5 text-center">
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="font-display text-base leading-snug text-foreground hover:text-accent transition-colors line-clamp-2 min-h-[2.75em]"
        >
          {p.name}
        </Link>
        {isCallOnly ? (
          <div className="mt-3 text-sm text-muted-foreground">
            מחיר משתנה לפי שער הזהב
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-accent">
              {formatILS(effective)}
            </span>
          </div>
        )}

        {isOutOfStock ? (
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-4 w-full rounded-full border border-muted-foreground/40 text-muted-foreground text-sm py-2.5 text-center hover:bg-muted transition-colors"
          >
            אזל מהמלאי — לפרטים
          </Link>
        ) : isCallOnly ? (
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-4 w-full rounded-full bg-accent hover:bg-accent/90 text-accent-foreground text-sm py-2.5 text-center transition-colors"
          >
            צרו קשר להזמנה
          </Link>
        ) : hasModels ? (
          // This tile stands for several distinct SKUs. Adding to cart here
          // would silently pick one of them for the shopper, so send them to
          // the product page to choose.
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-4 w-full rounded-full bg-accent hover:bg-accent/90 text-accent-foreground text-sm py-2.5 text-center transition-colors"
          >
            לבחירת דגם
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
            className={`mt-4 w-full rounded-full border text-sm py-2.5 transition-colors ${
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
