// Shared CardCom settlement — the single place an order is turned into "paid".
//
// This logic used to live inline in the webhook handler. It was extracted so the
// reconciliation sweep (runCardcomReconciliation, below) can settle a stuck order
// through the EXACT same code path. Two implementations of "mark an order paid"
// would be two chances to disagree about money, and the second one would only ever
// run in the rare case nobody is watching.
//
// Why a reconciliation sweep exists at all: the webhook answers CardCom with HTTP
// 200 on order-not-found, ReturnValue mismatch, currency mismatch and amount
// mismatch. A 200 permanently ends CardCom's retry ladder. So any of those paths —
// plus a plain Worker error or network blip — leaves a CHARGED card attached to an
// order that stays unpaid forever, with no confirmation email, no stock decrement
// and no shipping notification. Nothing in the system noticed. That matters more
// now than it used to: createCardcomPayment refuses to re-open payment for an order
// that already has a captured transaction (the double-charge guard), so a stuck
// order can no longer be rescued by the customer simply trying again.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyShippingCompany } from "@/lib/shipping.server";
import { sendOrderConfirmationEmails } from "@/lib/order-emails.server";

const CARDCOM_BASE = "https://secure.cardcom.solutions/api/v11";

/** Per the CardCom spec: 5s timeout, one retry. */
export async function getLpResult(lowProfileId: string): Promise<any> {
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
      console.error(`[cardcom-settle] GetLpResult attempt ${attempt} failed:`, e);
    }
  }
  throw lastErr;
}

export type SettleOutcome =
  | { kind: "already_paid" }
  | { kind: "return_value_mismatch" }
  | { kind: "declined"; code: number }
  | { kind: "pending_charge" }
  | { kind: "blocked"; reason: string }
  | { kind: "paid" }
  | { kind: "update_failed" };

/**
 * Turn a validated GetLpResult into an order state. Pure decision + persistence:
 * the CALLER decides what to say to whoever asked (an HTTP status for the webhook,
 * a counter for the sweep), so the two can never disagree about the money itself.
 *
 * `source` only ever reaches log lines — it must not change behaviour, or the
 * whole point of sharing this function is lost.
 */
