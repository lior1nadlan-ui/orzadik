import { useEffect } from "react";
import { readCookieConsent } from "@/components/CookieConsent";
import { BUSINESS } from "@/lib/business";

const GA_ID = BUSINESS.gaMeasurementId;

/**
 * Google Consent Mode v2 bridge.
 *
 * gtag.js and the consent DEFAULT ("denied", seeded from the stored choice) are
 * set in the SSR <head> (see __root.tsx) so the tag loads on every page without
 * writing any analytics/ad storage before consent. This component pushes a
 * `consent update` whenever the visitor changes their cookie-banner choice, so
 * granting analytics/marketing consent immediately unlocks GA storage — and
 * revoking it turns storage back off. Renders nothing.
 */
export function GoogleAnalytics() {
  useEffect(() => {
    if (!GA_ID) return;
    const applyConsent = () => {
      const w = window as unknown as { gtag?: (...args: unknown[]) => void };
      if (typeof w.gtag !== "function") return;
      const c = readCookieConsent();
      w.gtag("consent", "update", {
        analytics_storage: c?.analytics ? "granted" : "denied",
        ad_storage: c?.marketing ? "granted" : "denied",
        ad_user_data: c?.marketing ? "granted" : "denied",
        ad_personalization: c?.marketing ? "granted" : "denied",
      });
    };
    applyConsent();
    window.addEventListener("ozl:cookie-consent-changed", applyConsent);
    return () => window.removeEventListener("ozl:cookie-consent-changed", applyConsent);
  }, []);
  return null;
}
