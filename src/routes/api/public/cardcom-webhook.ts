import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyShippingCompany } from "@/lib/shipping.server";
import { sendOrderConfirmationEmails } from "@/lib/order-emails.server";
import { checkWebhookRateLimit } from "@/lib/rate-limit.server";

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

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
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

const CARDCOM_BASE = "https://secure.cardcom.solutions/api/v11";

async function getLpResult(lowProfileId: string): Promise<any> {
  const body = JSON.stringify({
    TerminalNumber: Number(process.env.CARDCOM_TERMINAL_NUMBER),
    ApiName: process.env.CARDCOM_API_NAME,
    LowProfileId: lowProfileId,
  });
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CARDCOM_BASE}/LowProfile/GetLpResult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`GetLpResult HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      console.error(`[cardcom-webhook] GetLpResult attempt ${attempt} failed:`, e);
    }
  }
  throw lastErr;
}

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
            console.error(
              `[cardcom-webhook] HIGH: order not found for LowProfileId=${lowProfileId}`,
            );
            return new Response("order not found", { status: 200 });
          }

          // Idempotency — already processed
          if (order.cardcom_tranzaction_id) {
            console.log(`[cardcom-webhook] order ${order.id} already processed, skipping`);
            return new Response("ok (idempotent)", { status: 200 });
          }

          // Server-to-server validation — this is the source of truth
          let lp: any;
          try {
            lp = await getLpResult(String(lowProfileId));
          } catch (e: any) {
            console.error("[cardcom-webhook] GetLpResult failed after retry:", e);
            return new Response(`GetLpResult failed: ${e?.message ?? "error"}`, { status: 500 });
          }

          // Defense-in-depth: ReturnValue is the order id we set at LowProfile
          // creation. If the validated transaction reports a different order,
          // refuse to process it (mismatched lookup or replayed notification).
          // We control this value, so a strict check carries no false-block risk.
          if (lp?.ReturnValue != null && String(lp.ReturnValue) !== String(order.id)) {
            console.error(
              `[cardcom-webhook] HIGH: ReturnValue mismatch — lp=${lp.ReturnValue} order=${order.id}`,
            );
            return new Response("return value mismatch", { status: 200 });
          }

          const responseCode = Number(lp?.ResponseCode);
          const operation = lp?.Operation ?? order.cardcom_operation ?? "ChargeOnly";
          const tokenInfo = lp?.TokenInfo ?? {};
          const docInfo = lp?.DocumentInfo ?? {};

          const cardcomFields: Record<string, any> = {
            cardcom_response_code: String(lp?.ResponseCode ?? ""),
            cardcom_description: lp?.Description ?? null,
            cardcom_document_type: docInfo?.DocumentType ?? null,
            cardcom_document_number: docInfo?.DocumentNumber ?? null,
            payment_provider: "cardcom",
          };

          // Card tokens & cardholder identity go to the server-only secrets
          // table — never stored on the orders table (not client-readable).
          if (tokenInfo?.Token) {
            const { error: secErr } = await supabaseAdmin
              .from("order_payment_secrets")
              .upsert({
                order_id: order.id,
                cardcom_token: tokenInfo?.Token ?? null,
                cardcom_token_card_year: tokenInfo?.CardYear ?? null,
                cardcom_token_card_month: tokenInfo?.CardMonth ?? null,
                cardcom_token_approval_number: tokenInfo?.TokenApprovalNumber ?? null,
                cardcom_token_card_owner_identity_number:
                  tokenInfo?.CardOwnerIdentityNumber ?? null,
              });
            if (secErr) {
              console.error("[cardcom-webhook] token secrets upsert failed:", secErr);
            }
          }

          if (responseCode !== 0) {
            await supabaseAdmin
              .from("orders")
              .update({ ...cardcomFields, payment_status: "failed" })
              .eq("id", order.id);
            console.log(`[cardcom-webhook] order ${order.id} payment failed (code ${responseCode})`);
            return new Response("ok", { status: 200 });
          }

          if (operation === "CreateTokenOnly") {
            await supabaseAdmin
              .from("orders")
              .update({
                ...cardcomFields,
                cardcom_tranzaction_id: 0,
                payment_status: "pending_charge",
              })
              .eq("id", order.id);
            return new Response("ok", { status: 200 });
          }

          // Amount integrity check: the LowProfile amount was set from order.total
          // server-side (never from the client), so a mismatch means either a
          // replay with a wrong transaction or an integrity violation — both unsafe.
          // We only block when GetLpResult returns a finite amount field; if CardCom
          // doesn't return one (NaN), the check is skipped (fail-open for field gaps).
          const ti = lp?.TranzactionInfo ?? {};
          const chargedAmount = Number(ti?.Amount ?? ti?.ApprovedAmount ?? ti?.SumPaid);
          if (
            Number.isFinite(chargedAmount) &&
            Math.round(chargedAmount) !== Math.round(Number(order.total))
          ) {
            console.error(
              `[cardcom-webhook] CRITICAL: amount mismatch for order ${order.id} — charged=${chargedAmount} expected=${order.total}. Blocking.`,
            );
            // Mark payment failed so the customer can retry; never mark as paid.
            await supabaseAdmin
              .from("orders")
              .update({ payment_status: "failed", notes: (order.notes ? order.notes + "\n" : "") + "[BLOCKED: amount mismatch]" })
              .eq("id", order.id);
            return new Response("amount mismatch", { status: 200 });
          }

          // ChargeOnly success → paid
          const { data: updated, error: updErr } = await supabaseAdmin
            .from("orders")
            .update({
              ...cardcomFields,
              cardcom_tranzaction_id: lp?.TranzactionId ?? null,
              payment_status: "paid",
              status: "processing",
              payment_method: "card",
              paid_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .select("*")
            .single();

          if (updErr || !updated) {
            console.error("[cardcom-webhook] order update failed:", updErr);
            return new Response("order update failed", { status: 500 });
          }

          // Stock decrement for products that opt into tracking. Placed here
          // deliberately: the payment is already committed and the order row is
          // already 'paid', so nothing below may change the payment outcome —
          // hence log-only on failure. Double-decrement is impossible: the
          // webhook returns early on a replay (cardcom_tranzaction_id above),
          // and the RPC itself claims orders.stock_decremented_at before
          // touching any product row.
          try {
            const { data: touched, error: stockErr } = await supabaseAdmin.rpc(
              "decrement_order_stock",
              { p_order_id: updated.id },
            );
            if (stockErr) console.error("[cardcom-webhook] stock decrement failed:", stockErr);
            else if (touched) console.log(`[cardcom-webhook] stock decremented for ${touched} product(s)`);
          } catch (e) {
            console.error("[cardcom-webhook] stock decrement threw:", e);
          }

          try {
            await notifyShippingCompany(updated.id);
          } catch (e) {
            console.error("[cardcom-webhook] shipping notify failed:", e);
          }
          try {
            await sendOrderConfirmationEmails(updated.id);
          } catch (e) {
            console.error("[cardcom-webhook] confirmation email failed:", e);
          }

          return new Response("ok", { status: 200 });
        } catch (err: any) {
          console.error("[cardcom-webhook] error:", err);
          return new Response("internal error", { status: 500 });
        }
      },

      GET: async () => new Response("cardcom webhook alive", { status: 200 }),
    },
  },
});
