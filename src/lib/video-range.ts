// Byte-range delivery for the site's video, so it plays on iPhones.
//
// WHY. iOS Safari will not play an <video> whose server ignores byte-range
// requests: it opens with "Range: bytes=0-1" and gives up unless it gets a 206.
// Measured on orzadik.com on 2026-11-08: every static file (Workers Assets,
// /assets/* and /media/* alike) answers a Range request with 200 and the whole
// body, never 206. So the homepage store film and the five gallery reels
// probably showed only their posters on an iPhone.
//
// HOW. Static files never reach our code: Nitro's Cloudflare runtime hands any
// public-asset path straight to env.ASSETS. So video is requested through a
// path that is NOT a static file, /v/<hashed-name>.mp4, which src/server.ts
// answers from env.ASSETS with proper 206 / 416 handling. In production builds
// Vite emits video as /assets/<name>-<hash>.mp4; rangeableVideoSrc() maps that
// URL to /v/<name>-<hash>.mp4. Anything else (the dev server's /src/assets/...
// URLs, absolute URLs) is left alone, so `vite dev` keeps working unchanged.

export const VIDEO_PROXY_PREFIX = "/v/";
const ASSET_PREFIX = "/assets/";
// One path segment, a plain hashed file name, video extensions only. Rejecting
// everything else keeps the proxy from becoming a way to read arbitrary assets
// or to traverse paths.
const VIDEO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(mp4|webm)$/;

/** The URL to put in <video src>: the range-capable /v/ path in production. */
export function rangeableVideoSrc(src: string): string {
  if (!src.startsWith(ASSET_PREFIX)) return src;
  const name = src.slice(ASSET_PREFIX.length);
  return VIDEO_NAME.test(name) ? VIDEO_PROXY_PREFIX + name : src;
}

/** "/v/<name>.mp4" → "/assets/<name>.mp4", or null if it is not a video name. */
export function videoAssetPath(pathname: string): string | null {
  if (!pathname.startsWith(VIDEO_PROXY_PREFIX)) return null;
  const name = pathname.slice(VIDEO_PROXY_PREFIX.length);
  return VIDEO_NAME.test(name) ? ASSET_PREFIX + name : null;
}

export type ByteRange = { start: number; end: number };

/**
 * Parse a single "Range: bytes=…" header against a body of `size` bytes
 * (RFC 9110 §14.1.2).
 *   null              → no usable range: answer 200 with the whole body. This
 *                       covers no header, other units, malformed specs, and
 *                       multi-range requests, which a server may ignore.
 *   "unsatisfiable"   → answer 416.
 *   { start, end }    → inclusive byte offsets, end clamped to the body.
 */
export function parseByteRange(
  header: string | null | undefined,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  if (a === "") {
    // Suffix range: the last N bytes.
    const n = Number(b);
    if (!Number.isSafeInteger(n) || n <= 0 || size <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(a);
  if (!Number.isSafeInteger(start)) return null;
  if (b !== "") {
    // An explicit last-pos below first-pos makes the spec invalid: ignore it.
    const last = Number(b);
    if (!Number.isSafeInteger(last) || last < start) return null;
    if (start >= size) return "unsatisfiable";
    return { start, end: Math.min(last, size - 1) };
  }
  // Open-ended "bytes=N-": everything from N, unless N is past the end.
  if (start >= size) return "unsatisfiable";
  return { start, end: size - 1 };
}

/**
 * Build the response for a fully buffered body: 206 for a satisfiable range,
 * 416 for an unsatisfiable one, 200 otherwise. `headers` carries the shared
 * ones (Content-Type, Cache-Control, ETag). HEAD gets the same headers, no body.
 */
export function rangedResponse(
  body: ArrayBuffer,
  rangeHeader: string | null,
  method: string,
  headers: Record<string, string>,
): Response {
  const size = body.byteLength;
  const out = new Headers(headers);
  out.set("Accept-Ranges", "bytes");
  const head = method === "HEAD";
  const range = parseByteRange(rangeHeader, size);
  if (range === "unsatisfiable") {
    out.set("Content-Range", `bytes */${size}`);
    out.delete("Content-Type");
    return new Response(null, { status: 416, headers: out });
  }
  if (range === null) {
    out.set("Content-Length", String(size));
    return new Response(head ? null : body, { status: 200, headers: out });
  }
  const length = range.end - range.start + 1;
  out.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  out.set("Content-Length", String(length));
  return new Response(head ? null : body.slice(range.start, range.end + 1), {
    status: 206,
    headers: out,
  });
}
