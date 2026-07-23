import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalAuthInfo } from "@/integrations/supabase/optional-auth";
import { checkOrderRateLimitByIp } from "@/lib/rate-limit.server";
import {
  sendEmail,
  emailShell,
  esc,
  ils,
  isEmailConfigured,
  unsubscribeToken,
  unsubscribeUrl,
} from "@/lib/email.server";
import { sellerIdentityLine, BUSINESS } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-authz.server";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(200).optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    name: z.string().max(300),
    price: z.number().min(0),
    quantity: z.number().int().min(1).max(999),
    thumbnail: z.string().url().nullable().optional(),
    slug: z.string().max(300),
  })).min(1).max(100),
  subtotal: z.number().min(0),
});


/**
 * Save (or upsert) a cart snapshot when a user is on checkout and has provided
 * an email. Used to send abandoned-cart reminders. Reuses the most recent
 * non-converted row for the same email if it's < 6h old.
 */
export const saveAbandonedCart = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    // Per-IP rate limit — this is an unauthenticated, state-changing insert;
    // without it an attacker could flood arbitrary-email cart rows.
    const req = getRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const { limited } = await checkOrderRateLimitByIp(ip);
    if (limited) throw new Error("יותר מדי בקשות מהכתובת הזו. אנא נסו מאוחר יותר.");

    const authed = await getOptionalAuthInfo();
    const authedUserId = authed?.userId ?? null;

    // SECURITY: If the caller is signed in, force the email to their auth email.
    // Anonymous callers can only submit one address — we never trigger reminder
    // emails for unverified addresses without an explicit opt-in elsewhere.
    const email = authed?.email ? authed.email.toLowerCase() : data.email.toLowerCase();

    // Find recent open cart for this email
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("abandoned_carts")
      .select("id")
      .eq("email", email)
      .is("converted_order_id", null)
      .eq("unsubscribed", false)
      .gte("created_at", sixHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("abandoned_carts")
        .update({
          name: data.name ?? null,
          items: data.items,
          subtotal: data.subtotal,
          user_id: authedUserId,
        })
        .eq("id", existing.id);
      return { id: existing.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("abandoned_carts")
      .insert({
        email,
        name: data.name ?? null,
        user_id: authedUserId,
        items: data.items,
        subtotal: data.subtotal,
      })
      .select("id")
      .single();
    if (error) throw new Error("שגיאה בשמירת העגלה");
    return { id: row.id };
  });


/** How long a cart stays eligible for its first reminder. */
const MAX_AGE_DAYS = 30;

/** Resend allows roughly 2 requests/second — same pacing as the campaign sender. */
const SEND_GAP_MS = 550;

/**
 * Reminders actually attempted per run.
 *
 * The scan window is 30 days, so one tick can legitimately surface a large
 * backlog; at SEND_GAP_MS apiece an unbounded run would sit in the request far
 * longer than the cron route or the admin button can wait. Carts past the
 * budget are simply left unstamped and go out on the next hourly tick.
 */
const MAX_SENDS_PER_RUN = 40;

/**
 * Consecutive send failures that mean the provider is down rather than one bad
 * address. Past this we stop the run instead of burning the rest of the budget
 * on calls that are all going to fail the same way.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Outcome of one reminder sweep.
 *
 * `skipped` is the discriminator between "there was nothing to send" and
 * "nothing could be sent": both return sent=0, but only the second one means
 * the shop is silently broken. The cron log and the admin manual-run button
 * both key off it, so it must survive being JSON round-tripped.
 */
export type AbandonedCartRunResult = {
  sent: number;
  scanned: number;
  /** Sends that came back not-ok. Those carts stay unstamped and retry later. */
  failed?: number;
  skipped?:
    | "email-not-configured"
    | "unsubscribe-secret-missing"
    | "scan-failed"
    | "send-failed";
};

/**
 * Send reminder emails for carts abandoned at least 1h ago (and at most 30d
 * ago) that were never converted, aren't unsubscribed, and haven't already been
 * reminded. Idempotent per cart via `reminder_1_sent_at`, which is stamped only
 * after the provider accepts the message — a rejected send leaves the cart
 * eligible so a later tick can retry it. Sends are paced and capped per run.
 * Invoked by the hourly cron trigger (see src/nitro/cron.ts and
 * /api/cron/abandoned-cart-reminders) and by the admin "run now" button below.
 * Not directly client-callable.
 */
