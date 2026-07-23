// Marketing-consent switch for a signed-in customer (account page).
//
// Why this exists: the account toggle used to write only
// `profiles.marketing_consent`, but the campaign audience is a UNION of
// consenting profiles AND `newsletter_subscribers` rows that are still open
// (see buildAudience in campaigns.functions.ts). A customer who had opted in at
// checkout — which creates a subscriber row — and then switched the account
// toggle off kept receiving campaigns, even though the UI told them
// "הוסרת מרשימת הדיוור". Spam Law §30א requires the opt-out to actually stop
// the sending, so the toggle must perform the exact same set of writes as the
// one-click unsubscribe link (src/routes/api/public/unsubscribe.ts).
//
// SECURITY: the address is resolved server-side from the validated JWT. The
// client never supplies an email — otherwise anyone could unsubscribe (or,
// worse, re-subscribe) an arbitrary address.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({ optIn: z.boolean() });

/**
 * Resolve the caller's email from the JWT claims, falling back to their own
 * profile row. Always lowercased — every list in this codebase stores the
 * address lowercased (see abandoned-cart.functions.ts / newsletter.functions.ts),
 * so an exact match is both correct and safe. Deliberately NOT using `ilike`
 * here: an address such as `a_b@example.com` would be read as a LIKE pattern and
 * could match — and silently unsubscribe or re-subscribe — a different person.
 */
async function resolveCallerEmail(
  userId: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const fromClaims = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (fromClaims) return fromClaims;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const fromProfile = String(data?.email ?? "").trim().toLowerCase();
  if (fromProfile) return fromProfile;

  throw new Error("לא נמצאה כתובת דוא\"ל לחשבון זה.");
}

/**
 * Set the signed-in customer's marketing preference across every send path.
 *
 * optIn=false performs the same four writes as the public unsubscribe endpoint,
 * for the caller's own address only:
 *   1. abandoned_carts.unsubscribed = true   (cart reminders)
 *   2. profiles.marketing_consent   = false  (+ consent timestamp/source cleared)
 *   3. newsletter_subscribers.unsubscribed_at = now()  (closed, not deleted, so
 *      the opt-out itself stays auditable)
 *   4. email_suppressions upsert             (global kill-switch every sender checks)
 *
 * optIn=true reverses all four coherently — this is a deliberate, authenticated
 * action by the address owner, which is exactly the standard newsletter.ts uses
 * for clearing a suppression. It never CREATES a newsletter_subscribers row;
 * signing up for the newsletter stays its own explicit action.
 */
export const setMarketingConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId as string;
    const claims = (context.claims ?? {}) as Record<string, unknown>;
    const email = await resolveCallerEmail(userId, claims);
    const now = new Date().toISOString();
    const optIn = data.optIn;

    try {
      if (!optIn) {
        // 1. Stop abandoned-cart reminders. Matched by address and by user id —
        //    the id catches any legacy row saved under different casing.
        const { error: cartErr } = await supabaseAdmin
          .from("abandoned_carts")
          .update({ unsubscribed: true })
          .eq("email", email);
        if (cartErr) throw cartErr;
        const { error: cartByUserErr } = await supabaseAdmin
          .from("abandoned_carts")
          .update({ unsubscribed: true })
          .eq("user_id", userId);
        if (cartByUserErr) throw cartByUserErr;

        // 2. Revoke profile consent (identity from the JWT, never from input).
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({
            marketing_consent: false,
            marketing_consent_at: null,
            marketing_consent_source: null,
          })
          .eq("id", userId);
        if (profErr) throw profErr;

        // 3. Close the newsletter subscription without deleting the record.
        const { error: subErr } = await supabaseAdmin
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: now })
          .eq("email", email)
          .is("unsubscribed_at", null);
        if (subErr) throw subErr;

        // 4. Global suppression — what every future sender checks, so the
        //    address stays out even if some other list re-adds it later.
        const { error: supErr } = await supabaseAdmin
          .from("email_suppressions")
          .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
        if (supErr) throw supErr;
      } else {
        // 1. Fresh, authenticated consent recorded on the profile.
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({
            marketing_consent: true,
            marketing_consent_at: now,
            marketing_consent_source: "account",
          })
          .eq("id", userId);
        if (profErr) throw profErr;

        // 2. Fresh consent outranks an earlier opt-out — lift the kill-switch.
        const { error: supErr } = await supabaseAdmin
          .from("email_suppressions")
          .delete()
          .eq("email", email);
        if (supErr) throw supErr;

        // 3. Revive an existing newsletter row. No upsert: we do not add the
        //    address to the newsletter list if it was never on it.
        const { error: subErr } = await supabaseAdmin
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: null })
          .eq("email", email);
        if (subErr) throw subErr;

        // 4. Re-enable cart reminders that the earlier opt-out switched off.
        const { error: cartErr } = await supabaseAdmin
          .from("abandoned_carts")
          .update({ unsubscribed: false })
          .eq("email", email);
        if (cartErr) throw cartErr;
        const { error: cartByUserErr } = await supabaseAdmin
          .from("abandoned_carts")
          .update({ unsubscribed: false })
          .eq("user_id", userId);
        if (cartByUserErr) throw cartByUserErr;
      }
    } catch (e) {
      console.error("[marketing-consent] update failed:", e);
      throw new Error("שמירת העדפות הדיוור נכשלה. אנא נסו שוב.");
    }

    return { ok: true as const, optIn };
  });
