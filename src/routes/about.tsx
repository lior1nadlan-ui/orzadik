import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "אודות | אור זרוע לצדיק — תשמישי קדושה ויודאיקה" },
      {
        name: "description",
        content:
          "אור זרוע לצדיק - חנות תשמישי קדושה ויודאיקה מהודרת. סטי חלאקה, מארזים לחתנים, כיסויי טלית ותפילין, סידורים, גביעי קידוש, חנוכיות ומזוזות בכשרות מובחרת.",
      },
      { property: "og:title", content: "אודות | אור זרוע לצדיק" },
      { property: "og:description", content: "חנות תשמישי קדושה ויודאיקה מהודרת בכשרות מובחרת: חלאקה, מארזים לחתנים, טלית ותפילין, גביעי קידוש, חנוכיות ומזוזות." },
      { property: "og:url", content: "https://orzadik.com/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "אודות | אור זרוע לצדיק" },
      { name: "twitter:description", content: "חנות תשמישי קדושה ויודאיקה מהודרת בכשרות מובחרת." },
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
          about: { "@type": "Organization", name: "אור זרוע לצדיק", url: "https://orzadik.com/" },
        }),
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF6E9] via-background to-background">
        <div className="container mx-auto px-4 py-16 md:py-24 text-center max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-5" aria-hidden="true">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#D4AF37]/70" />
            <span className="text-[#A8862A] text-sm tracking-[0.4em]">✦</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#D4AF37]/70" />
          </div>
          <p className="text-[11px] tracking-[0.4em] uppercase text-[#A8862A] mb-4">
            אור זרוע לצדיק
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-5">
            תשמישי קדושה ויודאיקה<br />שמלווים את החיים היהודיים
          </h1>
          <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
            מבריתות וחלאקות, דרך בר מצוות וחתונות, ועד לרגעי השבת והחג בבית —
            אנחנו כאן עם מוצרים מהודרים, איכותיים ובכשרות מובחרת.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="container mx-auto px-4 py-14 max-w-3xl">
        <div className="prose prose-lg max-w-none text-foreground space-y-5 text-right leading-relaxed">
          <h2 className="font-display text-2xl md:text-3xl font-bold">הסיפור שלנו</h2>
          <p>
            <strong>אור זרוע לצדיק</strong> הוקמה מתוך אהבה אמיתית לתשמישי קדושה ולמסורת היהודית.
            ראינו את החשיבות של להחזיק בבית פריטים שמלווים את הרגעים הקדושים ביותר —
            כאלה שעוברים מדור לדור ונשמרים שנים רבות.
          </p>
          <p>
            הקטלוג שלנו מציע מבחר רחב במיוחד: סטי חלאקה לתלת-שנה, מארזים מפוארים לחתנים,
            כיסויי טלית ותפילין, סידורים מעוצבים, גביעי קידוש מכסף וקריסטל, חנוכיות,
            מזוזות, פמוטים, נטלות, מעמדי בנצ'ר וכל הדרוש לשולחן השבת ולחגי ישראל.
          </p>
          <p>
            כל פריט עובר ביקורת איכות קפדנית, וניתן לרכוש אצלנו גם עם
            <strong> רקמה אישית או חריטת לייזר</strong> בהתאמה לאירוע — ערך מוסף שהופך
            מוצר רגיל למתנה אישית ובלתי נשכחת.
          </p>
        </div>
      </section>

      {/* Values grid */}
      <section className="bg-cream/30 border-y border-border/40">
        <div className="container mx-auto px-4 py-14 max-w-5xl">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10">
            למה לקוחות בוחרים בנו
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                t: "כשרות מובחרת",
                d: "כל המוצרים מיוצרים בהקפדה על כשרות מהודרת בפיקוח רבני.",
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
                d: "חברות חינם בקלאב נותנת 5% הנחה נוספת על כל הזמנה.",
              },
              {
                t: "שירות אישי",
                d: "אנחנו זמינים בוואטסאפ, באימייל ובטלפון לכל שאלה או בקשה מיוחדת.",
              },
            ].map((it) => (
              <div
                key={it.t}
                className="rounded-xl border border-[#D4AF37]/30 bg-background p-5 shadow-[var(--shadow-card)]"
              >
                <div className="text-[#A8862A] text-lg mb-2" aria-hidden="true">✦</div>
                <h3 className="font-display text-lg font-bold mb-2">{it.t}</h3>
                <p className="text-sm text-foreground/80 leading-relaxed">{it.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
          בואו להתרשם מהמבחר
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          מעל 1,000 פריטים מוקפדים — מתנות לאירועים, רגעים של קדושה לבית
          וכל מה שצריך להידור מצווה.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/shop">
            <Button size="lg" className="bg-[#D4AF37] hover:bg-[#A8862A] text-white">
              לכל המוצרים
            </Button>
          </Link>
          <Link to="/categories">
            <Button size="lg" variant="outline">
              לפי קטגוריות
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
