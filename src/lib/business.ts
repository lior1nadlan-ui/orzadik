// Central legal-identity + policy config for the business.
//
// Israeli Consumer Protection Law §4ב requires the seller's full name and
// company/business number (ח.פ / ע.מ) to be disclosed to the consumer (contact
// page, terms, order confirmation, invoice). Fill the OWNER-TODO fields with the
// real registered details — they render in the footer, terms, disclosures and
// order emails. Until filled, the UI shows a neutral fallback.

/**
 * The brand's owned public profiles — ONE list, consumed by both the
 * Organization node's `sameAs` in __root.tsx and the visible footer row.
 *
 * They have to come from the same place because `sameAs` is only as strong as
 * its reciprocity: it asserts "this URL is an official identity of this
 * entity", and a crawler weighs that far more heavily when the site visibly
 * links to the profile and the profile links back. Before this list existed,
 * `sameAs` declared four properties while the site linked to exactly one of
 * them (Instagram) — so Facebook and TikTok were claimed and corroborated by
 * nothing, which is the weakest form of the assertion.
 *
 * That matters here more than on a typical shop: on the brand-store query these
 * very profiles rank ABOVE the store, so binding them to the entity is what
 * turns them from rivals for the brand name into evidence for it.
 *
 * Every entry was verified live on 2026-08-02 before being trusted. Deliberately
 * NOT listed: orzarua.co and ozl.co.il (old shopfronts the owner cannot access —
 * declaring them official would legitimise a competitor), and the easy.co.il
 * listing (genuinely the shop's, but it advertises סופר סת"ם work the store does
 * not do; re-add once the owner corrects it).
 */
export const SOCIAL_PROFILES = [
  { label: "אינסטגרם", url: "https://www.instagram.com/or_zarua_latzadik/" },
  { label: "פייסבוק", url: "https://www.facebook.com/profile.php?id=61576488921081" },
  { label: "טיקטוק", url: "https://www.tiktok.com/@or_zarua_latzadik" },
] as const;

/** The Google Business Profile place URL. Separate from SOCIAL_PROFILES because
 *  it is an entity record rather than a profile a shopper would "follow" — it
 *  belongs in `sameAs` and in `hasMap`, not in the footer's follow row.
 *
 *  It is ALSO the only third-party proof this business has that a shopper can
 *  check: a real place, on Google's own map, with reviews Google collected.
 *  Until 2026-08-03 it was referenced in exactly one place in the whole
 *  codebase — __root.tsx's `hasMap` — i.e. it was visible to crawlers and to
 *  nobody else. It is now rendered on / and /about as a link a human can
 *  follow.
 *
 *  ⚠️ Linking the profile is honest. Marking its 6 reviews up as
 *  `aggregateRating` is NOT, and must stay out: Google permits review markup
 *  only for reviews the site itself collects. The first-party review system
 *  already in this codebase is the honest route to a rating. */
export const GOOGLE_PLACE_URL = "https://maps.google.com/?cid=1527663379608737920";

/**
 * Shop opening hours — ONE list, consumed by the Store node's
 * `openingHoursSpecification` in __root.tsx AND by the visible hours on / and
 * /about. They have to come from the same place for the reason the long note in
 * __root.tsx spells out: three different public sources disagreed about these
 * hours, publishing the wrong ones sends a real customer to a closed door, and a
 * visible table that could drift from the structured data would recreate exactly
 * that failure inside our own codebase.
 *
 * Read on 2026-08-03 from the shop's OWN Google Business Profile panel (the
 * record Google itself serves for this business), parsed twice, byte-identical
 * both times. Saturday is deliberately absent: in schema.org a day missing from
 * openingHoursSpecification is closed, which is correct for a Judaica shop on
 * Shabbat and is what the profile says.
 *
 * `days` are schema.org DayOfWeek tokens; `he` is the Hebrew label for the
 * visible row. Ranges are written with an ASCII hyphen, never U+2013 — an en
 * dash has bidi class ON and visually REVERSES a numeric range in RTL.
 */
export const OPENING_HOURS = [
  { days: ["Sunday", "Monday", "Tuesday"], he: "ראשון - שלישי", opens: "09:30", closes: "14:00" },
  { days: ["Wednesday", "Thursday"], he: "רביעי - חמישי", opens: "09:30", closes: "12:00" },
  {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    he: "ראשון - חמישי (אחר הצהריים)",
    opens: "16:00",
    closes: "19:00",
  },
  { days: ["Friday"], he: "שישי", opens: "09:30", closes: "12:00" },
] as const;

