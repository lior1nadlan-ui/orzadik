import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { HERO_SLIDES, heroSrc } from "@/components/home/HeroSlides";

// The hero names its photographs by base name and derives three sizes from
// each (768w, 1024w, the 1086px original). A missing size does not fail the
// build — it 404s in the browser, and on the first slide that is the LCP
// paint. This stats every file the srcset can ask for.
describe("hero slides ship every size the srcset references", () => {
  const files = HERO_SLIDES.flatMap((s) => [
    heroSrc(s.file, 768),
    heroSrc(s.file, 1024),
    heroSrc(s.file),
  ]);
  it.each(files)("%s exists on disk", (path) => {
    expect(existsSync(`public${path}`), `missing: public${path}`).toBe(true);
  });

  // head() preloads the first slide as the LCP image. If the preload drifted
  // to another file, the browser would fetch one picture and paint another.
  it("preloads the first slide", () => {
    const route = readFileSync("src/routes/index.tsx", "utf8");
    expect(route).toMatch(/href: heroSrc\(HERO_SLIDES\[0\]\.file, 1024\)/);
    expect(route).toMatch(/imageSrcSet: heroSrcSet\(HERO_SLIDES\[0\]\.file\)/);
  });
});
