// "האם התכוונתם ל..." for the site search: turn a search that found nothing
// into the closest phrases the catalogue itself uses. Pure and synchronous, so
// it is unit-tested; src/lib/search-suggest.ts gives it the catalogue's words
// and checks its phrases against the real search in one round trip
// (supabase/migrations/20261115220000_search_suggestions.sql).
//
// Built from what shoppers typed and did not find (site_searches, Oct-Nov 2026),
// with the number of results the shop shows for the answer:
//
//   תיק לתלית       ט and ת sound the same           → תיק לטלית   (81)
//   בירכונים        a vowel written out (י)          → ברכונים     (43)
//   גבע מכסף        a vowel dropped + a prefix (מ)   → גביע כסף    (24)
//   מזוזותו         one stray letter                 → מזוזות      (322)
//   מזוזות וקלף     a prefix (ו) on a catalogue word → מזוזות קלף  (225)
//   קלףכשר          a missing space                  → קלף כשר
//   בתי תפילין האש  every word exists, no product has all three
//                                                    → תפילין האש  (20)
//
// Two kinds of answer, in this order: SPELLING (each unknown word replaced by
// the nearest catalogue word), then FEWER WORDS (one word left out). The
// caller shows the first candidate that actually finds products, so a wrong
// guess costs nothing: it simply has no hits and the next one is tried.

/** Every word of an active product name → how many products carry it. */
export type Vocabulary = ReadonlyMap<string, number>;

export type SuggestionKind = "spelling" | "fewer_words";
export type SearchSuggestion = { term: string; kind: SuggestionKind };

/** The search_vocabulary() jsonb ({word: count}) as a map; junk is skipped. */
export function parseVocabulary(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [w, n] of Object.entries(raw as Record<string, unknown>)) {
    const count = Number(n);
    if (w && Number.isFinite(count) && count > 0) out.set(w, count);
  }
  return out;
}

/**
 * The database's norm_he(), letter for letter: lower case, the quote family
 * and % _ \ to spaces, niqqud and cantillation marks dropped, spaces collapsed.
 * Words are compared in this form on both sides, or "ס״מ" would never meet
 * the vocabulary's "ס מ".
 */
