// Order confirmation emails (customer receipt + shop-owner alert).
// Uses the shared Resend helper in email.server.ts. Safely no-ops when email
// isn't configured yet, so the checkout flow never breaks.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, emailShell, esc, ils, isEmailConfigured } from "@/lib/email.server";
import { BUSINESS, CONSUMER_POLICY, sellerIdentityLine } from "@/lib/business";

function itemsRows(items: any[]): string {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">
          ${esc(it.product_name)} × ${esc(it.quantity)}
          ${it.variant_label ? `<div style="color:#A8862A;font-size:12px;">גודל: ${esc(it.variant_label)}</div>` : ""}
          ${it.custom_text ? `<div style="color:#A8862A;font-size:12px;">✦ ${esc(it.custom_text)}</div>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:left;white-space:nowrap;">${ils(it.line_total)}</td>
      </tr>`,
    )
    .join("");
}

export async function sendOrderConfirmationEmails(orderId: string) {
  const ownerEmail = process.env.SHOP_OWNER_EMAIL;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, customer_phone, customer_address, customer_city, subtotal, shipping, total, order_items(product_name, quantity, line_total, variant_label, custom_text)",
    )
    .eq("id", orderId)
    .single();
  if (!order) {
    console.error(`[email] order ${orderId} not found — cannot send confirmation`);
    return;
  }
  if (!isEmailConfigured()) {
    console.log("[email] not configured — skipping confirmation for order", order.order_number);
    return;
  }

  const items = (order.order_items as any[]) ?? [];
  const rows = itemsRows(items);
  const totalsBlock = `
    <table style="width:100%;font-size:14px;margin-top:12px;">
      <tr><td style="color:#666;">סכום ביניים</td><td style="text-align:left;">${ils(order.subtotal)}</td></tr>
      <tr><td style="color:#666;">משלוח</td><td style="text-align:left;">${Number(order.shipping) === 0 ? "חינם" : ils(order.shipping)}</td></tr>
      <tr><td style="font-weight:bold;font-size:16px;padding-top:8px;">סך הכל</td><td style="font-weight:bold;font-size:16px;text-align:left;padding-top:8px;color:#A8862A;">${ils(order.total)}</td></tr>
    </table>`;

  // 1) Customer receipt
  const customerHtml = emailShell(`
    <h1 style="font-size:20px;margin:0 0 8px;">תודה על הזמנתך, ${esc(order.customer_name)}! 🎉</h1>
    <p style="font-size:14px;color:#555;margin:0 0 16px;">
      קיבלנו את התשלום עבור הזמנה <strong>${esc(order.order_number)}</strong>. נעדכן אותך בהמשך על מצב המשלוח.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    ${totalsBlock}
    <p style="font-size:13px;color:#666;margin-top:16px;">
      כתובת למשלוח: ${esc(order.customer_address)}${order.customer_city ? ", " + esc(order.customer_city) : ""}
    </p>
    <p style="font-size:12px;color:#888;margin-top:4px;">כל המחירים בשקלים (₪) וכוללים מע"מ.</p>

    <!-- §14ג(ב) written confirmation: seller identity + cancellation rights -->
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#777;line-height:1.7;">
      <div><strong>פרטי העוסק:</strong> ${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
      <div style="margin-top:8px;">
        <strong>זכות ביטול:</strong> ניתן לבטל את העסקה בכתב תוך ${CONSUMER_POLICY.cancellationDays} ימים
        ממועד קבלת המוצר, בהתאם לחוק הגנת הצרכן. ניתן להודיע על ביטול בדוא"ל
        ${esc(BUSINESS.email)} או דרך עמוד יצירת הקשר באתר. בביטול שאינו עקב פגם ייתכן ניכוי דמי
        ביטול בשיעור שלא יעלה על ${CONSUMER_POLICY.cancellationFeePct}% ממחיר העסקה או
        ${CONSUMER_POLICY.cancellationFeeCapIls} ₪ — הנמוך מביניהם. החזר כספי יבוצע תוך
        ${CONSUMER_POLICY.refundDays} ימים מקבלת הודעת הביטול. מוצרים שהותאמו אישית (רקמה/חריטה)
        מוגבלים לביטול לפי החוק.
      </div>
    </div>
  `);
  await sendEmail({
    to: order.customer_email,
    subject: `אישור הזמנה ${order.order_number} — אור זרוע לצדיק`,
    html: customerHtml,
    replyTo: ownerEmail,
  });

  // 2) Shop-owner alert
  if (ownerEmail) {
    const ownerHtml = emailShell(`
      <h1 style="font-size:20px;margin:0 0 8px;">התקבלה הזמנה חדשה 🛒</h1>
      <p style="font-size:14px;color:#555;margin:0 0 12px;">הזמנה <strong>${esc(order.order_number)}</strong></p>
      <table style="width:100%;font-size:14px;margin-bottom:12px;">
        <tr><td style="color:#666;">לקוח</td><td style="text-align:left;">${esc(order.customer_name)}</td></tr>
        <tr><td style="color:#666;">טלפון</td><td style="text-align:left;">${esc(order.customer_phone)}</td></tr>
        <tr><td style="color:#666;">אימייל</td><td style="text-align:left;">${esc(order.customer_email)}</td></tr>
        <tr><td style="color:#666;">כתובת</td><td style="text-align:left;">${esc(order.customer_address)}${order.customer_city ? ", " + esc(order.customer_city) : ""}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      ${totalsBlock}
    `);
    await sendEmail({
      to: ownerEmail,
      subject: `הזמנה חדשה ${order.order_number} — ${order.customer_name}`,
      html: ownerHtml,
      replyTo: order.customer_email,
    });
  }

  console.log("[email] order confirmation sent for", order.order_number);
}

