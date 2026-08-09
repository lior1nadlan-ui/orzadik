// What a product is CALLED on a tile, as opposed to what the supplier feed
// stored in `products.name`.
//
// WHY THIS EXISTS. On a 390x844 phone a /category tile is 171px wide and its
// name box is 139x44 — two 22px lines, measured on /category/kipot 2026-08-06.
// 14 of the 24 tiles on that first screen overflow that box, so every character
// the supplier spent on something that is not the product is a character the
// shopper never sees. Three kinds of junk were measured in the live feed and
// are removed here; a fourth was measured and is deliberately NOT removed.
//
// Pure and deterministic: no React, no window/document, no dates. Safe to call
// during Cloudflare Workers SSR and identical on both sides of hydration.
//
// SCOPE. This runs at RENDER time, in the tile. It does not touch the database,
// so the same strings still reach the PDP <h1>, the <title> and the JSON-LD,
// which are built in routes this module does not own. Fixing the rows is an
// owner action; this is the code-side mitigation.

// -----------------------------------------------------------------------------
// 1. "אין החזרת סחורה" — a blanket no-returns claim, welded onto 13 product
//    NAMES (all of them DMC hand-knit kippot, ₪48-₪88 effective, none of them
//    personalized). Measured 2026-08-06: it appears 46 times in the live
//    /category/kipot HTML and 11 times in that page's rendered text, i.e. it is
//    the last thing a shopper reads on the tile of a ₪88 stock item.
//
//    It is removed because it is not a product attribute and it is not true:
//    Israeli consumer law gives a 14-day cancellation right, with a carve-out
//    that applies to personalized goods only — and these are not personalized.
//    A name that states a policy STRICTER than the statutory one is the kind of
//    claim src/routes/returns.tsx exists to state correctly, once, in the right
//    place.
const NO_RETURNS_CLAIM = /\s*אין\s+החזרת\s+סחורה\s*/g;

// -----------------------------------------------------------------------------
// 2. Leading supplier catalogue prefix — 24 names begin with a bare 3-digit run
//    followed by a Hebrew word: "108 זוג פמוטי קריסטל מהודרים 10 ס\"מ",
//    "007 סט נרתיקים מהודרים ללולב ואתרוג", "806 כלי מהודר לדבש".
//    Verified 2026-08-06 that EVERY name in the catalogue starting with 1-6
//    digits uses one of six such prefixes (007 / 008 / 108 / 206 / 207 / 806) —
//    there is no name where a leading number is a quantity, so nothing
//    meaningful is lost. The lookahead requires a Hebrew letter after the run so
//    a future "100 סביבונים"-style quantity would still have to pass the
//    3-digit-exactly test, and a 2- or 4-digit leader is left alone entirely.
const LEADING_CATALOGUE_PREFIX = /^\s*\d{3}\s+(?=[֐-׿])/;

