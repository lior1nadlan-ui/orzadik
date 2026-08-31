// Post-delivery review request, sent 7 days after an order ships.
//
// Consent basis: this is a SERVICE follow-up about an order the customer
// actually placed — it contains no offer, no price and no product promotion,
// only links back to the items they bought. That is why it may go out on
// orders.contact_consent, which covers order-related contact. It deliberately
// still honours the global suppression list and still carries a working
// unsubscribe link: if someone has told us to stop emailing them, we stop,
// regardless of which legal bucket the message falls into.
//
// Not client-callable — invoked from /api/cron/review-requests, mirroring
// runAbandonedCartReminders.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendEmail,
  emailShell,
  emailButton,
  esc,
  isEmailConfigured,
  unsubscribeToken,
  unsubscribeUrl,
  listUnsubscribeHeaders,
} from "@/lib/email.server";
import { reviewToken, reviewUrl } from "@/lib/reviews.functions";
import { sellerIdentityLine, BUSINESS } from "@/lib/business";

/** How long after shipping to ask — long enough that the parcel has arrived. */
const DAYS_AFTER_SHIPPING = 7;
/** Orders handled per cron tick. */
const BATCH = 50;
/** Resend allows roughly 2 requests/second — same pacing as the other senders. */
const SEND_GAP_MS = 550;
/**
 * Actual send attempts per run (~22s wall at SEND_GAP_MS — the same budget
 * abandoned-cart already accepts, so the cron request can't time out). Orders
 * past the budget stay UNSTAMPED and drain on the next tick.
 */
const MAX_SENDS_PER_RUN = 40;
/** Consecutive failures that mean the provider is down, not one bad address. */
const MAX_CONSECUTIVE_FAILURES = 5;
/**
 * Past this age an order stops being retried. Without a floor, the first tick
 * after any gap would scan the entire historical order book.
 */
