import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { CookieConsent } from "@/components/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MetaPixel } from "@/components/MetaPixel";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AccessibilityWidget } from "@/components/AccessibilityWidget";

// Origin of the Supabase project, for the preconnect/dns-prefetch hints below.
// Falls back to the current project ref so the hint is still correct if the
// build runs without VITE_SUPABASE_URL set.
const SUPABASE_ORIGIN =
  import.meta.env.VITE_SUPABASE_URL || "https://whtjslgrrfzehivrknuv.supabase.co";
import { BUSINESS } from "@/lib/business";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary font-display">404</h1>
        <h2 className="mt-4 text-xl font-semibold">העמוד לא נמצא</h2>
        <p className="mt-2 text-sm text-muted-foreground">העמוד שחיפשת לא קיים או הועבר.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            חזרה לעמוד הבית
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">משהו השתבש</h1>
        <p className="mt-2 text-sm text-muted-foreground">אירעה שגיאה. אנא נסה שוב.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            נסה שוב
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">בית</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { name: "format-detection", content: "telephone=no" },
      // Search-engine ownership verification — rendered only when a token is set
      // (fill in src/lib/business.ts). GSC unlocks sitemap submission + indexing.
      ...(BUSINESS.googleSiteVerification
        ? [{ name: "google-site-verification", content: BUSINESS.googleSiteVerification }]
        : []),
      ...(BUSINESS.bingSiteVerification
        ? [{ name: "msvalidate.01", content: BUSINESS.bingSiteVerification }]
        : []),
      { title: "אור זרוע לצדיק - תשמישי קדושה" },
      { name: "description", content: "חנות תשמישי קדושה - כלי כסף, כוסות קידוש, חנוכיות, מזוזות ועוד." },
      { property: "og:title", content: "אור זרוע לצדיק - תשמישי קדושה" },
      { name: "twitter:title", content: "אור זרוע לצדיק - תשמישי קדושה" },
      { property: "og:description", content: "חנות תשמישי קדושה - כלי כסף, כוסות קידוש, חנוכיות, מזוזות ועוד." },
      { name: "twitter:description", content: "חנות תשמישי קדושה - כלי כסף, כוסות קידוש, חנוכיות, מזוזות ועוד." },
      { property: "og:image", content: "https://orzadik.com/og-default.jpg" },
      { name: "twitter:image", content: "https://orzadik.com/og-default.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "אור זרוע לצדיק" },
      { property: "og:url", content: "https://orzadik.com/" },
      { property: "og:locale", content: "he_IL" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      // Supabase serves product images + data — warm the connection early (LCP).
      // Derived from the same env the client uses: this was hardcoded to the
      // old project ref and silently kept preconnecting to a dead host after
      // the migration, warming the wrong origin and wasting the LCP hint.
      { rel: "preconnect", href: SUPABASE_ORIGIN, crossOrigin: "" },
      { rel: "dns-prefetch", href: SUPABASE_ORIGIN },
      // NOTE: no hreflang tags — the site is single-language (he-IL). Static
      // self-referential-to-homepage alternates on every page were incorrect
      // and conflicted with each page's own canonical, so they were removed.
      // Google Fonts preloaded + injected async (script below) so the external
      // round-trip does NOT block first paint. display=swap keeps text visible
      // in a fallback face until the web fonts arrive.
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700&family=Noto+Serif+Hebrew:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      // Google Analytics 4 with Consent Mode v2. gtag.js loads on every page, but
      // the consent DEFAULT is "denied" so NO analytics/ad storage (cookies) is set
      // until the visitor grants consent — the default is seeded from the stored
      // choice so returning consenters aren't reset. GoogleAnalytics.tsx flips it to
      // "granted" via `consent update` when the cookie banner choice changes.
      ...(BUSINESS.gaMeasurementId
        ? [
            {
              children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}var _c=null;try{_c=JSON.parse(localStorage.getItem("cookie-consent-v2"));}catch(e){}gtag("consent","default",{analytics_storage:_c&&_c.analytics?"granted":"denied",ad_storage:_c&&_c.marketing?"granted":"denied",ad_user_data:_c&&_c.marketing?"granted":"denied",ad_personalization:_c&&_c.marketing?"granted":"denied",wait_for_update:500});gtag("js",new Date());gtag("config","${BUSINESS.gaMeasurementId}");${BUSINESS.googleAdsId ? `gtag("config","${BUSINESS.googleAdsId}");` : ""}`,
            },
            {
              src: `https://www.googletagmanager.com/gtag/js?id=${BUSINESS.gaMeasurementId}`,
              async: true,
            },
          ]
        : []),
      // Meta (Facebook/Instagram) Pixel with consent gating. fbevents.js loads on
      // every page, but `fbq('consent', ...)` is set to "revoke" by default (seeded
      // from the stored choice) so NO ad cookies are written and NO events fire
      // until the visitor grants marketing consent — MetaPixel.tsx flips it to
      // "grant" via `fbq('consent','grant')` when the cookie banner choice changes.
      ...(BUSINESS.metaPixelId
        ? [
            {
              children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");var _fc=null;try{_fc=JSON.parse(localStorage.getItem("cookie-consent-v2"));}catch(e){}fbq("consent",_fc&&_fc.marketing?"grant":"revoke");fbq("init","${BUSINESS.metaPixelId}");fbq("track","PageView");`,
            },
          ]
        : []),
      {
        // Load Google Fonts without blocking first paint: append the stylesheet
        // after the document parses. The <link rel="preload" as="style"> above
        // warms the fetch so the swap is instant.
        children:
          '(function(){var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700&family=Noto+Serif+Hebrew:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;600&display=swap";document.head.appendChild(l);})();',
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://orzadik.com/#organization",
          name: "אור זרוע לצדיק",
          alternateName: ["Or Zarua LaTzadik", "אור זרוע לצדיק - תשמישי קדושה"],
          url: "https://orzadik.com/",
          logo: {
            "@type": "ImageObject",
            url: "https://orzadik.com/logo.png",
            width: 512,
            height: 512,
          },
          image: "https://orzadik.com/og-default.jpg",
          description:
            "חנות תשמישי קדושה ויודאיקה — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, מארזים לחתנים ותכשיטי זהב, עם אפשרות רקמה וחריטה אישית.",
          slogan: "אור זרוע לצדיק — תשמישי קדושה ויודאיקה מהודרת בהתאמה אישית",
          telephone: "+972-54-581-8486",
          email: "orzarualachatz@gmail.com",
          address: {
            "@type": "PostalAddress",
            streetAddress: "דרך עכו 190",
            addressLocality: "קרית ביאליק",
            addressRegion: "מחוז חיפה",
            postalCode: "2723642",
            addressCountry: "IL",
          },
          founder: { "@type": "Person", name: "ליאור בן עמי" },
          vatID: "039553623",
          taxID: "039553623",
          knowsAbout: [
            "תשמישי קדושה",
            "יודאיקה",
            "טליתות וציציות",
            "תפילין וכיסויים",
            "מזוזות",
            "גביעי קידוש וכלי כסף",
            "חנוכיות ופמוטים",
            "סידורים",
            "מארזים לחתנים ולבר מצווה",
            "רקמה וחריטה אישית",
          ],
          sameAs: [
            "https://www.instagram.com/or_zarua_latzadik/",
            "https://www.facebook.com/profile.php?id=61576488921081",
          ],
          areaServed: { "@type": "Country", name: "IL" },
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+972-54-581-8486",
            email: "orzarualachatz@gmail.com",
            contactType: "customer service",
            areaServed: "IL",
            availableLanguage: ["he"],
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": "https://orzadik.com/#website",
          url: "https://orzadik.com/",
          name: "אור זרוע לצדיק",
          inLanguage: "he-IL",
          publisher: { "@id": "https://orzadik.com/#organization" },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://orzadik.com/shop?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Store",
          "@id": "https://orzadik.com/#store",
          name: "אור זרוע לצדיק",
          url: "https://orzadik.com/",
          logo: {
            "@type": "ImageObject",
            url: "https://orzadik.com/logo.png",
            width: 512,
            height: 512,
          },
          image: "https://orzadik.com/og-default.jpg",
          description:
            "חנות תשמישי קדושה ויודאיקה — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות ומארזים לחתנים.",
          telephone: "+972-54-581-8486",
          email: "orzarualachatz@gmail.com",
          address: {
            "@type": "PostalAddress",
            streetAddress: "דרך עכו 190",
            addressLocality: "קרית ביאליק",
            addressRegion: "מחוז חיפה",
            postalCode: "2723642",
            addressCountry: "IL",
          },
          geo: { "@type": "GeoCoordinates", latitude: 32.84216, longitude: 35.08877 },
          currenciesAccepted: "ILS",
          paymentAccepted: "Cash, Credit Card",
          priceRange: "₪₪",
          areaServed: { "@type": "Country", name: "IL" },
          hasMap: "https://www.google.com/maps/search/?api=1&query=%D7%93%D7%A8%D7%9A+%D7%A2%D7%9B%D7%95+190+%D7%A7%D7%A8%D7%99%D7%AA+%D7%91%D7%99%D7%90%D7%9C%D7%99%D7%A7",
          sameAs: [
            "https://www.instagram.com/or_zarua_latzadik/",
            "https://www.facebook.com/profile.php?id=61576488921081",
          ],
          parentOrganization: { "@id": "https://orzadik.com/#organization" },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SalePromoBar() {
  return (
    <div
      className="w-full text-center text-[13px] md:text-sm font-semibold tracking-wide py-2 px-3"
      style={{
        background: "linear-gradient(90deg, #E8C76B 0%, #D4AF37 50%, #A8862A 100%)",
        color: "#1a1a1a",
      }}
      role="region"
      aria-label="מבצע מיוחד"
    >
      ✨ מבצע השקת אתר | 15% הנחה על כל האתר — ההנחה חלה אוטומטית בעגלה ✨
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <div id="app-root" className="flex min-h-screen flex-col">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-50 focus:rounded-md focus:bg-[#D4AF37] focus:px-4 focus:py-2 focus:text-white"
            >
              דלג לתוכן המרכזי
            </a>
            <div className="sticky top-0 z-40">
              <SalePromoBar />
              <SiteHeader />
            </div>
            <main id="main-content" tabIndex={-1} className="flex-1">
              <Outlet />
            </main>
            <SiteFooter />
          </div>
          <Toaster position="top-center" richColors />
          <CookieConsent />
          <GoogleAnalytics />
          <MetaPixel />
          <WhatsAppButton />
          <AccessibilityWidget />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
