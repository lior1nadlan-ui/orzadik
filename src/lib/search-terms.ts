// Site-search insights for the admin dashboard: what shoppers looked for, and
// what they looked for and did not find. Pure, so it is unit-tested; the server
// functions in search-log.functions.ts only fetch rows and call these.

/** One spelling per term: trimmed, single-spaced, lower-cased (Latin only —
 *  Hebrew has no case), Hebrew quote marks unified, capped at 100 chars. */
export function normalizeSearchTerm(raw: string): string {
  return raw
    .replace(/[׳’‘`]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 100);
}

export type SearchRow = { term: string; results_count: number; created_at: string };

export type TermStat = {
  term: string;
  /** How many times it was searched in the window. */
  count: number;
  /** Results the most recent search returned — the catalog's answer today. */
  lastResults: number;
  lastAt: string;
};

export type SearchInsights = {
  total: number;
  /** Terms whose latest search found nothing, most-searched first. */
  missed: TermStat[];
  /** All terms, most-searched first. */
  top: TermStat[];
};

export function summarizeSearches(rows: SearchRow[], limit = 15): SearchInsights {
  const byTerm = new Map<string, TermStat>();
  for (const r of rows) {
    const term = normalizeSearchTerm(r.term);
    if (!term) continue;
    const cur = byTerm.get(term);
    if (!cur) {
      byTerm.set(term, {
        term,
        count: 1,
        lastResults: r.results_count,
        lastAt: r.created_at,
      });
      continue;
    }
    cur.count += 1;
    if (r.created_at > cur.lastAt) {
      cur.lastAt = r.created_at;
      cur.lastResults = r.results_count;
    }
  }
  const all = [...byTerm.values()].sort(
    (a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt),
  );
  return {
    total: rows.length,
    missed: all.filter((t) => t.lastResults === 0).slice(0, limit),
    top: all.slice(0, limit),
  };
}
