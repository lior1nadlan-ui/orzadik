import { createFileRoute } from "@tanstack/react-router";
import { runAbandonedCartReminders } from "@/lib/abandoned-cart.functions";

/**
 * Scheduled trigger for abandoned-cart reminder emails.
 *
 * Protect with the CRON_SECRET env var. Call from any scheduler (Cloudflare
 * Cron Trigger / Supabase pg_cron+http / external cron), e.g. hourly:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://orzadik.com/api/cron/abandoned-cart-reminders
 *
 * If CRON_SECRET is unset the endpoint refuses to run (never left open).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Authorization header only — a ?token= query param would leak the secret
  // into proxy/access logs (CWE-598).
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (token.length !== secret.length) return false;
  // Constant-time comparison (CWE-208).
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const result = await runAbandonedCartReminders();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error("[cron/abandoned-cart-reminders] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/cron/abandoned-cart-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