export async function settleCardcomOrder(
  order: any,
  lp: any,
  source: "webhook" | "reconcile",
): Promise<SettleOutcome> {
  const tag = `[cardcom-${source}]`;

  // Authoritative idempotency. Tests the payment OUTCOME, not merely whether
  // cardcom_tranzaction_id is populated: the block path below also records a
  // TranzactionId (a blocked charge is a real charge and the admin needs a handle
  // to refund by), so a presence-only test would treat the retry of a previously
  // blocked order as "already processed" and never mark the successful second
  // payment paid. Re-entering for a not-yet-paid order is safe — the confirmation
  // email and the stock decrement each carry their own atomic latch.
  if (order.cardcom_tranzaction_id && order.payment_status === "paid") {
    return { kind: "already_paid" };
  }

  // Defense-in-depth: ReturnValue is the order id we set at LowProfile creation.
  // If the validated transaction reports a different order, refuse it (mismatched
  // lookup or replayed notification). We control this value, so a strict check
  // carries no false-block risk.
  if (lp?.ReturnValue != null && String(lp.ReturnValue) !== String(order.id)) {
    console.error(`${tag} HIGH: ReturnValue mismatch — lp=${lp.ReturnValue} order=${order.id}`);
    return { kind: "return_value_mismatch" };
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

  // Card tokens & cardholder identity go to the server-only secrets table — never
  // stored on the orders table (not client-readable).
  if (tokenInfo?.Token) {
    const { error: secErr } = await supabaseAdmin.from("order_payment_secrets").upsert({
      order_id: order.id,
      cardcom_token: tokenInfo?.Token ?? null,
      cardcom_token_card_year: tokenInfo?.CardYear ?? null,
      cardcom_token_card_month: tokenInfo?.CardMonth ?? null,
      cardcom_token_approval_number: tokenInfo?.TokenApprovalNumber ?? null,
      cardcom_token_card_owner_identity_number: tokenInfo?.CardOwnerIdentityNumber ?? null,
    });
    if (secErr) console.error(`${tag} token secrets upsert failed:`, secErr);
  }

  if (responseCode !== 0) {
    await supabaseAdmin
      .from("orders")
      .update({ ...cardcomFields, payment_status: "failed" })
      .eq("id", order.id);
    console.log(`${tag} order ${order.id} payment failed (code ${responseCode})`);
    return { kind: "declined", code: responseCode };
  }

  if (operation === "CreateTokenOnly") {
    await supabaseAdmin
      .from("orders")
      .update({ ...cardcomFields, cardcom_tranzaction_id: 0, payment_status: "pending_charge" })
      .eq("id", order.id);
    return { kind: "pending_charge" };
  }

  const ti = lp?.TranzactionInfo ?? {};

  // Refuse a transaction we cannot reconcile — WITHOUT losing the evidence. An
  // order whose card WAS charged keeps its TranzactionId and document fields, so it
  // stays refundable and traceable. The reason rides on cardcom_description (ours
  // to write) rather than orders.notes (customer-authored).
  const blockAndPersist = async (reason: string) => {
    await supabaseAdmin
      .from("orders")
      .update({
        ...cardcomFields,
        cardcom_tranzaction_id: lp?.TranzactionId ?? null,
        cardcom_description: `[חסום: ${reason}] ${lp?.Description ?? ""}`.trim(),
        payment_status: "failed",
      })
      .eq("id", order.id);
  };

  // Currency: assert ILS from CoinId, the ONLY currency signal the v11 schema
  // exposes here (TransactionInfo has CoinId: integer and no currency string).
  // 1 = ILS/NIS, mirroring the ISOCoinId: 1 we send. Absent/implausible → fail
  // open; the amount check is the real backstop.
  const coinRaw = ti?.CoinId ?? null;
  const coinNum = Number(coinRaw);
  const coinExposed =
    coinRaw !== null && coinRaw !== undefined && coinRaw !== "" &&
    Number.isInteger(coinNum) && coinNum > 0 && coinNum < 200;
  if (coinExposed && coinNum !== 1) {
    console.error(
      `${tag} CRITICAL: currency mismatch for order ${order.id} — coin=${coinRaw} expected ILS (CoinId 1). Blocking.`,
    );
    await blockAndPersist("מטבע לא תואם");
    return { kind: "blocked", reason: "currency" };
  }

  const chargedAmount = Number(ti?.Amount);
  // Instalment diagnostics. There is NO test path — CardCom's documented test
  // credentials return ResponseCode 603 — so the first real order IS the experiment
  // and it must not run uninstrumented.
  const nPayments = Number(ti?.NumberOfPayments ?? lp?.UIValues?.NumOfPayments);
  const payInfo = `payments=${ti?.NumberOfPayments ?? "?"} type=${ti?.PaymentType ?? "?"} first=${ti?.FirstPaymentAmount ?? "?"} const=${ti?.ConstPaymentAmount ?? "?"}`;
  // Scale tolerance by instalment count and nothing else: תשלומים introduce
  // per-payment rounding a single-payment epsilon cannot absorb (₪1,000/3 =
  // 333.333…), and the owner can enable instalments from the CardCom terminal with
  // NO deploy on our side. Still only ₪0.36 at CardCom's maximum of 36 payments.
  // Deliberately NOT widened to accept charged > total.
  const AMOUNT_EPSILON =
    Number.isFinite(nPayments) && nPayments > 1 ? 0.01 * nPayments : 0.01;
  if (Number.isFinite(chargedAmount)) {
    if (Math.abs(chargedAmount - Number(order.total)) > AMOUNT_EPSILON) {
      console.error(
        `${tag} CRITICAL: amount mismatch for order ${order.id} — charged=${chargedAmount} expected=${order.total} epsilon=${AMOUNT_EPSILON} ${payInfo}. Blocking.`,
      );
      await blockAndPersist("סכום לא תואם");
      return { kind: "blocked", reason: "amount" };
    }
  } else {
    console.error(
      `${tag} HIGH: GetLpResult returned no usable amount for order ${order.id} (TranzactionInfo.Amount absent) — proceeding WITHOUT amount verification.`,
    );
  }

  console.log(
    `${tag} settling order ${order.id} — charged=${chargedAmount} total=${order.total} coin=${coinRaw} ${payInfo}`,
  );

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
    console.error(`${tag} order update failed:`, updErr);
    return { kind: "update_failed" };
  }

  // Everything below runs AFTER the payment is committed and the row already says
  // paid, so nothing here may change the payment outcome — hence log-only on
  // failure. Each side effect carries its own atomic latch, which is what makes it
  // safe for BOTH the webhook and the sweep to reach this code for the same order.
  try {
    const { data: touched, error: stockErr } = await supabaseAdmin.rpc("decrement_order_stock", {
      p_order_id: updated.id,
    });
    if (stockErr) console.error(`${tag} stock decrement failed:`, stockErr);
    else if (touched) console.log(`${tag} stock decremented for ${touched} product(s)`);
  } catch (e) {
    console.error(`${tag} stock decrement threw:`, e);
  }

  try {
    await notifyShippingCompany(updated.id);
  } catch (e) {
    console.error(`${tag} shipping notify failed:`, e);
  }

  // Idempotent paid-confirmation email. Claim the send atomically BEFORE
  // dispatching: two near-simultaneous callers (a CardCom retry, the delivery that
  // races the browser redirect, or the webhook racing the sweep) can both read the
  // order as unprocessed and both reach this line. The conditional UPDATE flips
  // confirmation_email_sent_at from NULL for exactly one caller; the loser matches
  // zero rows and skips. On a send failure the latch is RELEASED so a later attempt
  // can re-claim — a one-off provider blip must not permanently suppress the
  // confirmation.
  try {
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", updated.id)
      .is("confirmation_email_sent_at", null)
      .select("id");
    if (claimErr) {
      console.error(`${tag} confirmation email claim failed:`, claimErr);
    } else if (claimed && claimed.length > 0) {
      try {
        await sendOrderConfirmationEmails(updated.id);
      } catch (sendErr) {
        console.error(
          `${tag} confirmation send failed for order ${updated.id}, releasing latch for retry:`,
          sendErr,
        );
        await supabaseAdmin
          .from("orders")
          .update({ confirmation_email_sent_at: null })
          .eq("id", updated.id);
      }
    } else {
      console.log(`${tag} confirmation email already claimed for order ${updated.id}, skipping`);
    }
  } catch (e) {
    console.error(`${tag} confirmation email failed:`, e);
  }

  return { kind: "paid" };
}

