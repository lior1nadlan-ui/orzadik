import { describe, expect, it } from "vitest";
import {
  heVariants,
  isKnownWord,
  maxCostFor,
  normHe,
  parseVocabulary,
  pickSuggestion,
  planSuggestions,
  spellingDistance,
  wordCandidates,
} from "@/lib/did-you-mean";

// The real counts from search_vocabulary() on 15.11.2026, for the words these
// tests touch.
const VOCAB = new Map(
  Object.entries({
    טלית: 347,
    לטלית: 148,
    תיק: 196,
    גביע: 159,
    כסף: 365,
    ברכונים: 33,
    ברכון: 6,
    מזוזה: 369,
    קלף: 25,
    פיטום: 6,
    הקטורת: 6,
    בית: 32,
    מעץ: 29,
    עץ: 67,
    תפילין: 271,
    האש: 122,
    שלי: 122,
    בתי: 9,
    כיפה: 251,
    // Real neighbours of the words above, so the ranking is tested against
    // the competition it meets in the live vocabulary.
    תלת: 1,
    לתליה: 2,
    לתלייה: 28,
    מזוזת: 3,
    מוכסף: 4,
    בכסף: 18,
    וכסף: 6,
    מכסה: 16,
    קמל: 2,
    לברכונים: 11,
    ברכוני: 1,
    גב: 2,
    קלה: 23,
  }),
);

describe("normHe", () => {
  it("matches the database's norm_he: niqqud off, quotes to spaces, lower case", () => {
    expect(normHe("גבע מכסּף")).toBe("גבע מכסף");
    expect(normHe('20 ס"מ')).toBe("20 ס מ");
    expect(normHe("  Art-Man  ")).toBe("art-man");
  });
});

describe("heVariants", () => {
  it("adds the singular stems the search looks for", () => {
    expect(heVariants("מזוזות")).toContain("מזוזה");
    expect(heVariants("גביעים")).toContain("גביע");
    expect(heVariants("חנוכיות")).toEqual(expect.arrayContaining(["חנוכיה", "חנוכייה"]));
    expect(heVariants("בת")).toEqual([]);
  });
});

describe("spellingDistance", () => {
  it("charges little for what Hebrew spellers actually mix up", () => {
    expect(spellingDistance("תלית", "טלית")).toBeCloseTo(0.3);
    expect(spellingDistance("גבע", "גביע")).toBeCloseTo(0.4);
    expect(spellingDistance("בתי", "בית")).toBeCloseTo(0.6);
    expect(spellingDistance("קלפ", "קלף")).toBeCloseTo(0.1);
    expect(spellingDistance("קמע", "קמח")).toBeCloseTo(1);
  });

  it("gives up as soon as the budget is spent", () => {
    expect(spellingDistance("תפידנית", "תפילין", 1)).toBe(Infinity);
    expect(spellingDistance("טלית", "מזוזה", 0.8)).toBe(Infinity);
  });

  it("allows less on short words", () => {
    expect(maxCostFor(2)).toBe(0);
    expect(maxCostFor(3)).toBeLessThan(maxCostFor(5));
  });
});

describe("isKnownWord", () => {
  it("leaves alone what the search already finds", () => {
    expect(isKnownWord("טלית", VOCAB)).toBe(true);
    expect(isKnownWord("גביעים", VOCAB)).toBe(true); // through the plural rule
    expect(isKnownWord("כיפ", VOCAB)).toBe(true); // inside a word, while typing
    expect(isKnownWord("31x38", VOCAB)).toBe(true); // a size
    expect(isKnownWord("של", VOCAB)).toBe(true); // too short to judge
    expect(isKnownWord("תלית", VOCAB)).toBe(false);
  });
});

