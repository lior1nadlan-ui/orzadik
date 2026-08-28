import { describe, it, expect } from "vitest";
import { applyCachePolicy } from "./server";

// An HTML document served from this Worker names hashed assets —
// /assets/styles-<hash>.css and the route chunks — and a Workers Assets deploy
// serves only the hashes belonging to the version it just uploaded. Every older
// hash 404s from the instant a deploy lands.
//
// That makes the CDN's stale window a correctness bound, not a performance
// knob: HTML that outlives a deploy points at files that no longer exist, the
// stylesheet 404s, and the visitor gets raw unstyled HTML with the skip link
// and the sr-only <h1> on screen. It shipped that way with
// stale-while-revalidate=86400 and the owner photographed it.
//
// This test pins the bound. If someone widens it again, they have to come here
// and read why they shouldn't.
const MAX_STALE_SECONDS = 600;

function html(headers: Record<string, string> = {}): Response {
  return new Response("<!doctype html>", {
    headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
  });
}

const get = (path: string) => new Request(`https://orzadik.com${path}`);

function directive(response: Response, name: string): number | undefined {
  const cc = response.headers.get("Cache-Control") ?? "";
  const match = cc.match(new RegExp(`${name}=(\\d+)`));
  return match ? Number(match[1]) : undefined;
}

describe("public HTML can never go stale past a deploy", () => {
  const res = applyCachePolicy(get("/"), html());

  it("is shared-cacheable", () => {
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=");
  });

  it("never lets a browser hold HTML privately", () => {
    expect(directive(res, "max-age")).toBe(0);
  });

  it("keeps s-maxage + stale-while-revalidate within the deploy-safe bound", () => {
    const fresh = directive(res, "s-maxage") ?? 0;
    const stale = directive(res, "stale-while-revalidate") ?? 0;
    expect(
      fresh + stale,
      `HTML could be served ${fresh + stale}s after a deploy deleted the assets it names`,
    ).toBeLessThanOrEqual(MAX_STALE_SECONDS);
  });
});

describe("private paths are never cached", () => {
  it.each(["/account", "/cart", "/checkout", "/order/123", "/admin", "/auth/login", "/api/x"])(
    "%s is no-store",
    (path) => {
      expect(applyCachePolicy(get(path), html()).headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
    },
  );
});

describe("it stays out of the way", () => {
  it("never overrides a Cache-Control a route already set", () => {
    const res = applyCachePolicy(
      get("/sitemap.xml"),
      html({ "Cache-Control": "public, max-age=3600" }),
    );
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("leaves non-HTML responses alone", () => {
    const json = new Response("{}", { headers: { "Content-Type": "application/json" } });
    expect(applyCachePolicy(get("/api/x"), json).headers.get("Cache-Control")).toBeNull();
  });

  it("leaves non-GET requests alone", () => {
    const post = new Request("https://orzadik.com/", { method: "POST" });
    expect(applyCachePolicy(post, html()).headers.get("Cache-Control")).toBeNull();
  });
});
