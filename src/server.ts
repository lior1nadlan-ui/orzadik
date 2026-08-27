import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// Security headers applied to every response.
// CSP allows inline scripts/styles (required for TanStack Start SSR hydration).
// connect-src covers Supabase (REST + realtime) and CardCom API.
// frame-src covers the CardCom payment redirect page.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com https://connect.facebook.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://whtjslgrrfzehivrknuv.supabase.co https://secure.cardcom.solutions https://*.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://www.google.com https://googleads.g.doubleclick.net",
    // NOTE on the google endpoints below: a CSP host wildcard matches SUBDOMAINS
    // ONLY — "https://*.analytics.google.com" does NOT match the apex host
    // "https://analytics.google.com", which is exactly where GA4 posts its
    // /g/collect beacon. That gap silently blocked part of our own measurement
    // (verified against the live console via a Lighthouse run), so the apex is
    // listed explicitly alongside the wildcard. www.google.com and
    // googleads.g.doubleclick.net carry the Google Ads conversion/remarketing
    // pings fired by the GTM container; they were being blocked the same way.
    "connect-src 'self' https://whtjslgrrfzehivrknuv.supabase.co wss://whtjslgrrfzehivrknuv.supabase.co https://secure.cardcom.solutions https://cloudflareinsights.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com https://googleads.g.doubleclick.net https://connect.facebook.net https://www.facebook.com",
    "frame-src https://secure.cardcom.solutions",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://secure.cardcom.solutions",
  ].join("; "),
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // Isolate the browsing context without requiring COEP (which would break
  // GA/Meta/Supabase/CardCom subresources). allow-popups keeps the CardCom
  // payment popup/redirect flow working.
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    // Don't overwrite if already set by a route handler
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Private, per-user or state-changing paths must never be shared-cached.
const NO_STORE_PREFIXES = [
  "/account",
  "/cart",
  "/checkout",
  "/order",
  "/admin",
  "/auth",
  "/api",
];

/**
 * Apply an SEO/perf-friendly Cache-Control to public HTML pages (CDN caches
 * for a few minutes and serves stale while revalidating), and no-store to
 * private pages. Never overrides a Cache-Control a route already set (e.g. the
 * sitemap), and only touches GET HTML responses.
 *
 * WHY THE STALE WINDOW IS SHORT, AND MUST STAY SHORT
 * An HTML document here is NOT independent of the assets it names: it links
 * /assets/styles-<hash>.css and the hashed route chunks, and a Workers Assets
 * deploy serves ONLY the hashes in the version it just uploaded. The moment a
 * deploy lands, every previous hash 404s.
 *
 * So a stale HTML document that outlives a deploy is a broken page — not a
 * slightly old one. The stylesheet 404s, nothing else on the page fails
 * loudly, and the visitor gets raw unstyled HTML: the skip link visible at the
 * top, the nav collapsed into run-together text, the sr-only <h1> on screen.
 * That is exactly what the owner photographed on 2026-08-26, on a day with
 * four deploys inside three and a half hours against a 24-hour SWR window.
 *
 * `s-maxage` bounds the fresh window and `stale-while-revalidate` extends it;
 * together they are how long a visitor can be handed HTML pointing at deleted
 * files. Keep their SUM small. 86400 was chosen for a site nobody was
 * deploying; it has been wrong since the deploy workflow went in.
 */
