import type { ProductCardData } from "@/components/ProductCard";

// Recently-viewed products — full ProductCardData snapshots (not bare ids) so
// the strip renders with zero extra Supabase queries. Display prices still
// pass through getEffectivePrice at render time inside ProductCard, so
// site-discount math stays live; only the base price can go stale, which
// self-heals on the next visit to that product.
const KEY = "ozl_recent_v1";
const CAP = 12;

// try/catch per the cart.tsx convention (private-mode Safari).
export function readRecent(): ProductCardData[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function recordRecent(snap: ProductCardData) {
  try {
    const next = [snap, ...readRecent().filter((p) => p && p.id !== snap.id)].slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