/**
 * Owner alert the moment an order is CREATED (before payment).
 *
 * The paid-confirmation above only fires from the CardCom webhook, so an order
 * whose customer bailed at the payment screen was invisible until the owner
 * happened to open the admin. The owner asked to hear about every order — this
 * one is clearly labeled "ממתינה לתשלום" so it can't be mistaken for money in.
 */
export async function sendOrderCreatedOwnerAlert(orderId: string) {
  const ownerEmail = process.env.SHOP_OWNER_EMAIL;
  if (!ownerEmail || !isEmailConfigured()) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "order_number, customer_name, customer_email, customer_phone, customer_address, customer_city, notes, subtotal, shipping, total, order_items(product_name, quantity, line_total, variant_label, custom_text)",
    )
    .eq("id", orderId)
    .single();
  if (!order) return;

  const rows = itemsRows((order.order_items as any[]) ?? []);
  const html = emailShell(`
    <h1 style="font-size:20px;margin:0 0 8px;">הזמנה חדשה נוצרה 🕐</h1>
    <p style="font-size:14px;margin:0 0 12px;">
      הזמנה <strong>${esc(order.order_number)}</strong> —
      <strong style="color:#b45309;">ממתינה לתשלום</strong>.
      אם התשלום יושלם יגיע מייל אישור נפרד.
    </p>
    <table style="width:100%;font-size:14px;margin-bottom:12px;">
      <tr><td style="color:#666;">לקוח</td><td style="text-align:left;">${esc(order.customer_name)}</td></tr>
      <tr><td style="color:#666;">טלפון</td><td style="text-align:left;">${esc(order.customer_phone)}</td></tr>
      <tr><td style="color:#666;">אימייל</td><td style="text-align:left;">${esc(order.customer_email)}</td></tr>
      <tr><td style="color:#666;">כתובת</td><td style="text-align:left;">${esc(order.customer_address)}${order.customer_city ? ", " + esc(order.customer_city) : ""}</td></tr>
      ${order.notes ? `<tr><td style="color:#666;">הערות</td><td style="text-align:left;">${esc(order.notes)}</td></tr>` : ""}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    <table style="width:100%;font-size:14px;margin-top:12px;">
      <tr><td style="font-weight:bold;">סך הכל</td><td style="font-weight:bold;text-align:left;color:#A8862A;">${ils(order.total)}</td></tr>
    </table>`);

  await sendEmail({
    to: ownerEmail,
    subject: `🕐 הזמנה חדשה ${order.order_number} (ממתינה לתשלום) — ${order.customer_name}`,
    html,
    replyTo: order.customer_email,
  });
  console.log("[email] created-order owner alert sent for", order.order_number);
}

/**
 * Customer "your order shipped" email, with tracking when available.
 * Caller (markOrderShipped) guards on shipping_notified_at so it sends once.
 */
export async function sendOrderShippedEmail(orderId: string) {
  if (!isEmailConfigured()) return false;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "order_number, customer_name, customer_email, customer_address, customer_city, tracking_number, shipping_carrier, order_items(product_name, quantity, line_total, variant_label, custom_text)",
    )
    .eq("id", orderId)
    .single();
  if (!order) return false;

  const rows = itemsRows((order.order_items as any[]) ?? []);
  const trackingBlock = order.tracking_number
    ? `<div style="background:#FAF6E9;border:1px solid #EADFBE;border-radius:8px;padding:12px;margin:16px 0;font-size:14px;">
         <strong>מספר מעקב:</strong> ${esc(order.tracking_number)}
         ${order.shipping_carrier ? `<div style="color:#666;font-size:13px;margin-top:4px;">חברת שילוח: ${esc(order.shipping_carrier)}</div>` : ""}
       </div>`
    : "";

  const html = emailShell(`
    <h1 style="font-size:20px;margin:0 0 8px;">ההזמנה שלך בדרך! 📦</h1>
    <p style="font-size:14px;color:#555;margin:0 0 16px;">
      שלום ${esc(order.customer_name)}, הזמנה <strong>${esc(order.order_number)}</strong> נמסרה למשלוח
      לכתובת ${esc(order.customer_address)}${order.customer_city ? ", " + esc(order.customer_city) : ""}.
    </p>
    ${trackingBlock}
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    <p style="font-size:13px;color:#666;margin-top:16px;">
      לשאלות על המשלוח אפשר להשיב למייל הזה ונשמח לעזור.
    </p>`);

  await sendEmail({
    to: order.customer_email,
    subject: `ההזמנה ${order.order_number} נשלחה אליך 📦 — אור זרוע לצדיק`,
    html,
    replyTo: process.env.SHOP_OWNER_EMAIL,
  });
  console.log("[email] shipped email sent for", order.order_number);
  return true;
}
