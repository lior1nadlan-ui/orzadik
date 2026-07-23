import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatILS, useCart, getEffectivePrice, getDisplayOriginal } from "@/lib/cart";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Package, Sparkles } from "lucide-react";

export type BundleProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  /** Genuine recorded former price — drives the honest strike-through total. */
  sale_price: number | null;
  thumbnail_url: string | null;
  /**
   * When `price` is a size variant's price, these carry the variant onto the
   * cart line — checkout reprices from the DB, so a line missing variantId
   * would be charged the base product price instead of the displayed one.
   */
  variantId?: string;
  variantLabel?: string;
};

// The set is a "frequently bought together" convenience. Items are added to
// the cart at their normal (already site-discounted) price — there is no extra
// bundle discount, so the displayed total must equal what checkout charges.

export function BundleOffer({
  main,
  addons,
  variant = "full",
}: {
  main: BundleProduct;
  addons: BundleProduct[];
  variant?: "full" | "compact";
}) {
  const { add } = useCart();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { [main.id]: true };
    addons.forEach((a, i) => (init[a.id] = i === 0));
    return init;
  });

  const all = useMemo(() => [main, ...addons], [main, addons]);
  const chosen = all.filter((p) => selected[p.id]);
  const totalBase = chosen.reduce((s, p) => s + getDisplayOriginal(p.price, p.sale_price), 0);
  const totalEff = chosen.reduce((s, p) => s + getEffectivePrice(p.price), 0);

  function addBundle() {
    if (chosen.length < 2) {
      toast.error("בחרו לפחות מוצר אחד נוסף לערכה");
      return;
    }
    for (const p of chosen) {
      add({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        salePrice: p.sale_price,
        thumbnail: p.thumbnail_url,
        variantId: p.variantId,
        variantLabel: p.variantLabel,
      });
    }
    toast.success(`${chosen.length} פריטים נוספו לעגלה`);
  }

  if (variant === "compact") {
    return (
      <section className="mt-5 rounded-xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF6E9] via-white to-[#FAF6E9] p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-[#A8862A] flex-shrink-0" />
            <p className="text-[10px] tracking-[0.2em] text-[#A8862A] uppercase font-bold truncate">
              ערכה משתלמת
            </p>
          </div>
          <span className="rounded-full bg-[#D4AF37] text-white text-[10px] font-bold px-2 py-0.5 flex-shrink-0">
            מומלץ יחד
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-2.5">
          {all.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-1.5">
              {idx > 0 && <Plus className="h-3 w-3 text-[#D4AF37] flex-shrink-0" />}
              <label className="relative cursor-pointer block">
                <Link
                  to="/product/$slug"
                  params={{ slug: p.slug }}
                  onClick={(e) => idx === 0 && e.preventDefault()}
                  title={p.name}
                  className={
                    "block h-14 w-14 rounded-md overflow-hidden bg-white border transition " +
                    (selected[p.id]
                      ? "border-[#D4AF37] ring-1 ring-[#D4AF37]/50"
                      : "border-border/60 opacity-50")
                  }
                >
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.name} className="h-full w-full object-contain p-0.5" />
                  ) : null}
                </Link>
                <div className="absolute -top-1 -right-1 bg-white rounded border border-border shadow-sm">
                  <Checkbox
                    checked={!!selected[p.id]}
                    onCheckedChange={(v) =>
                      setSelected((s) => ({ ...s, [p.id]: !!v }))
                    }
                    disabled={idx === 0}
                    className="h-3.5 w-3.5"
                  />
                </div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#D4AF37]/30">
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground leading-none">סה״כ ערכה</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-[#A8862A]">{formatILS(totalEff)}</span>
              {totalBase > totalEff && (
                <span className="text-[10px] text-muted-foreground line-through">{formatILS(totalBase)}</span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={addBundle}
            className="bg-[#D4AF37] hover:bg-[#A8862A] text-white text-xs h-8 px-3"
          >
            הוסף ערכה
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 rounded-2xl border-2 border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF6E9] to-white p-5 md:p-8 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-[#A8862A]" />
          <p className="text-xs tracking-[0.25em] text-[#A8862A] uppercase font-semibold">ערכה משתלמת</p>
        </div>
        <span className="rounded-full bg-[#D4AF37] text-white text-xs font-bold px-3 py-1 shadow-sm">
          ערכה מומלצת
        </span>
      </div>
      <h3 className="font-display text-xl md:text-2xl font-bold mb-4">
        קנו יחד וחסכו — הערכה המומלצת
      </h3>

      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {all.map((p, idx) => (
          <div key={p.id} className="flex items-center gap-3 md:gap-4">
            {idx > 0 && <Plus className="h-5 w-5 text-[#D4AF37] flex-shrink-0" />}
            <label className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="relative">
                <Link
                  to="/product/$slug"
                  params={{ slug: p.slug }}
                  onClick={(e) => idx === 0 && e.preventDefault()}
                  className="block h-24 w-24 md:h-28 md:w-28 rounded-lg overflow-hidden bg-white border border-border/60 hover:border-[#D4AF37] transition"
                >
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.name} className="h-full w-full object-contain p-1" />
                  ) : null}
                </Link>
                <div className="absolute -top-1.5 -right-1.5 bg-white rounded-md border border-border shadow-sm p-0.5">
                  <Checkbox
                    checked={!!selected[p.id]}
                    onCheckedChange={(v) =>
                      setSelected((s) => ({ ...s, [p.id]: !!v }))
                    }
                    disabled={idx === 0}
                  />
                </div>
              </div>
              <div className="text-center max-w-[7rem]">
                <div className="text-xs leading-tight line-clamp-2 text-foreground">
                  {idx === 0 ? <span className="font-semibold">{p.name}</span> : p.name}
                </div>
                <div className="text-xs text-[#A8862A] font-bold mt-1">
                  {formatILS(getEffectivePrice(p.price))}
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-4 border-t border-[#D4AF37]/30">
        <div>
          <span className="text-sm text-muted-foreground">
            סה״כ הערכה ({chosen.length} פריטים):
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-[#A8862A]">{formatILS(totalEff)}</span>
            {totalBase > totalEff && (
              <span className="text-sm text-muted-foreground line-through">{formatILS(totalBase)}</span>
            )}
          </div>
        </div>
        <Button
          size="lg"
          onClick={addBundle}
          className="bg-[#D4AF37] hover:bg-[#A8862A] text-white"
        >
          הוסף את הערכה לעגלה
        </Button>
      </div>
    </section>
  );
}
