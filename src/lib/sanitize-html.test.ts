import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize-html";

describe("sanitizeHtml — keeps the store's real content intact", () => {
  it("preserves the tag vocabulary actually present in the DB", () => {
    const html =
      "<h2>כותרת</h2><p>פסקה עם <strong>הדגשה</strong>.</p><ul><li>פריט</li></ul><ol><li>שני</li></ol><br>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("keeps Hebrew text and entities untouched", () => {
    const html = "<p>טלית 40&times;60 ס&quot;מ &amp; עוד</p>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("keeps safe links and hardens them with rel", () => {
    const out = sanitizeHtml('<a href="/category/talitot" title="טליתות">טליתות</a>');
    expect(out).toContain('href="/category/talitot"');
    expect(out).toContain('title="טליתות"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("allows https, mailto and tel", () => {
    for (const href of ["https://orzadik.com/x", "mailto:a@b.co", "tel:+972545818486"]) {
      expect(sanitizeHtml(`<a href="${href}">x</a>`)).toContain(`href="${href}"`);
    }
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });

  it("leaves plain text with no markup alone", () => {
    expect(sanitizeHtml('חומר: קריסטל | מידות: אורך 16 ס"מ')).toBe(
      'חומר: קריסטל | מידות: אורך 16 ס"מ',
    );
  });
});

describe("sanitizeHtml — strips anything dangerous", () => {
  it("removes script tags AND their contents", () => {
    const out = sanitizeHtml('<p>לפני</p><script>alert("x")</script><p>אחרי</p>');
    expect(out).toBe("<p>לפני</p><p>אחרי</p>");
    expect(out).not.toContain("alert");
  });

  it("removes an unclosed script through end of input", () => {
    expect(sanitizeHtml("<p>ok</p><script>evil()")).toBe("<p>ok</p>");
  });

  it("removes style, iframe, object, embed with contents", () => {
    for (const t of ["style", "iframe", "object", "embed", "noscript"]) {
      const out = sanitizeHtml(`<p>a</p><${t}>PAYLOAD</${t}><p>b</p>`);
      expect(out).not.toContain("PAYLOAD");
      expect(out).toBe("<p>a</p><p>b</p>");
    }
  });

  it("drops every event handler attribute", () => {
    const out = sanitizeHtml('<p onclick="steal()" onmouseover="x()">טקסט</p>');
    expect(out).toBe("<p>טקסט</p>");
  });

  it("drops javascript:, vbscript: and data: hrefs but keeps the text", () => {
    for (const bad of [
      "javascript:alert(1)",
      "vbscript:msgbox",
      "data:text/html;base64,PHN2Zz4=",
    ]) {
      const out = sanitizeHtml(`<a href="${bad}">לחצו</a>`);
      expect(out).not.toContain(bad);
      expect(out).toContain("לחצו");
    }
  });

  it("catches a scheme hidden with control characters or spaces", () => {
    const out = sanitizeHtml('<a href="java\tscript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("script:");
  });

  it("unwraps unknown tags but keeps their text", () => {
    expect(sanitizeHtml("<div><p>שלום</p></div>")).toBe("<p>שלום</p>");
    expect(sanitizeHtml("<marquee>זז</marquee>")).toBe("זז");
  });

  it("strips HTML comments (which can hide markup)", () => {
    expect(sanitizeHtml("<p>a</p><!-- <script>x</script> --><p>b</p>")).toBe("<p>a</p><p>b</p>");
  });

  it("drops img/svg entirely — including an onerror payload", () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(out).toBe("");
  });

  it("keeps a link's text when its href is rejected", () => {
    const out = sanitizeHtml('<a href="javascript:void(0)">קרא עוד</a>');
    expect(out).toContain("קרא עוד");
    expect(out).not.toContain("href");
  });

  it("is idempotent — sanitising twice changes nothing further", () => {
    const dirty =
      '<div onclick="x"><p>טקסט <a href="javascript:1">קישור</a></p><script>y</script></div>';
    const once = sanitizeHtml(dirty);
    expect(sanitizeHtml(once)).toBe(once);
  });
});