// -----------------------------------------------------------------------------
// 3. Trailing SKU — 42 names end in a bare number or a dashed code that is the
//    supplier's article number: "חמש אבנים 21666", "רעשן גדול פלסטיק 23130",
//    "חותמות א.ב. 27 יח במארז SY-239".
//
//    GUARDED, because a blanket strip is WRONG here and the counter-examples are
//    in the same 42: "שרשרת כסף טהור 925" is the silver fineness (9 rows) and
//    "גביע קריסטל … תכולה 100" / "… תכולה 210" is the capacity in millilitres
//    (5 rows). Both are the most load-bearing word in the name. So the digits
//    are removed only when the word in front of them is not one of those
//    qualifiers.
const TRAILING_SKU = /\s+(?:\d{3,6}|[A-Za-z]{1,3}-\d{2,5})\s*$/;
/** Words that make a trailing number part of the product, not a catalogue id. */
const SKU_KEEP_BEFORE = /(תכולה|טהור|נפח|משקל|גרם|מ"ל|מ״ל)\s*$/;

// -----------------------------------------------------------------------------
// 4. NOT removed: "ארט". The brief for this work recorded it as a supplier token
//    on 289 names and asked for it to be stripped. Measured against the live
//    catalogue on 2026-08-06 before touching it, and the premise does not hold:
//    289 names contain the substring, but 280 of them are the BRAND "ארטמן" /
//    "ארט-מן" / "ארט מן" (Art-Man), which is the maker of the kippah and the
//    single most identifying word in strings like
//    「כיפה קטיפה "ארט-מן" עם ריקמה יברכך גודל 4 - כחול כהה」.
//    Stripping the token would leave "מן" and destroy the name on 6% of the
//    catalogue. The remaining 9 are shopping bags printed with the supplier's
//    logo ("שקית נייר … ארט מהודרת"), where the word is still descriptive.
//    A rule that damages 280 names to tidy 9 is not worth having, so there
//    isn't one. Do not add it back without re-measuring.

// -----------------------------------------------------------------------------
// 5. Bidi normalisation. The house invariant: never leave U+2013 EN DASH or
//    U+00D7 MULTIPLICATION SIGN between two digits in Hebrew copy. Both are
//    bidi class ON, so UAX#9 rule N1 resolves them to R between two European
//    numbers and the range paints REVERSED — "16×21" renders as "21×16".
//    This bug has been reintroduced three times in hand-written copy; it is also
//    sitting in the DATA. Measured 2026-08-06: 1 product name carries U+00D7
//    between digits ("ברכון לוסייט בגודל 16×21 ס\"מ") and 23 rows carry U+2013
//    somewhere. The substitutes are ASCII: U+002D is bidi class ES and stays
//    inside the number run, and a plain "x" is class L, which N1 also resolves
//    against its numeric neighbours without flipping them.
//    An en dash NOT between digits (17 names use it as a plain separator,
//    "סידור מבד טוויד – ורוד עתיק") is left alone: between two Hebrew runs it
//    resolves to R and paints correctly.
const DIGIT_TIMES_DIGIT = /(\d)\s*[×✕✖]\s*(\d)/g;
const DIGIT_ENDASH_DIGIT = /(\d)\s*[–—]\s*(\d)/g;

/**
 * Apply the rule above to ANY string this module hands to a renderer — not just
 * the product name.
 *
 * This is deliberately exported and deliberately called on every emitted value.
 * The first version of this module normalised inside displayProductName only,
 * which left the one field where digit-sign-digit is the NORMAL shape — `מידות`
 * — going to the tile raw. That is the worst possible place to miss it: the
 * measured example in sizeSegment's own docstring is "26X19 ס\"מ", the header
 * above records a live row reading "בגודל 16×21 ס\"מ", and a dimension is
 * precisely a number-sign-number run. So the field most likely to carry the
 * hazard was the one field not protected from it.
 *
 * Length-preserving or shrinking ("16 × 21" -> "16x21"), so callers may safely
 * normalise BEFORE any length guard and get a slightly more permissive result.
 */
export function neutralizeBidiDigits(s: string): string {
  return s.replace(DIGIT_TIMES_DIGIT, "$1x$2").replace(DIGIT_ENDASH_DIGIT, "$1-$2");
}

/** Punctuation left dangling once a chunk in the middle/end is removed. */
const DANGLING_TAIL = /[\s,|·\-–—]+$/;
const DANGLING_HEAD = /^[\s,|·]+/;

/**
 * The name to PRINT for a product — supplier bookkeeping removed, bidi hazards
 * neutralised, whitespace collapsed.
 *
 * Always returns a non-empty string when given one: if every rule fired and
 * nothing survived (impossible on today's data, but cheap to guarantee), the
 * trimmed input is returned rather than an empty tile caption.
 */
export function displayProductName(raw: string | null | undefined): string {
  if (!raw) return "";
  const original = String(raw).trim();

  let s = neutralizeBidiDigits(original)
    .replace(NO_RETURNS_CLAIM, " ")
    .replace(LEADING_CATALOGUE_PREFIX, "");

  // Trailing SKU, only when the preceding word does not turn the number into an
  // attribute (see SKU_KEEP_BEFORE).
  const withoutSku = s.replace(TRAILING_SKU, "");
  if (withoutSku !== s && !SKU_KEEP_BEFORE.test(withoutSku)) s = withoutSku;

  s = s
    .replace(/\s+/g, " ")
    .replace(DANGLING_HEAD, "")
    .replace(DANGLING_TAIL, "")
    .trim();

  return s.length > 0 ? s : original;
}

// =============================================================================
// THE ATTRIBUTE LINE
// =============================================================================
//
// On a wall of 171px near-identical squares at near-identical prices, the
// caption is the photograph. The supplier already ships the three facts that
// separate one kippah from the next, in a fixed trailing line on
// `products.description`:
//
//     חומר: קטיפה | צבע: שחור | מידות: אורך 19 ס"מ
//
// Coverage measured across all 4,648 active products on 2026-08-06:
//     חומר   3,925 (84.4%)      צבע   2,106 (45.3%)      מידות   3,321 (71.5%)
//
// COLOUR COVERAGE IS THE DESIGN CONSTRAINT, and it collapses exactly where the
// gift shelves are:
//     kipot 743 rows           חומר 92%   צבע 84%
//     shabbat 357              חומר 98%   צבע 34%
//     candlesticks 263         חומר 89%   צבע 33%
//     netilat-yadaim 267       חומר 93%   צבע 35%
//     brachot-chamsot 301      חומר 95%   צבע 38%
//     gviei-kidush 200         חומר 72%   צבע 21%
//
// So the line is designed for ABSENCE first: it is a join of whatever is
// present, never a template with holes. One fact renders one word with no
// separator; nothing renders nothing at all and the caller draws no row.
//
// SEPARATOR. U+00B7 MIDDLE DOT, and it is safe here for the reason the en dash
// is not: every segment starts or ends with a Hebrew letter or a digit, and
// UAX#9 N1 treats European numbers as R when resolving neutrals, so the dot sits
// between two R-resolving runs and takes RTL. It must never be placed between
// two BARE numbers — which is why the size segment always carries its unit.

type SpecKey = "חומר" | "צבע" | "מידות";

/**
 * The three label patterns, compiled ONCE at module load.
 *
 * They used to be built with `new RegExp(\`${key}\\s*:…\`)` on every lookup,
 * which is three compilations per product. That is fine for one product page
 * and not fine here: /category/$slug can have up to ~1000 ProductCards mounted
 * at once, so the tile caption is the hottest render path on the site. Value
 * runs to the next pipe, newline, or end; the label may be preceded by a pipe,
 * a newline or the start of the string, so there is no anchor. Non-global, so
 * they hold no lastIndex state and are safe to share.
 */
const SPEC_PATTERNS: Record<SpecKey, RegExp> = {
  "חומר": /חומר\s*:\s*([^|\n\r]+)/,
  "צבע": /צבע\s*:\s*([^|\n\r]+)/,
  "מידות": /מידות\s*:\s*([^|\n\r]+)/,
};

/** Pull one `key: value` out of the house spec line. */
function specValue(text: string, key: SpecKey): string | null {
  const m = text.match(SPEC_PATTERNS[key]);
  if (!m) return null;
  const v = m[1].trim().replace(/\s+/g, " ");
  return v.length > 0 ? v : null;
}

/**
 * Multi-valued supplier fields are comma lists ("שקוף,כסף", "גימור זהב,גימור
 * כסף,שחור"). Rendered with a slash they stay one short token and stay TRUE —
 * printing only the first value would claim a single colour for a product that
 * has several. Longest measured combined material+colour string is 40 chars;
 * the caller clamps the row to one line, and an ellipsis is a truncation the
 * reader can see, not a claim.
 */
function compactList(v: string): string {
  return v.split(/\s*,\s*/).filter(Boolean).join("/");
}

/**
 * The size segment, and it is the fussiest of the three because `מידות` is the
 * dirtiest field: 735 distinct values, median 23 chars, and a long tail where
 * the supplier pasted whole marketing paragraphs into it (max 145 chars,
 * e.g. "26X19 ס\"מ. תזכורת יומיומית לברכה חשובה, מושלמת לכל פינה…").
 *
 * Only a single compact clause is accepted — the "אורך 19 ס\"מ" shape that is
 * the top 8 values in the field and covers the kippah wall, where size IS the
 * discriminator (17 / 18 / 19 ס"מ). Multi-dimension values
 * ("אורך 36 ס\"מ, רוחב 29 ס\"מ") and anything with sentence punctuation are
 * dropped rather than truncated: half a measurement is worse than none.
 */
function sizeSegment(v: string): string | null {
  if (/[.!?]/.test(v)) return null;      // a sentence, not a measurement
  if (v.includes(",")) return null;      // multi-dimension — too long for 171px
  // Normalise BEFORE the length guard: this is the field that actually carries
  // "16×21", and the substitution only ever shortens ("16 × 21" -> "16x21").
  const s = neutralizeBidiDigits(v).replace(/^\s*(?:אורך|גובה|קוטר)\s+/, "").trim();
  if (s.length === 0 || s.length > 16) return null;
  if (!/\d/.test(s)) return null;        // "בינוני" tells a shopper nothing here
  return s;
}

/** Strip the light markup the ~300 HTML-bearing description rows carry. */
function toPlainText(raw: string): string {
  return raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&");
}

/**
 * `'קטיפה · שחור · 19 ס"מ'` — or `'קטיפה'`, or null.
 *
 * Reads the supplier spec line off a product description. Returns null when the
 * row carries none of the three facts, so the tile renders no empty row and no
 * orphan separator.
 */
export function parseTileAttributes(description: string | null | undefined): string | null {
  if (!description) return null;
  const raw = String(description);
  // Cheap necessary condition on the RAW string, BEFORE toPlainText runs four
  // whole-string replaces over it. 49% of products carry no spec tail at all and
  // descriptions run to hundreds of characters, so on a grid of ~1000 tiles this
  // skips the expensive half of the work for about half of them. It cannot
  // produce a false negative: toPlainText only strips tags and decodes entities,
  // and none of the three labels is a tag or an entity, so a label present after
  // the strip was present before it.
  if (!/חומר|צבע|מידות/.test(raw)) return null;
  const text = toPlainText(raw);
  if (!/(חומר|צבע|מידות)\s*:/.test(text)) return null;

  const material = specValue(text, "חומר");
  const colour = specValue(text, "צבע");
  const sizeRaw = specValue(text, "מידות");

  const parts: string[] = [];
  // Every value is normalised on the way out. sizeSegment already does its own
  // (it needs the normalised form for its length guard); material and colour go
  // through here because "כסף 2–3 מ\"מ" is a shape this feed can produce too, and
  // a per-value guarantee is the only kind that survives someone adding a fourth
  // attribute later.
  if (material) parts.push(neutralizeBidiDigits(compactList(material)));
  if (colour) parts.push(neutralizeBidiDigits(compactList(colour)));
  if (sizeRaw) {
    const size = sizeSegment(sizeRaw);
    if (size) parts.push(size);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
