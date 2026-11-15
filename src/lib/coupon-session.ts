// The coupon this browser tab is carrying — browser only. The code itself is
// kept under COUPON_STORAGE_KEY (the checkout applies it by itself); its terms
// are kept beside it for display only, so the site-wide strip can say what the
// code gives without asking the server on every page. Nothing here grants a
// discount: the checkout and placeOrder check the code again with the server.
import { useEffect, useState } from "react";
import { COUPON_STORAGE_KEY, type CouponTerms } from "@/lib/coupons";

const TERMS_KEY = "oz-coupon-terms";
const EVENT = "oz-coupon-change";

/** Keep (or with null, forget) the tab's coupon, and tell the strip. */
export function rememberCoupon(terms: CouponTerms | null): void {
  try {
    if (terms) {
      sessionStorage.setItem(COUPON_STORAGE_KEY, terms.code);
      sessionStorage.setItem(TERMS_KEY, JSON.stringify(terms));
    } else {
      sessionStorage.removeItem(COUPON_STORAGE_KEY);
      sessionStorage.removeItem(TERMS_KEY);
    }
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable — the checkout box still works */
  }
}

function read(): CouponTerms | null {
  try {
    const raw = sessionStorage.getItem(TERMS_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<CouponTerms> | null;
    if (!t || typeof t.code !== "string" || typeof t.discountValue !== "number") return null;
    return {
      code: t.code,
      discountType: t.discountType === "fixed" ? "fixed" : "percent",
      discountValue: t.discountValue,
      freeShipping: !!t.freeShipping,
      minOrder: typeof t.minOrder === "number" ? t.minOrder : null,
    };
  } catch {
    return null;
  }
}

/** The tab's coupon terms; null during SSR and until the first effect. */
export function useActiveCoupon(): CouponTerms | null {
  const [terms, setTerms] = useState<CouponTerms | null>(null);
  useEffect(() => {
    const sync = () => setTerms(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return terms;
}