export function applyCachePolicy(request: Request, response: Response): Response {
  if (request.method !== "GET") return response;
  if (response.headers.has("Cache-Control")) return response;
  const ct = response.headers.get("Content-Type") ?? "";
  if (!ct.includes("text/html")) return response;

  const path = new URL(request.url).pathname;
  const isPrivate = NO_STORE_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    isPrivate
      ? "private, no-store"
      : "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Product slugs that were renamed, old → new, served as 301.
 *
 * The groom range had two problems in its URLs. Four of the eleven boxes were
 * slugged with the PERSONAL NAME of the customer whose bespoke unit had been
 * photographed — /product/groom-set-yaron-biton — and those URLs were live in
 * the sitemap, in the canonical tag and in og:url, so the names travelled with
 * every share and were queued for indexing. The other seven were opaque
 * (groom-set-06), which is a poor URL for what is the store's highest-ticket
 * line. Both sets were renamed to describe the product.
 *
 * The redirect matters because the old URLs were already submitted to Google;
 * without it they become 404s and the store loses the only crawl equity its
 * flagship line has. Keep entries here permanently — a 301 costs one lookup.
 */
const RENAMED_PRODUCT_SLUGS: Record<string, string> = {
  "groom-set-06": "groom-set-grey-print",
  "groom-set-07": "groom-set-white-crown",
  "groom-set-08": "groom-set-beige-suede",
  "groom-set-09": "groom-set-light-blue",
  "groom-set-10": "groom-set-blue-denim",
  "groom-set-15": "groom-set-white-embroidered",
  "groom-set-16": "groom-set-beige-linen-classic",
  "groom-set-liam-shalom-goli": "groom-set-linen-look-premium",
  "groom-set-oren-realov": "groom-set-black-leather-look",
  "groom-set-yaron-ben-dror": "groom-set-grey-melange",
  "groom-set-yaron-biton": "groom-set-brown-leather-look",
};

const PRODUCT_PATH_PREFIX = "/product/";

/**
 * Resolve a request path to its renamed product slug, or undefined.
 *
 * decodeURIComponent THROWS on a malformed percent sequence, and this store has
 * genuinely percent-encoded Hebrew slugs in the wild
 * (/product/%D7%9B%D7%99%D7%A4%D7%94-...), so a crawler or a truncated share
 * link hitting a broken escape must not take down the whole fetch handler.
 */
function renamedProductSlug(pathname: string): string | undefined {
  if (!pathname.startsWith(PRODUCT_PATH_PREFIX)) return undefined;
  const rest = pathname.slice(PRODUCT_PATH_PREFIX.length).replace(/\/+$/, "");
  if (!rest || rest.includes("/")) return undefined;
  let slug: string;
  try {
    slug = decodeURIComponent(rest);
  } catch {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(RENAMED_PRODUCT_SLUGS, slug)
    ? RENAMED_PRODUCT_SLUGS[slug]
    : undefined;
}

// NOTE: cron triggers are NOT handled here. Nitro overrides wrangler's `main`
// and emits its own Cloudflare module, so a `scheduled` export on this object
// would never be invoked. The handler lives in src/nitro/cron.ts, registered on
// Nitro's `cloudflare:scheduled` hook.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Canonicalize the ORIGIN in one hop: scheme first, then host, then redirect
    // once if either changed. Doing them as two separate 301s would make
    // http://www.orzadik.com cost two round-trips and dilute the signal across
    // an intermediate URL.
    //
    // The scheme half was measured missing on 2026-08-02: http://orzadik.com/
    // answered 200, not a redirect, so every one of the ~3,900 indexable pages
    // had a crawlable insecure twin. Cloudflare's "Always Use HTTPS" toggle is
    // the other way to fix it and is strictly better (it never reaches the
    // Worker at all) — this is the belt to that braces, and it keeps the
    // guarantee in code where it is reviewable rather than in a dashboard
    // setting nobody can see from the repo.
    //
    // Protocol detection: behind Cloudflare the Worker can be handed a request
    // whose URL already says https even when the visitor used http, so the
    // `x-forwarded-proto` header is checked as well as the URL scheme. Only an
    // explicit "http" counts — an absent or unexpected header must never
    // trigger a redirect, or a misconfigured edge could produce a loop.
    const reqUrl = new URL(request.url);
    const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
    const isInsecure = reqUrl.protocol === "http:" || forwardedProto === "http";
    const isWww = reqUrl.hostname === "www.orzadik.com";
    if (isInsecure || isWww) {
      if (isInsecure) reqUrl.protocol = "https:";
      if (isWww) reqUrl.hostname = "orzadik.com";
      return new Response(null, { status: 301, headers: { Location: reqUrl.toString() } });
    }
    // Renamed product slugs. Mutating only `pathname` keeps any query string
    // (?utm_source=…) intact, so campaign attribution survives the hop.
    const renamedSlug = renamedProductSlug(reqUrl.pathname);
    if (renamedSlug) {
      reqUrl.pathname = PRODUCT_PATH_PREFIX + renamedSlug;
      return new Response(null, { status: 301, headers: { Location: reqUrl.toString() } });
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applyCachePolicy(request, applySecurityHeaders(normalized));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(brandedErrorResponse());
    }
  },
};
