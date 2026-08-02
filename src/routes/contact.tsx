import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageCircle, Mail, MapPin, Clock, RotateCcw } from "lucide-react";
import { BUSINESS, CONSUMER_POLICY, sellerIdentityLine } from "@/lib/business";
import { ContactForm } from "@/components/ContactForm";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "צור קשר | אור זרוע לצדיק" },
      {
        name: "description",
        content:
          "צרו קשר עם אור זרוע לצדיק — טופס פנייה באתר, טלפון, וואטסאפ, דוא\"ל וכתובת. נשמח לעזור בבירורים, בהזמנות מיוחדות ובכל שאלה על תשמישי הקדושה שלנו.",
      },
      { property: "og:title", content: "צור קשר | אור זרוע לצדיק" },
      {
        property: "og:description",
        content:
          "דרכי יצירת קשר עם אור זרוע לצדיק — טופס פנייה, טלפון, וואטסאפ, דוא\"ל וכתובת בקרית ביאליק.",
      },
      { property: "og:url", content: "https://orzadik.com/contact" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "צור קשר | אור זרוע לצדיק" },
      {
        name: "twitter:description",
        content:
          "דרכי יצירת קשר עם אור זרוע לצדיק — טופס פנייה, טלפון, וואטסאפ, דוא\"ל וכתובת בקרית ביאליק.",
      },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/contact" }],
    // ContactPage node. `about`, `publisher` and `mainEntity` all point at the
    // canonical Organization emitted site-wide from __root.tsx by BARE @id
    // reference — they do not restate its properties.
    //
    // They used to. `mainEntity` re-declared @id …/#organization inline with
    // url: BUSINESS.site, which is "https://orzadik.com" (no trailing slash),
    // while the root node on this very same page says "https://orzadik.com/" —
    // and it restated a PostalAddress carrying only streetAddress /
    // addressLocality / addressCountry, dropping the addressRegion and
    // postalCode the root node publishes. Any consumer that merges by @id (the
    // entire point of using @id) therefore built one entity holding two `url`
    // values and two contradictory addresses, from a single document. `url` is
    // a top-tier reconciliation key and NAP consistency is the primary local
    // signal, so the page whose whole job is to state the name-address-phone
    // was the one page contradicting itself about it.
    //
    // Referencing instead of restating loses nothing — the full node already
    // ships on this page from the root route — and it is the pattern the
    // AboutPage node and the article/product templates already use correctly
    // for isPartOf, publisher and seller.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "@id": "https://orzadik.com/contact#contactpage",
          name: "צור קשר | אור זרוע לצדיק",
          url: "https://orzadik.com/contact",
          inLanguage: "he-IL",
          description:
            "דרכי יצירת קשר עם אור זרוע לצדיק — טלפון, וואטסאפ, דוא\"ל וכתובת בקרית ביאליק, לבירורים, הזמנות מיוחדות והתאמות אישיות.",
          isPartOf: { "@id": "https://orzadik.com/#website" },
          about: { "@id": "https://orzadik.com/#organization" },
          publisher: { "@id": "https://orzadik.com/#organization" },
          mainEntity: { "@id": "https://orzadik.com/#organization" },
        }),
      },
    ],
  }),
});

