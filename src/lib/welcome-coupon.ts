// The newsletter's welcome gift: a personal code for each new subscriber,
// switched on and sized in the CRM (/admin/coupons → "קופון הצטרפות").
//
// Why: the list had 2 subscribers on 15.11.2026 and no campaign had ever gone
// out. A small, honest reason to leave an address is the quickest way to build
// it. The code is personal (coupons.allowed_email), single-use, does not apply
// to items already on sale, and reaches the subscriber only in the welcome
// email, so owning the inbox is what earns it. Pure; the server side is
// welcome-coupon.server.ts.

/** site_settings key (jsonb {enabled, percent, days}). No row = off. */
export const WELCOME_COUPON_KEY = "welcome_coupon";
/** Every welcome code starts "WELCOME-": one per address, ever. */
export const WELCOME_CODE_PREFIX = "WELCOME";
export const WELCOME_PERCENT_MAX = 30;
export const WELCOME_DAYS_MAX = 180;

export type WelcomeCouponSettings = { enabled: boolean; percent: number; days: number };

export const WELCOME_COUPON_DEFAULTS: WelcomeCouponSettings = {
  enabled: false,
  percent: 10,
  days: 30,
};

const wholeIn = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/**
 * The stored setting, read tolerantly: anything missing or out of range falls
 * back to the default, and only a literal `true` turns the offer on, so a
 * damaged row can never start handing out codes by itself.
 */
export function parseWelcomeCouponSettings(v: unknown): WelcomeCouponSettings {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    enabled: o.enabled === true,
    percent: wholeIn(o.percent, 1, WELCOME_PERCENT_MAX) ?? WELCOME_COUPON_DEFAULTS.percent,
    days: wholeIn(o.days, 1, WELCOME_DAYS_MAX) ?? WELCOME_COUPON_DEFAULTS.days,
  };
}

/** Hebrew errors for the CRM form; empty when the values can be saved. */
export function welcomeCouponErrors(s: { percent: number; days: number }): string[] {
  const errors: string[] = [];
  if (wholeIn(s.percent, 1, WELCOME_PERCENT_MAX) == null) {
    errors.push(`אחוז ההנחה צריך להיות מספר שלם בין 1 ל-${WELCOME_PERCENT_MAX}.`);
  }
  if (wholeIn(s.days, 1, WELCOME_DAYS_MAX) == null) {
    errors.push(`התוקף צריך להיות בין 1 ל-${WELCOME_DAYS_MAX} ימים.`);
  }
  return errors;
}

export function isWelcomeCode(code: string | null | undefined): boolean {
  return String(code ?? "")
    .toUpperCase()
    .startsWith(`${WELCOME_CODE_PREFIX}-`);
}

/** What the signup form promises while the offer is on. */
export function welcomeOfferLine(percent: number): string {
  return `הצטרפו וקבלו ${percent}% הנחה על ההזמנה הבאה`;
}