describe("wordCandidates", () => {
  const first = (w: string, v = VOCAB) => wordCandidates(w, v)[0]?.text;

  it("finds the catalogue word behind the real misses", () => {
    expect(first("תלית")).toBe("טלית");
    expect(first("לתלית")).toBe("לטלית");
    expect(first("בירכונים")).toBe("ברכונים");
    expect(first("גבע")).toBe("גביע");
    expect(first("מזוזותו")).toBe("מזוזות");
  });

  it("drops a prefix glued to a catalogue word", () => {
    expect(first("לפיטום")).toBe("פיטום");
    expect(first("מכסף")).toBe("כסף");
    expect(first("וקלף")).toBe("קלף");
  });

  it("puts back a missing space", () => {
    const vocab = new Map([...VOCAB, ["כשר", 40]]);
    expect(first("קלףכשר", vocab)).toBe("קלף כשר");
    expect(first("וקלףכשר", vocab)).toBe("קלף כשר");
  });

  it("offers nothing rather than a far-fetched guess", () => {
    expect(wordCandidates("קמע", VOCAB)).toEqual([]);
    expect(wordCandidates("תפידנית", VOCAB)).toEqual([]);
  });
});

describe("planSuggestions", () => {
  it("corrects the unknown words and keeps the known ones as typed", () => {
    expect(planSuggestions("תיק לתלית", VOCAB).spelling[0]).toBe("תיק לטלית");
    expect(planSuggestions("גבע מכסּף", VOCAB).spelling[0]).toBe("גביע כסף");
  });

  it("leaves a word out when no product has them all", () => {
    const plan = planSuggestions("בתי תפילין האש", VOCAB);
    expect(plan.spelling).toEqual([]);
    expect(plan.fewerWords).toEqual(
      expect.arrayContaining(["תפילין האש", "בתי תפילין", "בתי האש"]),
    );
  });

  it("drops the word nothing matches before a word the shopper typed right", () => {
    expect(planSuggestions("קמע האש", VOCAB).fewerWords[0]).toBe("האש");
  });

  it("can correct one word and leave out another", () => {
    const plan = planSuggestions("בית מעץ לפיטום הקטורת", VOCAB);
    expect(plan.spelling[0]).toBe("בית מעץ פיטום הקטורת");
    expect(plan.fewerWords).toContain("בית פיטום הקטורת");
  });

  it("never keeps only guessed words", () => {
    const plan = planSuggestions("קמע האש", new Map([...VOCAB, ["קמא", 3]]));
    expect(plan.spelling[0]).toBe("קמא האש");
    expect(plan.fewerWords).not.toContain("קמא");
  });

  it("has nothing to try for one word that is not close to anything", () => {
    expect(planSuggestions("תפידנית", VOCAB)).toEqual({ spelling: [], fewerWords: [] });
    expect(planSuggestions("טלית", new Map())).toEqual({ spelling: [], fewerWords: [] });
  });

  it("stays within what one search_phrase_hits() call takes", () => {
    const plan = planSuggestions("בית מעץ לפיטום הקטורת תיק גבע כסף תפילין", VOCAB);
    expect(plan.spelling.length + plan.fewerWords.length).toBeLessThanOrEqual(10);
    expect([...plan.spelling, ...plan.fewerWords]).not.toContain(
      "בית מעץ לפיטום הקטורת תיק גבע כסף תפילין",
    );
  });
});

describe("pickSuggestion", () => {
  const plan = { spelling: ["תיק לטלית"], fewerWords: ["תיק", "לתלית"] };

  it("prefers a spelling fix that finds products", () => {
    expect(pickSuggestion(plan, { "תיק לטלית": 114, תיק: 196 })).toEqual({
      term: "תיק לטלית",
      kind: "spelling",
    });
  });

  it("falls back to fewer words, and to nothing", () => {
    expect(pickSuggestion(plan, { "תיק לטלית": 0, תיק: 196 })).toEqual({
      term: "תיק",
      kind: "fewer_words",
    });
    expect(pickSuggestion(plan, {})).toBeNull();
  });
});

describe("parseVocabulary", () => {
  it("keeps only words with a positive count", () => {
    const v = parseVocabulary({ טלית: 347, "": 3, רע: "x", אפס: 0 });
    expect([...v.entries()]).toEqual([["טלית", 347]]);
    expect(parseVocabulary(null).size).toBe(0);
    expect(parseVocabulary([1, 2]).size).toBe(0);
  });
});
