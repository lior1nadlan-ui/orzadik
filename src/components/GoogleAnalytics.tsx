import { useEffect } from "react";
import { readCookieConsent } from "@/components/CookieConsent";
import { BUSINESS } from "@/lib/business";

const GA_ID = BUSINESS.gaMeasurementId;

let loaded = false;

/**
 * Inject gtag.js + initialize GA4 exactly once. Called only after the visitor
 * has granted analytics consent (see the privacy policy §7: analytics cookies
 * fire only after consent). GA4 anonymizes IPs by default.
 */
function loadGa() {
  if (loaded || !GA_ID || typeof window === "undefined") return;
  loaded = true;
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", GA_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

/**
 * Consent-gated Google Analytics loader. Renders nothing. Loads GA4 only when
 * the stored cookie consent has `analytics: true`, and also reacts to the user
 * changing their choice later via the cookie banner. Never loads before consent.
 */
export function GoogleAnalytics() {
  useEffect(() => {
    if (!GA_ID) return;
    if (readCookieConsent()?.analytics) loadGa();
    const onChange = () => {
      if (readCookieConsent()?.analytics) loadGa();
    };
    window.addEventListener("ozl:cookie-consent-changed", onChange);
    return () => window.removeEventListener("ozl:cookie-consent-changed", onChange);
  }, []);
  return null;
}
