// Shared bearer-token gate for the /api/cron/* endpoints.
//
// Extracted rather than copied into each cron route: this is the only thing
// standing between the public internet and the mail senders, and three
// hand-duplicated constant-time comparisons is three chances to get one wrong.

/**
 * True only when the request carries `Authorization: Bearer $CRON_SECRET`.
 *
 * - Header only. A `?token=` query parameter would leak the secret into proxy
 *   and access logs (CWE-598).
 * - Constant-time comparison (CWE-208).
 * - If CRON_SECRET is unset the endpoint refuses everything, so a
 *   misconfigured deploy fails closed instead of leaving the senders open.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** Run `job` behind the cron gate and render the standard JSON envelope. */
export async function handleCronRequest(
  request: Request,
  name: string,
  job: () => Promise<Record<string, unknown>>,
): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const result = await job();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error(`[cron/${name}] error:`, e);
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