/** The visible "09:30 - 14:00" label for an hours row. ASCII hyphen only. */
export function openingHoursLabel(row: { opens: string; closes: string }): string {
  return `${row.opens} - ${row.closes}`;
}

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
  // ⚠️ DO NOT SHIP THIS FILE UNTIL CLOUDFLARE EMAIL ROUTING IS LIVE ON
  // orzadik.com AND ALL THREE ADDRESSES BELOW HAVE BEEN TESTED BY SENDING REAL
  // MAIL TO THEM. Publishing an address the domain cannot receive is the exact
  // defect this replaces — see the history note below.
  //
  // All three are published to customers: `email` in the header, /contact,
  // /shipping, /returns and in the seller-identity line at the foot of every
  // order confirmation, abandoned-cart reminder, review request and campaign
  // (Consumer Protection Law §4ב requires the seller's contact details there).
  // The other two are STATUTORY routes — the privacy contact (חוק הגנת הפרטיות)
  // and the accessibility coordinator (תקנות שוויון זכויות / ת"י 5568) — named
  // in /privacy, /terms and /accessibility, where the accessibility statement
  // promises a response within 30 days.
  //
  // HISTORY, so nobody repeats it: these first pointed at privacy@ and
  // accessibility@orzadik.com while **orzadik.com had no MX record**, so both
  // silently bounced — a statutory contact route that could not receive mail at
  // all. They were then pointed at orzarualachatz@gmail.com, which does receive,
  // but which the owner does not read. Both failure modes are invisible from the
  // outside: mail leaves the customer's outbox and nothing comes back.
  //
  // Now on the domain, via Cloudflare Email Routing forwarding to the owner's
  // own inbox. That keeps the owner's personal address off the site, survives a
  // change of personal mailbox without a code change, and adds the MX record
  // whose absence was a spam signal on every order confirmation the shop sends.

  /** General contact email. Routed to the owner's inbox. */
  email: "info@orzadik.com",
  /** WhatsApp number (digits only, international). */
  whatsapp: "972545818486",
  /** Privacy / data-protection contact. Routed to the owner's inbox. */
  privacyEmail: "privacy@orzadik.com",
  /** Accessibility coordinator contact. Routed to the owner's inbox. */
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
  // payment_status values that the CardCom webhook can write but that had no Hebrew
  // label, so any screen rendering them fell through to the raw English token:
  //   `failed`          — the charge was declined, or our own amount/currency
  //                       integrity check refused to mark the order paid.
  //   `pending_charge`  — a CreateTokenOnly authorisation: the card is tokenised
  //                       but NOT captured. Reachable only if CardCom_Operation is
  //                       ever switched off ChargeOnly; the label exists so the
  //                       state is legible the moment it appears.
  failed: "התשלום נכשל",
  pending_charge: "ממתינה לחיוב",
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
// Bumped when /privacy §5 (the holders list) and §14 (jurisdiction) were
// substantively amended. §13 tells the reader "תאריך העדכון האחרון מצוין בראש
// המדיניות", so leaving it stale makes the page assert something false about
// itself. Shared by /privacy, /terms and /accessibility — moving all three is
// correct here, since /terms §11 binds the privacy policy in as part of the
// same agreement and its jurisdiction clause changed in the same pass.
export const LEGAL_LAST_UPDATED = "1.8.2026";

/** Consumer-law policy constants (Consumer Protection Law §14ג–§14ה). */
export const CONSUMER_POLICY = {
  /** Cancellation window for distance-selling of goods: 14 days from receipt. */
  cancellationDays: 14,
  /** Refund must be issued within this many days of a valid cancellation. */
  refundDays: 14,
  /** Cancellation fee cap: the LOWER of this percent of the order, or the flat cap. */
  cancellationFeePct: 5,
  cancellationFeeCapIls: 100,
  /** Estimated delivery window shown pre-purchase (business days). Must match the
   *  site-wide "3-14 ימי עסקים" claim (terms.tsx §6, llms.txt, product/cart/track,
   *  category-faq, TrustBadges) so no surface can ever publish a window the store
   *  does not honor. */
  deliveryMinDays: 3,
  deliveryMaxDays: 14,
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
