// Tell the staff about every new abandoned cart — the owner asked to hear
// about every lead, not only orders.
//
// An unpaid ORDER already alerts at creation (sendOrderCreatedOwnerAlert +
// Telegram). A cart left before any order existed alerted nobody: it surfaced
// only in the next morning's briefing, by which time the shopper has moved on.
// This runs every 10 minutes and sends ONE message per run for the carts that
// went quiet in the meantime (Telegram + staff email, kind "orders").
//
// A cart counts once it has sat untouched for QUIET_MIN — the shopper may still
// be typing the address — and is stamped staff_alerted_at so it alerts once.
// A cart whose person then placed an order is stamped silently: the order
// alert already covered them.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailShell, esc, isEmailConfigured, sendEmail } from "@/lib/email.server";
import { getStaffRecipients } from "@/lib/staff-recipients.server";
import { isTelegramConfigured, sendTelegramText } from "@/lib/telegram.server";

const QUIET_MIN = 30;
/** Older carts are history, not news — never alert on them (e.g. on first run). */
const MAX_AGE_HOURS = 48;
const BATCH = 20;
const ORIGIN = process.env.APP_URL || "https://orzadik.com";

const ils = (n: unknown) => `₪${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;
const tgEsc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function itemNames(items: unknown): string {
  if (!Array.isArray(items)) return "";
  const names = items
    .map((i) => String((i as { name?: unknown })?.name ?? "").trim())
    .filter(Boolean);
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` ועוד ${names.length - 3}` : "");
}

export async function runLeadAlerts(): Promise<{ alerted: number; skipped: number }> {
  const now = Date.now();
  const { data: carts, error } = await supabaseAdmin
    .from("abandoned_carts")
    .select("id, email, name, phone, items, subtotal, created_at, updated_at")
    .is("staff_alerted_at", null)
    .is("converted_order_id", null)
    .lte("updated_at", new Date(now - QUIET_MIN * 60_000).toISOString())
    .gte("created_at", new Date(now - MAX_AGE_HOURS * 3600_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("[lead-alerts] load:", error.message);
    return { alerted: 0, skipped: 0 };
  }
  if (!carts?.length) return { alerted: 0, skipped: 0 };

  // Did the person go on to place an order? Then the order alert told us.
  const emails = [...new Set(carts.map((c) => c.email.toLowerCase()))];
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("customer_email, created_at")
    .in("customer_email", emails)
    .gte("created_at", carts[0].created_at);
  const orderedSince = (email: string, at: string) =>
    (orders ?? []).some(
      (o) => String(o.customer_email).toLowerCase() === email.toLowerCase() && o.created_at >= at,
    );

  const fresh = carts.filter((c) => !orderedSince(c.email, c.created_at));
  const covered = carts.filter((c) => orderedSince(c.email, c.created_at));

  let delivered = fresh.length === 0;
  if (fresh.length) {
    const head =
      fresh.length === 1
        ? "🛒 <b>ליד חדש — עגלה נטושה</b>"
        : `🛒 <b>${fresh.length} לידים חדשים — עגלות נטושות</b>`;
    const lines = fresh.map(
      (c) =>
        `• <b>${tgEsc(c.name || c.email)}</b> — ${tgEsc(ils(c.subtotal))}\n` +
        `   ${tgEsc([c.phone, c.email].filter(Boolean).join(" · "))}\n` +
        (itemNames(c.items) ? `   ${tgEsc(itemNames(c.items))}\n` : ""),
    );
    const tg = isTelegramConfigured()
      ? await sendTelegramText(`${head}\n\n${lines.join("")}\n${ORIGIN}/admin/leads`)
      : false;

    let mailed = false;
    if (isEmailConfigured()) {
      const rows = fresh
        .map(
          (c) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;">
               <strong>${esc(c.name || c.email)}</strong> — ${esc(ils(c.subtotal))}<br>
               <span style="color:#666;font-size:13px;">${esc([c.phone, c.email].filter(Boolean).join(" · "))}</span><br>
               <span style="color:#666;font-size:13px;">${esc(itemNames(c.items))}</span>
             </td></tr>`,
        )
        .join("");
      const subject =
        fresh.length === 1
          ? `ליד חדש: ${fresh[0].name || fresh[0].email} השאיר עגלה (${ils(fresh[0].subtotal)})`
          : `${fresh.length} לידים חדשים — עגלות נטושות`;
      const html = emailShell(
        `<h1 style="font-size:20px;margin:0 0 8px;">🛒 ${esc(subject)}</h1>
         <p style="font-size:14px;color:#555;margin:0 0 12px;">התחילו הזמנה באתר ולא סיימו. כדאי לחזור אליהם בוואטסאפ או בטלפון.</p>
         <table style="width:100%;font-size:14px;">${rows}</table>
         <p style="margin-top:16px;"><a href="${ORIGIN}/admin/leads" style="color:#A8862A;">לכל הלידים בניהול</a></p>`,
        subject,
      );
      for (const to of await getStaffRecipients("orders")) {
        if (await sendEmail({ to, subject, html })) mailed = true;
      }
    }
    // Neither channel configured: nothing will ever deliver, so stamp anyway
    // rather than re-scanning the same rows every 10 minutes.
    delivered = tg || mailed || (!isTelegramConfigured() && !isEmailConfigured());
  }

  const stamp = [...covered, ...(delivered ? fresh : [])].map((c) => c.id);
  if (stamp.length) {
    const { error: sErr } = await supabaseAdmin
      .from("abandoned_carts")
      .update({ staff_alerted_at: new Date().toISOString() })
      .in("id", stamp);
    if (sErr) console.error("[lead-alerts] stamp:", sErr.message);
  }
  return { alerted: delivered ? fresh.length : 0, skipped: covered.length };
}
