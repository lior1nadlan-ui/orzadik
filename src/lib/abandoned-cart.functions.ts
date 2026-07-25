import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalAuthInfo } from "@/integrations/supabase/optional-auth";
import { checkOrderRateLimitByIp } from "@/lib/rate-limit.server";
import {
  sendEmail,
  emailShell,
  emailButton,
  esc,
  ils,
  isEmailConfigured,
  unsubscribeToken,
  unsubscribeUrl,
  listUnsubscribeHeaders,
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

/** Minimum gap after reminder 1 before the second, gentler nudge may go out. */
const SECOND_REMINDER_AFTER_HOURS = 48;

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
 * Send abandoned-cart reminders in two passes on the same hourly tick:
 *
 *  1. First reminder — carts abandoned at least 1h ago (and at most 30d ago)
 *     that were never converted, aren't unsubscribed, and have no
 *     `reminder_1_sent_at` yet.
 *  2. Second, gentler nudge — carts whose `reminder_1_sent_at` is at least
 *     SECOND_REMINDER_AFTER_HOURS old, still have no `reminder_2_sent_at`, are
 *     still unconverted / not unsubscribed, and are still inside the same 30d
 *     window.
 *
 * Each pass is idempotent per cart via its own `reminder_{1,2}_sent_at` flag,
 * which is stamped only after the provider accepts the message — a rejected
 * send leaves the cart eligible so a later tick can retry it. Both passes share
 * one consent gate, one per-run send budget and one failure breaker, and both
 * go only to addresses that gave marketing consent. Invoked by the hourly cron
 * trigger (see src/nitro/cron.ts and /api/cron/abandoned-cart-reminders) and by
 * the admin "run now" button below. Not directly client-callable.
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

  const { data: firstCarts, error: firstErr } = await supabaseAdmin
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

  if (firstErr) {
    console.error("[abandoned-cart] scan failed:", firstErr);
    return { sent: 0, scanned: 0, skipped: "scan-failed" };
  }

  // Second, gentler nudge. Carts that already received reminder 1 at least
  // SECOND_REMINDER_AFTER_HOURS ago, never converted, not unsubscribed, and
  // still inside the same 30-day recovery window as pass 1. reminder_2_sent_at
  // makes this one-shot exactly like reminder 1. Oldest-created first, so carts
  // nearest the end of the window get their second chance before they age out.
  const reminder1Before = new Date(
    now - SECOND_REMINDER_AFTER_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data: secondCarts, error: secondErr } = await supabaseAdmin
    .from("abandoned_carts")
    .select("id, email, name, items, subtotal")
    .is("converted_order_id", null)
    .not("reminder_1_sent_at", "is", null)
    .is("reminder_2_sent_at", null)
    .eq("unsubscribed", false)
    .lte("reminder_1_sent_at", reminder1Before)
    .gte("created_at", newerThan)
    .order("created_at", { ascending: true })
    .limit(100);

  if (secondErr) {
    console.error("[abandoned-cart] second-reminder scan failed:", secondErr);
    return { sent: 0, scanned: 0, skipped: "scan-failed" };
  }

  const first = firstCarts ?? [];
  const second = secondCarts ?? [];
  const scanned = first.length + second.length;

  // Spam Law §30א: a cart reminder is a marketing message ("פרסומת") and may go
  // only to addresses that gave marketing consent. The consented set is the SAME
  // union the newsletter campaigns use (buildAudience in campaigns.functions.ts):
  // a profile with marketing_consent = true, OR a newsletter_subscribers row
  // still opted in — minus the global email_suppressions list, and minus any
  // profile that explicitly turned marketing off. Gating on the profiles table
  // alone silently dropped newsletter-only and guest subscribers — exactly the
  // audience these reminders exist for — so in a store with few registered
  // accounts the recipient set was effectively empty.
  //
  // FAIL-CLOSED: if any consent/suppression source errors we send NOTHING rather
  // than risk mailing an address that never consented or has since opted out.
  const cartEmails = [
    ...new Set([...first, ...second].map((c) => c.email.toLowerCase())),
  ];
  const consented = new Set<string>();
  if (cartEmails.length > 0) {
    const [profileConsent, newsletterActive, suppressed, revoked] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("email")
        .in("email", cartEmails)
        .eq("marketing_consent", true),
      supabaseAdmin
        .from("newsletter_subscribers")
        .select("email")
        .in("email", cartEmails)
        .is("unsubscribed_at", null),
      supabaseAdmin.from("email_suppressions").select("email").in("email", cartEmails),
      supabaseAdmin
        .from("profiles")
        .select("email")
        .in("email", cartEmails)
        .eq("marketing_consent", false),
    ]);
    const consentErr =
      profileConsent.error ?? newsletterActive.error ?? suppressed.error ?? revoked.error;
    if (consentErr) {
      console.error("[abandoned-cart] consent lookup failed — sending nothing:", consentErr);
      return { sent: 0, scanned, skipped: "scan-failed" };
    }
    const lower = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const suppressedSet = new Set((suppressed.data ?? []).map((r) => lower(r.email)));
    const revokedSet = new Set((revoked.data ?? []).map((r) => lower(r.email)));
    // profiles.marketing_consent = false is an explicit refusal and beats a
    // stale newsletter row for the same address, exactly as buildAudience does.
    for (const r of [...(profileConsent.data ?? []), ...(newsletterActive.data ?? [])]) {
      const e = lower(r.email);
      if (e && !suppressedSet.has(e) && !revokedSet.has(e)) consented.add(e);
    }
  }

  let sent = 0;
  let failed = 0;
  let attempted = 0;
  let consecutiveFailures = 0;
  let skipped: AbandonedCartRunResult["skipped"];

  /**
   * Send one reminder pass. Shares the run-level counters and the single
   * MAX_SENDS_PER_RUN budget with every other pass, so reminder 1 and reminder 2
   * together never exceed the per-run send cap or the consecutive-failure
   * breaker. Stamps `stampColumn` only after a confirmed send — a rejected send
   * (sendEmail returns false, it does not throw) leaves the one-shot flag null
   * so the next tick can retry rather than permanently retiring the cart.
   * Returns "stop" when the whole run must halt: the unsubscribe secret is
   * missing (can't build a compliant link) or the provider looks down.
   */
  const runPass = async (
    list: Array<{ id: string; email: string; name: string | null; items: unknown }>,
    stampColumn: "reminder_1_sent_at" | "reminder_2_sent_at",
    subject: string,
    buildHtml: (cart: { name: string | null; items: unknown }, unsub: string) => string,
  ): Promise<"stop" | "done"> => {
    for (const cart of list) {
      if (!consented.has(cart.email.toLowerCase())) continue;
      // Budget reached — remaining carts keep their *_sent_at null and are
      // picked up by the next tick.
      if (attempted >= MAX_SENDS_PER_RUN) return "done";

      // Spam Law §30א: a working, per-recipient unsubscribe link. If no secret
      // is configured we stop rather than send a non-compliant message.
      const token = await unsubscribeToken(cart.email);
      if (!token) {
        console.log("[abandoned-cart] UNSUBSCRIBE_SECRET not set — skipping marketing reminders");
        skipped = "unsubscribe-secret-missing";
        return "stop";
      }
      const unsub = unsubscribeUrl(cart.email, token);
      const html = buildHtml(cart, unsub);

      attempted++;
      const ok = await sendEmail({
        to: cart.email,
        subject,
        html,
        replyTo: process.env.SHOP_OWNER_EMAIL,
        // RFC 8058 one-click opt-out — required by Gmail/Yahoo bulk-sender rules.
        // Same signed unsub URL already rendered in the footer link.
        headers: listUnsubscribeHeaders(unsub),
      });

      if (ok) {
        const stampedAt = new Date().toISOString();
        const { error: stampError } = await supabaseAdmin
          .from("abandoned_carts")
          .update(
            stampColumn === "reminder_1_sent_at"
              ? { reminder_1_sent_at: stampedAt }
              : { reminder_2_sent_at: stampedAt },
          )
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
          return "stop";
        }
      }

      // Resend allows ~2 req/s. Without this a full budget of back-to-back POSTs
      // is rate-limited from the third request on. This is I/O wait, not Worker
      // CPU time.
      await sleep(SEND_GAP_MS);
    }
    return "done";
  };

  // Pass 1 — the original reminder, with the item table.
  const firstStatus = await runPass(
    first,
    "reminder_1_sent_at",
    "פרסומת: העגלה שלכם ממתינה — אור זרוע לצדיק",
    (cart, unsub) => {
      const items = Array.isArray(cart.items) ? (cart.items as any[]) : [];
      const rows = items
        .map(
          (it) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${esc(it.name)} × ${esc(it.quantity)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:left;white-space:nowrap;">${ils(Number(it.price) * Number(it.quantity))}</td>
        </tr>`,
        )
        .join("");
      return emailShell(`
      <p class="oz-muted" style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
      <h1 style="font-size:20px;margin:0 0 8px;">שכחתם משהו בעגלה? 🛍️</h1>
      <p class="oz-muted" style="font-size:14px;color:#555;margin:0 0 16px;">
        ${cart.name ? esc(cart.name) + ", " : ""}העגלה שלכם עדיין ממתינה — המוצרים שבחרתם שמורים לכם.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      ${emailButton("https://orzadik.com/cart", "חזרה לעגלה")}
      <div class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
        <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
        <div style="margin-top:6px;">
          קיבלתם הודעה זו כי התחלתם הזמנה באתר.
          <a class="oz-gold" href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
        </div>
      </div>
    `, `${cart.name ? cart.name + ", " : ""}המוצרים שבחרתם שמורים בעגלה שלכם.`);
    },
  );

  // Pass 2 — a short, distinct nudge. Only if the run wasn't halted (secret
  // missing or provider down); the shared budget/breaker carry over, so if
  // pass 1 spent the whole budget this pass sends nothing and drains next tick.
  if (firstStatus !== "stop") {
    await runPass(
      second,
      "reminder_2_sent_at",
      "פרסומת: עדיין חושבים על זה? — אור זרוע לצדיק",
      (cart, unsub) =>
        emailShell(`
      <p class="oz-muted" style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
      <h1 style="font-size:20px;margin:0 0 8px;">עדיין חושבים על זה?</h1>
      <p class="oz-muted" style="font-size:14px;color:#555;margin:0 0 16px;">
        ${cart.name ? esc(cart.name) + ", " : ""}רצינו רק להזכיר שהעגלה שלכם עדיין שמורה אצלנו. אם תרצו להשלים את ההזמנה — אנחנו כאן בשבילכם.
      </p>
      ${emailButton("https://orzadik.com/cart", "חזרה לעגלה")}
      <div class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
        <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
        <div style="margin-top:6px;">
          קיבלתם הודעה זו כי התחלתם הזמנה באתר.
          <a class="oz-gold" href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
        </div>
      </div>
    `, `${cart.name ? cart.name + ", " : ""}העגלה שלכם עדיין שמורה אצלנו.`),
    );
  }

  console.log(
    `[abandoned-cart] reminders: scanned=${scanned} sent=${sent} failed=${failed}${skipped ? ` skipped=${skipped}` : ""}`,
  );
  return {
    sent,
    scanned,
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
