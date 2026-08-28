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
          'צרו קשר עם אור זרוע לצדיק — טופס פנייה באתר, טלפון, וואטסאפ, דוא"ל וכתובת. נשמח לעזור בבירורים, בהזמנות מיוחדות ובכל שאלה על תשמישי הקדושה שלנו.',
      },
      { property: "og:title", content: "צור קשר | אור זרוע לצדיק" },
      {
        property: "og:description",
        content:
          'דרכי יצירת קשר עם אור זרוע לצדיק — טופס פנייה, טלפון, וואטסאפ, דוא"ל וכתובת בקרית ביאליק.',
      },
      { property: "og:url", content: "https://orzadik.com/contact" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "צור קשר | אור זרוע לצדיק" },
      {
        name: "twitter:description",
        content:
          'דרכי יצירת קשר עם אור זרוע לצדיק — טופס פנייה, טלפון, וואטסאפ, דוא"ל וכתובת בקרית ביאליק.',
      },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/contact" }],
    // ContactPage node. `about` and `publisher` point at the canonical
    // Organization emitted site-wide from __root.tsx by BARE @id reference —
    // they do not restate its properties. (`mainEntity` was also here; it is
    // gone now, for a different reason — see the note at the property list.)
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
            'דרכי יצירת קשר עם אור זרוע לצדיק — טלפון, וואטסאפ, דוא"ל וכתובת בקרית ביאליק, לבירורים, הזמנות מיוחדות והתאמות אישיות.',
          isPartOf: { "@id": "https://orzadik.com/#website" },
          about: { "@id": "https://orzadik.com/#organization" },
          publisher: { "@id": "https://orzadik.com/#organization" },
          // `mainEntity` DELIBERATELY absent — see the matching notes in
          // index.tsx and about.tsx. It is documented as the inverse of
          // Thing.mainEntityOfPage, so it is an EXCLUSIVE claim: "this is THE
          // page this entity lives on". Only one URL can usefully make it, and
          // which one is not a judgement call — the Organization node in
          // __root.tsx publishes `url: "https://orzadik.com/"`, so the homepage
          // is the page the entity itself names. Three pages asserting it (as /,
          // /about and /contact briefly did) is three answers to a one-answer
          // question, which is the same one-@id-two-answers contradiction this
          // very file was repaired for when it used to re-declare #organization
          // inline with a conflicting url and a shorter address.
          // `about` + `publisher` already say everything true here: this page is
          // ABOUT the business and is PUBLISHED by it. It is not where the
          // business lives.
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
        <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase mb-3">
          צור קשר
        </p>
        <h1 className="font-display text-3xl md:text-5xl tracking-wide text-foreground">
          צרו איתנו קשר
        </h1>
        <div className="gold-rule mx-auto mt-5 w-24" aria-hidden="true" />
        <p className="mt-5 mx-auto max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          נשמח לעמוד לרשותכם בכל שאלה על המוצרים, בבקשות להתאמה אישית (רקמה או חריטה), בהזמנות
          מיוחדות ובכל בירור. בחרו את הדרך הנוחה לכם — ונחזור אליכם בהקדם.
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
            {/* The shop's real hours, from its own Google Business Profile (read
                2026-08-03), replacing a generic "09:00-17:00 phone hours" line
                that was a THIRD answer competing with the Business Profile and
                the easy.co.il listing. Google cross-checks a business's hours
                across its listings when deciding how confident it is that they
                describe one business, so three answers actively weakened the
                entity. These are also the hours now published in
                openingHoursSpecification on the Organization node — the visible
                text and the structured data have to agree or the markup is
                describing a page that does not say that.
                Wednesday and Thursday genuinely differ from Sunday-Tuesday
                (morning ends at 12:00), which is why they are listed separately
                rather than collapsed into one tidy range. */}
            <p className="font-medium">שעות פתיחת החנות</p>
            <p className="mt-1 text-muted-foreground">
              ראשון-שלישי: 9:30-14:00 ו-16:00-19:00 · רביעי-חמישי: 9:30-12:00 ו-16:00-19:00 · שישי:
              9:30-12:00 · שבת: סגור.
            </p>
            <p className="mt-3 font-medium">זמני מענה</p>
            <p className="mt-1 text-muted-foreground">
              נשתדל להשיב לכל פנייה בהקדם, בדרך כלל תוך יום עסקים אחד. המענה הטלפוני זמין בשעות
              פתיחת החנות (למעט ערבי חג וחגים). לפניות בדוא"ל ובוואטסאפ ניתן לכתוב בכל שעה ונחזור
              אליכם בשעות הפעילות.
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
              ניתן לבטל עסקה בכתב עד {CONSUMER_POLICY.cancellationDays} ימים ממועד קבלת המוצר, בהתאם
              לחוק הגנת הצרכן — בהודעה בדוא"ל{" "}
              <a
                href={`mailto:${BUSINESS.email}`}
                className="inline-block py-1.5 -my-1.5 text-accent underline underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                {BUSINESS.email}
              </a>{" "}
              או דרך אחת מדרכי הקשר שלמעלה. לפרטים המלאים על זכות הביטול, דמי הביטול, ההחזרים
              והחריגים (כגון פריטים שהותאמו אישית) — ראו את{" "}
              <Link
                to="/terms"
                className="inline-block py-1.5 -my-1.5 text-accent underline underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
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
    <a href={href} {...externalProps} className="glass glass-lift flex items-start gap-4 p-5">
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