/**
 * Reconciliation sweep — the safety net for every path that ends CardCom's retry
 * ladder without settling the order.
 *
 * Window: older than GRACE_MINUTES (so it never races a webhook that is simply in
 * flight — CardCom's own second attempt is about a minute out) and newer than
 * LOOKBACK_HOURS (an abandoned checkout from last week is not a stuck payment, it
 * is just abandoned, and re-querying it forever would be noise).
 *
 * It only ever ASKS CardCom about orders we already sent to CardCom — a row without
 * cardcom_low_profile_id never reached a payment page. And it settles through
 * settleCardcomOrder, so the latches that stop a double email / double stock
 * decrement are the same ones the webhook relies on.
 */
const GRACE_MINUTES = 15;
const LOOKBACK_HOURS = 72;

export async function runCardcomReconciliation() {
  if (!process.env.CARDCOM_API_NAME || !process.env.CARDCOM_TERMINAL_NUMBER) {
    return { skipped: "cardcom not configured" };
  }

  const now = Date.now();
  const notAfter = new Date(now - GRACE_MINUTES * 60_000).toISOString();
  const notBefore = new Date(now - LOOKBACK_HOURS * 3_600_000).toISOString();

  const { data: stuck, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .not("cardcom_low_profile_id", "is", null)
    .not("payment_status", "in", '("paid","refunded")')
    .lt("created_at", notAfter)
    .gt("created_at", notBefore)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[cardcom-reconcile] query failed:", error);
    return { error: error.message };
  }
  if (!stuck || stuck.length === 0) return { checked: 0, recovered: 0 };

  let recovered = 0;
  const outcomes: Record<string, number> = {};
  for (const order of stuck) {
    try {
      const lp = await getLpResult(String(order.cardcom_low_profile_id));
      const outcome = await settleCardcomOrder(order, lp, "reconcile");
      outcomes[outcome.kind] = (outcomes[outcome.kind] ?? 0) + 1;
      if (outcome.kind === "paid") {
        recovered++;
        // Deliberately loud: this line means a real customer paid and the webhook
        // never landed it. One of these is worth investigating even though the
        // sweep already fixed the order.
        console.error(
          `[cardcom-reconcile] RECOVERED order ${order.id} (${order.order_number}) — payment had been taken but never settled by the webhook.`,
        );
      }
    } catch (e) {
      outcomes.error = (outcomes.error ?? 0) + 1;
      console.error(`[cardcom-reconcile] order ${order.id} failed:`, e);
    }
  }
  return { checked: stuck.length, recovered, outcomes };
}
