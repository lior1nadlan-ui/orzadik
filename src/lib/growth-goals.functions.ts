// Admin: the growth goals' numbers for the dashboard card (rules and targets in
// growth-goals.ts). Each measure is read on its own and fails on its own: a
// failed read shows "—" on that row and never blanks the card.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { buildAudience } from "@/lib/campaigns.functions";
import { emptySearchShare, measureOrders, type GoalKey, type GoalOrder } from "@/lib/growth-goals";
import { liveReferralOffer } from "@/lib/referral.server";
import { liveWelcomeOffer } from "@/lib/welcome-coupon.server";

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 1000;

export type GrowthGoalsData = {
  values: Record<GoalKey, number | null>;
  /** The counts behind the empty-search share, for "17 of 184". */
  searches: { total: number; empty: number } | null;
  /** Whether each program a goal leans on is live (on, and coupons on site-wide). */
  programs: { welcome: boolean; referral: boolean };
};

/** Every paid order, ever: the repeat-customer count needs all of them. */
async function loadPaidOrders(): Promise<GoalOrder[]> {
  const out: GoalOrder[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("customer_email, customer_phone, payment_status, status, paid_at, created_at")
      .eq("payment_status", "paid")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return out;
  }
}

async function countApprovedReviews(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadRecentSearches(now: number) {
  const { data, error } = await supabaseAdmin
    .from("site_searches")
    .select("term, results_count, corrected_to")
    .gte("created_at", new Date(now - 30 * DAY).toISOString())
    .limit(10_000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function settled<T>(r: PromiseSettledResult<T>, label: string): T | null {
  if (r.status === "fulfilled") return r.value;
  console.error(`[growth-goals] ${label}:`, r.reason);
  return null;
}

export const getGrowthGoals = createServerFn({ method: "POST" }).handler(
  async (): Promise<GrowthGoalsData> => {
    await requireAdmin();
    const now = Date.now();
    const [orders, reviews, audience, searches, welcome, referral] = await Promise.allSettled([
      loadPaidOrders(),
      countApprovedReviews(),
      buildAudience(),
      loadRecentSearches(now),
      liveWelcomeOffer(),
      liveReferralOffer(),
    ]);
    const o = settled(orders, "orders");
    const measured = o ? measureOrders(o, now) : null;
    const s = settled(searches, "searches");
    const share = s ? emptySearchShare(s) : null;
    return {
      values: {
        paidOrders30d: measured?.paidOrders30d ?? null,
        reviews: settled(reviews, "reviews"),
        mailingList: settled(audience, "audience")?.length ?? null,
        repeatCustomers: measured?.repeatCustomers ?? null,
        emptySearchPct: share?.pct ?? null,
      },
      searches: share ? { total: share.total, empty: share.empty } : null,
      programs: {
        welcome: Boolean(settled(welcome, "welcome")),
        referral: Boolean(settled(referral, "referral")),
      },
    };
  },
);
