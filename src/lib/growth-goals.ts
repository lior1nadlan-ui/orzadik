// The growth plan's scoreboard ("איך נדע שזה עובד"), live on the CRM dashboard:
// each measure the plan set on 15.11.2026, today's value against its target for
// mid-February 2027, and the tool in the CRM that moves it.
//
// Each baseline is that day's value under the SAME definition the card measures
// now, so a bar starts empty and only real change fills it. Two are measured
// better here than in the plan's table:
//  - the mailing list is everyone a campaign can go to (newsletter signups and
//    accounts that agreed to marketing, minus opt-outs, as campaigns.functions.ts
//    builds it): 5 on 15.11, where the table counted the newsletter's 2;
//  - empty searches are the last 30 days, and a search answered with "did you
//    mean" results (site_searches.corrected_to) is not empty: 9.5% for the 30
//    days to 15.11, where the table's 6.6% was a different window.
//
// Pure, so the arithmetic is tested; growth-goals.functions.ts measures.

import { isPlaceholderTerm, normalizeSearchTerm } from "@/lib/search-terms";

const DAY = 24 * 60 * 60 * 1000;

/** The end of 15.2.2027 in Israel (UTC+2 in winter). */
export const GOALS_UNTIL_MS = Date.parse("2027-02-15T22:00:00Z");

export type GoalKey =
  | "paidOrders30d"
  | "reviews"
  | "mailingList"
  | "repeatCustomers"
  | "emptySearchPct";

/** A CRM screen, or the search card further down the dashboard. */
export type GoalLink = "/admin/leads" | "/admin/reviews" | "/admin/coupons" | "#search-insights";

export type GoalDef = {
  key: GoalKey;
  label: string;
  /** What exactly is counted, in one line. */
  detail: string;
  /** The value on 15.11.2026, by the same definition. */
  baseline: number;
  target: number;
  /** A share that should go down (empty searches). */
  lowerIsBetter?: boolean;
  percent?: boolean;
  /** What moves it, and where. `program` names a CRM switch that may be off. */
  action: { label: string; to: GoalLink; program?: "welcome" | "referral" };
};

export const GROWTH_GOALS: readonly GoalDef[] = [
  {
    key: "paidOrders30d",
    label: "הזמנות ששולמו בחודש",
    detail: "ב-30 הימים האחרונים, בלי מבוטלות",
    baseline: 3,
    target: 10,
    action: { label: "תשלומים שנתקעו ועגלות נטושות", to: "/admin/leads" },
  },
  {
    key: "reviews",
    label: "ביקורות באתר",
    detail: "ביקורות מאושרות שמוצגות באתר",
    baseline: 0,
    target: 10,
    action: { label: "ביקורות לאישור", to: "/admin/reviews" },
  },
  {
    key: "mailingList",
    label: "רשימת הדיוור",
    detail: "מי שהסכים לקבל מבצעים, בלי מי שהסיר את עצמו",
    baseline: 5,
    target: 150,
    action: { label: "קופון ברוכים הבאים", to: "/admin/coupons", program: "welcome" },
  },
  {
    key: "repeatCustomers",
    label: "לקוחות חוזרים",
    detail: "לקוחות עם שתי הזמנות ששולמו או יותר",
    baseline: 0,
    target: 3,
    action: { label: "חבר מביא חבר", to: "/admin/coupons", program: "referral" },
  },
  {
    key: "emptySearchPct",
    label: "חיפושים בלי תוצאות",
    detail: "ב-30 הימים האחרונים",
    baseline: 9.5,
    target: 4,
    lowerIsBetter: true,
    percent: true,
    action: { label: "הפניות חיפוש", to: "#search-insights" },
  },
];

/** At the target: "10" or more, or for a share, below "4%". */
export function goalReached(def: GoalDef, current: number): boolean {
  return def.lowerIsBetter ? current < def.target : current >= def.target;
}

/**
 * How far from the baseline toward the target, 0-1. Below the baseline is 0;
 * a full bar means reached, so an unreached goal stops at 0.99 (a share of
 * exactly 4% is not "below 4%").
 */
export function goalProgress(def: GoalDef, current: number): number {
  if (goalReached(def, current)) return 1;
  const span = def.lowerIsBetter ? def.baseline - def.target : def.target - def.baseline;
  if (!(span > 0)) return 0;
  const moved = def.lowerIsBetter ? def.baseline - current : current - def.baseline;
  return Math.min(0.99, Math.max(0, moved / span));
}

/** Whole days until the end of 15.2.2027; 0 from then on. */
export function goalDaysLeft(now: number): number {
  return Math.max(0, Math.ceil((GOALS_UNTIL_MS - now) / DAY));
}

export function formatGoalValue(def: GoalDef, v: number): string {
  if (def.percent) return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
  return v.toLocaleString("he-IL");
}

export function goalTargetLabel(def: GoalDef): string {
  const t = formatGoalValue(def, def.target);
  return def.lowerIsBetter ? `פחות מ-${t}` : t;
}

// ---- Measuring ---------------------------------------------------------------

export type GoalOrder = {
  customer_email: string | null;
  customer_phone: string | null;
  payment_status: string;
  status: string | null;
  paid_at: string | null;
  created_at: string;
};

/** A sale that stood: paid, and not cancelled or refunded since. */
export function isStandingSale(o: GoalOrder): boolean {
  return o.payment_status === "paid" && !["cancelled", "refunded"].includes(String(o.status ?? ""));
}

/**
 * Who bought: the email, lower-cased; without one, the phone's digits in local
 * form (+972 54... and 054... are the same person). Null when neither is usable.
 */
export function buyerKey(o: Pick<GoalOrder, "customer_email" | "customer_phone">): string | null {
  const email = String(o.customer_email ?? "")
    .trim()
    .toLowerCase();
  if (email) return email;
  const phone = String(o.customer_phone ?? "")
    .replace(/\D/g, "")
    .replace(/^972/, "0");
  return phone.length >= 9 ? `tel:${phone}` : null;
}

/** Paid orders of the last 30 days, and buyers with two standing sales or more. */
export function measureOrders(
  orders: GoalOrder[],
  now: number,
): { paidOrders30d: number; repeatCustomers: number } {
  const since = now - 30 * DAY;
  let paidOrders30d = 0;
  const perBuyer = new Map<string, number>();
  for (const o of orders) {
    if (!isStandingSale(o)) continue;
    if (Date.parse(o.paid_at ?? o.created_at) >= since) paidOrders30d += 1;
    const key = buyerKey(o);
    if (key) perBuyer.set(key, (perBuyer.get(key) ?? 0) + 1);
  }
  let repeatCustomers = 0;
  for (const n of perBuyer.values()) if (n >= 2) repeatCustomers += 1;
  return { paidOrders30d, repeatCustomers };
}

export type GoalSearch = { term: string; results_count: number; corrected_to: string | null };

/**
 * The share of searches that showed the shopper nothing, in percent to one
 * decimal; null with no searches. Crawler templates are not searches, and a
 * search answered with "did you mean" results showed something.
 */
export function emptySearchShare(rows: GoalSearch[]): {
  total: number;
  empty: number;
  pct: number | null;
} {
  let total = 0;
  let empty = 0;
  for (const r of rows) {
    const term = normalizeSearchTerm(r.term);
    if (!term || isPlaceholderTerm(term)) continue;
    total += 1;
    if (r.results_count === 0 && !r.corrected_to) empty += 1;
  }
  return { total, empty, pct: total > 0 ? Math.round((1000 * empty) / total) / 10 : null };
}
