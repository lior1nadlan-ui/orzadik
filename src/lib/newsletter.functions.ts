// Newsletter signup.
//
// Compliance stance (Spam Law §30א): single opt-in is lawful here because every
// marketing message we send carries the "פרסומת" marking, the seller identity
// line and a working per-recipient unsubscribe link. Deliberately NOT building
// double opt-in — it is not required, and the confirmation mail would itself be
// an unsolicited message.
//
// Signing up is also treated as fresh, explicit consent: it clears any earlier
// suppression for that address. That is the only path that removes a suppression
// row, and it always requires a deliberate action by the address owner.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkOrderRateLimitByIp } from "@/lib/rate-limit.server";
import {
  sendEmail,
  emailShell,
  esc,
  isEmailConfigured,
  unsubscribeToken,
  unsubscribeUrl,
} from "@/lib/email.server";
import { sellerIdentityLine, BUSINESS } from "@/lib/business";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(200).optional().nullable(),
  source: z.enum(["footer", "checkout", "account"]),
  // Honeypot: a real person never fills a hidden field. Bots fill everything.
  website: z.string().max(0).optional(),
});

/**
 * Record a marketing-consent signup for `email` and (best effort) welcome them.
 *
 * Shared by the public server function below and by the checkout opt-in, so the
 * revive / un-suppress / profile-sync rules can't drift between the two.
 */
export async function recordNewsletterConsent(opts: {
  email: string;
  name?: string | null;
  source: "footer" | "checkout" | "account";
  userId?: string | null;
}): Promise<void> {
  const email = opts.email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Upsert on the plain unique index. Re-subscribing revives a closed row.
  const { error: subErr } = await supabaseAdmin
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        name: opts.name || null,
        source: opts.source,
        consented_at: now,
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    );
  if (subErr) throw subErr;

  // Fresh consent outranks an old opt-out.
  const { error: supErr } = await supabaseAdmin
    .from("email_suppressions")
    .delete()
    .eq("email", email);
  if (supErr) console.error("[newsletter] suppression clear failed:", supErr);

  // Keep a registered profile's consent flags in step with the list.
  const profileUpdate = {
    marketing_consent: true,
    marketing_consent_at: now,
    marketing_consent_source: opts.source,
  };
  const { error: profErr } = opts.userId
    ? await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", opts.userId)
    : await supabaseAdmin.from("profiles").update(profileUpdate).ilike("email", email);
  if (profErr) console.error("[newsletter] profile consent sync failed:", profErr);
}

/** Best-effort welcome mail. Never throws — signup already succeeded. */
export async function sendNewsletterWelcome(email: string, name?: string | null): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const token = await unsubscribeToken(email);
    if (!token) return; // no secret → no compliant unsubscribe → don't send
    const unsub = unsubscribeUrl(email, token);
    await sendEmail({
      to: email,
      subject: "פרסומת: נרשמת לעדכונים של אור זרוע לצדיק ✨",
      html: emailShell(`
        <p style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
        <h1 style="font-size:20px;margin:0 0 8px;">${name ? esc(name) + ", ב" : "ב"}רוכים הבאים! ✨</h1>
        <p style="font-size:14px;color:#555;margin:0 0 16px;">
          נרשמת לרשימת התפוצה של אור זרוע לצדיק. נשלח מדי פעם מבצעים, פריטים חדשים
          ועדכונים לקראת החגים — בלי ספאם, ואפשר להסיר בכל רגע.
        </p>
        <div style="text-align:center;margin-top:20px;">
          <a href="https://orzadik.com/shop" style="display:inline-block;background:#D4AF37;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;">
            לחנות
          </a>
        </div>
        <div style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
          <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
          <div style="margin-top:6px;">
            <a href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
          </div>
        </div>
      `),
      replyTo: process.env.SHOP_OWNER_EMAIL,
    });
  } catch (e) {
    console.error("[newsletter] welcome email failed (non-fatal):", e);
  }
}

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    // Honeypot tripped — behave exactly like success so bots learn nothing.
    if (data.website) return { ok: true as const };

    const req = getRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const { limited } = await checkOrderRateLimitByIp(ip);
    if (limited) throw new Error("יותר מדי בקשות מהכתובת הזו. אנא נסו מאוחר יותר.");

    const email = data.email.trim().toLowerCase();
    try {
      await recordNewsletterConsent({ email, name: data.name, source: data.source });
    } catch (e) {
      console.error("[newsletter] subscribe failed:", e);
      throw new Error("לא הצלחנו לרשום את הכתובת כעת. אנא נסו שוב.");
    }

    await sendNewsletterWelcome(email, data.name);
    return { ok: true as const };
  });
