import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  CatchBoundary,
  isNotFound,
  isRedirect,
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
import { AccessibilityWidget, applySavedA11ySettings } from "@/components/AccessibilityWidget";

// Origin of the Supabase project, for the preconnect/dns-prefetch hints below.
// Falls back to the current project ref so the hint is still correct if the
// build runs without VITE_SUPABASE_URL set.
const SUPABASE_ORIGIN =
  import.meta.env.VITE_SUPABASE_URL || "https://whtjslgrrfzehivrknuv.supabase.co";
import { BUSINESS } from "@/lib/business";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    // No `bg-background` here on purpose: the page ground (and its fixed light
    // mesh on body::before) is what the glass panel is supposed to float over.
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* `glass`, not `glass-strong`: these two panels sit on the known light
          page ground, where 72% white still holds --accent at 5.71:1. The
          stronger 94% pane is reserved for the fixed overlays, which float over
          arbitrary page content. */}
      <div className="glass w-full max-w-md p-8 text-center [--glass-radius:1.5rem]">
        {/* The code is decoration, not the heading — the sentence below is. */}
        <p className="font-display text-7xl font-bold text-accent" aria-hidden="true">404</p>
        <div className="gold-rule mx-auto mt-5 w-24" aria-hidden="true" />
        <h1 className="mt-5 text-xl font-semibold">העמוד לא נמצא</h1>
        <p className="mt-2 text-sm text-muted-foreground">העמוד שחיפשת לא קיים או הועבר.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="press inline-flex items-center justify-center rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
          >
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
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* `glass`, not `glass-strong`: these two panels sit on the known light
          page ground, where 72% white still holds --accent at 5.71:1. The
          stronger 94% pane is reserved for the fixed overlays, which float over
          arbitrary page content. */}
      <div className="glass w-full max-w-md p-8 text-center [--glass-radius:1.5rem]">
        <h1 className="text-xl font-semibold">משהו השתבש</h1>
        <div className="gold-rule mx-auto mt-4 w-16" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">אירעה שגיאה. אנא נסה שוב.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="press rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
          >
            נסה שוב
          </button>
          {/* Was `hover:bg-accent` with the inherited ink on top — since --accent
              is the dark gold #7E611E, that hover state put --foreground at
              3.06:1, a text failure that only appeared on hover. Neutral surface
              instead; the boundary uses --input (3.25:1), the control token. */}
          <a
            href="/"
            className="press rounded-full border border-input px-5 py-2.5 text-sm text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
          >
            בית
          </a>
        </div>
      </div>
    </div>
  );
}

// Branded error card for a CHILD-ROUTE throw, rendered INSIDE the persistent
// chrome (SiteHeader/SiteFooter stay mounted — see RouteErrorBoundary). Unlike
// the root `ErrorComponent` above (a bare full-screen shell for true shell
// failures), this keeps the shopper's navigation and offers both retry and a
// path home. min-h, not min-h-screen: it sits within <main>, between the header
// and footer, so it fills the content area without pushing the footer offscreen.
function LayoutErrorComponent({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="glass w-full max-w-md p-8 text-center [--glass-radius:1.5rem]">
        <h1 className="text-xl font-semibold">משהו השתבש</h1>
        <div className="gold-rule mx-auto mt-4 w-16" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">
          אירעה שגיאה בטעינת העמוד. אפשר לנסות שוב או לחזור לעמוד הבית.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="press rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
          >
            נסה שוב
          </button>
          {/* Client-side Link (not a hard <a> reload): the chrome is intact, so a
              SPA hop home is the right recovery. Navigating changes the pathname,
              which is the boundary's reset key, so the error clears on its own;
              onClick={reset} also covers a retry of the home route itself. Neutral
              --input surface mirrors the shell ErrorComponent's contrast note. */}
          <Link
            to="/"
            onClick={reset}
            className="press rounded-full border border-input px-5 py-2.5 text-sm text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
          >
            בית
          </Link>
        </div>
      </div>
    </div>
  );
}

