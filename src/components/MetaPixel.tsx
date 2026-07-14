import { useEffect } from "react";
import { readCookieConsent } from "@/components/CookieConsent";
import { BUSINESS } from "@/lib/business";

const PIXEL_ID = BUSINESS.metaPixelId;

/**
 * Meta (Facebook/Instagram) Pixel consent bridge.
 *
 * fbevents.js and the consent DEFAULT ("revoke", seeded from the stored choice)
 * are set in the SSR <head> (see __root.tsx) so the pixel loads on every page
 * without writing any ad cookies before consent. This component pushes an
 * `fbq('consent','grant'|'revoke')` whenever the visitor changes their
 * cookie-banner choice — granting marketing consent immediately unlocks the
 * pixel (and releases the queued PageView), revoking it turns it back off.
 * Gated on the same `marketing` category as other ad tags. Renders nothing.
 */
export function MetaPixel() {
  useEffect(() => {
    if (!PIXEL_ID) return;
    const applyConsent = () => {
      const w = window as unknown as { fbq?: (...args: unknown[]) => void };
      if (typeof w.fbq !== "function") return;
      const c = readCookieConsent();
      w.fbq("consent", c?.marketing ? "grant" : "revoke");
    };
    applyConsent();
    window.addEventListener("ozl:cookie-consent-changed", applyConsent);
    return () => window.removeEventListener("ozl:cookie-consent-changed", applyConsent);
  }, []);
  return null;
}
