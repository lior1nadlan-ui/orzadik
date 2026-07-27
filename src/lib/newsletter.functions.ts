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
import { checkNewsletterRateLimitByIp } from "@/lib/rate-limit.server";
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
import { sellerIdentityLine, BUSINESS } from "@/lib/business";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(200).optional().nullable(),
  source: z.enum(["footer", "checkout", "account", "article", "home", "category"]),
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
  source: "footer" | "checkout" | "account" | "article" | "home" | "category";
  userId?: string | null;
  /** First-party explicit consent (a checkout/account opt-in tied to a real
   *  action) MAY revive a previously-suppressed address — the anonymous signup
   *  form must not, or it becomes an email-bombing vector. Defaults to false. */
  allowResubscribe?: boolean;
}): Promise<{ suppressed: boolean }> {
  const email = opts.email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Anti-abuse (email-bombing): a signup form carries no proof that the
  // submitter owns the address. If the address was previously suppressed
  // (unsubscribed / bounced / complained), an anonymous form submit must NOT
  // revive it — otherwise an attacker could re-subscribe someone who opted out
  // and bomb them with mail. If a suppression row exists, do none of the writes
  // below (no un-suppress, no consent flip) and signal the caller to skip the
  // welcome mail. The address stays suppressed. Brand-new addresses (no row)
  // are unaffected. Fail open on a query error to preserve the happy path.
  const { data: suppressed, error: supCheckErr } = await supabaseAdmin
    .from("email_suppressions")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (!supCheckErr && suppressed && !opts.allowResubscribe) {
    return { suppressed: true };
  }

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
    // .eq, not .ilike: `email` is already lowercased (L54) so an exact match
    // never misses, and .ilike treats `_`/`%` in the local-part as LIKE
    // wildcards — flipping marketing_consent=true on a look-alike stranger's
    // profile (e.g. john_doe vs johnXdoe), a §30א opt-in violation.
    : await supabaseAdmin.from("profiles").update(profileUpdate).eq("email", email);
  if (profErr) console.error("[newsletter] profile consent sync failed:", profErr);

  return { suppressed: false };
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
        <p class="oz-muted" style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
        <h1 style="font-size:20px;margin:0 0 8px;">${name ? esc(name) + ", ב" : "ב"}רוכים הבאים! ✨</h1>
        <p class="oz-muted" style="font-size:14px;color:#555;margin:0 0 16px;">
          נרשמת לרשימת התפוצה של אור זרוע לצדיק. נשלח מדי פעם מדריכים ותוכן לקראת
          החגים, פריטים חדשים ועדכונים — בלי ספאם, ואפשר להסיר בכל רגע.
        </p>
        ${emailButton("https://orzadik.com/shop", "לחנות")}
        <div class="oz-muted" style="font-size:11px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
          <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
          <div style="margin-top:6px;">
            <a class="oz-gold" href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.
          </div>
        </div>
      `, name ? `${name}, נרשמת לעדכונים — מדריכים ותוכן לחגים, ואפשר להסיר בכל רגע.` : "נרשמת לעדכונים — מדריכים ותוכן לחגים, ואפשר להסיר בכל רגע."),
      replyTo: process.env.SHOP_OWNER_EMAIL,
      // Same opt-out as the footer link, exposed to the mailbox provider so the
      // native "unsubscribe" button works without opening the mail.
      headers: listUnsubscribeHeaders(unsub),
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
    const { limited } = await checkNewsletterRateLimitByIp(ip);
    if (limited) throw new Error("יותר מדי בקשות מהכתובת הזו. אנא נסו מאוחר יותר.");

    const email = data.email.trim().toLowerCase();
    let suppressed = false;
    try {
      ({ suppressed } = await recordNewsletterConsent({ email, name: data.name, source: data.source }));
    } catch (e) {
      console.error("[newsletter] subscribe failed:", e);
      throw new Error("לא הצלחנו לרשום את הכתובת כעת. אנא נסו שוב.");
    }

    // A previously-suppressed (unsubscribed) address is left untouched and is
    // not re-mailed. Return the same benign success so the form never reveals
    // whether an address is on the suppression list.
    if (suppressed) return { ok: true as const };

    await sendNewsletterWelcome(email, data.name);
    return { ok: true as const };
  });
