// "מחירים חשודים" — catalog prices that are probably a mistake. Pure, so the
// rules are tested without a database.
//
// Rules, from what was actually found in the catalog (docs/improvement-workflow.md,
// "ממתין לבעלים"):
//   * pack_unit_price — the name says it is a stand / set of many units, but the
//     price is that of one unit ("סטנד 100 טבעות" at ₪22).
//   * family_outlier — same name (name_norm) as other active products, but the
//     price is under half or over double the family median.
//   * former_hidden — a former price is recorded but is not above what the
//     customer pays (price minus SITE_DISCOUNT), so the site never shows it.
//   * sharp_change — changed by 50% or more in the last 30 days.

import { getEffectivePrice } from "@/lib/pricing";

export type AuditProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  salePrice: number | null;
  nameNorm: string | null;
};

export type AuditChange = { productId: string; oldPrice: number; newPrice: number };

export type PriceIssueKind =
  | "pack_unit_price"
  | "family_outlier"
  | "former_hidden"
  | "sharp_change";

export type PriceIssue = {
  productId: string;
  name: string;
  sku: string | null;
  price: number;
  kind: PriceIssueKind;
  detail: string;
};

export const ISSUE_LABEL: Record<PriceIssueKind, string> = {
  pack_unit_price: "סט/סטנד במחיר של יחידה",
  family_outlier: "שונה מאוד מדגמים באותו שם",
  former_hidden: "מחיר קודם שלא מוצג באתר",
  sharp_change: "שינוי חד לאחרונה",
};

/** How many units the name says the product holds (20+), or 0. Keywords must
 *  be whole words: "סט" also starts "סטן" (satin) and sits inside "פלסטיק". */
export function packUnits(name: string): number {
  const n = name.replace(/["״'`]/g, "");
  const patterns = [
    // "סטנד 100 טבעות", "סט 50 טבעות" — not "סט 20 ס מ" (a size)
    /(?:^|\s)(?:סטנד|סט|מארז|חבילה|קרטון)\s+(\d{2,4})\s+(?!ס\s?מ|מ\s?ל|x|X|על\s)/,
    // "72 יח", "24 יחידות"
    /(\d{2,4})\s*(?:יחידות|יח)(?:\s|$|-)/,
  ];
  for (const re of patterns) {
    const m = n.match(re);
    if (m) {
      const units = Number(m[1]);
      if (units >= 20 && units <= 5000) return units;
    }
  }
  return 0;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const PACK_MAX_PRICE = 60;

export function auditPrices(
  products: AuditProduct[],
  recentChanges: AuditChange[] = [],
): PriceIssue[] {
  const issues: PriceIssue[] = [];
  const add = (p: AuditProduct, kind: PriceIssueKind, detail: string) =>
    issues.push({ productId: p.id, name: p.name, sku: p.sku, price: p.price, kind, detail });

  const families = new Map<string, number[]>();
  for (const p of products) {
    if (!p.nameNorm || !(p.price > 0)) continue;
    const list = families.get(p.nameNorm) ?? [];
    list.push(p.price);
    families.set(p.nameNorm, list);
  }

  for (const p of products) {
    const units = packUnits(p.name);
    // "(המחיר ליחידה אחת)" in the name means the owner confirmed a single unit
    // is sold (2026-10-11, 33 products) — the name already says so.
    if (units && p.price > 0 && p.price <= PACK_MAX_PRICE && !/ליחידה אחת/.test(p.name)) {
      add(p, "pack_unit_price", `בשם ${units} יחידות, הלקוח משלם ₪${getEffectivePrice(p.price)}`);
    }
    if (p.salePrice !== null && p.salePrice > 0 && p.price > 0) {
      const pays = getEffectivePrice(p.price);
      if (Math.round(p.salePrice) <= pays) {
        add(p, "former_hidden", `מחיר קודם ₪${p.salePrice}, הלקוח משלם ₪${pays}`);
      }
    }
    const fam = p.nameNorm ? families.get(p.nameNorm) : undefined;
    if (fam && fam.length >= 3 && p.price > 0) {
      const med = median(fam);
      if (p.price < med / 2 || p.price > med * 2) {
        add(
          p,
          "family_outlier",
          `ללקוח ₪${getEffectivePrice(p.price)} מול ₪${getEffectivePrice(med)} אצל ${fam.length - 1} דגמים אחרים באותו שם`,
        );
      }
    }
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const flagged = new Set<string>();
  for (const c of recentChanges) {
    const p = byId.get(c.productId);
    if (!p || flagged.has(c.productId) || !(c.oldPrice > 0)) continue;
    const ratio = Math.abs(c.newPrice - c.oldPrice) / c.oldPrice;
    if (ratio >= 0.5) {
      flagged.add(c.productId);
      add(
        p,
        "sharp_change",
        `ללקוח ₪${getEffectivePrice(c.oldPrice)} ← ₪${getEffectivePrice(c.newPrice)} (${Math.round(ratio * 100)}%)`,
      );
    }
  }

  return issues;
}
