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

export function ProductCard({ p, priority = false, eager, highPriority }: { p: ProductCardData; priority?: boolean; eager?: boolean; highPriority?: boolean }) {
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
    // Glass tile, spelled out rather than composed from `.glass`. DELIBERATE:
    // `.glass` carries `backdrop-filter: blur(16px) saturate(1.25)`, and this
    // component renders 24 tiles per /shop page (+24 per "load more") and up to
    // ~1000 at once on /category/$slug, which would put that many live
    // backdrop-filter layers on the two highest-traffic routes — the compositor
    // re-snapshots and re-blurs every one of them on every scrolled frame.
    // shop.tsx's skeleton block already refuses this for a mere 8 panes. The
    // blur also buys nothing here: the tiles sit on the flat near-white ground
    // plus a very low-alpha fixed mesh, so 72%-white-over-it is visually the
    // same as an opaque fill. So: `bg-card` + the SAME radius token + the SAME
    // three-part glass box-shadow (inset hairline + inner highlight + the wide
    // drop shadow), minus the two backdrop-filter declarations. Opaque white
    // also raises --accent from 5.71:1 to 5.81:1. Restating the vars rather
    // than hard-coding keeps `html.a11y-contrast` working (it repoints
    // --glass-line to #000 and --glass-highlight to transparent).
    // `isolate` restores the stacking context that backdrop-filter used to
    // create, so the z-10 badge/heart stay scoped to their own tile.
    // The hover lift restates the full shadow (inset rings + the LIFT drop
    // shadow) instead of a bare `shadow-*`, which would blow away the rings.
    // Hover is gated to real pointers; movement is additionally motion-safe
    // gated (reduced motion keeps colour/opacity, drops movement).
    // Tailwind v4 emits -translate-y-* to the standalone `translate` property,
    // so `translate` is named in the transition list alongside `transform`.
    <div className="group relative isolate flex flex-col h-full overflow-hidden rounded-[var(--glass-radius)] bg-card shadow-[inset_0_0_0_1px_var(--glass-line),inset_0_1px_0_var(--glass-highlight),var(--glass-shadow)] transition-[transform,translate,box-shadow] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[inset_0_0_0_1px_var(--glass-line),inset_0_1px_0_var(--glass-highlight),var(--glass-shadow-lift)] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1">
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
        // Press + hover written out rather than composed from `.press`: that
        // utility declares `transition-property: transform` and, being emitted
        // after Tailwind's own utilities, it would win over `transition-colors`
        // and make the fill snap. Naming every property keeps both.
        className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
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
          // Lets a row with no thumbnail_url fall back to a bundled photograph
          // instead of "אין תמונה" — the groom sets are the only such rows.
          slug={p.slug}
          alt={p.name}
          width={400}
          priority={priority}
          eager={eager}
          highPriority={highPriority}
          // 700ms was well over the 300ms UI ceiling. v4 emits scale-* to the
          // standalone `scale` property, so it is named in the transition list.
          className="h-full w-full object-cover transition-[transform,scale] duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
        />
      </Link>

      {/* Caption */}
      <div className="flex flex-col flex-1 px-4 pt-4 pb-5 text-center">
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="font-display text-base leading-snug text-foreground transition-colors duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent line-clamp-2 min-h-[2.75em]"
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
            className="mt-4 w-full rounded-full border border-muted-foreground/40 text-muted-foreground text-sm py-2.5 text-center transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
          >
            אזל מהמלאי — לפרטים
          </Link>
        ) : isCallOnly ? (
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="mt-4 w-full rounded-full bg-accent text-accent-foreground text-sm py-2.5 text-center transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
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
            className="mt-4 w-full rounded-full bg-accent text-accent-foreground text-sm py-2.5 text-center transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
          >
            לבחירת דגם
          </Link>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              // add() opens the mini-cart drawer as the persistent confirmation
              // (running subtotal + a direct path to checkout), so the old
              // transient toast is gone. The button keeps its brief "נוסף ✓"
              // state, which also debounces a rapid double-add.
              add({ productId: p.id, slug: p.slug, name: p.name, price: p.price, salePrice: p.sale_price, thumbnail: p.thumbnail_url });
              setAdded(true);
              window.setTimeout(() => setAdded(false), 1500);
            }}
            disabled={added}
            className={`mt-4 w-full rounded-full border text-sm py-2.5 transition-[color,background-color,border-color,transform,scale] duration-160 ease-out motion-safe:active:scale-[0.97] focus-visible:active:scale-100 ${
              added
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/80 text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
            }`}
          >
            {added ? "נוסף ✓" : "הוסף לעגלה"}
          </button>
        )}
      </div>
    </div>
  );
}
