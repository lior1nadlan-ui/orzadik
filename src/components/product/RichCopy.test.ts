import { describe, it, expect } from "vitest";
import { parseSpecLine, normalizeMarkup, decodeEntities } from "./RichCopy";

describe("parseSpecLine", () => {
  it("parses the house spec format", () => {
    expect(parseSpecLine('חומר: קטיפה | צבע: קרם | מידות: אורך 19 ס"מ')).toEqual([
      { label: "חומר", value: "קטיפה" },
      { label: "צבע", value: "קרם" },
      { label: "מידות", value: 'אורך 19 ס"מ' },
    ]);
  });

  it("keeps a value that itself contains a colon", () => {
    // The label split takes the FIRST colon, so a dimension like 'יחס 1:2' stays whole.
    expect(parseSpecLine("חומר: כסף | הערה: יחס 1:2")).toEqual([
      { label: "חומר", value: "כסף" },
      { label: "הערה", value: "יחס 1:2" },
    ]);
  });

  it("is not fooled by prose that happens to contain a pipe", () => {
    expect(parseSpecLine("מוצר איכותי | מתאים לכל בית יהודי")).toBeNull();
  });

  it("rejects a single segment", () => {
    expect(parseSpecLine("חומר: קטיפה")).toBeNull();
  });

  it("does not treat a far-away colon as a label", () => {
    // >24 chars before the colon is prose punctuation, not a spec key.
    const long = "זהו משפט ארוך מאוד שנמשך והלאה: ערך | חומר: כסף";
    const pairs = parseSpecLine(long);
    expect(pairs).not.toBeNull();
    expect(pairs![0]).toEqual({ label: "", value: "זהו משפט ארוך מאוד שנמשך והלאה: ערך" });
  });

  it("returns null rather than a half-parsed table when most segments are unlabelled", () => {
    expect(parseSpecLine("אחד | שתיים | שלוש | חומר: כסף")).toBeNull();
  });
});

describe("normalizeMarkup", () => {
  it("turns a paragraph boundary into a blank line", () => {
    expect(normalizeMarkup("<p>ראשון</p><p>שני</p>").trim()).toBe("ראשון\n\nשני");
  });

  it("turns <br> into a soft newline", () => {
    expect(normalizeMarkup("שורה<br>שנייה")).toBe("שורה\nשנייה");
    expect(normalizeMarkup("שורה<br />שנייה")).toBe("שורה\nשנייה");
  });

  it("keeps inline emphasis tags for the JSX renderer", () => {
    expect(normalizeMarkup("<p>טקסט <strong>מודגש</strong> כאן</p>")).toContain("<strong>");
  });

  it("drops any other tag but keeps its text — including a would-be link", () => {
    const out = normalizeMarkup('<a href="https://evil.example">לחצו כאן</a>');
    expect(out).toBe("לחצו כאן");
    expect(out).not.toContain("href");
  });

  it("drops a script tag's element wrapper (no html is ever built from this)", () => {
    expect(normalizeMarkup("<script>alert(1)</script>")).not.toContain("<script");
  });

  it("survives the one malformed tag present in the live data", () => {
    expect(normalizeMarkup("<long>טקסט")).toBe("טקסט");
  });
});

describe("decodeEntities", () => {
  it("decodes the entities that appear in supplier copy", () => {
    expect(decodeEntities("א&nbsp;ב")).toBe("א ב");
    expect(decodeEntities("&quot;מהודר&quot;")).toBe('"מהודר"');
    expect(decodeEntities("&#39;")).toBe("'");
  });

  it("decodes &amp; last so &amp;lt; does not become a bracket", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});