export function normHe(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[׳״`'"‘’“”%_\\]/g, " ")
    .replace(/[֑-ׇ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The database's he_variants(): the word plus the singular stems the search
 * also looks for in product names (כיפות → כיפה, חנוכיות → חנוכיה/חנוכייה,
 * גביעים → גביע, גביעי → גביע). Stems shorter than 3 letters are dropped,
 * as there.
 */
export function heVariants(w: string): string[] {
  const out = new Set<string>([w]);
  const n = w.length;
  if (w.endsWith("ות") && n >= 4) {
    out.add(w.slice(0, -2));
    out.add(`${w.slice(0, -2)}ה`);
  }
  if (w.endsWith("יות") && n >= 5) {
    out.add(`${w.slice(0, -3)}יה`);
    out.add(`${w.slice(0, -3)}ייה`);
  }
  if (w.endsWith("ים") && n >= 4) out.add(w.slice(0, -2));
  if (w.endsWith("י") && n >= 4) out.add(w.slice(0, -1));
  return [...out].filter((v) => v.length >= 3);
}

// ---------------------------------------------------------------------------
// How far apart two spellings are, as a Hebrew speaker types them.

const FINAL_TO_PLAIN: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const PLAIN_TO_FINAL: Record<string, string> = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };
const plain = (c: string) => FINAL_TO_PLAIN[c] ?? c;
const pairKey = (a: string, b: string) => (a < b ? a + b : b + a);

// Letters that sound alike in Israeli Hebrew, so a shopper who spells by ear
// swaps them: טלית/תלית, כיפה/חיפה, קידוש/כידוש, אמונה/עמונה, סידור/שידור,
// בית/וית.
const SOUND_ALIKE = new Set(
  [
    ["ט", "ת"],
    ["כ", "ח"],
    ["כ", "ק"],
    ["א", "ע"],
    ["ס", "ש"],
    ["ב", "ו"],
  ].map(([a, b]) => pairKey(a, b)),
);
// Silent letters, mostly at the end of a word: מזוזה/מזוזא.
const SILENT_PAIR = new Set(
  [
    ["א", "ה"],
    ["ה", "ע"],
  ].map(([a, b]) => pairKey(a, b)),
);

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  const x = plain(a);
  const y = plain(b);
  if (x === y) return 0.1; // the final form in the wrong place: קלפ/קלף
  const key = pairKey(x, y);
  if (SOUND_ALIKE.has(key)) return 0.3;
  if (SILENT_PAIR.has(key)) return 0.5;
  return 1;
}

// A vowel letter added or left out is the most common difference of all:
// Israelis write both כתיב מלא and כתיב חסר (גביע/גבע, ברכונים/בירכונים).
function insertDeleteCost(c: string): number {
  if (c === "י" || c === "ו") return 0.4;
  if (c === "א" || c === "ה") return 0.6;
  return 1;
}

const SWAP_COST = 0.6; // two neighbours typed the wrong way round: בתי/בית
const PREFIX_COST = 0.3; // a prefix letter glued to a catalogue word
const SPLIT_COST = 0.5; // a missing space
const EPS = 1e-9;

/**
 * Weighted edit distance (optimal string alignment): the costs above for a
 * substitution, an added or missing letter and a swap of neighbours, 1 for
 * anything else. Stops early and returns Infinity once every alignment is
 * already over `max`.
 */
export function spellingDistance(a: string, b: string, max = Infinity): number {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) * 0.4 > max + EPS) return Infinity;
  let before = new Array<number>(m + 1).fill(0);
  let prev = new Array<number>(m + 1).fill(0);
  let cur = new Array<number>(m + 1).fill(0);
  for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + insertDeleteCost(b[j - 1]);
  for (let i = 1; i <= n; i++) {
    cur[0] = prev[0] + insertDeleteCost(a[i - 1]);
    let rowMin = cur[0];
    for (let j = 1; j <= m; j++) {
      let v = Math.min(
        prev[j] + insertDeleteCost(a[i - 1]),
        cur[j - 1] + insertDeleteCost(b[j - 1]),
        prev[j - 1] + substitutionCost(a[i - 1], b[j - 1]),
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1] &&
        a[i - 1] !== a[i - 2]
      ) {
        v = Math.min(v, before[j - 2] + SWAP_COST);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max + EPS) return Infinity;
    [before, prev, cur] = [prev, cur, before];
  }
  return prev[m];
}

/**
 * How much correcting a word of this length may cost. Short words get little
 * room, because at three letters two edits make any word into any other: "קמע"
 * may become "קמא" (one sound-alike letter), never "קמח".
 */
export function maxCostFor(length: number): number {
  if (length <= 2) return 0;
  if (length === 3) return 0.6;
  if (length === 4) return 0.8;
  if (length <= 6) return 1;
  return 1.4;
}

// ---------------------------------------------------------------------------
// Words the catalogue knows.

/** How many products carry this word or one of its plural stems; 0 if none. */
function exactFreq(w: string, vocab: Vocabulary): number {
  let best = vocab.get(w) ?? 0;
  if (best > 0) return best;
  for (const v of heVariants(w)) best = Math.max(best, vocab.get(v) ?? 0);
  return best;
}

/**
 * True when there is nothing to correct: the word is too short to judge or
 * holds a digit (a size, a model number), the catalogue has it or one of its
 * singular forms, or it sits inside a catalogue word, which the search matches
 * too ("כיפ" while typing "כיפה").
 */
export function isKnownWord(w: string, vocab: Vocabulary): boolean {
  if (w.length <= 2 || /\d/.test(w)) return true;
  if (exactFreq(w, vocab) > 0) return true;
  for (const v of vocab.keys()) if (v.includes(w)) return true;
  return false;
}

/** The product count used to decide which word says least: the commonest goes first. */
function wordFreq(w: string, vocab: Vocabulary): number {
  if (w.length <= 2 || /\d/.test(w)) return Number.MAX_SAFE_INTEGER;
  const exact = exactFreq(w, vocab);
  if (exact > 0) return exact;
  let best = 0;
  for (const [v, n] of vocab) if (v.includes(w) && n > best) best = n;
  return best;
}

// Hebrew prefix letters, alone and in the pairs that are written together.
const PREFIXES = [
  "ו",
  "ה",
  "ב",
  "כ",
  "ל",
  "מ",
  "ש",
  "וה",
  "וב",
  "וכ",
  "ול",
  "ומ",
  "וש",
  "שה",
  "שב",
  "של",
  "שמ",
  "מה",
  "כש",
];

const HEBREW_LETTERS = "אבגדהוזחטיכךלמםנןסעפףצץקרשת";

/** The word with its last letter in final form, as a word that was split ends. */
function withFinalForm(w: string): string {
  const last = w[w.length - 1];
  const fin = PLAIN_TO_FINAL[last];
  return fin ? w.slice(0, -1) + fin : w;
}

type Candidate = { text: string; cost: number; freq: number };

/** Every string one edit from `w`, with what that edit costs. */
function singleEdits(w: string): Array<{ text: string; cost: number }> {
  const out: Array<{ text: string; cost: number }> = [];
  for (let i = 0; i < w.length; i++) {
    out.push({ text: w.slice(0, i) + w.slice(i + 1), cost: insertDeleteCost(w[i]) });
    if (i + 1 < w.length && w[i] !== w[i + 1]) {
      out.push({ text: w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2), cost: SWAP_COST });
    }
    for (const c of HEBREW_LETTERS) {
      if (c !== w[i]) {
        out.push({ text: w.slice(0, i) + c + w.slice(i + 1), cost: substitutionCost(w[i], c) });
      }
    }
  }
  for (let i = 0; i <= w.length; i++) {
    for (const c of HEBREW_LETTERS) {
      out.push({ text: w.slice(0, i) + c + w.slice(i), cost: insertDeleteCost(c) });
    }
  }
  return out;
}

/** Corrections of `w` that cost at most `budget`, without prefix handling. */
function plainCandidates(w: string, budget: number, vocab: Vocabulary): Candidate[] {
  const out: Candidate[] = [];
  if (budget <= EPS || w.length < 2) return out;
  // 1. A catalogue word a few keystrokes away.
  for (const [v, n] of vocab) {
    if (v === w) continue;
    const d = spellingDistance(w, v, budget);
    if (d <= budget + EPS) out.push({ text: v, cost: d, freq: n });
  }
  // 2. One edit from a word the search reads through its plural rules, which
  //    the vocabulary does not list: מזוזותו → מזוזות (read as מזוזה).
  for (const e of singleEdits(w)) {
    if (e.cost > budget + EPS || vocab.has(e.text)) continue;
    const f = exactFreq(e.text, vocab);
    if (f > 0) out.push({ text: e.text, cost: e.cost, freq: f });
  }
  // 3. Two catalogue words typed without the space: קלףכשר → קלף כשר.
  if (w.length >= 5 && SPLIT_COST <= budget + EPS) {
    for (let i = 2; i <= w.length - 2; i++) {
      const left = withFinalForm(w.slice(0, i));
      const right = w.slice(i);
      const fl = exactFreq(left, vocab);
      const fr = exactFreq(right, vocab);
      if (fl > 0 && fr > 0) {
        out.push({ text: `${left} ${right}`, cost: SPLIT_COST, freq: Math.min(fl, fr) });
      }
    }
  }
  return out;
}

/**
 * The best corrections for one word the catalogue does not know, cheapest
 * first, the commoner word first on a tie. Empty when nothing is close enough.
 */
export function wordCandidates(w: string, vocab: Vocabulary, limit = 2): Candidate[] {
  const max = maxCostFor(w.length);
  const found = new Map<string, Candidate>();
  const add = (c: Candidate) => {
    if (c.cost > max + EPS || c.text === w) return;
    const cur = found.get(c.text);
    if (!cur || c.cost < cur.cost - EPS) found.set(c.text, c);
  };
  plainCandidates(w, max, vocab).forEach(add);
  // A prefix letter glued to a catalogue word: לפיטום → פיטום, מכסף → כסף,
  // and with a second slip after it: וקלףכשר → קלף כשר. The search finds the
  // bare word inside the prefixed one, so dropping the prefix only widens it.
  for (const p of PREFIXES) {
    if (!w.startsWith(p) || w.length - p.length < 3) continue;
    const rest = w.slice(p.length);
    const f = exactFreq(rest, vocab);
    if (f > 0) add({ text: rest, cost: PREFIX_COST, freq: f });
    for (const c of plainCandidates(rest, max - PREFIX_COST, vocab)) {
      add({ ...c, cost: c.cost + PREFIX_COST });
    }
  }
  return [...found.values()]
    .sort((a, b) => a.cost - b.cost || b.freq - a.freq || a.text.localeCompare(b.text))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Whole phrases.

const MAX_WORDS = 8;
const words = (phrase: string) => phrase.split(" ").filter(Boolean);

/** Candidate phrases, in the order they should be tried. */
export type SuggestionPlan = { spelling: string[]; fewerWords: string[] };

/**
 * What to try for a search that found nothing, best first:
 *
 * SPELLING — every unknown word swapped for its nearest catalogue word, then
 * the same with one word's second-best instead. Words the catalogue knows are
 * kept exactly as typed.
 *
 * FEWER WORDS — one word left out, for a phrase no single product matches:
 *  1. an unknown word the shopper typed, which no product can match;
 *  2. from the spelling-corrected phrase, the commonest word first, as long as
 *     at least one word the shopper typed correctly is kept — or "קמע האש"
 *     could end up as "קמא" (a guess) with the shopper's real word gone;
 *  3. from the words as typed, the commonest word first.
 */
export function planSuggestions(term: string, vocab: Vocabulary): SuggestionPlan {
  const typed = words(normHe(term)).slice(0, MAX_WORDS);
  const original = typed.join(" ");
  if (typed.length === 0 || vocab.size === 0) return { spelling: [], fewerWords: [] };

  const known = typed.map((w) => isKnownWord(w, vocab));
  const options = typed.map((w, i) => (known[i] ? [] : wordCandidates(w, vocab, 2)));

  const spelling: Array<{ phrase: string; cost: number }> = [];
  let corrected: string[] | null = null;
  if (options.some((o) => o.length > 0)) {
    corrected = typed.map((w, i) => options[i][0]?.text ?? w);
    const baseCost = options.reduce((s, o) => s + (o[0]?.cost ?? 0), 0);
    spelling.push({ phrase: corrected.join(" "), cost: baseCost });
    options.forEach((o, i) => {
      if (!o[1]) return;
      const alt = [...(corrected as string[])];
      alt[i] = o[1].text;
      spelling.push({ phrase: alt.join(" "), cost: baseCost - o[0].cost + o[1].cost });
    });
  }
  const spellingPhrases = [
    ...new Set(
      spelling
        .sort((a, b) => a.cost - b.cost)
        .map((s) => s.phrase)
        .filter((p) => p !== original),
    ),
  ].slice(0, 3);

  const fewer: string[] = [];
  const keepIfNew = (ws: string[]) => {
    const p = ws.join(" ");
    if (ws.length > 0 && p !== original && !spellingPhrases.includes(p) && !fewer.includes(p)) {
      fewer.push(p);
    }
  };
  if (typed.length >= 2) {
    // 1. An unknown word as typed — no product can match it.
    for (let i = typed.length - 1; i >= 0; i--) {
      if (!known[i]) keepIfNew(typed.filter((_, j) => j !== i));
    }
    // 2. From the corrected phrase, the commonest word first, keeping at least
    //    one word that was typed right.
    if (corrected) {
      const fixed = corrected;
      const flat = fixed.flatMap((w, i) => words(w).map((x) => ({ w: x, typedRight: known[i] })));
      if (flat.length >= 2) {
        const order = flat
          .map((x, i) => ({ i, f: wordFreq(x.w, vocab) }))
          .sort((a, b) => b.f - a.f || b.i - a.i);
        for (const { i } of order) {
          const rest = flat.filter((_, j) => j !== i);
          if (rest.some((x) => x.typedRight)) keepIfNew(rest.map((x) => x.w));
        }
      }
    }
    // 3. From the words as typed, the commonest first.
    const order = typed
      .map((w, i) => ({ i, f: wordFreq(w, vocab) }))
      .sort((a, b) => b.f - a.f || b.i - a.i);
    for (const { i } of order) keepIfNew(typed.filter((_, j) => j !== i));
  }

  // search_phrase_hits() takes 10 phrases per call.
  return { spelling: spellingPhrases, fewerWords: fewer.slice(0, 10 - spellingPhrases.length) };
}

/** The first planned phrase that finds products, given search_phrase_hits(). */
export function pickSuggestion(
  plan: SuggestionPlan,
  hits: Record<string, number>,
): SearchSuggestion | null {
  const found = (p: string) => Number(hits[p.slice(0, 100)] ?? 0) > 0;
  const spelling = plan.spelling.find(found);
  if (spelling) return { term: spelling, kind: "spelling" };
  const fewer = plan.fewerWords.find(found);
  if (fewer) return { term: fewer, kind: "fewer_words" };
  return null;
}
