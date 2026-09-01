import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { BUSINESS, GOOGLE_PLACE_URL, OPENING_HOURS, openingHoursLabel } from "@/lib/business";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "אודות | אור זרוע לצדיק — תשמישי קדושה ויודאיקה" },
      {
        name: "description",
        content:
          "אור זרוע לצדיק - חנות תשמישי קדושה ויודאיקה מהודרת. סטי חלאקה, מארזים לחתנים, כיסויי טלית ותפילין, סידורים, גביעי קידוש, חנוכיות ונרתיקי מזוזה — נבחרים בהקפדה על כשרות והידור.",
      },
      { property: "og:title", content: "אודות | אור זרוע לצדיק" },
      {
        property: "og:description",
        content:
          "חנות תשמישי קדושה ויודאיקה מהודרת: חלאקה, מארזים לחתנים, כיסויי טלית ותפילין, גביעי קידוש, חנוכיות ונרתיקי מזוזה — נבחרים בהקפדה על כשרות והידור.",
      },
      { property: "og:url", content: "https://orzadik.com/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "אודות | אור זרוע לצדיק" },
      {
        name: "twitter:description",
        content: "חנות תשמישי קדושה ויודאיקה מהודרת — נבחרים בהקפדה על כשרות והידור.",
      },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/about" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          // Given an @id so this page is a first-class, addressable node in the
          // graph rather than an anonymous one — matching ContactPage, which
          // already carries …/contact#contactpage.
          "@id": "https://orzadik.com/about#aboutpage",
          name: "אודות | אור זרוע לצדיק",
          url: "https://orzadik.com/about",
          inLanguage: "he-IL",
          description:
            "על אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה מהודרת בבעלות ליאור בן עמי מקרית ביאליק, עם רקמה וחריטה אישית ומשלוח עד הבית בישראל.",
          isPartOf: { "@id": "https://orzadik.com/#website" },
          // `about` — and DELIBERATELY not `mainEntity`. The two are not
          // synonyms: `about` states the subject matter, while `mainEntity` is
          // documented as the inverse of Thing.mainEntityOfPage and so asserts
          // "this is THE page this entity lives on" — an exclusive claim that
          // only one URL can usefully make.
          //
          // This page used to assert both, and the homepage asserted neither
          // beyond `about`, so the brand's actual home made a strictly WEAKER
          // machine-readable claim than a secondary page — with /contact making
          // the same exclusive claim as a third rival. Three pages naming
          // themselves the entity's page is three answers to a one-answer
          // question, which is worth less than one page naming itself once.
          //
          // Which page wins is not a preference, it is already fixed by the
          // graph: the Organization node in __root.tsx publishes
          // `url: "https://orzadik.com/"`. Keeping mainEntity here would leave
          // the entity's own `url` pointing at / while the inverse of this
          // property pointed at /about — the same one-@id, two-answers
          // contradiction contact.tsx was repaired for below. So the claim now
          // lives on / (see the long note in index.tsx) and this node states
          // what is true and sufficient here: an AboutPage that is `about` the
          // organization already reads as "the about-page OF this business"
          // without also claiming to be its home.
          //
          // All three references are BARE @ids; the full node ships on this page
          // from __root.tsx and must not be restated here (restating it on
          // /contact is what produced two conflicting `url` values for one @id —
          // see the note in contact.tsx).
          about: { "@id": "https://orzadik.com/#organization" },
          publisher: { "@id": "https://orzadik.com/#organization" },
        }),
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div>
      {/* Hero — no band, no wash. The page's light mesh is the ground; the
          section only holds air and a hairline ornament. */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-16 md:py-24 text-center max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-5" aria-hidden="true">
            <span className="gold-rule w-12" />
            <span className="text-gold text-sm tracking-[0.4em]">✦</span>
            <span className="gold-rule w-12" />
          </div>
          {/* The brand name belongs in THIS h1. /about exists to answer "what
              is this business", and it is the page bound to #organization via
              AboutPage.about — yet its h1 named only the category
              ("תשמישי קדושה ויודאיקה שמלווים את החיים היהודיים") and left the
              brand to a decorative eyebrow, so NO h1 anywhere on the site
              contained "אור זרוע לצדיק". The competing shopfront the brand
              query loses to is titled with the brand name outright.

              This is a different trade from the homepage h1, which was made
              deliberately brand-free in the Pane of Light redesign for UX
              reasons — that decision stands and is NOT reversed here. /about
              carries no such constraint and its h1 was generic anyway.

              The eyebrow now names the page rather than the brand (it would
              otherwise just repeat the h1), matching the <title> and the
              eyebrow pattern on /contact. No copy is discarded: the previous
              h1 sentence opens the lede below, and every term in the new h1 is
              already published on the page (the shop, the category, and
              "מקרית ביאליק" in the story section) — nothing new is claimed. */}
          <p className="text-[11px] tracking-[0.4em] uppercase text-accent mb-4">אודות החנות</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-5 text-foreground">
            אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה בקרית ביאליק
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            תשמישי קדושה ויודאיקה שמלווים את החיים היהודיים — מבריתות וחלאקות, דרך בר מצוות וחתונות,
            ועד לרגעי השבת והחג בבית. אנחנו כאן עם מוצרים מהודרים ואיכותיים, נבחרים בקפידה.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="container mx-auto px-4 pb-14 max-w-3xl">
        <div className="glass max-w-none space-y-5 px-6 py-10 md:px-12 md:py-12 text-right text-foreground leading-relaxed [--glass-radius:1.25rem]">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            הסיפור שלנו
          </h2>
          <p>
            <strong>אור זרוע לצדיק</strong> הוקמה מתוך אהבה אמיתית לתשמישי קדושה ולמסורת היהודית.
            ראינו את החשיבות של להחזיק בבית פריטים שמלווים את הרגעים הקדושים ביותר — כאלה שעוברים
            מדור לדור ונשמרים שנים רבות.
          </p>
          <p>
            שם החנות, <strong>„אור זרוע לצדיק"</strong>, נלקח מן הפסוק בספר תהילים (פרק צ״ז, פס׳
            יא): „אוֹר זָרֻעַ לַצַּדִּיק וּלְיִשְׁרֵי־לֵב שִׂמְחָה" — והוא מבטא את רוח החנות: להביא
            אור, הידור וקדושה אל תוך הבית היהודי.{" "}
            <Link to="/or-zarua-latzadik" className="text-accent underline underline-offset-4">
              על מקור הפסוק ומשמעותו הרחבנו בעמוד נפרד
            </Link>
            .
          </p>
          <p>
            הקטלוג שלנו מציע מבחר רחב במיוחד: סטי חלאקה לתלת-שנה, מארזים מפוארים לחתנים, כיסויי טלית
            ותפילין, סידורים מעוצבים, גביעי קידוש מכסף וקריסטל, חנוכיות, נרתיקי מזוזה, פמוטים,
            נטלות, מעמדי בנצ'ר וכל הדרוש לשולחן השבת ולחגי ישראל.
          </p>
          <p>
            הפריטים נבחרים בהקפדה על כשרות והידור, וניתן לרכוש אצלנו גם עם
            <strong> רקמה אישית או חריטת לייזר</strong> בהתאמה לאירוע — ערך מוסף שהופך מוצר רגיל
            למתנה אישית ובלתי נשכחת.
          </p>
          <p className="text-base text-muted-foreground">
            החנות בבעלות <strong className="text-foreground">ליאור בן עמי</strong> ופועלת מקרית
            ביאליק (דרך עכו 190). אפשר ליצור איתנו קשר בטלפון{" "}
            <a
              href="tel:+972545818486"
              className="text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
            >
              054-581-8486
            </a>
            , בוואטסאפ או במייל — נשמח לסייע בבחירה ובהתאמה אישית.
          </p>
        </div>
      </section>

      {/* The physical shop. /about is the page bound to #organization, and it
          was the page most likely to be read by someone deciding whether this is
          a real business — yet it said "פועלת מקרית ביאליק (דרך עכו 190)" in
          running prose and stopped there. The address was a sentence, the hours
          existed only inside __root.tsx's JSON-LD, and GOOGLE_PLACE_URL — the
          shop's own record on Google's map, and the ONLY third-party proof this
          business has — was referenced nowhere a human could click.

          Every line below is checkable. Hours read from OPENING_HOURS, the same
          constant the Store node emits, so the visible table and the structured
          data are one fact. NO rating and NO review count: the 6 Google reviews
          are real but they are Google's, and marking them up as aggregateRating
          would be a review claim the site is not entitled to make. The link
          sends the reader to read them at the source instead.

          OWNER TODO — the empty frame below is a slot for a PHOTOGRAPH OF THE
          ACTUAL SHOPFRONT at דרך עכו 190. It is the single highest-value asset
          missing from this page: a picture of the real place does more for a
          stranger's confidence than any sentence here. Drop the file in
          public/ and replace the placeholder div with an <img> (keep width/
          height so it reserves its box). Until that photo exists the frame
          renders as a labelled, honest empty state rather than a stock image of
          somebody else's shop. */}
      <section className="container mx-auto px-4 pb-14 max-w-3xl">
        <div className="glass px-6 py-8 md:px-12 md:py-10 [--glass-radius:1.25rem]">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-5">
            החנות עצמה
          </h2>

          <div className="grid gap-8 md:grid-cols-2 md:items-start">
            <div>
              <p className="text-foreground leading-relaxed">
                {BUSINESS.name} · {BUSINESS.legalId}
              </p>
              <p className="mt-1 text-muted-foreground leading-relaxed">{BUSINESS.address}</p>

              <h3 className="font-display text-lg text-foreground mt-6 mb-3">שעות פתיחה</h3>
              {/* ASCII hyphen in every range — see openingHoursLabel. */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {OPENING_HOURS.map((h) => (
                  <div key={h.he} className="contents">
                    <dt className="text-foreground">{h.he}</dt>
                    <dd>{openingHoursLabel(h)}</dd>
                  </div>
                ))}
                <dt className="text-foreground">שבת</dt>
                <dd>סגור</dd>
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                <a
                  href={GOOGLE_PLACE_URL}
                  target="_blank"
                  rel="noopener"
                  className="inline-block py-1.5 -my-1.5 text-sm text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                >
                  הפרופיל שלנו בגוגל מפות
                </a>
                <a
                  href={`tel:${BUSINESS.phone}`}
                  className="inline-block py-1.5 -my-1.5 text-sm text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                >
                  {BUSINESS.phoneDisplay}
                </a>
              </div>
            </div>

            {/* Photo slot — see the OWNER TODO above. */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-secondary hairline flex items-center justify-center">
              <p className="px-6 text-center text-sm text-muted-foreground leading-relaxed">
                תמונה של החנות בדרך עכו 190 תתווסף כאן בקרוב.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values grid */}
      <section className="border-y border-glass-line">
        <div className="container mx-auto px-4 py-14 max-w-5xl">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10 text-foreground">
            הערכים שלנו
          </h2>
          {/* Deliberately NOT .stagger here — same reasoning as categories.tsx.
              `.stagger > *` runs orz-reveal with `both` fill, and that keyframe
              ends on `transform: none`. A filled animation keeps applying at the
              animation cascade origin, which outranks normal author rules, so
              every card would stay pinned to `transform: none` and the
              .glass-lift hover raise would silently stop working once the reveal
              finished (leaving only a shadow flicker). The ongoing hover
              feedback is worth more than a one-shot entrance. */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                // A selection claim, not a manufacturing claim: the previous
                // wording ("כל המוצרים מיוצרים בהקפדה על כשרות מהודרת בפיקוח
                // רבני") covered ~4,600 SKUs including candlesticks and gold
                // jewelry, for which rabbinic manufacturing supervision is not a
                // meaningful statement. Kept in step with the homepage FAQ.
                t: "בחירה מוקפדת",
                d: "אנו בוחרים כל פריט בהקפדה על איכות והידור. לפרטים על ההכשר של פריט מסוים — צרו קשר ונשמח לסייע.",
              },
              {
                t: "איכות פרימיום",
                d: "חומרים נבחרים, גימור מוקפד ועיצוב נדיב — לפריטים שנשמרים לשנים.",
              },
              {
                t: "התאמה אישית",
                d: "רקמת שם, חריטת לייזר ומסרים אישיים על המארזים והכיסויים.",
              },
              {
                t: "משלוח עד הבית",
                d: "משלוח לכל הארץ בתוך 3-14 ימי עסקים, באריזה מוגנת.",
              },
              {
                t: "מועדון לקוחות",
                d: "החברות במועדון הלקוחות חינמית ומעניקה מעקב הזמנות באזור האישי והטבות לחברי מועדון.",
              },
              {
                t: "שירות אישי",
                d: "אנחנו זמינים בוואטסאפ, באימייל ובטלפון לכל שאלה או בקשה מיוחדת.",
              },
            ].map((it) => (
              <div key={it.t} className="glass glass-lift h-full p-5">
                <div className="text-gold text-lg mb-2" aria-hidden="true">
                  ✦
                </div>
                <h3 className="font-display text-lg font-bold mb-2 text-foreground">{it.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{it.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* טעימה מהקטלוג — מוצרים אחרונים */}
      <FeaturedProductsCarousel />

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-4 text-foreground">
          בואו להתרשם מהמבחר
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          מעל 4,500 פריטים מוקפדים — מתנות לאירועים, רגעים של קדושה לבית וכל מה שצריך להידור מצווה.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/shop" className="press inline-block">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
            >
              לכל המוצרים
            </Button>
          </Link>
          <Link to="/categories" className="press inline-block">
            <Button size="lg" variant="outline">
              לפי קטגוריות
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
