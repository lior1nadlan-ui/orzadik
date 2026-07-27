// Shared cart revalidation — the single source of truth for "what the catalog
// says about the cart's products RIGHT NOW", used by BOTH /cart and /checkout so
// the two surfaces can never diverge.
//
// The cart lives in localStorage, so a line can sit for days while the product
// is re-priced, deactivated, or marked out of stock. placeOrder() re-reads all
// of this authoritatively and THROWS on a mismatch — which, without this pass,
// the shopper only discovers after filling in the whole checkout form.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEffectivePrice, formatILS, lineKey, type CartItem } from "@/lib/cart";

export type CartSnapshot = {
  products: Map<string, { price: number; isActive: boolean; outOfStock: boolean }>;
  variants: Map<string, { productId: string; price: number | null; inStock: boolean }>;
};

/** Everything a single cart line can be wrong about. `null` ⇒ the line is fine. */
export type LineCheck =
  | { kind: "unavailable" }
  | { kind: "outofstock" }
  | { kind: "size-outofstock" }
  | { kind: "size-unavailable" }
  | { kind: "price"; previous: number; current: number };

/** A line the shopper cannot order at all — placeOrder() would reject it. */
export const isBlocking = (c: LineCheck) => c.kind !== "price";

/**
 * Mirrors placeOrder()'s per-line validation exactly (see the lineItems map in
 * src/lib/checkout.functions.ts), so the cart never reports a problem the
 * server would not raise, and never stays silent about one it would:
 *
 *   • product missing / inactive          → "מוצר לא זמין"
 *   • stock_status === "outofstock"       → "מוצר אזל מהמלאי"
 *   • variant missing or for another product → "גודל לא תקין"
 *   • variant in_stock === false          → "הגודל אזל מהמלאי"
 *   • base price = variant price when set, else the product price
 *
 * A missing product row is the same signal as is_active=false: the public RLS
 * policy on `products` is `USING (is_active = true)`, so a deactivated product
 * simply stops being returned to a shopper. (An admin's session CAN see it, and
 * then the explicit flag catches it.)
 */
export function evaluateLine(item: CartItem, snap: CartSnapshot): LineCheck | null {
  const p = snap.products.get(item.productId);
  if (!p || !p.isActive) return { kind: "unavailable" };
  if (p.outOfStock) return { kind: "outofstock" };

  let base = p.price;
  if (item.variantId) {
    const v = snap.variants.get(item.variantId);
    if (!v || v.productId !== item.productId) return { kind: "size-unavailable" };
    if (!v.inStock) return { kind: "size-outofstock" };
    if (v.price !== null) base = v.price;
  }
  // Never claim a price change from a value we could not parse — fail open.
  if (!Number.isFinite(base) || !Number.isFinite(item.price)) return null;

  // Compare what the customer is CHARGED, via the shared pricing helper the
  // server itself uses, so a difference here is a real difference in money.
  const current = getEffectivePrice(base);
  const previous = getEffectivePrice(item.price);
  return current === previous ? null : { kind: "price", previous, current };
}

/**
 * Neutral, factual copy — states what changed and what follows from it. No
 * urgency, no scarcity, no "hurry": a price that moved and a size that ran out
 * are facts, not levers.
 */
export function noticeText(check: LineCheck, item: CartItem): string {
  switch (check.kind) {
    case "unavailable":
      return "הפריט אינו זמין להזמנה כרגע, ולכן אינו נכלל בסיכום ההזמנה.";
    case "outofstock":
      return "הפריט אזל מהמלאי, ולכן אינו נכלל בסיכום ההזמנה.";
    case "size-outofstock":
      return `${item.variantLabel ? `הגודל שנבחר (${item.variantLabel}) אזל מהמלאי` : "הגודל שנבחר אזל מהמלאי"}, ולכן הפריט אינו נכלל בסיכום ההזמנה. אפשר לבחור גודל אחר בעמוד המוצר.`;
    case "size-unavailable":
      return "הגודל שנבחר אינו זמין יותר, ולכן הפריט אינו נכלל בסיכום ההזמנה. אפשר לבחור גודל אחר בעמוד המוצר.";
    // States the fact and stops there. It deliberately does NOT promise "this is
    // also what will be charged": the line amount is pre-member-discount (a club
    // member's 5% comes off the subtotal, see the הטבת מועדון row in the summary),
    // and the amount actually due is reconciled in the summary column.
    case "price":
      return `המחיר עודכן מאז שהפריט נוסף לעגלה — קודם ${formatILS(check.previous)}, כעת ${formatILS(check.current)}. הסכום המוצג כאן הוא המחיר הנוכחי.`;
  }
}

/**
 * Client-side revalidation shared by /cart and /checkout. The cart itself is
 * localStorage-backed, so `items` is empty during SSR and the query is disabled
 * there; the page renders immediately from the stored cart and the notices/
 * totals settle when this resolves. On ANY failure `fresh` stays undefined and
 * both `checks` and the counts stay empty — a flaky read must never stand
 * between a shopper and checkout.
 */
export function useCartRevalidation(items: CartItem[]) {
  // Sorted so the query key is stable regardless of the order lines were added.
  const productIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.productId))).sort(),
    [items],
  );
  const variantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of items) if (i.variantId) ids.add(i.variantId);
    return Array.from(ids).sort();
  }, [items]);

  const { data: fresh } = useQuery<CartSnapshot>({
    queryKey: ["cart-revalidate", productIds.join(","), variantIds.join(",")],
    enabled: productIds.length > 0,
    // Shorter than the app-wide 60s default: this is a freshness check, and a
    // stale answer to "is this still the price?" is the bug we are fixing.
    staleTime: 30_000,
    queryFn: async () => {
      const [pRes, vRes] = await Promise.all([
        supabase.from("products").select("id, price, is_active, stock_status").in("id", productIds),
        variantIds.length > 0
          ? supabase
              .from("product_variants")
              .select("id, product_id, price, in_stock")
              .in("id", variantIds)
          : null,
      ]);
      if (pRes.error) throw pRes.error;
      if (vRes && vRes.error) throw vRes.error;

      const products: CartSnapshot["products"] = new Map();
      for (const p of pRes.data ?? []) {
        products.set(p.id, {
          price: Number(p.price),
          isActive: p.is_active !== false,
          outOfStock: p.stock_status === "outofstock",
        });
      }

      const variants: CartSnapshot["variants"] = new Map();
      for (const v of vRes?.data ?? []) {
        variants.set(v.id, {
          productId: v.product_id,
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          // Tri-state on purpose, exactly like the server: most rows never set
          // in_stock, and an unset size must stay purchasable. Only an explicit
          // false blocks the line.
          inStock: v.in_stock !== false,
        });
      }

      return { products, variants };
    },
  });

  // One entry per problematic line, keyed by lineKey. Empty until the check
  // resolves (and forever, if it fails) — so nothing downstream changes shape.
  const checks = useMemo(() => {
    const m = new Map<string, LineCheck>();
    if (!fresh) return m;
    for (const item of items) {
      const c = evaluateLine(item, fresh);
      if (c) m.set(lineKey(item), c);
    }
    return m;
  }, [items, fresh]);

  const blockedCount = useMemo(
    () => Array.from(checks.values()).filter(isBlocking).length,
    [checks],
  );
  const repricedCount = useMemo(
    () => Array.from(checks.values()).filter((c) => c.kind === "price").length,
    [checks],
  );

  return { fresh, checks, blockedCount, repricedCount, productIds, variantIds };
}