// The child-route error boundary. Placed INSIDE RootComponent's <main> (around
// <Outlet/>) so a throw in any page component is caught HERE — a nearer ancestor
// than the root route's own CatchBoundary — leaving SiteHeader/SiteFooter mounted
// instead of blanking the whole site. Isolated into its own component so the
// location subscription (for the reset key) re-renders only this node, not the
// providers above. Keyed on pathname → a later navigation auto-clears the error.
// notFound/redirect signals are re-thrown so their dedicated boundaries still
// handle them (mirrors TanStack's own Match onCatch). SSR-safe: CatchBoundary is
// a class error boundary, valid during server render.
function RouteErrorBoundary() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <CatchBoundary
      getResetKey={() => pathname}
      errorComponent={LayoutErrorComponent}
      onCatch={(err) => {
        if (isNotFound(err) || isRedirect(err)) throw err;
        console.error("[layout-boundary]", err);
      }}
    >
      <Outlet />
    </CatchBoundary>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { name: "format-detection", content: "telephone=no" },
      // Browser UI chrome tint (Android address bar, installed-PWA splash).
      // Matches theme_color in /manifest.webmanifest and the deep-gold --accent.
      { name: "theme-color", content: "#7E611E" },
      // Global crawl directive. Without it Google caps every page to a tiny
      // thumbnail and the site is ineligible for Discover / large SERP images.
      // Private routes (auth/cart/checkout/account/order/track/favorites/admin)
      // each set their own { name: "robots", content: "noindex, nofollow" } and
      // that override WINS: HeadContent dedupes meta by `name`, iterating matches
      // leaf→root with first-seen winning, so the route-level robots is emitted
      // and this root default is skipped on those pages.
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      // Search-engine ownership verification — rendered only when a token is set
      // (fill in src/lib/business.ts). GSC unlocks sitemap submission + indexing.
      ...(BUSINESS.googleSiteVerification
        ? [{ name: "google-site-verification", content: BUSINESS.googleSiteVerification }]
        : []),
      ...(BUSINESS.bingSiteVerification
        ? [{ name: "msvalidate.01", content: BUSINESS.bingSiteVerification }]
        : []),
      { title: "אור זרוע לצדיק - תשמישי קדושה" },
      { name: "description", content: "חנות תשמישי קדושה - כלי כסף, כוסות קידוש, חנוכיות, נרתיקי מזוזה ועוד." },
      { property: "og:title", content: "אור זרוע לצדיק - תשמישי קדושה" },
      { name: "twitter:title", content: "אור זרוע לצדיק - תשמישי קדושה" },
      { property: "og:description", content: "חנות תשמישי קדושה - כלי כסף, כוסות קידוש, חנוכיות, נרתיקי מזוזה ועוד." },
      { name: "twitter:description", content: "חנות תשמישי קדושה - כלי כסף, כוסות קידוש, חנוכיות, נרתיקי מזוזה ועוד." },
      { property: "og:image", content: "https://orzadik.com/og-default.jpg" },
      // NOTE: no og:image:secure_url / :width / :height here on purpose. og:image
      // is already https, so secure_url is redundant. More importantly, product /
      // category / article routes override og:image with a per-item photo but
      // cannot re-declare these siblings (HeadContent dedupes by property, so a
      // root-level width/height/secure_url would stay glued to the per-item image
      // and mis-describe it — 1920×1080 and the generic banner instead of the
      // actual square product photo, which Facebook prefers via secure_url).
      // Declaring only og:image keeps every route's card correct.
      { property: "og:image:alt", content: "אור זרוע לצדיק — תשמישי קדושה ויודאיקה מהודרת" },
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
      // gtag.js is fetched from this origin on every page (see the GA snippet in
      // scripts below). Warm the TCP+TLS handshake early so analytics doesn't
      // add a cold round-trip after first paint.
      { rel: "preconnect", href: "https://www.googletagmanager.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
      // NOTE: no hreflang tags — the site is single-language (he-IL). Static
      // self-referential-to-homepage alternates on every page were incorrect
      // and conflicted with each page's own canonical, so they were removed.
      // Google Fonts as a REAL stylesheet link, discovered while the HTML is
      // parsed. Previously this was a preload + a script that appended the
      // stylesheet after parse: that kept first paint unblocked, but it pushed
      // FONT-FILE discovery behind the parser AND the script, so Assistant did
      // not land until ~1.9s. Loading it here cut LCP from 2092ms to 870ms on
      // the product template (measured, clean profile). Both origins are
      // preconnected above, so the discovery costs about one warm round-trip.
      //
      // display=swap is deliberate. The page's CLS 0.71 was initially blamed on
      // these fonts (Chrome's CLS-culprit heuristic attributes shifts to any
      // font that loaded nearby), so display=optional was tried — and measured
      // CLS again: still 0.7093, unchanged. The real cause was the empty
      // streaming <main> letting the footer paint inside the viewport; see the
      // note on <main> below. Since fonts were NOT the culprit, `optional` was
      // reverted: it would have cost first-visit brand typography (the fallback
      // sticks for the whole load) to fix nothing.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700&family=Noto+Serif+Hebrew:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      // PWA + icons. All same-origin (allowed under the CSP default-src 'self').
      // No apple-touch-icon: the only logo asset (/logo.png) is a landscape
      // 586×200, and iOS forces the home-screen icon into a square — a non-square
      // source is stretched/distorted, which harms the brand more than iOS's own
      // fallback. Re-add a <link rel="apple-touch-icon"> only once a real square
      // (180×180) PNG exists. The classic favicon stays .ico.
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
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
      // (The async font-stylesheet injector that used to live here was removed —
      // the stylesheet is now a plain <link> in `links` above so the font files
      // are discovered at parse time. See the note there: injecting it from JS
      // was the direct cause of a 0.71 CLS on the product template.)
      // ONE business, ONE node. This used to ship as TWO: Organization
      // (@id #organization) and Store (@id #store) — both asserting the same
      // name, the same url "https://orzadik.com/", and the same telephone,
      // email, logo, image, address and sameAs. They differed only in which
      // half of the facts each was given: Store held the storefront half (geo,
      // hasMap, priceRange, currenciesAccepted, paymentAccepted) and
      // Organization held the identity half (alternateName, founder,
      // vatID/taxID, knowsAbout, contactPoint, slogan) — plus a
      // `parentOrganization` edge from Store to Organization, which explicitly
      // declares an HQ→branch relationship for a business with exactly one shop.
      //
      // `url` and `name` are the two strongest keys a reconciliation engine
      // uses to bind a schema node to a web entity, so two distinct @ids
      // asserting an identical url + name + telephone + address is the textbook
      // shape of a DUPLICATED entity. Google will probably merge them, but
      // "probably merges" is not what you want on the one query where three of
      // the brand's own social profiles already outrank the store.
      //
      // The split also put the properties on the wrong side: `geo` lived on the
      // Store node, making Store the node most likely matched to the Google
      // Business Profile — and Store was precisely the node denied the Latin
      // transliteration, the founder, the taxID and knowsAbout, i.e. every
      // property that tells this shop apart from the Psalms 97:11 verse it is
      // named after and from the unrelated book seller at baiitmalesfarim.co.il.
      //
      // Store is a subtype of LocalBusiness, which is a subtype of Organization,
      // so multi-typing is lossless — every property below stays valid on the
      // merged node and it now carries the union of both sets. Nothing else in
      // the repo referenced #store (verified by grep over src/ and public/:
      // the only hit was its own former declaration), so retiring that @id
      // breaks no reference.
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["Organization", "Store"],
          "@id": "https://orzadik.com/#organization",
          name: "אור זרוע לצדיק",
          alternateName: ["Or Zarua LaTzadik", "אור זרוע לצדיק - תשמישי קדושה"],
          url: "https://orzadik.com/",
          logo: {
            "@type": "ImageObject",
            url: "https://orzadik.com/logo.png",
            width: 586,
            height: 200,
          },
          image: "https://orzadik.com/og-default.jpg",
          description:
            "חנות תשמישי קדושה ויודאיקה — טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות, מארזים לחתנים ותכשיטי זהב, עם אפשרות רקמה וחריטה אישית.",
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
            "כיסויי טלית ותפילין",
            "נרתיקי מזוזה",
            "גביעי קידוש וכלי כסף",
            "חנוכיות ופמוטים",
            "סידורים",
            "מארזים לחתנים ולבר מצווה",
            "רקמה וחריטה אישית",
          ],
          // sameAs asserts "this URL is an official identity of THIS entity".
          // The SERP for the brand query is led by the shop's OWN Instagram,
          // Facebook and TikTok, so sameAs is the one property that converts
          // those profiles from rivals for the brand name into corroboration
          // of it. Only two of them were declared here before.
          //
          // Every entry was verified live before being added — a URL that 404s
          // or belongs to someone else would be a false identity claim:
          //  • TikTok — confirmed through TikTok's own oEmbed endpoint, which
          //    returns author_name "אור זרוע לצדיק- תשמישי קדושה" for this
          //    handle. A plain GET is worthless as evidence here: TikTok's WAF
          //    answers 200 for handles that do not exist (a made-up control
          //    handle also returned 200, while its oEmbed returned 400).
          //  • easy.co.il — the business's own listing: same street address,
          //    same phone (0545818486), and it links out to exactly the
          //    Instagram and Facebook URLs already declared here.
          //  • Google Business Profile — see the hasMap note below for how the
          //    place URL was derived and checked.
          //
          // DELIBERATELY ABSENT: orzarua.co and ozl.co.il. sameAs carries no
          // directionality and no notion of preference, so listing ozl.co.il —
          // a live (HTTP 200), brand-titled shopfront this business does not
          // control — would declare it an official property of the entity and
          // legitimise the competitor rather than demote it. orzarua.co does
          // not resolve at all. Both make the entity graph worse, not better.
          //
          // ALSO DELIBERATELY ABSENT: the easy.co.il listing, even though it IS
          // genuinely this business's own and matches on street address and
          // phone. The cut is about CONTENT, not ownership: that listing files
          // the shop under the category "סופר סת\"ם" and its description offers
          // תפילין and ספרי תורה — a scribal trade this store does not practise,
          // and which the site's own FAQ denies in plain Hebrew. sameAs does not
          // merely link; it asserts official identity, which makes everything on
          // the far side owner-endorsed evidence about this entity. Declaring it
          // would ask Google to believe the false half too — on the exact query
          // where the brand is trying to establish what it actually is, and while
          // answer engines are already repeating the sofer-STaM claim back to
          // shoppers. Re-add it the moment the owner corrects the listing; that
          // correction is owner action #2, and this line is why it matters.
          sameAs: [
            "https://www.instagram.com/or_zarua_latzadik/",
            "https://www.facebook.com/profile.php?id=61576488921081",
            "https://www.tiktok.com/@or_zarua_latzadik",
            "https://maps.google.com/?cid=1527663379608737920",
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
          // ——— Storefront facts, merged in from the retired #store node ———
          geo: { "@type": "GeoCoordinates", latitude: 32.84216, longitude: 35.08877 },
          currenciesAccepted: "ILS",
          // Card only. The single checkout path in the codebase is the Cardcom
          // hosted card page (src/lib/cardcom.functions.ts); there is no
          // pay-on-delivery or over-the-counter flow anywhere in the app, so
          // the previous second value was dropped — structured data must not
          // advertise a payment method the store cannot actually accept.
          paymentAccepted: "Credit Card",
          priceRange: "₪₪",
          // NOTE: no `openingHoursSpecification` here on purpose. Nothing in the
          // codebase or the DB records the store's opening hours, and publishing
          // invented hours in structured data would be a business promise the
          // store never made — and would send real customers to a closed door.
          // Add it only once the owner supplies real hours.
          //
          // The canonical Google Business Profile place URL. It replaces a
          // "maps/search/?api=1&query=<address string>" URL, which asks Google
          // to RUN A SEARCH; this one NAMES THE PLACE, and so wires the site
          // directly to the Knowledge Graph entity that already exists for this
          // shop — the strongest disambiguation signal available in code.
          //
          // Derived and verified, not guessed. The business's easy.co.il
          // listing links its Google reviews to cid=1527663379608737920;
          // resolving that cid through Google's own Maps embed endpoint returns
          // name "אור זרוע לצדיק", address "דרך עכו 190, קריית ביאליק, 2723642",
          // phone "054-581-8486", coordinates [32.84216, 35.08877] — byte-equal
          // to the `geo` above and to the postalCode in `address` — plus KG id
          // /g/11xt21675j and category gcid:judaica_store. Five independent
          // fields match data already in this node, so this is the right place
          // and not a lookalike.
          hasMap: "https://maps.google.com/?cid=1527663379608737920",
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
      // (The separate #store node that used to sit here was merged into the
      // #organization node above — see the note there. Its storefront-only
      // properties moved across verbatim; everything else it declared was an
      // exact duplicate of the Organization node's own values.)
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Defer the two non-critical global widgets (WhatsApp FAB + Accessibility
  // panel) so they mount AFTER first paint instead of competing with hydration.
  // CookieConsent, GoogleAnalytics and MetaPixel stay immediate — consent and
  // analytics must run right away. SSR renders nothing for the deferred widgets;
  // this effect runs client-side only, so it is SSR-safe.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Restore a returning visitor's saved accessibility preferences (contrast,
    // larger text, stop-animations…) IMMEDIATELY — deferring the widget's UI
    // must not delay the actual page adaptation those users depend on.
    applySavedA11ySettings();

    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleHandle = w.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
    } else {
      timer = setTimeout(() => setIdle(true), 800);
    }
    return () => {
      if (idleHandle !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleHandle);
      }
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <div id="app-root" className="flex min-h-screen flex-col">
            {/* Skip link — the FIRST thing a keyboard user meets, so it is the
                one place gold may not be decorative. Was `bg-[#D4AF37]` with
                white text: 2.1:1, a straight Lighthouse failure. --accent
                (#7E611E) carries white at 5.81:1, and it follows the token, so
                high-contrast mode re-points it to #5c4300 (9.30:1) for free.
                Deliberately NOT animated: this is keyboard-initiated. */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:font-medium focus:text-accent-foreground"
            >
              דלג לתוכן המרכזי
            </a>
            {/* The header pins itself (sticky -top-9). No sticky wrapper here:
                sticky can't travel beyond its parent, so the header must sit
                directly in the full-height app root. */}
            <SiteHeader />
            {/* min-h-screen (not just flex-1) reserves the streaming window.
                The route content streams in AFTER the shell, so for ~750ms
                <main> is empty; with only `flex-1` the footer then sat exactly
                at the viewport bottom (measured: y=213 + height=519 = 732 = the
                full viewport) and was thrown offscreen the moment the content
                arrived. That single displacement scored 0.709 — essentially the
                whole of the product template's CLS 0.71, a Core Web Vitals
                failure across 4,600+ pages. Reserving a viewport here keeps the
                footer below the fold until real content defines the height, so
                the insertion shifts nothing visible. On pages whose content is
                taller than the viewport (the normal case) this is inert. */}
            <main id="main-content" tabIndex={-1} className="min-h-screen flex-1 scroll-mt-24 lg:scroll-mt-32">
              <RouteErrorBoundary />
            </main>
            <SiteFooter />
          </div>
          <Toaster position="top-center" richColors />
          <CookieConsent />
          <GoogleAnalytics />
          <MetaPixel />
          {/* Deferred to browser-idle after first paint (see the effect above). */}
          {idle && <WhatsAppButton />}
          {idle && <AccessibilityWidget />}
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
