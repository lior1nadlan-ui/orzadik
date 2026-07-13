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
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://secure.cardcom.solutions https://*.google-analytics.com https://www.googletagmanager.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://secure.cardcom.solutions https://cloudflareinsights.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
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
  "/reset-password",
  "/forgot-password",
];

/**
 * Apply an SEO/perf-friendly Cache-Control to public HTML pages (CDN caches
 * for a few minutes and serves stale while revalidating), and no-store to
 * private pages. Never overrides a Cache-Control a route already set (e.g. the
 * sitemap), and only touches GET HTML responses.
 */
function applyCachePolicy(request: Request, response: Response): Response {
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
      : "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Canonicalize host: 301-redirect www → apex so all SEO signals concentrate
    // on https://orzadik.com and there's no crawlable duplicate host.
    const reqUrl = new URL(request.url);
    if (reqUrl.hostname === "www.orzadik.com") {
      reqUrl.hostname = "orzadik.com";
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
