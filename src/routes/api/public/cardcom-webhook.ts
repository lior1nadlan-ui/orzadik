import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkWebhookRateLimit, getClientIp } from "@/lib/rate-limit.server";
import { getLpResult, settleCardcomOrder } from "@/lib/cardcom-settle.server";

// CardCom sends webhooks from a set of source IPs / CIDR ranges.
// Set CARDCOM_ALLOWED_IPS to a comma-separated list of exact IPs and/or CIDR
// ranges (e.g. "82.80.227.16/29, 1.2.3.4") to enable enforcement.
// Confirm current ranges from CardCom support. Leave unset to skip (fail-open).
function getCardcomAllowedList(): string[] | null {
  const raw = process.env.CARDCOM_ALLOWED_IPS;
  if (!raw) return null; // not configured → skip check
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

// True if `ip` matches any entry in `list` (exact IP or a.b.c.d/nn CIDR range).
function ipInAllowlist(ip: string, list: string[]): boolean {
  const ipInt = ipv4ToInt(ip);
  for (const entry of list) {
    if (entry.includes("/")) {
      const [base, bitsStr] = entry.split("/");
      const baseInt = ipv4ToInt(base);
      const bits = Number(bitsStr);
      if (ipInt === null || baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      if ((ipInt & mask) === (baseInt & mask)) return true;
    } else if (entry === ip) {
      return true;
    }
  }
  return false;
}

/**
 * Cardcom payment webhook receiver (per Cardcom integration spec).
 *
 * Flow:
 *  1. Extract LowProfileId from the webhook payload.
 *  2. Locate the order by cardcom_low_profile_id (NOT ReturnValue).
 *  3. Idempotency: if the order already has a TranzactionId — return 200.
 *  4. Validate the transaction server-to-server via GetLpResult
 *     (5s timeout, one retry). The webhook itself is unauthenticated;
 *     GetLpResult IS the validation.
 *  5. Persist Cardcom fields and update order status.
 */



export const Route = createFileRoute("/api/public/cardcom-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const clientIp = getClientIp(request);

          // 1. IP allowlist (enforced only when CARDCOM_ALLOWED_IPS env var is set)
          const allowlist = getCardcomAllowedList();
          if (allowlist && !ipInAllowlist(clientIp, allowlist)) {
            console.error(`[cardcom-webhook] BLOCKED: request from unlisted IP ${clientIp}`);
            return new Response("forbidden", { status: 403 });
          }

          // 2. Per-IP rate limit: max 60 webhook calls per minute per IP
          const { limited } = await checkWebhookRateLimit(clientIp, 60, 60);
          if (limited) {
            console.error(`[cardcom-webhook] RATE LIMITED: IP ${clientIp}`);
            return new Response("rate limited", { status: 429 });
          }

          // Cardcom may post JSON or form-encoded
          let payload: Record<string, any> = {};
          const ctype = request.headers.get("content-type") ?? "";
          if (ctype.includes("application/json")) {
            payload = await request.json();
          } else {
            const form = await request.formData();
            for (const [k, v] of form.entries()) payload[k] = v;
          }

          // Do NOT log full payload — may contain customer PII. Log only the LowProfileId.
          const _lpForLog = payload.LowProfileId ?? payload.lowProfileId ?? payload.lowprofilecode ?? null;
          console.log("[cardcom-webhook] received LowProfileId:", _lpForLog);

          const lowProfileId =
            payload.LowProfileId ?? payload.lowProfileId ?? payload.lowprofilecode ?? null;
          if (!lowProfileId) {
            console.error("[cardcom-webhook] HIGH: missing LowProfileId in payload");
            return new Response("missing LowProfileId", { status: 400 });
          }

          // GetLpResult is memoized: the orphaned-session recovery below needs it
          // before the order is known, and the validation step needs it after.
          // Calling it twice would double the outbound latency for no gain.
          let lpCached: any = null;
          let lpFetched = false;
          const lp$ = async () => {
            if (!lpFetched) {
              lpCached = await getLpResult(String(lowProfileId));
              lpFetched = true;
            }
            return lpCached;
          };

          // Locate order by LowProfileId (fallback to legacy payment_txn_id)
          let { data: order } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("cardcom_low_profile_id", String(lowProfileId))
            .maybeSingle();
          if (!order) {
            const { data: legacy } = await supabaseAdmin
              .from("orders")
              .select("*")
              .eq("payment_txn_id", String(lowProfileId))
              .maybeSingle();
            order = legacy;
          }
          if (!order) {
            // ORPHANED SESSION RECOVERY. There is one slot for a LowProfileId, so a
            // buyer who opens the payment page, backs out, and clicks pay again gets
            // a new id written OVER the old one. If they then complete payment on the
            // first, still-open tab, both lookups above miss — the card is charged
            // and the order would stay unpaid forever, with no confirmation, no stock
            // decrement and no retry (CardCom stops once it has our 200).
            //
            // Recover via ReturnValue, which is the order id we ourselves set at
            // LowProfile/Create. This is NOT the prohibited "match on ReturnValue":
            // that rule protects against trusting the UNAUTHENTICATED webhook body,
            // whereas this value comes from CardCom's own server-to-server
            // GetLpResult response, keyed by the LowProfileId — the same response
            // this handler already treats as the source of truth below.
            try {
              const probe = await lp$();
              const rv = probe?.ReturnValue;
              if (rv && /^[0-9a-f-]{36}$/i.test(String(rv))) {
                const { data: byRv } = await supabaseAdmin
                  .from("orders")
                  .select("*")
                  .eq("id", String(rv))
                  .eq("payment_provider", "cardcom")
                  .maybeSingle();
                if (byRv) {
                  order = byRv;
                  console.error(
                    `[cardcom-webhook] HIGH: recovered orphaned session LowProfileId=${lowProfileId} → order ${byRv.id} via ReturnValue. A superseded payment page was completed; verify no double charge.`,
                  );
                }
              }
            } catch (e) {
              console.error("[cardcom-webhook] orphan recovery GetLpResult failed:", e);
            }
          }
          if (!order) {
            console.error(
              `[cardcom-webhook] HIGH: order not found for LowProfileId=${lowProfileId}`,
            );
            return new Response("order not found", { status: 200 });
          }

          // Idempotency — already SETTLED.
          //
          // This tests the payment OUTCOME, not merely whether
          // cardcom_tranzaction_id is populated. The block paths below also record a
          // TranzactionId, because a blocked charge is still a real charge and the
          // admin needs a handle to refund by — so a presence-only test would treat
          // the retry of a previously-blocked order as "already processed", return
          // 200, and never mark the successful second payment as paid. Card charged,
          // order stuck on "failed" forever, no email, no stock decrement.
          //
          // Re-entering for a not-yet-paid order is safe: the confirmation email and
          // the stock decrement each carry their own atomic latch
          // (confirmation_email_sent_at / stock_decremented_at), so neither can fire
          // twice regardless of how often this handler runs.
          if (order.cardcom_tranzaction_id && order.payment_status === "paid") {
            console.log(`[cardcom-webhook] order ${order.id} already processed, skipping`);
            return new Response("ok (idempotent)", { status: 200 });
          }

          // Server-to-server validation — this is the source of truth
          let lp: any;
          try {
            lp = await lp$();
          } catch (e: any) {
            console.error("[cardcom-webhook] GetLpResult failed after retry:", e);
            // 500 (not 200) on purpose: this is the one failure worth having CardCom
            // retry, because we never reached a verdict at all.
            return new Response(`GetLpResult failed: ${e?.message ?? "error"}`, { status: 500 });
          }

          // Everything from here — integrity checks, status transitions, stock,
          // email, shipping — lives in settleCardcomOrder, shared verbatim with the
          // reconciliation sweep. Two implementations of "mark an order paid" would
          // be two chances to disagree about money, and the second would only ever
          // run when nobody is watching.
          const outcome = await settleCardcomOrder(order, lp, "webhook");
          switch (outcome.kind) {
            case "update_failed":
              // The ONLY outcome we want CardCom to retry: the charge is valid but
              // our write lost. Every other outcome is a settled verdict, and a 200
              // correctly ends the retry ladder.
              return new Response("order update failed", { status: 500 });
            case "return_value_mismatch":
              return new Response("return value mismatch", { status: 200 });
            case "blocked":
              return new Response(`${outcome.reason} mismatch`, { status: 200 });
            default:
              return new Response("ok", { status: 200 });
          }
        } catch (err: any) {
          console.error("[cardcom-webhook] error:", err);
          return new Response("internal error", { status: 500 });
        }
      },

      GET: async () => new Response("cardcom webhook alive", { status: 200 }),
    },
  },
});
