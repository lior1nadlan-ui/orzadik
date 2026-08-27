// Scheduled data-retention sweep.
//
// WHY THIS EXISTS
// The catalogue had no purge of any kind. Four crons ran — review requests,
// campaign tick, abandoned-cart reminders, CardCom reconciliation — and not one
// of them deleted a row. Two tables were accumulating personal data with no end
// date and, in one case, no reader at all:
//
//   order_payment_secrets   card token + expiry + approval number +
//                           cardcom_token_card_owner_identity_number, an Israeli
//                           ID number. Written on every settlement that carried
//                           a token — INCLUDING declines, because the write sat
//                           above the responseCode check. Grepped the whole
//                           repository: one writer, one deleter (a user's own
//                           erasure request), ZERO readers.
//
//   abandoned_carts         email, name and cart contents. The reminder job
//                           scans a 30-day window, so a row stops being useful
//                           after 30 days — but nothing ever removed it. The
//                           compliance README already promised "TTL לעגלות
//                           נטושות"; this is that TTL, which until now did not
//                           exist.
//
// The settlement path no longer writes secrets for a failed payment
// (shouldPersistPaymentSecrets). This sweep is the other half: it clears what
// the old behaviour already left behind, and bounds everything written from here
// on. Both halves are needed — the code fix alone leaves the existing rows
// forever, and the sweep alone would be fighting a producer that never stops.
//
// WHAT IS DELIBERATELY NOT DELETED
// Secrets belonging to a PAID order. A token against a real charge is the only
// version of this data with a plausible future use (a refund, a chargeback), and
// deciding its lifetime is the owner's call, not a sweep's. It is flagged in the
// return value instead, so the number is visible in the cron log rather than
// silently growing. Orders, order_items and reviews are business records under
// their own statutory retention and are never touched here.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Grace period before a failed order's secrets are cleared.
 *
 * NOT zero, and the reason is the retry ladder. CardCom retries a webhook, and
 * runCardcomReconciliation re-reads an order for 72 hours after its last real
 * payment attempt; a decline can still flip to paid inside that window if the
 * shopper completes a second attempt against the same order. Deleting the
 * instant a decline lands would race those paths.
 *
 * 24 hours clears the webhook ladder by a wide margin while keeping the exposure
 * to a single day. It is not a compromise with the data's usefulness — there is
 * none — only with the settlement machinery around it.
 */
export const FAILED_SECRETS_GRACE_HOURS = 24;

/**
 * How long an abandoned cart is kept.
 *
 * runAbandonedCartReminders scans `created_at >= now - 30 days`, so after 30
 * days a row can never be acted on again. 90 is that window plus a deliberate
 * margin: the sweep should not be the thing that decides a cart is finished, the
 * reminder job's own window should, and a 3x buffer means a change there does
 * not silently start destroying rows it still wanted.
 */
export const ABANDONED_CART_RETENTION_DAYS = 90;

/** ISO timestamp `hours` in the past. Split out so the cutoffs are unit-testable
 *  without a clock or a database. */
export function cutoffIso(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

export type RetentionResult = {
  failedSecretsDeleted: number;
  abandonedCartsDeleted: number;
  /** Secrets kept because their order is paid — reported, never deleted here. */
  paidSecretsKept: number;
  errors: string[];
};

/**
 * Delete what has aged out. Idempotent: a second run in the same minute finds
 * nothing left to do and returns zeros.
 */
export async function runDataRetentionSweep(now: Date = new Date()): Promise<RetentionResult> {
  const out: RetentionResult = {
    failedSecretsDeleted: 0,
    abandonedCartsDeleted: 0,
    paidSecretsKept: 0,
    errors: [],
  };

  // 1. Payment secrets whose order did not result in a charge.
  //
  // Two statements rather than a join: PostgREST cannot DELETE across a
  // relationship, so the order ids are selected first and used as an `in` list.
  // The id list is bounded by the number of failed orders, which is small and
  // stays small — if that ever stops being true this wants a SQL function, not a
  // bigger page size.
  const secretsCutoff = cutoffIso(now, FAILED_SECRETS_GRACE_HOURS);
  const { data: deadOrders, error: deadErr } = await supabaseAdmin
    .from("orders")
    .select("id")
    .in("payment_status", ["failed", "cancelled", "refunded"])
    .lte("updated_at", secretsCutoff);

  if (deadErr) {
    out.errors.push(`select dead orders: ${deadErr.message}`);
  } else if (deadOrders && deadOrders.length > 0) {
    const ids = deadOrders.map((o: { id: string }) => o.id);
    const { data: gone, error: delErr } = await supabaseAdmin
      .from("order_payment_secrets")
      .delete()
      .in("order_id", ids)
      .select("order_id");
    if (delErr) out.errors.push(`delete payment secrets: ${delErr.message}`);
    else out.failedSecretsDeleted = gone?.length ?? 0;
  }

  // 2. Abandoned carts past their TTL.
  const cartCutoff = cutoffIso(now, ABANDONED_CART_RETENTION_DAYS * 24);
  const { data: carts, error: cartErr } = await supabaseAdmin
    .from("abandoned_carts")
    .delete()
    .lte("created_at", cartCutoff)
    .select("id");
  if (cartErr) out.errors.push(`delete abandoned carts: ${cartErr.message}`);
  else out.abandonedCartsDeleted = carts?.length ?? 0;

  // 3. Report, do not delete: secrets still held against paid orders.
  const { count, error: keptErr } = await supabaseAdmin
    .from("order_payment_secrets")
    .select("order_id", { count: "exact", head: true });
  if (keptErr) out.errors.push(`count remaining secrets: ${keptErr.message}`);
  else out.paidSecretsKept = count ?? 0;

  if (out.errors.length) console.error("[retention] completed with errors:", out.errors);
  return out;
}
