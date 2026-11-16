// What shoppers typed into the site search over the last 30 days, on the
// /admin dashboard. The zero-result terms come first: each is a product people
// asked for that the shop does not have, or has under a word they do not use.
//
// The second case is fixable right here: "הפנה" stores a search redirect
// (supabase/migrations/20261002120000_search_redirects.sql), so the next
// shopper who types that phrase gets the results for the owner's word instead.
// Every term opens the live /shop results in a new tab, so the owner sees
// exactly what the shopper sees — before and after a redirect.
//
// Since the search corrects itself (src/lib/did-you-mean.ts), each missed term
// also shows what the shop now displays for it instead, with one click to make
// that a permanent redirect; or, when the catalogue has changed, that the term
// finds products today. Worked out in the browser with the same two public
// calls the shop makes (src/lib/search-suggest.ts), so it cannot disagree
// with what a shopper sees.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteSearchRedirect,
  getSearchInsights,
  saveSearchRedirect,
} from "@/lib/search-log.functions";
import { resolveSearchQuery } from "@/lib/search-redirects";
import { suggestSearch, type SearchSuggestion } from "@/lib/search-suggest";
import type { TermStat } from "@/lib/search-terms";
import { normalizeSearchTerm as shopSearchTerm } from "@/routes/shop";

const QUERY_KEY = ["admin-search-insights"] as const;

/** What a missed term gets today: products of its own, a suggestion, or nothing. */
type MissedHint = { nowFound: number } | { suggestion: SearchSuggestion } | null;

async function loadMissedHints(terms: string[]): Promise<Record<string, MissedHint>> {
  // Through the shop's own steps (redirects, then spelling fixes), so a term
  // is judged exactly as the results page runs it.
  const effective = await Promise.all(
    terms.map(async (t) => shopSearchTerm(await resolveSearchQuery(t)).slice(0, 100)),
  );
  const { data } = await supabase.rpc("search_phrase_hits", { p_terms: effective.slice(0, 10) });
  const hits = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<
    string,
    number
  >;
  const out: Record<string, MissedHint> = {};
  await Promise.all(
    terms.map(async (t, i) => {
      const now = Number(hits[effective[i]] ?? 0);
      if (now > 0) {
        out[t] = { nowFound: now };
        return;
      }
      const suggestion = await suggestSearch(effective[i]);
      out[t] = suggestion ? { suggestion } : null;
    }),
  );
  return out;
}

const shopLink = (term: string) => `/shop?q=${encodeURIComponent(term)}`;

function TermLink({ term }: { term: string }) {
  return (
    <a
      href={shopLink(term)}
      target="_blank"
      rel="noopener noreferrer"
      className="min-w-0 truncate underline-offset-4 hover:underline"
    >
      {term}
    </a>
  );
}

const timesHe = (n: number) => (n === 1 ? "פעם אחת" : `${n} פעמים`);

function MissedRow({ t, target, hint }: { t: TermStat; target?: string; hint?: MissedHint }) {
  const qc = useQueryClient();
  const save = useServerFn(saveSearchRedirect);
  const remove = useServerFn(deleteSearchRedirect);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setOpen(false);
      setValue("");
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-1.5 text-sm">
      <div className="flex items-center gap-3">
        <TermLink term={t.term} />
        <span className="ms-auto shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {timesHe(t.count)}
        </span>
        {target ? null : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium text-primary [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
          >
            הפנה
          </button>
        )}
      </div>
      {target ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            מופנה ל־
            <TermLink term={target} />
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => remove({ data: { term: t.term } }), "ההפניה בוטלה")}
            className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            ביטול
          </button>
        </div>
      ) : null}
      {!target && hint && "suggestion" in hint ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-sky-800">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {hint.suggestion.kind === "spelling"
              ? "האתר מציג במקום: "
              : "האתר מציג במקום, בלי מילה אחת: "}
            <TermLink term={hint.suggestion.term} />
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => save({ data: { term: t.term, target: hint.suggestion.term } }),
                `מעכשיו "${t.term}" יציג תמיד את "${hint.suggestion.term}"`,
              )
            }
            className="ms-auto shrink-0 rounded-full border border-sky-200 px-2.5 py-0.5 font-medium [@media(hover:hover)_and_(pointer:fine)]:hover:bg-sky-50"
          >
            קבע כהפניה
          </button>
        </div>
      ) : null}
      {!target && hint && "nowFound" in hint ? (
        <div className="mt-1 text-xs text-emerald-700">
          היום החיפוש הזה כבר מוצא {hint.nowFound} מוצרים.
        </div>
      ) : null}
      {open && !target ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            run(
              () => save({ data: { term: t.term, target: value } }),
              `מעכשיו "${t.term}" יציג את התוצאות של "${value.trim()}"`,
            );
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="המילה שבה המוצר מופיע אצלכם"
            aria-label={`להפנות את "${t.term}" אל`}
            maxLength={100}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={busy || !value.trim()}>
            שמירה
          </Button>
        </form>
      ) : null}
    </li>
  );
}

