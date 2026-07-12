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

/** Unique line key that distinguishes same product across variants & custom text. */
export function lineKey(i: { productId: string; variantId?: string; customText?: string }) {
  return `${i.productId}|${i.variantId ?? ""}|${i.customText ?? ""}`;
}

const Ctx = createContext<CartCtx | null>(null);
const GUEST_KEY = "ozl_cart_v2";
const userKey = (uid: string) => `ozl_cart_v2_${uid}`;

import { useAuth } from "@/lib/auth";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

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
  }, []);
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
    () => ({ items, add, remove, setQty, clear, count, subtotalBase, subtotal, discountAmount, shipping, grandTotal }),
    [items, add, remove, setQty, clear, count, subtotalBase, subtotal, discountAmount, shipping, grandTotal],
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
