import { useCallback, useEffect, useState } from "react";

// Wishlist ("מועדפים") shared state — localStorage-backed, no provider needed.
// localStorage is the source of truth; every mounted hook instance (header
// badge, each product card, product page) converges via a custom event, plus
// the native "storage" event for cross-tab sync.
const KEY = "ozl_favs_v1";
const CAP = 100;
const EVT = "ozl:favs-changed";

// try/catch per the cart.tsx convention — localStorage throws in
// private-mode Safari and when storage is full.
export function readFavs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeFavs(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useFavorites() {
  // SSR-safe: the server renders [] — all localStorage access lives in
  // effects and event handlers only.
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setIds(readFavs());
    refresh();
    setHydrated(true);
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Stable callback identities — consumers may use them in effect deps
  // (same rationale as the cart callbacks in src/lib/cart.tsx).
  // Dedupe + CAP keeps the /favorites .in() query bounded.
  const toggle = useCallback((id: string): boolean => {
    const cur = readFavs();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, CAP);
    writeFavs(next);
    setIds(next);
    return !cur.includes(id);
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, has, toggle, count: ids.length, hydrated };
}