export function SearchInsightsCard() {
  const load = useServerFn(getSearchInsights);
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => load({ data: { days: 30 } }),
    staleTime: 5 * 60_000,
  });
  const missed = data?.missed.slice(0, 8) ?? [];
  const openTerms = missed.filter((t) => !data?.redirects[t.term]).map((t) => t.term);
  // Second, so the card never waits for it; the rows fill in their hints.
  const { data: hints } = useQuery({
    queryKey: ["admin-search-hints", openTerms],
    queryFn: () => loadMissedHints(openTerms),
    enabled: openTerms.length > 0,
    staleTime: 5 * 60_000,
  });
  if (!data || data.total === 0) return null;
  const top = data.top.filter((t) => t.lastResults > 0).slice(0, 8);
  const suggestedCount = openTerms.filter((t) => {
    const h = hints?.[t];
    return h && "suggestion" in h;
  }).length;
  // Still a dead end: no redirect, no suggestion, and no products of its own
  // today. Until the hints load, every open row counts, as before.
  const deadEndCount = openTerms.filter((t) => !hints?.[t]).length;

  return (
    // The anchor the growth goals' "הפניות חיפוש" link scrolls to.
    <div id="search-insights" className="scroll-mt-24 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">מה חיפשו באתר · {data.days} ימים אחרונים</div>
        <div className="text-xs text-muted-foreground">{data.total} חיפושים</div>
      </div>
      {/* min-w-0 on the columns: a grid track otherwise grows to its longest
          term and pushes the row's count and button off the card. */}
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-rose-700">חיפשו ולא מצאו</div>
          {missed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">כל חיפוש החזיר תוצאות. מצוין.</p>
          ) : (
            <>
              <ul className="mt-2 divide-y">
                {missed.map((t) => (
                  <MissedRow
                    key={t.term}
                    t={t}
                    target={data.redirects[t.term]}
                    hint={hints?.[t.term]}
                  />
                ))}
              </ul>
              {suggestedCount > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  החיפוש מתקן עכשיו לבד שגיאות כתיב ומילה מיותרת, אז שורה עם "האתר מציג במקום" כבר
                  מגיעה למוצרים. ההצעה נכונה? "קבע כהפניה" נועל אותה. לא נכונה? לחצו "הפנה" וכתבו את
                  המילה שבה המוצר מופיע אצלכם.
                </p>
              ) : null}
              {deadEndCount > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  שורה בלי הצעה היא לקוח שיצא בידיים ריקות. המוצר קיים אצלכם בשם אחר? לחצו "הפנה"
                  וכתבו את המילה שבה הוא מופיע, ומהחיפוש הבא הלקוח יראה אותו. אם המוצר לא קיים, אולי
                  שווה להכניס אותו למלאי.
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">החיפושים הנפוצים</div>
          {top.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">עדיין אין מספיק חיפושים.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {top.map((t) => (
                <li key={t.term} className="flex items-center gap-3 py-1.5 text-sm">
                  <TermLink term={t.term} />
                  <span className="ms-auto shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {timesHe(t.count)} · {t.lastResults} תוצאות
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
