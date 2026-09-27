import { describe, it, expect } from "vitest";
import { emailPriceHtml, emailPriceText, emailLine } from "./email-price";
import { formatPromoEnd, type ActivePromo } from "./promotions";

const END = "2026-12-20T21:59:00Z";
const promo: ActivePromo = { id: "p", percentOff: 20, label: "מבצע חנוכה", endsAt: END };
const strip = (s: string) => s.replace(/\u200f|\u200e|\u00a0/g, " ");

describe("email prices", () => {
  it("without a promotion, print what the emails always printed", () => {
    // catalogue 300 → site price 210
    expect(strip(emailPriceText(300, null))).toMatch(/210/);
    expect(emailPriceText(300, null)).not.toMatch(/הנחה/);
    expect(emailPriceHtml(300, null)).not.toMatch(/<s /);
    expect(emailPriceText(0, promo)).toBe("לפי שער הזהב");
  });

  it("with one, show the promo price, the regular one struck, and the end date", () => {
    // catalogue 300 → 210 regular → 20% off → 168
    const html = strip(emailPriceHtml(300, promo));
    expect(html).toMatch(/168/);
    expect(html).toMatch(/<s [^>]*>[^<]*210/);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("-20%");
    expect(html).toContain(`מבצע חנוכה · בתוקף עד ${formatPromoEnd(END)}`);

    const text = strip(emailPriceText(300, promo));
    expect(text).toMatch(/168.*במקום.*210.*20% הנחה.*בתוקף עד/);
  });

  it("prices a cart line now, with and without the promotion", () => {
    expect(emailLine(300, 2, promo)).toEqual({
      total: 336,
      regularTotal: 420,
      pct: 20,
      note: `מבצע חנוכה · בתוקף עד ${formatPromoEnd(END)}`,
    });
    expect(emailLine(300, 2, null)).toEqual({ total: 420, regularTotal: 420, pct: 0, note: null });
    // Unlabelled promotions still say what the price is and until when.
    expect(emailLine(300, 1, { ...promo, label: null }).note).toMatch(/^מחיר מבצע · בתוקף עד/);
  });
});
