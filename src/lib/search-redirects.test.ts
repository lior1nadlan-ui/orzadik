import { describe, expect, it } from "vitest";
import { applySearchRedirect } from "./search-redirects";

describe("applySearchRedirect", () => {
  const map = { "כיסוי חלה": "מפת חלה", tefillin: "תפילין" };

  it("redirects the whole phrase, however it was typed", () => {
    expect(applySearchRedirect("  כיסוי   חלה ", map)).toBe("מפת חלה");
    expect(applySearchRedirect("Tefillin", map)).toBe("תפילין");
  });

  it("leaves anything else exactly as typed", () => {
    expect(applySearchRedirect("כיסוי חלה רקום", map)).toBe("כיסוי חלה רקום");
    expect(applySearchRedirect("טלית", map)).toBe("טלית");
    expect(applySearchRedirect("", map)).toBe("");
  });
});
