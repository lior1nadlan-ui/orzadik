// Central legal-identity + policy config for the business.
//
// Israeli Consumer Protection Law §4ב requires the seller's full name and
// company/business number (ח.פ / ע.מ) to be disclosed to the consumer (contact
// page, terms, order confirmation, invoice). Fill the OWNER-TODO fields with the
// real registered details — they render in the footer, terms, disclosures and
// order emails. Until filled, the UI shows a neutral fallback.

export const BUSINESS = {
  /** Registered/display name of the business. */
  name: "אור זרוע לצדיק",
  /** Legal entity type + registration number. */
  legalId: "עוסק מורשה 039553623",
  /** Full business address for consumer disclosure. */
  address: "דרך עכו 190, קרית ביאליק",
  /** Public contact phone (already used in structured data). */
  phone: "+972-54-581-8486",
  phoneDisplay: "054-581-8486",
  /** General contact email. */
  email: "orzarualachatz@gmail.com",
  /** WhatsApp number (digits only, international). */
  whatsapp: "972545818486",
  /** Privacy / data-protection contact. */
  privacyEmail: "privacy@orzadik.com",
  /** Accessibility coordinator contact. */
  accessibilityEmail: "accessibility@orzadik.com",
  site: "https://orzadik.com",
  /**
   * Search-engine verification tokens. Fill from Google Search Console
   * ("HTML tag" method) and Bing Webmaster Tools; the meta tag is only
   * rendered when a token is set. Empty = tag omitted.
   */
  googleSiteVerification: "",
  bingSiteVerification: "",
  /**
   * Google Analytics 4 Measurement ID (format "G-XXXXXXXXXX"), from the GA4
   * property's Data Stream. The gtag.js tag is only injected when this is set.
   * Empty = no analytics loaded (and no analytics cookies).
   */
  gaMeasurementId: "G-SNVN50FGWL",
  /**
   * Meta (Facebook/Instagram) Pixel ID — the ~15-digit numeric ID from Meta
   * Events Manager (Data Sources → Web → your Pixel → Settings). Powers the
   * Meta ad campaign: conversion optimization, retargeting, and Lookalike
   * audiences. Loaded consent-gated (marketing category) with Meta's consent
   * API — the tag loads on every page but sets NO ad cookies and fires NO
   * events until the visitor grants marketing consent. Empty = pixel omitted.
   */
  metaPixelId: "",
  /**
   * Google Ads conversion tracking. `googleAdsId` is the account conversion ID
   * ("AW-XXXXXXXXXX"); `googleAdsPurchaseLabel` is the conversion action's label
   * (the part after the slash in `send_to`). Both run through the SAME gtag.js
   * already loaded for GA4, so no extra tag is needed — the base just adds a
   * `config` for the Ads ID, and the order page fires the `conversion` event.
   * Consent Mode v2 (ad_storage/ad_user_data) gates the ad cookies. Empty =
   * Google Ads conversion tracking disabled.
   */
  googleAdsId: "AW-18319944861",
  googleAdsPurchaseLabel: "pjKcCKOC19AcEJ3Z0J9E",
} as const;

/**
 * Human-readable Hebrew labels for the order-status enum. The tokens mirror the
 * real status values driven from /admin (admin.orders.tsx `STATUSES`) and shown
 * raw on /account — pending/processing/shipped/completed/cancelled/refunded —
 * plus `paid` (the payment milestone surfaced on the account/order screens) so a
 * single map covers every status a page may render. Reuse via `orderStatusHe()`.
 */
export const ORDER_STATUS_LABELS_HE: Record<string, string> = {
  pending: "ממתינה",
  processing: "בטיפול",
  paid: "שולם",
  shipped: "נשלחה",
  completed: "הושלמה",
  cancelled: "בוטלה",
  refunded: "זוכתה",
};

/** Hebrew label for an order status, falling back to the raw token if unknown. */
export function orderStatusHe(s: string): string {
  return ORDER_STATUS_LABELS_HE[s] ?? s;
}

/**
 * Single source of truth for the "last updated" date shown on the three legal
 * pages (terms / privacy / accessibility). Currently hardcoded in each as
 * "עודכן לאחרונה: 26.6.2026" — point all three at this constant instead.
 */
export const LEGAL_LAST_UPDATED = "26.6.2026";

/** Consumer-law policy constants (Consumer Protection Law §14ג–§14ה). */
export const CONSUMER_POLICY = {
  /** Cancellation window for distance-selling of goods: 14 days from receipt. */
  cancellationDays: 14,
  /** Refund must be issued within this many days of a valid cancellation. */
  refundDays: 14,
  /** Cancellation fee cap: the LOWER of this percent of the order, or the flat cap. */
  cancellationFeePct: 5,
  cancellationFeeCapIls: 100,
  /** Estimated delivery window shown pre-purchase (business days). */
  deliveryMinDays: 3,
  deliveryMaxDays: 7,
} as const;

/** Human-readable seller-identity line for disclosures/emails (§4ב). */
export function sellerIdentityLine(): string {
  const parts: string[] = [BUSINESS.name];
  if (BUSINESS.legalId) parts.push(BUSINESS.legalId);
  if (BUSINESS.address) parts.push(BUSINESS.address);
  parts.push(`טל' ${BUSINESS.phoneDisplay}`);
  return parts.join(" · ");
}

/** Compute the maximum lawful cancellation fee for an order total (§14ה). */
export function cancellationFee(orderTotal: number): number {
  const pct = Math.round((orderTotal * CONSUMER_POLICY.cancellationFeePct) / 100);
  return Math.min(pct, CONSUMER_POLICY.cancellationFeeCapIls);
}
