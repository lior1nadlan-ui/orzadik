import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// The homepage hero <video> names its poster and <source> files as plain
// string literals in src/routes/index.tsx. A typo there does not fail the
// build or a type check — it 404s in the browser and the visitor gets a blank
// video frame (or, worse, no poster at all on the LCP paint). This is the
// guard that class of mistake deserves: it reads the literals out of the
// route and stats every file the runtime will ask for.
const ROUTE = "src/routes/index.tsx";

// hero-poster.jpg is not referenced anywhere in the route — the <video poster>
// attribute takes one URL and it is the WebP — but it ships alongside the WebP
// as the un-transcoded export, so only its on-disk presence is asserted.
const HERO_MEDIA_REFERENCED = [
  "/media/hero-video.mp4",
  "/media/hero-video.webm",
  "/media/hero-poster.webp",
];
const HERO_MEDIA_ON_DISK = [...HERO_MEDIA_REFERENCED, "/media/hero-poster.jpg"];

describe("hero video ships every file the route references", () => {
  const routeSrc = readFileSync(ROUTE, "utf8");

  it.each(HERO_MEDIA_REFERENCED)("%s is referenced in the route", (path) => {
    expect(routeSrc.includes(path), `${ROUTE} does not reference ${path}`).toBe(true);
  });

  it.each(HERO_MEDIA_ON_DISK)("%s exists on disk", (path) => {
    expect(existsSync(`public${path}`), `missing: public${path}`).toBe(true);
  });

  // head() preloads the poster as the homepage's LCP paint. If this drifts
  // from the <video>'s own poster attribute, the browser preloads one file
  // while the element paints another — a wasted fetch on every visit.
  it("preloads the same poster the <video> element uses", () => {
    const preload = routeSrc.match(/rel: "preload",\s*\n\s*as: "image",\s*\n\s*href: "([^"]+)"/);
    expect(preload, "poster preload link not found").not.toBeNull();
    const posterAttr = routeSrc.match(/poster="([^"]+)"/);
    expect(posterAttr, "<video poster> attribute not found").not.toBeNull();
    expect(preload![1]).toBe(posterAttr![1]);
    expect(preload![1]).toBe("/media/hero-poster.webp");
  });
});
