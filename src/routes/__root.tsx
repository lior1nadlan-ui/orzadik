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
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AccessibilityWidget } from "@/components/AccessibilityWidget";
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
      { rel: "preconnect", href: "https://kekspqdnhnivojivrwvy.supabase.co", crossOrigin: "" },
      { rel: "dns-prefetch", href: "https://kekspqdnhnivojivrwvy.supabase.co" },
      // NOTE: no hreflang tags — the site is single-language (he-IL). Static
      // self-referential-to-homepage alternates on every page were incorrect
      // and conflicted with each page's own canonical, so they were removed.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&family=Noto+Serif+Hebrew:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://orzadik.com/#organization",
          name: "אור זרוע לצדיק",
          alternateName: "Or Zarua LaTzadik",
          url: "https://orzadik.com/",
          logo: "https://orzadik.com/logo.png",
          image: "https://orzadik.com/og-default.jpg",
          description:
            "חנות תשמישי קדושה ויודאיקה — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, מארזים לחתנים ותכשיטי זהב.",
          telephone: "+972-54-581-8486",
          sameAs: ["https://www.instagram.com/or_zarua_latzadik/"],
          areaServed: { "@type": "Country", name: "IL" },
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+972-54-581-8486",
            contactType: "customer service",
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
          logo: "https://orzadik.com/logo.png",
          image: "https://orzadik.com/og-default.jpg",
          description:
            "חנות תשמישי קדושה ויודאיקה — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות ומארזים לחתנים.",
          telephone: "+972-54-581-8486",
          email: "orzarualachatz@gmail.com",
          currenciesAccepted: "ILS",
          paymentAccepted: "Cash, Credit Card",
          priceRange: "₪₪",
          areaServed: { "@type": "Country", name: "IL" },
          hasMap: "https://orzadik.com/",
          sameAs: ["https://www.instagram.com/or_zarua_latzadik/"],
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
          <WhatsAppButton />
          <AccessibilityWidget />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
