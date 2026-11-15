// Server side of the newsletter's welcome gift (rules in welcome-coupon.ts):
// reading the CRM setting and minting a subscriber's personal code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { couponsEnabled } from "@/lib/coupons.server";
import { generateCouponCode } from "@/lib/coupons";
import {
  parseWelcomeCouponSettings,
  WELCOME_CODE_PREFIX,
  WELCOME_COUPON_KEY,
  type WelcomeCouponSettings,
} from "@/lib/welcome-coupon";

const DAY = 24 * 60 * 60 * 1000;

/** The CRM setting. A failed read counts as off: no code is ever minted blind. */
export async function readWelcomeCouponSettings(): Promise<WelcomeCouponSettings> {
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", WELCOME_COUPON_KEY)
    .maybeSingle();
  if (error) {
    console.error("[welcome-coupon] settings:", error);
    return parseWelcomeCouponSettings(null);
  }
  return parseWelcomeCouponSettings(data?.value);
}

/**
 * The offer the signup form may promise right now, or null. Needs both the
 * welcome switch and the shop-wide coupon switch: a promise the checkout would
 * then refuse is worse than none.
 */
export async function liveWelcomeOffer(): Promise<WelcomeCouponSettings | null> {
  const s = await readWelcomeCouponSettings();
  if (!s.enabled) return null;
  if (!(await couponsEnabled())) return null;
  return s;
}

/**
 * A new subscriber's personal code, or null: the offer is off, this address
 * already got one (re-subscribing never mints another), or the write failed.
 * Never throws — the signup itself has already succeeded.
 */
export async function issueWelcomeCoupon(
  email: string,
): Promise<{ code: string; percent: number; endsAt: string } | null> {
  try {
    const offer = await liveWelcomeOffer();
    if (!offer) return null;
    const address = email.trim().toLowerCase();
    const { data: had, error: hadErr } = await supabaseAdmin
      .from("coupons")
      .select("id")
      .eq("allowed_email", address)
      .like("code", `${WELCOME_CODE_PREFIX}-%`)
      .limit(1);
    // Unsure whether one exists: give none rather than a second.
    if (hadErr || (had ?? []).length > 0) return null;

    const endsAt = new Date(Date.now() + offer.days * DAY).toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCouponCode(WELCOME_CODE_PREFIX);
      const { error } = await supabaseAdmin.from("coupons").insert({
        code,
        influencer_name: null,
        notes: "קופון הצטרפות לניוזלטר",
        discount_type: "percent",
        discount_value: offer.percent,
        free_shipping: false,
        min_order: null,
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        max_uses: 1,
        once_per_customer: true,
        commission_percent: null,
        scope: "all",
        category_ids: [],
        product_ids: [],
        // A welcome gift on top of a sale price would stack two discounts.
        apply_to_sale_items: false,
        allowed_email: address,
        is_active: true,
      });
      if (!error) return { code, percent: offer.percent, endsAt };
      if (error.code !== "23505") {
        console.error("[welcome-coupon] insert:", error);
        return null;
      }
    }
    return null;
  } catch (e) {
    console.error("[welcome-coupon] issue:", e);
    return null;
  }
}
