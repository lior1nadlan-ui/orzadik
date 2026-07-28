import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";

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
      { property: "og:description", content: "חנות תשמישי קדושה ויודאיקה מהודרת: חלאקה, מארזים לחתנים, כיסויי טלית ותפילין, גביעי קידוש, חנוכיות ונרתיקי מזוזה — נבחרים בהקפדה על כשרות והידור." },
      { property: "og:url", content: "https://orzadik.com/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "אודות | אור זרוע לצדיק" },
      { name: "twitter:description", content: "חנות תשמישי קדושה ויודאיקה מהודרת — נבחרים בהקפדה על כשרות והידור." },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/about" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "אודות | אור זרוע לצדיק",
          url: "https://orzadik.com/about",
          inLanguage: "he-IL",
          description:
            "על אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה מהודרת בבעלות ליאור בן עמי מקרית ביאליק, עם רקמה וחריטה אישית ומשלוח עד הבית בישראל.",
          isPartOf: { "@id": "https://orzadik.com/#website" },
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
          <p className="text-[11px] tracking-[0.4em] uppercase text-accent mb-4">
            אור זרוע לצדיק
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-5 text-foreground">
            תשמישי קדושה ויודאיקה שמלווים את החיים היהודיים
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            מבריתות וחלאקות, דרך בר מצוות וחתונות, ועד לרגעי השבת והחג בבית —
            אנחנו כאן עם מוצרים מהודרים ואיכותיים, נבחרים בקפידה.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="container mx-auto px-4 pb-14 max-w-3xl">
        <div className="glass max-w-none space-y-5 px-6 py-10 md:px-12 md:py-12 text-right text-foreground leading-relaxed [--glass-radius:1.25rem]">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">הסיפור שלנו</h2>
          <p>
            <strong>אור זרוע לצדיק</strong> הוקמה מתוך אהבה אמיתית לתשמישי קדושה ולמסורת היהודית.
            ראינו את החשיבות של להחזיק בבית פריטים שמלווים את הרגעים הקדושים ביותר —
            כאלה שעוברים מדור לדור ונשמרים שנים רבות.
          </p>
          <p>
            שם החנות, <strong>„אור זרוע לצדיק"</strong>, נלקח מן הפסוק בספר תהילים (פרק צ״ז, פס׳ יא):
            „אוֹר זָרֻעַ לַצַּדִּיק וּלְיִשְׁרֵי־לֵב שִׂמְחָה" — והוא מבטא את רוח החנות: להביא אור,
            הידור וקדושה אל תוך הבית היהודי.
          </p>
          <p>
            הקטלוג שלנו מציע מבחר רחב במיוחד: סטי חלאקה לתלת-שנה, מארזים מפוארים לחתנים,
            כיסויי טלית ותפילין, סידורים מעוצבים, גביעי קידוש מכסף וקריסטל, חנוכיות,
            נרתיקי מזוזה, פמוטים, נטלות, מעמדי בנצ'ר וכל הדרוש לשולחן השבת ולחגי ישראל.
          </p>
          <p>
            הפריטים נבחרים בהקפדה על כשרות והידור, וניתן לרכוש אצלנו גם עם
            <strong> רקמה אישית או חריטת לייזר</strong> בהתאמה לאירוע — ערך מוסף שהופך
            מוצר רגיל למתנה אישית ובלתי נשכחת.
          </p>
          <p className="text-base text-muted-foreground">
            החנות בבעלות <strong className="text-foreground">ליאור בן עמי</strong> ופועלת מקרית ביאליק (דרך עכו 190).
            אפשר ליצור איתנו קשר בטלפון{" "}
            <a
              href="tel:+972545818486"
              className="text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
            >
              054-581-8486
            </a>,
            בוואטסאפ או במייל — נשמח לסייע בבחירה ובהתאמה אישית.
          </p>
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
                d: "משלוח לכל הארץ בתוך 3–14 ימי עסקים, באריזה מוגנת.",
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
                <div className="text-gold text-lg mb-2" aria-hidden="true">✦</div>
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
          מעל 4,500 פריטים מוקפדים — מתנות לאירועים, רגעים של קדושה לבית
          וכל מה שצריך להידור מצווה.
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
