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
} as const;

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
