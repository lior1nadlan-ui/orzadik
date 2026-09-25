// Sending the "your order is waiting for payment" email. The rules for who gets
// it are in payment-reminder.ts (pure, tested) — read that file's header for
// why this message exists and why it may go out on the order consent.
//
// Runs hourly beside the cart reminders (src/nitro/cron.ts), and on demand from
// the order dialog. Not client-callable on its own.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  emailButton,
  emailShell,
  esc,
  ils,
  isEmailConfigured,
  listUnsubscribeHeaders,
  sendEmail,
  unsubscribeToken,
  unsubscribeUrl,
} from "@/lib/email.server";
import { itemsRows } from "@/lib/order-emails.server";
import { BUSINESS, sellerIdentityLine } from "@/lib/business";
import { recoveredBy } from "@/lib/crm-digest";
import {
  paymentReminderDecision,
  REMIND_AFTER_MS,
  REMIND_WINDOW_MS,
  type ReminderDecision,
  type ReminderOrder,
} from "@/lib/payment-reminder";

const ORIGIN = process.env.APP_URL || "https://orzadik.com";
const DAY = 24 * 60 * 60 * 1000;
/** Resend allows roughly 2 requests/second — same pacing as the other senders. */
const SEND_GAP_MS = 550;
const MAX_SENDS_PER_RUN = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ORDER_COLUMNS =
  "id, user_id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, created_at, contact_consent, payment_reminder_sent_at, cardcom_tranzaction_id, order_items(product_name, quantity, line_total, variant_label, custom_text, products(slug, thumbnail_url))";

type FullOrder = ReminderOrder & {
  user_id: string | null;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total: number | string | null;
  order_items: unknown[] | null;
};

/** The email itself: that order, its items, one button back to the SAME order
 *  (/order/<id> re-opens CardCom for it — no new order, no second basket), and
 *  a human way out. No offer, no discount, no urgency. */
export function renderPaymentReminder(o: FullOrder, unsub: string | null) {
  const name = String(o.customer_name ?? "").trim();
  const payUrl = `${ORIGIN}/order/${o.id}`;
  const html = emailShell(
    `
    <h1 style="font-size:20px;margin:0 0 8px;">${name ? `${esc(name)}, ההזמנה שלך שמורה` : "ההזמנה שלך שמורה"}</h1>
    <p class="oz-muted" style="font-size:14px;color:#555;margin:0 0 16px;line-height:1.7;">
      התשלום על הזמנה <strong>${esc(o.order_number)}</strong> לא הושלם, ולכן היא עדיין לא יצאה לטיפול.
      אם זה קרה בטעות, אפשר להשלים את התשלום על אותה הזמנה בדיוק, בקישור המאובטח:
    </p>
    ${emailButton(payUrl, "להשלמת התשלום")}
    ${
      o.user_id
        ? `<p class="oz-muted" style="font-size:12px;color:#888;text-align:center;margin:6px 0 0;">ההזמנה שייכת לחשבון באתר — ייתכן שתתבקשו להתחבר.</p>`
        : ""
    }
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;">${itemsRows(
      (o.order_items as any[]) ?? [],
    )}</table>
    <p style="font-size:15px;margin:12px 0 0;"><strong>סך הכל: ${esc(ils(Number(o.total)))}</strong></p>
    <p class="oz-muted" style="font-size:13px;color:#555;margin:18px 0 0;line-height:1.7;">
      אם הכרטיס נדחה, אפשר לנסות כרטיס אחר, או להתקשר אלינו ב-${esc(BUSINESS.phoneDisplay)} ונשמח לעזור.
      ואם החלטת לוותר — אין צורך לעשות דבר.
    </p>
    <div class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
      <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
      <div style="margin-top:6px;">
        קיבלת הודעה זו בעקבות הזמנה שביצעת באתר.${
          unsub
            ? ` <a class="oz-gold" href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.`
            : ""
        }
      </div>
    </div>
  `,
    `ההזמנה ${o.order_number ?? ""} שמורה — נשאר רק להשלים את התשלום.`,
  );
  return {
    subject: `ההזמנה שלך ממתינה להשלמת התשלום — ${o.order_number ?? ""}`,
    html,
  };
}

/** Everything the decision needs beyond the order rows themselves. */
async function loadContext(emails: string[], now: number) {
  const [suppressed, carts, paid] = await Promise.all([
    emails.length
      ? supabaseAdmin.from("email_suppressions").select("email").in("email", emails)
      : Promise.resolve({ data: [], error: null }),
    emails.length
      ? supabaseAdmin
          .from("abandoned_carts")
          .select("email, reminder_1_sent_at, reminder_2_sent_at")
          .in("email", emails)
      : Promise.resolve({ data: [], error: null }),
    // Paid orders from the same window, to recognise an attempt that was fixed.
    supabaseAdmin
      .from("orders")
      .select("customer_email, customer_phone, payment_status, created_at, status")
      .in("payment_status", ["paid", "refunded"])
      .gte("created_at", new Date(now - REMIND_WINDOW_MS - DAY).toISOString())
      .limit(1000),
  ]);
  // Fail CLOSED: without the opt-out list we cannot know who asked us to stop.
  const err = suppressed.error ?? carts.error ?? paid.error;
  if (err) throw err;
  const lower = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase();
  const recentlyCartReminded = new Set<string>();
  for (const c of (carts.data ?? []) as any[]) {
    const last = Math.max(
      c.reminder_1_sent_at ? Date.parse(c.reminder_1_sent_at) : 0,
      c.reminder_2_sent_at ? Date.parse(c.reminder_2_sent_at) : 0,
    );
    if (last && now - last < REMIND_WINDOW_MS) recentlyCartReminded.add(lower(c.email));
  }
  return {
    suppressed: new Set(((suppressed.data ?? []) as any[]).map((r) => lower(r.email))),
    recentlyCartReminded,
    paidOrders: (paid.data ?? []) as any[],
  };
}