export async function runAbandonedCartReminders(): Promise<AbandonedCartRunResult> {
  if (!isEmailConfigured()) {
    console.log("[abandoned-cart] email not configured — skipping reminders");
    return { sent: 0, scanned: 0, skipped: "email-not-configured" };
  }

  const now = Date.now();
  const olderThan = new Date(now - 60 * 60 * 1000).toISOString(); // abandoned ≥ 1h
  // Upper age used to be 24h, which made this job lossy rather than merely
  // late: any cart not swept within a day — no cron mapped, a deploy gap, a
  // mail outage — aged out permanently and was never reminded at all. 30 days
  // keeps the scan bounded while letting a backlog drain over successive ticks;
  // `reminder_1_sent_at` still guarantees exactly one reminder per cart.
  const newerThan = new Date(now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString(); // but < 30d

  const { data: carts, error } = await supabaseAdmin
    .from("abandoned_carts")
    .select("id, email, name, items, subtotal")
    .is("converted_order_id", null)
    .is("reminder_1_sent_at", null)
    .eq("unsubscribed", false)
    .lte("created_at", olderThan)
    .gte("created_at", newerThan)
    // Freshest first. With a 30-day window the eligible set can exceed the
    // 100-row budget, and PostgREST would otherwise return an arbitrary slice;
    // newest-first means the reminders most likely to still be relevant go out
    // on this tick, and every cart sent is stamped so the rest drain next tick.
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[abandoned-cart] scan failed:", error);
    return { sent: 0, scanned: 0, skipped: "scan-failed" };
  }

  // Spam Law §30א: the reminder is a marketing message ("פרסומת"), so it may
  // only go to recipients who gave explicit marketing consent. Anonymous
  // checkout emails have no such consent — they are skipped and simply age out
  // of the reminder window.
  const cartEmails = [...new Set((carts ?? []).map((c) => c.email.toLowerCase()))];
  let consented = new Set<string>();
  if (cartEmails.length > 0) {
    const { data: profiles, error: consentError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("email", cartEmails)
      .eq("marketing_consent", true);
    if (consentError) {
      console.error("[abandoned-cart] consent lookup failed — sending nothing:", consentError);
      return { sent: 0, scanned: (carts ?? []).length };
    }
    consented = new Set((profiles ?? []).map((p) => (p.email ?? "").toLowerCase()));
  }

  let sent = 0;
  let failed = 0;
  let attempted = 0;
  let consecutiveFailures = 0;
  let skipped: AbandonedCartRunResult["skipped"];
  for (const cart of carts ?? []) {
    if (!consented.has(cart.email.toLowerCase())) continue;
    // Budget reached — the remaining carts keep reminder_1_sent_at null and are
    // picked up by the next tick.
    if (attempted >= MAX_SENDS_PER_RUN) break;
    const items = Array.isArray(cart.items) ? (cart.items as any[]) : [];
    const rows = items
      .map(
        (it) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${esc(it.name)} × ${esc(it.quantity)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:left;white-space:nowrap;">${ils(Number(it.price) * Number(it.quantity))}</td>
        </tr>`,
      )
      .join("");

    // Spam Law §30א: a working, per-recipient unsubscribe link. If no secret is
    // configured we skip sending this marketing message entirely (better than
    // sending a non-compliant one).
    const token = await unsubscribeToken(cart.email);
    if (!token) {
      console.log("[abandoned-cart] UNSUBSCRIBE_SECRET not set — skipping marketing reminders");
      skipped = "unsubscribe-secret-missing";
      break;
    }
    const unsub = unsubscribeUrl(cart.email, token);

    const html = emailShell(`
      <p style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
      <h1 style="font-size:20px;margin:0 0 8px;">שכחתם משהו בעגלה? 🛍️</h1>
      <p style="font-size:14px;color:#555;margin:0 0 16px;">
        ${cart.name ? esc(cart.name) + ", " : ""}העגלה שלכם עדיין ממתינה — המוצרים שבחרתם שמורים לכם.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      <div style="text-align:center;margin-top:20px;">
        <a href="https://orzadik.com/cart" style="display:inline-block;background:#D4AF37;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;">
          חזרה לעגלה
        </a>
      </div>
      <div style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
        <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
        <div style="margin-top:6px;">
          קיבלתם הודעה זו כי התחלתם הזמנה באתר.
          <a href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
        </div>
      </div>
    `);

    attempted++;
    const ok = await sendEmail({
      to: cart.email,
      subject: "פרסומת: העגלה שלכם ממתינה — אור זרוע לצדיק",
      html,
      replyTo: process.env.SHOP_OWNER_EMAIL,
    });

    if (ok) {
      // Stamp ONLY on a confirmed send. sendEmail returns false (it does not
      // throw) on an HTTP error such as a 429 rate-limit rejection, and
      // reminder_1_sent_at is a one-shot flag: stamping a rejected send would
      // permanently retire the cart from every future tick and the customer
      // would never be reminded at all. Leaving it null costs one retry on the
      // next hourly tick, which the 30-day window has ample room for.
      const { error: stampError } = await supabaseAdmin
        .from("abandoned_carts")
        .update({ reminder_1_sent_at: new Date().toISOString() })
        .eq("id", cart.id);
      if (stampError) {
        // The mail went out but the flag did not stick — log it, because the
        // next tick will see this cart as un-reminded and mail it again.
        console.error("[abandoned-cart] stamp failed for", cart.id, stampError);
      }
      sent++;
      consecutiveFailures = 0;
    } else {
      failed++;
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[abandoned-cart] ${consecutiveFailures} consecutive send failures — stopping run`,
        );
        skipped = "send-failed";
        break;
      }
    }

    // Resend allows ~2 req/s. Without this a full budget of back-to-back POSTs
    // is rate-limited from the third request on. This is I/O wait, not Worker
    // CPU time.
    await sleep(SEND_GAP_MS);
  }

  console.log(
    `[abandoned-cart] reminders: scanned=${(carts ?? []).length} sent=${sent} failed=${failed}${skipped ? ` skipped=${skipped}` : ""}`,
  );
  return {
    sent,
    scanned: (carts ?? []).length,
    ...(failed ? { failed } : {}),
    ...(skipped ? { skipped } : {}),
  };
}


/**
 * Admin-triggered "run the sweep now".
 *
 * The hourly cron is the normal path; this exists so the shop owner can verify
 * the job end-to-end and drain a backlog after an outage without waiting for
 * the next tick. Same idempotency guarantees — a cart already stamped with
 * `reminder_1_sent_at` is not re-mailed, so pressing the button twice is safe.
 */
export const runAbandonedCartRemindersNow = createServerFn({ method: "POST" }).handler(
  async (): Promise<AbandonedCartRunResult> => {
    await requireAdmin();
    return runAbandonedCartReminders();
  },
);
