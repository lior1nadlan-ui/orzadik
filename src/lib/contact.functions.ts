// Public contact form → owner inbox.
//
// The form is a THIRD channel alongside phone and WhatsApp, not a replacement:
// it exists so a visitor who is not ready to call can still reach the store
// without leaving the site.
//
// Two deliberate non-features, both mirroring the anti-abuse stance in
// newsletter.functions.ts:
//   • No auto-reply to the address that was typed in. Nothing here proves the
//     submitter owns that address, so mailing it back would turn the form into
//     an email-bombing relay. The confirmation is shown on screen instead.
//   • No DB row. The message is delivered as mail to the owner (reply-to set to
//     the sender), so there is no new table and no customer message sitting in
//     storage longer than it needs to.
//
// If Resend is not configured the handler THROWS rather than reporting success —
// a contact form that silently drops messages is worse than no form at all.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getClientIp, checkContactRateLimitByIp } from "@/lib/rate-limit.server";
import { sendEmail, emailShell, esc, isEmailConfigured } from "@/lib/email.server";
import { BUSINESS } from "@/lib/business";

const Schema = z.object({
  name: z.string().trim().min(2, "שם קצר מדי").max(200),
  email: z.string().trim().email("כתובת דוא\"ל לא תקינה").max(255),
  // Optional second channel. Loose on purpose — Israeli numbers get typed with
  // dashes, spaces and a leading +972 or 0, and rejecting a valid number is a
  // worse failure here than accepting a malformed one.
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10, "ההודעה קצרה מדי").max(4000),
  // Honeypot: a real person never fills a hidden field. Bots fill everything.
  website: z.string().max(0).optional(),
});

/** Escape for HTML, then keep the sender's line breaks readable in the mail. */
function escMultiline(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br>");
}

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    // Honeypot tripped — behave exactly like success so bots learn nothing.
    if (data.website) return { ok: true as const };

    const ip = getClientIp(getRequest());
    const { limited } = await checkContactRateLimitByIp(ip);
    if (limited) {
      throw new Error("נשלחו יותר מדי פניות מהכתובת הזו. נסו שוב מאוחר יותר או התקשרו אלינו.");
    }

    if (!isEmailConfigured()) {
      console.error("[contact] RESEND_API_KEY/ORDER_EMAIL_FROM missing — message not delivered");
      throw new Error("שליחת ההודעה נכשלה כרגע. אפשר להתקשר אלינו או לכתוב בוואטסאפ.");
    }

    const to = (process.env.SHOP_OWNER_EMAIL || BUSINESS.email || "").trim();
    if (!to) {
      console.error("[contact] no owner inbox configured — message not delivered");
      throw new Error("שליחת ההודעה נכשלה כרגע. אפשר להתקשר אלינו או לכתוב בוואטסאפ.");
    }

    const phone = data.phone?.trim();
    const sent = await sendEmail({
      to,
      subject: `פנייה חדשה מהאתר — ${data.name}`,
      // reply_to is the whole point: the owner hits Reply and answers the
      // customer directly, without copying the address out of the body.
      replyTo: data.email,
      html: emailShell(
        `
        <h1 style="font-size:20px;margin:0 0 12px;">פנייה חדשה מטופס יצירת הקשר</h1>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;font-size:14px;line-height:1.8;">
          <tr><td style="padding:2px 0;"><strong>שם:</strong> ${esc(data.name)}</td></tr>
          <tr><td style="padding:2px 0;"><strong>דוא"ל:</strong> <a href="mailto:${esc(data.email)}" style="color:#A8862A;">${esc(data.email)}</a></td></tr>
          ${phone ? `<tr><td style="padding:2px 0;"><strong>טלפון:</strong> <a href="tel:${esc(phone)}" style="color:#A8862A;">${esc(phone)}</a></td></tr>` : ""}
        </table>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #eee;">
          <p class="oz-muted" style="font-size:12px;color:#888;margin:0 0 6px;">ההודעה:</p>
          <p style="font-size:14px;line-height:1.8;margin:0;white-space:normal;">${escMultiline(data.message)}</p>
        </div>
        <p class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;">
          נשלח מטופס יצירת הקשר באתר. השיבו למייל הזה כדי לענות ללקוח ישירות.
        </p>
      `,
        `פנייה חדשה מ${data.name}`,
      ),
    });

    // sendEmail swallows transport errors and returns false. Surface that as a
    // real failure so the visitor knows to use the phone/WhatsApp instead of
    // waiting for an answer that will never come.
    if (!sent) {
      throw new Error("שליחת ההודעה נכשלה כרגע. אפשר להתקשר אלינו או לכתוב בוואטסאפ.");
    }

    return { ok: true as const };
  });