// Neutral, no-marketing prefill for the WhatsApp deep link.
const WA_TEXT = "שלום, הגעתי מהאתר ואשמח לקבל פרטים.";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.address)}`;

function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
      <header className="mb-10 md:mb-14 text-center">
        <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase mb-3">צור קשר</p>
        <h1 className="font-display text-3xl md:text-5xl tracking-wide text-foreground">צרו איתנו קשר</h1>
        <div className="gold-rule mx-auto mt-5 w-24" aria-hidden="true" />
        <p className="mt-5 mx-auto max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          נשמח לעמוד לרשותכם בכל שאלה על המוצרים, בבקשות להתאמה אישית (רקמה או חריטה),
          בהזמנות מיוחדות ובכל בירור. בחרו את הדרך הנוחה לכם — ונחזור אליכם בהקדם.
        </p>
      </header>

      {/* Contact methods — each card is the actionable link itself. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ContactCard
          href={`tel:${BUSINESS.phone}`}
          icon={<Phone className="h-5 w-5" aria-hidden="true" />}
          label="טלפון"
          value={BUSINESS.phoneDisplay}
        />
        <ContactCard
          href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(WA_TEXT)}`}
          external
          icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
          label="וואטסאפ"
          value={BUSINESS.phoneDisplay}
        />
        <ContactCard
          href={`mailto:${BUSINESS.email}`}
          icon={<Mail className="h-5 w-5" aria-hidden="true" />}
          label='דוא"ל'
          value={BUSINESS.email}
        />
        <ContactCard
          href={MAPS_URL}
          external
          icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
          label="כתובת"
          value={BUSINESS.address}
          valueSuffix="פתח במפה ‹"
        />
      </div>

      {/* On-site form — the fourth channel, added so a visitor who is not ready
          to call does not have to leave the site to ask a question. */}
      <ContactForm />

      {/* Response time + hours — an honest expectation, not a guarantee. */}
      <section className="glass mt-6 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="text-[15px] leading-relaxed text-foreground">
            <p className="font-medium">זמני מענה</p>
            <p className="mt-1 text-muted-foreground">
              נשתדל להשיב לכל פנייה בהקדם, בדרך כלל תוך יום עסקים אחד.
              שעות המענה הטלפוני: ימים א'-ה', 09:00-17:00 (למעט ערבי חג וחגים).
              לפניות בדוא"ל ובוואטסאפ ניתן לכתוב בכל שעה ונחזור אליכם בשעות הפעילות.
            </p>
          </div>
        </div>
      </section>

      {/* Cancellation / returns — the canonical explanation lives in the terms. */}
      <section className="glass mt-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="text-[15px] leading-relaxed text-foreground">
            <p className="font-medium">כיצד לבטל או להחזיר הזמנה</p>
            <p className="mt-1 text-muted-foreground">
              ניתן לבטל עסקה בכתב עד {CONSUMER_POLICY.cancellationDays} ימים ממועד קבלת המוצר,
              בהתאם לחוק הגנת הצרכן — בהודעה בדוא"ל{" "}
              <a
                href={`mailto:${BUSINESS.email}`}
                className="text-accent underline underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                {BUSINESS.email}
              </a>{" "}
              או דרך אחת מדרכי הקשר שלמעלה. לפרטים המלאים על זכות הביטול, דמי הביטול, ההחזרים
              והחריגים (כגון פריטים שהותאמו אישית) — ראו את{" "}
              <Link
                to="/terms"
                className="text-accent underline underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                התקנון ותנאי השימוש
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Seller identity disclosure (חוק הגנת הצרכן §4ב). */}
      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        {sellerIdentityLine()}
      </p>
    </div>
  );
}

/* A single contact method, rendered as the tap target itself. `external` links
   open in a new tab with a safe rel; internal protocol links (tel/mailto) do
   not. Hover lift restates the glass shadow and is pointer- + motion-gated. */
function ContactCard({
  href,
  icon,
  label,
  value,
  valueSuffix,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  valueSuffix?: string;
  external?: boolean;
}) {
  const externalProps = external ? { target: "_blank", rel: "noreferrer noopener" } : {};
  return (
    <a
      href={href}
      {...externalProps}
      className="glass glass-lift flex items-start gap-4 p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs tracking-wide text-muted-foreground">{label}</span>
        {/* dir="auto": phone/email resolve LTR, the Hebrew address resolves RTL. */}
        <span className="mt-0.5 block break-words font-medium text-foreground" dir="auto">
          {value}
        </span>
        {valueSuffix && <span className="mt-0.5 block text-xs text-accent">{valueSuffix}</span>}
      </span>
    </a>
  );
}