async function deliver(o: FullOrder): Promise<boolean> {
  const email = String(o.customer_email ?? "")
    .trim()
    .toLowerCase();
  const token = process.env.UNSUBSCRIBE_SECRET ? await unsubscribeToken(email) : null;
  const unsub = token ? unsubscribeUrl(email, token) : null;
  const { subject, html } = renderPaymentReminder(o, unsub);
  return sendEmail({
    to: email,
    subject,
    html,
    replyTo: process.env.SHOP_OWNER_EMAIL,
    ...(unsub ? { headers: listUnsubscribeHeaders(unsub) } : {}),
  });
}

/** The hourly pass. */
export async function runPaymentReminders(): Promise<{
  sent: number;
  scanned: number;
  failed?: number;
  skipped?: string;
}> {
  if (!isEmailConfigured()) return { sent: 0, scanned: 0, skipped: "email-not-configured" };
  const now = Date.now();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(ORDER_COLUMNS)
    .in("payment_status", ["unpaid", "failed"])
    .is("payment_reminder_sent_at", null)
    .eq("contact_consent", true)
    .lte("created_at", new Date(now - REMIND_AFTER_MS).toISOString())
    .gte("created_at", new Date(now - REMIND_WINDOW_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[payment-reminder] scan failed:", error);
    return { sent: 0, scanned: 0, skipped: "scan-failed" };
  }
  const rows = (data ?? []) as unknown as FullOrder[];
  if (rows.length === 0) return { sent: 0, scanned: 0 };

  let ctx: Awaited<ReturnType<typeof loadContext>>;
  try {
    ctx = await loadContext(
      [...new Set(rows.map((o) => String(o.customer_email ?? "").toLowerCase()).filter(Boolean))],
      now,
    );
  } catch (e) {
    console.error("[payment-reminder] context lookup failed — sending nothing:", e);
    return { sent: 0, scanned: rows.length, skipped: "scan-failed" };
  }
  const recovered = recoveredBy([...ctx.paidOrders, ...rows]);

  let sent = 0;
  let failed = 0;
  let attempted = 0;
  for (const o of rows) {
    const decision = paymentReminderDecision(o, {
      now,
      recovered,
      suppressed: ctx.suppressed,
      recentlyCartReminded: ctx.recentlyCartReminded,
    });
    if (decision !== "send") continue;
    if (attempted >= MAX_SENDS_PER_RUN) break;
    if (attempted > 0) await sleep(SEND_GAP_MS);
    attempted++;

    const ok = await deliver(o);
    // Stamp on ATTEMPT, as the review requests do: sendEmail also reports false
    // when its timeout fires on a request Resend had already accepted, and a
    // retry would then mail the same customer twice about one order.
    const { error: stampErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_reminder_sent_at: new Date().toISOString() })
      .eq("id", o.id);
    if (stampErr) console.error("[payment-reminder] stamp failed for", o.id, stampErr);
    if (ok) sent++;
    else failed++;
  }
  return { sent, scanned: rows.length, ...(failed ? { failed } : {}) };
}

const REASON_HE: Partial<Record<ReminderDecision, string>> = {
  "money-captured": "קיים חיוב שבוצע להזמנה הזו — צריך בירור ידני, לא קישור לתשלום נוסף.",
  "not-open": "ההזמנה כבר לא ממתינה לתשלום (שולמה, בוטלה, או שהלקוח שילם בהזמנה אחרת).",
  "no-consent": "הלקוח לא אישר יצירת קשר בהזמנה הזו.",
  suppressed: "הלקוח ביקש לא לקבל מאיתנו מיילים.",
};

/** The owner's button. Lifts the timing and once-only rules, never the safety
 *  ones; returns why when it refuses. */
export async function sendPaymentReminderNow(
  orderId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!isEmailConfigured()) return { ok: false, message: "שליחת מיילים לא מוגדרת." };
  const now = Date.now();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return { ok: false, message: "ההזמנה לא נמצאה." };
  const o = data as unknown as FullOrder;
  const email = String(o.customer_email ?? "").toLowerCase();
  const ctx = await loadContext(email ? [email] : [], now);
  const decision = paymentReminderDecision(o, {
    now,
    recovered: recoveredBy([...ctx.paidOrders, o]),
    suppressed: ctx.suppressed,
    recentlyCartReminded: ctx.recentlyCartReminded,
    manual: true,
  });
  if (decision !== "send") {
    return { ok: false, message: REASON_HE[decision] ?? "לא ניתן לשלוח להזמנה הזו." };
  }
  const ok = await deliver(o);
  if (ok) {
    await supabaseAdmin
      .from("orders")
      .update({ payment_reminder_sent_at: new Date().toISOString() })
      .eq("id", o.id);
  }
  return ok
    ? { ok: true, message: "נשלח ללקוח מייל עם קישור להשלמת התשלום." }
    : { ok: false, message: "השליחה נכשלה — נסו שוב בעוד רגע." };
}