const MAX_AGE_DAYS = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runReviewRequests(): Promise<{
  sent: number;
  scanned: number;
  failed?: number;
}> {
  if (!isEmailConfigured()) {
    console.log("[review-request] email not configured — skipping");
    return { sent: 0, scanned: 0 };
  }
  if (!process.env.UNSUBSCRIBE_SECRET) {
    console.log("[review-request] UNSUBSCRIBE_SECRET not set — skipping");
    return { sent: 0, scanned: 0 };
  }

  const cutoff = new Date(Date.now() - DAYS_AFTER_SHIPPING * 24 * 60 * 60 * 1000).toISOString();
  // Lower bound on the scan: orders older than this stop being retried. (.gte
  // excludes NULL shipped_at exactly as the existing .lte already does.)
  const floor = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, order_items(product_id, product_name)",
    )
    .eq("payment_status", "paid")
    .in("status", ["shipped", "completed"])
    .eq("contact_consent", true)
    .is("review_request_sent_at", null)
    .lte("shipped_at", cutoff)
    .gte("shipped_at", floor)
    // Oldest first, so the orders nearest aging out get their retry before the
    // fresh ones.
    .order("shipped_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("[review-request] scan failed:", error);
    return { sent: 0, scanned: 0 };
  }
  const rows = orders ?? [];
  if (rows.length === 0) return { sent: 0, scanned: 0 };

  // Global opt-out list. Small table, so one fetch and an in-memory Set.
  const emails = [...new Set(rows.map((o) => (o.customer_email ?? "").toLowerCase()))];
  const { data: suppressedRows, error: supErr } = await supabaseAdmin
    .from("email_suppressions")
    .select("email")
    .in("email", emails);
  if (supErr) {
    // Fail CLOSED: without the opt-out list we cannot know who asked us to stop.
    console.error("[review-request] suppression lookup failed — sending nothing:", supErr);
    return { sent: 0, scanned: rows.length };
  }
  const suppressed = new Set((suppressedRows ?? []).map((r) => r.email.toLowerCase()));

  // Resolve slugs so each product row can deep-link to its review section.
  // Products deleted since the order simply lose their link.
  const productIds = [
    ...new Set(
      rows.flatMap((o) =>
        ((o.order_items as any[]) ?? []).map((it) => it.product_id).filter(Boolean),
      ),
    ),
  ];
  const slugById = new Map<string, { slug: string; thumbnail_url: string | null }>();
  if (productIds.length > 0) {
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, slug, thumbnail_url")
      .in("id", productIds);
    if (pErr) console.error("[review-request] product lookup failed:", pErr);
    for (const p of products ?? []) {
      slugById.set(p.id, { slug: p.slug, thumbnail_url: p.thumbnail_url });
    }
  }

  let sent = 0;
  let failed = 0;
  let attempted = 0;
  let consecutiveFailures = 0;
  for (const order of rows) {
    const email = (order.customer_email ?? "").toLowerCase();
    const stamp = async () =>
      supabaseAdmin
        .from("orders")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", order.id);

    // Opted out: stamp anyway so this order is never re-scanned.
    if (!email || suppressed.has(email)) {
      await stamp();
      continue;
    }

    const items = ((order.order_items as any[]) ?? [])
      .map((it) => ({ ...it, product: slugById.get(it.product_id) }))
      .filter((it) => it.product);
    if (items.length === 0) {
      await stamp();
      continue;
    }

    const token = await unsubscribeToken(email);
    if (!token) {
      // Secret vanished mid-run — stop rather than send without an opt-out.
      console.log("[review-request] UNSUBSCRIBE_SECRET missing mid-run — stopping");
      break;
    }
    const unsub = unsubscribeUrl(email, token);

    // Signed, order-scoped verified-review link — same secret + HMAC helper as
    // the unsub token, domain-separated (see reviews.functions). Reviews left
    // through it are tied to the order and earn the "קונה מאומת" badge. If the
    // secret is somehow unavailable it degrades to no CTA (the reminder still
    // ships) rather than emitting a forgeable link.
    const reviewSig = await reviewToken(order.id);
    const reviewHref = reviewSig ? reviewUrl(order.id, reviewSig) : null;

    const rowsHtml = items
      .map((it) => {
        const thumb = it.product!.thumbnail_url
          ? `<td width="60" style="padding:8px 0;"><img src="${esc(it.product!.thumbnail_url)}" width="48" height="48" alt="" style="border-radius:8px;object-fit:cover;"></td>`
          : `<td width="60"></td>`;
        return `<tr>
          ${thumb}
          <td style="padding:8px 0;font-size:14px;">${esc(it.product_name)}</td>
        </tr>`;
      })
      .join("");

    const ctaHtml = reviewHref
      ? emailButton(reviewHref, "לכתיבת חוות דעת") +
        `<p class="oz-muted" style="font-size:12px;color:#888;text-align:center;margin:6px 0 0;">הקישור מותאם אישית להזמנה שלך.</p>`
      : "";

    const html = emailShell(
      `
      <h1 style="font-size:20px;margin:0 0 8px;">${esc(order.customer_name)}, איך היה?</h1>
      <p class="oz-muted" style="font-size:14px;color:#555;margin:0 0 16px;">
        ההזמנה <strong>${esc(order.order_number)}</strong> הגיעה אליך — נשמח לשמוע איך היה!
        חוות הדעת שלך עוזרת לנו ולקונים הבאים.
      </p>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
      ${ctaHtml}
      <div class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
        <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
        <div style="margin-top:6px;">
          קיבלת הודעה זו בעקבות הזמנה שביצעת באתר.
          <a class="oz-gold" href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
        </div>
      </div>
    `,
      `${order.customer_name}, נשמח לשמוע איך היו המוצרים מהזמנה ${order.order_number}.`,
    );

    // Budget reached — the rest keep review_request_sent_at null and go out on
    // the next daily tick.
    if (attempted >= MAX_SENDS_PER_RUN) break;
    attempted++;

    const ok = await sendEmail({
      to: order.customer_email,
      subject: "איך היו המוצרים? נשמח לחוות דעת — אור זרוע לצדיק",
      html,
      replyTo: process.env.SHOP_OWNER_EMAIL,
      // RFC 8058 one-click opt-out header — same signed unsub URL as the footer.
      headers: listUnsubscribeHeaders(unsub),
    });

    // Stamp on ATTEMPT, not on success. It looks tempting to stamp only when
    // ok===true so a failure can retry, but sendEmail also returns false when
    // the 8s abort fires on a request Resend already accepted — and
    // review_request_sent_at is the hard gate that makes the signed review link
    // in that delivered email valid. Retrying would then mail the same customer
    // a fresh copy every day (up to the 30-day floor), each carrying a link that
    // reports "הקישור אינו תקין". One lost request beats 30 duplicates with a
    // dead CTA. The real fix for the original bug is the pacing above: the mass
    // failures were 429s from unthrottled sends, which no longer happen. Orders
    // never ATTEMPTED (past the budget, or after the breaker trips) stay
    // unstamped and go out on the next tick.
    const { error: stampErr } = await stamp();
    if (stampErr) console.error("[review-request] stamp failed for", order.id, stampErr);

    if (ok) {
      sent++;
      consecutiveFailures = 0;
    } else {
      failed++;
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[review-request] ${consecutiveFailures} consecutive send failures — stopping run`,
        );
        break;
      }
    }

    // Resend allows ~2 req/s. Without this, back-to-back POSTs are 429'd from
    // roughly the third request on. This is I/O wait, not Worker CPU time.
    await sleep(SEND_GAP_MS);
  }

  console.log(`[review-request] scanned=${rows.length} sent=${sent} failed=${failed}`);
  return { sent, scanned: rows.length, ...(failed ? { failed } : {}) };
}
