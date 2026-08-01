import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";

// Price math lives in a single shared module (client + server). Re-exported
// here so existing `@/lib/cart` imports keep working unchanged.
export {
  SITE_DISCOUNT,
  MEMBER_DISCOUNT,
  SHIPPING_FLAT,
  FREE_SHIPPING_THRESHOLD,
  getEffectivePrice,
  getDisplayOriginal,
  getDiscountPct,
  applyMemberDiscount,
  getShipping,
} from "@/lib/pricing";
import { getEffectivePrice, getDisplayOriginal, getShipping } from "@/lib/pricing";
import { trackAddToCart } from "@/lib/analytics";

export type CustomMethod = "embroidery" | "laser";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  /** Base (pre-discount) catalog price. Discount is applied at display & checkout. */
  price: number;
  /** Genuine recorded former price, used for the honest strike-through display. */
  salePrice?: number | null;
  thumbnail: string | null;
  quantity: number;
  /** Optional custom text (name to embroider or engrave) */
  customText?: string;
  /** Personalization method when customText is set */
  customMethod?: CustomMethod;
  /** Optional size/variant id (product_variants.id) */
  variantId?: string;
  /** Display label for the chosen variant (e.g. size) */
  variantLabel?: string;
};


type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (lineKey: string) => void;
  setQty: (lineKey: string, qty: number) => void;
  clear: () => void;
  count: number;
  /** Whether the mini-cart drawer is currently open. */
  isCartOpen: boolean;
  /** Open the mini-cart drawer (fired automatically after a successful add). */
  openCart: () => void;
  /** Close the mini-cart drawer. */
  closeCart: () => void;
  /** Subtotal of base prices (pre-discount). */
  subtotalBase: number;
  /** Subtotal after site discount. */
  subtotal: number;
  /** Total discount amount in ₪. */
  discountAmount: number;
  /** Shipping fee for the current cart. */
  shipping: number;
  /** Final total (subtotal + shipping). */
  grandTotal: number;
};

/**
 * Unique line key that distinguishes the same product across variants, custom
 * text AND personalization method.
 *
 * The method belongs in the identity because add() merges on this key and keeps
 * the EXISTING line, discarding the incoming item's fields. Without it, a buyer
 * who typed a name with רקמה, then switched to חריטת לייזר and added again — the
 * natural way to correct the choice on a page with no "update cart" control —
 * got one line of quantity 2 still labelled רקמה, with nothing saying the laser
 * selection had been dropped. The method is carried all the way to
 * order_items.custom_text as `[רקמה]` / `[לייזר]`, so it reaches the packing
 * slip and the CardCom invoice line; and personalized goods are the one
 * category the store's own emails say cannot be freely cancelled.
 *
 * Callers pass whole CartItem objects, so no call site changes. Nothing is
 * persisted under the old key either — localStorage stores the items array.
 */
export function lineKey(i: {
  productId: string;
  variantId?: string;
  customText?: string;
  customMethod?: string;
}) {
  return `${i.productId}|${i.variantId ?? ""}|${i.customText ?? ""}|${i.customMethod ?? ""}`;
}

const Ctx = createContext<CartCtx | null>(null);
const GUEST_KEY = "ozl_cart_v2";
const userKey = (uid: string) => `ozl_cart_v2_${uid}`;

import { useAuth } from "@/lib/auth";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Mini-cart drawer visibility. Starts closed on both server and client so
  // there is no hydration mismatch; it is only ever toggled from user handlers
  // (add / header cart button / drawer controls), never during render.
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart whenever the active user changes; merge guest cart on sign-in.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (user) {
        const key = userKey(user.id);
        const mineRaw = localStorage.getItem(key);
        const guestRaw = localStorage.getItem(GUEST_KEY);
        const mine: CartItem[] = mineRaw ? JSON.parse(mineRaw) : [];
        const guest: CartItem[] = guestRaw ? JSON.parse(guestRaw) : [];
        const merged = [...mine];
        for (const g of guest) {
          const idx = merged.findIndex((m) => lineKey(m) === lineKey(g));
          if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + g.quantity };
          else merged.push(g);
        }
        setItems(merged);
        if (guestRaw) localStorage.removeItem(GUEST_KEY);
      } else {
        const raw = localStorage.getItem(GUEST_KEY);
        setItems(raw ? JSON.parse(raw) : []);
      }
    } catch {}
    setHydrated(true);
  }, [user?.id]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const key = user ? userKey(user.id) : GUEST_KEY;
    localStorage.setItem(key, JSON.stringify(items));
  }, [items, user?.id, hydrated]);

  // Stable identities (empty deps) — openCart/closeCart are declared before
  // add() so add() can call openCart() while itself staying stable.
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  // Stable callback identities — consumers depend on these in effect deps
  // (e.g. the order-confirmation page clears the cart in a useEffect). A fresh
  // identity each render there caused an infinite render loop.
  const add = useCallback<CartCtx["add"]>((item, qty = 1) => {
    setItems((cur) => {
      const k = lineKey(item);
      const idx = cur.findIndex((c) => lineKey(c) === k);
      if (idx >= 0) {
        const next = [...cur];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...cur, { ...item, quantity: qty }];
    });
    // Fire add_to_cart once per add() call, centrally — every "add to cart"
    // path (product card, product page, cross-sell, bundle) routes through here,
    // so there is one place to instrument instead of many. no-ops on SSR / no
    // gtag+fbq.
    trackAddToCart({ id: item.productId, name: item.name, price: item.price, quantity: qty });
    // Persistent confirmation: slide the mini-cart open on every successful add.
    // openCart is stable, so add()'s identity stays stable across renders.
    openCart();
  }, [openCart]);
  const remove = useCallback<CartCtx["remove"]>((k) => setItems((c) => c.filter((i) => lineKey(i) !== k)), []);
  const setQty = useCallback<CartCtx["setQty"]>(
    (k, qty) => setItems((c) => c.map((i) => (lineKey(i) === k ? { ...i, quantity: Math.max(1, qty) } : i))),
    [],
  );
  const clear = useCallback<CartCtx["clear"]>(() => setItems([]), []);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotalBase = items.reduce((s, i) => s + getDisplayOriginal(i.price, i.salePrice) * i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + getEffectivePrice(i.price) * i.quantity, 0);
  const discountAmount = subtotalBase - subtotal;
  const shipping = getShipping(subtotal);
  const grandTotal = subtotal + shipping;

  // Memoize so consumers don't re-render on every unrelated provider render.
  const value = useMemo<CartCtx>(
    () => ({ items, add, remove, setQty, clear, count, isCartOpen, openCart, closeCart, subtotalBase, subtotal, discountAmount, shipping, grandTotal }),
    [items, add, remove, setQty, clear, count, isCartOpen, openCart, closeCart, subtotalBase, subtotal, discountAmount, shipping, grandTotal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;

}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}

export function formatILS(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}
