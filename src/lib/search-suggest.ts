// The site search's "האם התכוונתם ל...": the database side of
// src/lib/did-you-mean.ts. Runs wherever the search runs — the /shop loader
// on the server, the shop and the header's dropdown in the browser — on the
// public client, because both functions read only what the shop shows anyway
// (supabase/migrations/20261115220000_search_suggestions.sql).
//
// Cost: the vocabulary (~1,100 words, ~13KB) once per tab or server isolate,
// and then ONE search_phrase_hits() call (~140ms) per search that found
// nothing. A search that finds products never gets here.

import { supabase } from "@/integrations/supabase/client";
import {
  parseVocabulary,
  pickSuggestion,
  planSuggestions,
  type SearchSuggestion,
  type Vocabulary,
} from "@/lib/did-you-mean";
import { isPlaceholderTerm } from "@/lib/search-terms";

export type { SearchSuggestion, SuggestionKind } from "@/lib/did-you-mean";

const VOCAB_TTL_MS = 60 * 60_000;
// After a failed read, try again soon, but not on every keystroke.
const VOCAB_RETRY_MS = 60_000;

let vocab: { at: number; ttl: number; value: Promise<Vocabulary> } | null = null;

/** The catalogue's words, cached. Never throws: on a read error it is empty. */
export function loadVocabulary(): Promise<Vocabulary> {
  const now = Date.now();
  if (vocab && now - vocab.at < vocab.ttl) return vocab.value;
  const entry = {
    at: now,
    ttl: VOCAB_TTL_MS,
    value: Promise.resolve(new Map()) as Promise<Vocabulary>,
  };
  entry.value = (async () => {
    try {
      const { data, error } = await supabase.rpc("search_vocabulary");
      if (error) throw error;
      return parseVocabulary(data);
    } catch (e) {
      console.warn("[search] vocabulary unavailable:", e);
      entry.ttl = VOCAB_RETRY_MS;
      return new Map();
    }
  })();
  vocab = entry;
  return entry.value;
}

const MEMO_TTL_MS = 10 * 60_000;
const MEMO_MAX = 200;
const memo = new Map<string, { at: number; value: Promise<SearchSuggestion | null> }>();

/**
 * The phrase to show instead of a search that found nothing, or null.
 * `term` is the search as the results page runs it (after the owner's
 * redirects and the spelling fixes in shop.tsx). Never throws; remembered for
 * a few minutes per term, so the next page of results, a re-render and the
 * header's preview of the same words cost nothing.
 */
export function suggestSearch(term: string): Promise<SearchSuggestion | null> {
  const key = term.trim().slice(0, 100);
  if (!key || isPlaceholderTerm(key)) return Promise.resolve(null);
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.at < MEMO_TTL_MS) return hit.value;

  const value = (async () => {
    try {
      const words = await loadVocabulary();
      if (words.size === 0) {
        memo.delete(key); // the vocabulary did not load; that says nothing about the term
        return null;
      }
      const plan = planSuggestions(key, words);
      const phrases = [...plan.spelling, ...plan.fewerWords];
      if (phrases.length === 0) return null;
      const { data, error } = await supabase.rpc("search_phrase_hits", { p_terms: phrases });
      if (error) throw error;
      const hits =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, number>)
          : {};
      return pickSuggestion(plan, hits);
    } catch (e) {
      console.warn("[search] suggestion failed:", e);
      memo.delete(key); // a failure is not an answer; ask again next time
      return null;
    }
  })();

  if (memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { at: now, value });
  return value;
}
