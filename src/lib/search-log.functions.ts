// First-party log of site searches, and the admin view of it. The analytics
// tags already get every search (trackSearch); this keeps a copy the owner can
// actually read — in /admin, next to the orders. See
// supabase/migrations/20261002100000_site_searches.sql.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { checkOrderRateLimitByIp, getClientIp } from "@/lib/rate-limit.server";
import { normalizeSearchTerm, summarizeSearches, type SearchInsights } from "@/lib/search-terms";

/** Public: record one settled search. Best effort — never throws to the page. */
export const logSearch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        term: z.string().max(200),
        results_count: z.number().int().min(0).max(100_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const term = normalizeSearchTerm(data.term);
    if (!term) return { ok: false };
    // A person searches a few dozen times an hour at most; a bot filling the
    // table should run out quickly. Its own bucket, so it never eats the
    // order quota.
    const { limited } = await checkOrderRateLimitByIp(
      getClientIp(getRequest()),
      60,
      60 * 60,
      "search",
    );
    if (limited) return { ok: false };
    const { error } = await supabaseAdmin
      .from("site_searches")
      .insert({ term, results_count: data.results_count });
    return { ok: !error };
  });

/** Admin: the top and zero-result terms over the last `days` days. */
export const getSearchInsights = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<SearchInsights & { days: number }> => {
    await requireAdmin();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("site_searches")
      .select("term, results_count, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10_000);
    if (error) throw new Error(error.message);
    return { ...summarizeSearches(rows ?? []), days: data.days };
  });
