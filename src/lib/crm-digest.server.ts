// Fetch + send for the owner's morning briefing. The rules for what goes in it
// live in crm-digest.ts (pure, tested); this file only loads the rows and
// delivers the result.
//
// TWO CHANNELS, INDEPENDENT. Telegram and email are sent separately and each
// failure is logged on its own, the same way the order alerts are wired: an
// expired Resend key must not silence the phone, and a revoked bot token must
// not silence the inbox.
//
// Not client-callable. It runs from the daily cron (src/nitro/cron.ts) and from
// the admin's "send now" button, which gates on requireAdmin() first.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildDigest,
  digestSubject,
  renderDigestEmailInner,
  renderDigestTelegram,
  CART_WINDOW_DAYS,
  FAILED_PAYMENT_WINDOW_DAYS,
  type Digest,
  type DigestCart,
  type DigestFollowUp,
  type DigestOrder,
} from "@/lib/crm-digest";
import { daysOverdue, endOfIsraelDay, hiddenActionKeys } from "@/lib/crm-tasks";
import { isTelegramConfigured, sendTelegramText } from "@/lib/telegram.server";
import { emailShell, isEmailConfigured, sendEmail } from "@/lib/email.server";
import { BUSINESS } from "@/lib/business";

const ORIGIN = process.env.APP_URL || "https://orzadik.com";
const DAY = 24 * 60 * 60 * 1000;

const ORDER_COLUMNS =
  "id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, created_at, paid_at, shipped_at";

/** Reviews older than this that are still unapproved were most likely hidden
 *  on purpose (approval is a toggle; "hide" writes the same false). */
const REVIEW_WINDOW_DAYS = 30;

export async function loadDigest(now: number = Date.now()): Promise<Digest> {
  // Two bounded reads instead of the whole order book:
  //   • everything recent enough to be a failed payment, the paid retry that
  //     recovers it, or last week's revenue;
  //   • every paid order not yet shipped, however old — the oldest of those is
  //     the one the briefing exists to surface.
  const recentFloor = new Date(now - (FAILED_PAYMENT_WINDOW_DAYS + 1) * DAY).toISOString();
  const [recent, unshipped, carts, reviews, states, followUps] = await Promise.all([
    supabaseAdmin.from("orders").select(ORDER_COLUMNS).gte("created_at", recentFloor).limit(1000),
    supabaseAdmin
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("payment_status", "paid")
      .is("shipped_at", null)
      .in("status", ["pending", "processing"])
      .limit(500),
    supabaseAdmin
      .from("abandoned_carts")
      .select("id, email, name, subtotal, created_at, converted_order_id, unsubscribed")
      .is("converted_order_id", null)
      .eq("unsubscribed", false)
      .gte("created_at", new Date(now - CART_WINDOW_DAYS * DAY).toISOString())
      .limit(500),
    supabaseAdmin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false)
      .gte("created_at", new Date(now - REVIEW_WINDOW_DAYS * DAY).toISOString()),
    supabaseAdmin
      .from("crm_action_state")
      .select("action_key, snoozed_until, dismissed_at")
      .limit(2000),
    supabaseAdmin
      .from("crm_followups")
      .select("customer_email, title, due_at")
      .is("done_at", null)
      .lt("due_at", new Date(endOfIsraelDay(now)).toISOString())
      .order("due_at", { ascending: true })
      .limit(100),
  ]);

  // Orders are the point of the briefing: fail loudly rather than report an
  // empty queue that is really a failed query. Carts and reviews are context —
  // their failure degrades to zero with a log line.
  if (recent.error) throw recent.error;
  if (unshipped.error) throw unshipped.error;
  if (carts.error) console.error("[digest] carts:", carts.error);
  if (reviews.error) console.error("[digest] reviews:", reviews.error);
  if (states.error) console.error("[digest] action state:", states.error);
  if (followUps.error) console.error("[digest] follow-ups:", followUps.error);

  const byId = new Map<string, DigestOrder>();
  for (const o of [...(recent.data ?? []), ...(unshipped.data ?? [])] as DigestOrder[]) {
    byId.set(o.id, o);
  }

  // A reminder names the customer when any fetched order knows them.
  const nameByEmail = new Map<string, string>();
  for (const o of byId.values()) {
    const key = String(o.customer_email ?? "").toLowerCase();
    if (key && o.customer_name && !nameByEmail.has(key)) nameByEmail.set(key, o.customer_name);
  }
  const dueFollowUps: DigestFollowUp[] = (followUps.data ?? []).map((f) => ({
    title: f.title,
    who: nameByEmail.get(f.customer_email) ?? f.customer_email,
    daysOverdue: daysOverdue(f.due_at, now),
  }));

  return buildDigest(
    [...byId.values()],
    (carts.data ?? []) as DigestCart[],
    reviews.count ?? 0,
    now,
    { hidden: hiddenActionKeys(states.data ?? [], now), followUps: dueFollowUps },
  );
}

export type DigestRunResult = {
  sent: boolean;
  telegram: boolean;
  email: boolean;
  actionable: boolean;
  skipped?: "nothing-actionable" | "no-channel";
};

/**
 * Build and deliver the briefing.
 *
 * The scheduled run is silent on a day with nothing to do (`force` false).
 * The admin button forces it, so the owner can see what a briefing looks like
 * — and prove both channels work — on any day.
 */
export async function runDailyDigest(
  opts: { force?: boolean; now?: number } = {},
): Promise<DigestRunResult> {
  const now = opts.now ?? Date.now();
  const hasTelegram = isTelegramConfigured();
  const hasEmail = isEmailConfigured();
  const empty = { sent: false, telegram: false, email: false };

  if (!hasTelegram && !hasEmail) {
    console.log("[digest] neither Telegram nor email is configured — skipping");
    return { ...empty, actionable: false, skipped: "no-channel" };
  }

  const digest = await loadDigest(now);
  if (!digest.actionable && !opts.force) {
    return { ...empty, actionable: false, skipped: "nothing-actionable" };
  }

  const telegram = hasTelegram
    ? await sendTelegramText(renderDigestTelegram(digest, now, ORIGIN))
    : false;

  let email = false;
  const to = (process.env.SHOP_OWNER_EMAIL || BUSINESS.email || "").trim();
  if (hasEmail && to) {
    email = await sendEmail({
      to,
      subject: digestSubject(digest),
      html: emailShell(renderDigestEmailInner(digest, now, ORIGIN), digestSubject(digest)),
    });
  }

  return { sent: telegram || email, telegram, email, actionable: digest.actionable };
}
