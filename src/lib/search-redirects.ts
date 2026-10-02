// Owner-managed search redirects ("when someone searches X, search Y"), set
// from the /admin search card. See
// supabase/migrations/20261002120000_search_redirects.sql.
//
// Applied in front of the shop's own spelling fixes (normalizeSearchTerm in
// src/routes/shop.tsx), to the WHOLE phrase only: a redirect for "כיסוי חלה"
// never rewrites "כיסוי חלה רקום".

import { supabase } from "@/integrations/supabase/client";
import { normalizeSearchTerm } from "@/lib/search-terms";

export type RedirectMap = Record<string, string>;

/** The phrase to actually search for: the owner's target when one is set for
 *  this exact phrase, otherwise the shopper's own words, untouched. */
export function applySearchRedirect(raw: string, map: RedirectMap): string {
  const key = normalizeSearchTerm(raw);
  return (key && map[key]) || raw;
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; map: RedirectMap } | null = null;

/** All redirects, cached for a few minutes per server isolate / browser tab.
 *  Never throws: on a read error the search simply runs unredirected. */
export async function getSearchRedirects(): Promise<RedirectMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  try {
    const { data, error } = await supabase
      .from("search_redirects")
      .select("term, target")
      .limit(1000);
    if (error) throw error;
    const map: RedirectMap = {};
    for (const r of data ?? []) map[r.term] = r.target;
    cache = { at: Date.now(), map };
    return map;
  } catch (e) {
    console.warn("[search] redirects unavailable:", e);
    return cache?.map ?? {};
  }
}

/** Resolve a shopper's query through the redirects. Browsing (no term) costs
 *  no lookup. */
export async function resolveSearchQuery(raw: string): Promise<string> {
  if (!raw.trim()) return raw;
  return applySearchRedirect(raw, await getSearchRedirects());
}
