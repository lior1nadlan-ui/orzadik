import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// The homepage hero builds each slide's srcSet by STRING SUBSTITUTION on the
// filename — `src.replace(".webp", "-768w.webp")` — so a slide whose renditions
// were never generated does not fail the build, fail a type check, or throw. It
// 404s in the browser, the browser silently falls back to another candidate,
// and the only symptom is a hero that is heavier or blurrier than intended on
// exactly the devices that can least afford it.
//
// That is precisely how the reel drifted before: it shipped at 900x1200 into a
// full-viewport frame and nobody noticed until the owner said the photographs
// looked blurry. This test is the guard that class of mistake deserves — it
// reads the real array out of the route and stats every file the runtime will
// ask for.
const ROUTE = "src/routes/index.tsx";
const WIDTHS = [768, 1024] as const;

function heroSlides(): string[] {
  const src = readFileSync(ROUTE, "utf8");
  const block = src.match(/const HERO_SLIDES = \[(.*?)\n\];/s);
  if (!block) throw new Error(`HERO_SLIDES not found in ${ROUTE} — did the array get renamed?`);
  return [...block[1].matchAll(/"(\/product-photos\/[^"]+)"/g)].map((m) => m[1]);
}

describe("hero slides ship every file their srcSet names", () => {
  const slides = heroSlides();

  it("finds a non-empty slide list", () => {
    expect(slides.length).toBeGreaterThan(0);
  });

  it("has no duplicate slides", () => {
    expect(new Set(slides).size).toBe(slides.length);
  });

  it.each(slides)("%s exists at full size", (slide) => {
    expect(existsSync(`public${slide}`), `missing: public${slide}`).toBe(true);
  });

  // The srcSet is built by replacing ".webp" — so every slide needs all three.
  it.each(slides)("%s has its 768w and 1024w renditions", (slide) => {
    for (const w of WIDTHS) {
      const variant = slide.replace(".webp", `-${w}w.webp`);
      expect(
        existsSync(`public${variant}`),
        `missing: public${variant} — the hero's srcSet names it, so it would 404`,
      ).toBe(true);
    }
  });

  // head() preloads the LCP frame with a hand-written srcset string. If it
  // drifts from HERO_SLIDES[0], the browser preloads one file and the element
  // then downloads a different one: two fetches for one paint, which is worse
  // than not preloading at all.
  //
  // The key is matched as `imageSrcSet`, camelCase, ON PURPOSE. head() hands
  // these to React as <link> props, and React's prop name is imageSrcSet — it
  // emits the lowercase HTML attribute itself. The lowercase spelling reached
  // the HTML too, so it "worked", while React logged an Invalid DOM property
  // warning on every homepage render. Pinning the spelling here is what makes
  // that a test failure instead of console noise nobody reads. This assertion
  // did catch the fix going in, which is the only evidence that it works.
  it("preloads exactly the first slide, and its renditions match", () => {
    const src = readFileSync(ROUTE, "utf8");
    const preload = src.match(
      /rel: "preload",[\s\S]*?href: "([^"]+)"[\s\S]*?imageSrcSet:\s*\n?\s*"([^"]+)"/,
    );
    expect(preload, "preload link with imageSrcSet not found").not.toBeNull();
    const [, href, srcset] = preload!;

    expect(href, "preload href must be HERO_SLIDES[0]").toBe(slides[0]);
    for (const w of WIDTHS) {
      expect(srcset).toContain(`${slides[0].replace(".webp", `-${w}w.webp`)} ${w}w`);
    }
    expect(srcset).toContain(slides[0]);
  });
});

// §4.5 of the accessibility statement DECLARES the carousel's interval to the
// public. It carried "כל 5 שניות" while the homepage had already moved to 3 —
// a published declaration under תקנות שוויון זכויות שאינה מתארת את האתר. Both
// surfaces now read src/lib/hero-timing.ts; these tests fail if either goes
// back to a literal.
describe("hero timing is declared once", () => {
  const A11Y = "src/routes/accessibility.tsx";

  it("the accessibility statement reads the interval from the shared constant", () => {
    const src = readFileSync(A11Y, "utf8");
    expect(src).toContain("HERO_SLIDE_INTERVAL_SECONDS");
    expect(
      src.match(/מתחלפת בהעברה רכה כל\s*\d/),
      "§4.5 must not restate the interval as a literal",
    ).toBeNull();
  });

  it("the homepage advances on the shared constant, not a literal", () => {
    const src = readFileSync(ROUTE, "utf8");
    expect(src).toContain("HERO_SLIDE_INTERVAL_MS");
    expect(
      src.match(/setHeroSlide[\s\S]{0,120}?\),\s*\d{3,}\s*\)/),
      "the hero interval must come from hero-timing.ts",
    ).toBeNull();
  });
});
