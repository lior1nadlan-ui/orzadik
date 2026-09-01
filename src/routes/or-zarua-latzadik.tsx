import { createFileRoute, Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/business";

// The Hebrew brand query is a VERSE, and that is the whole problem this page
// exists to solve.
//
// "orzadik" is an invented token: nothing else on the internet competes for it,
// so the store ranks first without trying. "אור זרוע לצדיק" is תהילים צ״ז, יא —
// searched by people looking for the pasuk, the Yom Kippur custom, and the
// 13th-century halachic work that carries the name, and answered by sites with
// orders of magnitude more authority than a shop.
//
// A store's homepage cannot outrank scripture on a scripture query, and it
// should not: the searcher asking what the pasuk means is not asking for a
// tallit. What CAN rank is a page whose subject IS the phrase — which is what
// this is. It answers the pasuk question honestly and in full, and only then
// says that a shop in קרית ביאליק took the name. That is a page Google can
// place on the query without misleading anyone, and it is the one surface on
// the site that competes for the Hebrew name rather than for the category.
//
// EVERYTHING STATED HERE IS EITHER THE VERSE ITSELF OR A WIDELY DOCUMENTED
// CUSTOM. No commentary is quoted and none is invented; where a reading is one
// tradition among several, the page says so. A page that fabricates Torah to
// win a search result would deserve to lose it.
const CANONICAL = "https://orzadik.com/or-zarua-latzadik";
const TITLE = "אור זרוע לצדיק — פירוש הפסוק, מקורו, והשם שמאחורי החנות";
const DESCRIPTION =
  'אור זרוע לצדיק ולישרי לב שמחה (תהילים צ״ז, יא) — משמעות הפסוק, מקומו בפרק, אמירתו לפני כל נדרי ביום הכיפורים, וספר „אור זרוע". וגם: למה חנות תשמישי הקדושה בקרית ביאליק נקראת בשם הזה.';

export const Route = createFileRoute("/or-zarua-latzadik")({
  component: NamePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${CANONICAL}#webpage`,
          url: CANONICAL,
          name: TITLE,
          description: DESCRIPTION,
          inLanguage: "he-IL",
          isPartOf: { "@id": "https://orzadik.com/#website" },
          // `about` is the pasuk; `mentions` is the business. That order is the
          // honest one for this page and it is also what tells Google the page
          // is a real answer to the phrase rather than a storefront wearing it.
          about: {
            "@type": "CreativeWork",
            name: "תהילים צ״ז, יא — אור זרוע לצדיק ולישרי לב שמחה",
          },
          mentions: { "@id": "https://orzadik.com/#organization" },
          publisher: { "@id": "https://orzadik.com/#organization" },
        }),
      },
    ],
  }),
});

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-glass-line pt-8 first:border-0">
      <h2 className="font-display mb-4 text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
      <div className="space-y-4 leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

function NamePage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
      <p className="text-accent mb-4 text-[11px] tracking-[0.4em] uppercase">השם שלנו</p>
      <h1 className="font-display mb-6 text-3xl leading-tight font-bold text-foreground md:text-4xl">
        אור זרוע לצדיק — מקור הפסוק ומשמעותו
      </h1>

      {/* The pasuk itself, set apart. It is the reason anyone reaches this
          page, so it is the first thing on it rather than a paragraph in. */}
      <figure className="glass mb-10 px-6 py-8 text-center [--glass-radius:1.25rem] md:px-10">
        <blockquote className="font-display text-xl leading-relaxed text-foreground md:text-2xl">
          אוֹר זָרֻעַ לַצַּדִּיק וּלְיִשְׁרֵי־לֵב שִׂמְחָה
        </blockquote>
        <figcaption className="text-muted-foreground mt-4 text-sm">
          תהילים פרק צ״ז, פסוק י״א
        </figcaption>
      </figure>

      <div className="space-y-10">
        <Section id="pshat" title="פשט הפסוק">
          <p>
            הפסוק חותם כמעט את מזמור צ״ז בתהילים. הוא בנוי משני חלקים מקבילים: אור שנזרע לצדיק,
            ושמחה לישרי הלב. הצירוף „אור זרוע" נקרא על דרך הזריעה — אור שנטמן באדמה כמו זרע,
            ופירותיו עולים בבוא העת. זו קריאה שמחזיקה בתוכה גם ממד של זמן: הזורע אינו קוצר באותו
            יום.
          </p>
          <p>
            יש בכתבי־יד ובמסורות תרגום קדומות גרסה „אור <em>זרח</em> לצדיק", ומכאן שתי דרכי הבנה
            שהלכו זו לצד זו לאורך הדורות — אור שנזרע ומחכה, או אור שכבר זורח. שתיהן מובאות בפרשנות
            המסורתית, ואין כאן הכרעה בין קריאה לקריאה.
          </p>
        </Section>

        <Section id="perek" title="מקומו בפרק">
          <p>
            מזמור צ״ז הוא אחד ממזמורי המלכת ה׳ („ה׳ מלך תגל הארץ"), ונאמר בקבלת שבת. המזמור מתאר
            התגלות שכולה אש וענן ומשפט, ורק בסיומו הוא פונה אל האדם היחיד: לצדיק ולישרי הלב. הפסוק
            הזה הוא המעבר מן הנשגב אל האנושי — מה שיוצא מן ההתגלות הגדולה אל חייו של מי שמנסה לחיות
            בישרות.
          </p>
        </Section>

        <Section id="kol-nidrei" title="לפני כל נדרי">
          <p>
            במנהג אשכנז הפסוק נאמר בפתיחת ליל יום הכיפורים, לפני כל נדרי, יחד עם ההכרזה המתירה
            „להתפלל עם העבריינים". זהו ההקשר שבו רבים פוגשים אותו לראשונה: רגע שבו הקהילה כולה
            עומדת, כולל מי שהתרחק, ומכריזה שהאור זרוע — גם כשעדיין אינו נראה.
          </p>
        </Section>

        <Section id="sefer" title={'ספר „אור זרוע"'}>
          <p>
            „אור זרוע" הוא גם שמו של חיבור הלכה מרכזי מן המאה הי״ג, מאת רבי יצחק בן משה מווינה,
            מגדולי חכמי אשכנז, הנודע על שם ספרו. הספר נזכר רבות בספרות ההלכה, ולכן חיפוש הצירוף
            מוביל לא פעם אליו ולא אל הפסוק.
          </p>
        </Section>

        <Section id="hachanut" title="ולמה זה שם של חנות">
          <p>
            <strong>{BUSINESS.name}</strong> היא חנות תשמישי קדושה ויודאיקה ב{BUSINESS.address},
            בבעלות ליאור בן עמי. השם נבחר מן הפסוק הזה מפני שהוא מתאר בדיוק את מה שהחנות מוכרת:
            חפצים שנקנים היום ומלווים בית שנים ארוכות — טלית שנכנסת איתה חתן לחופה ויוצא בה לבית
            הכנסת עשרים שנה אחר כך, נרתיק מזוזה שנשאר על המשקוף, גביע קידוש שעובר הלאה. דבר שנזרע
            ופירותיו עולים בבוא העת.
          </p>
          <p>
            אם הגעתם לכאן בחיפוש אחר הפסוק — זה מה שיש לנו לומר עליו. אם הגעתם בחיפוש אחר החנות,{" "}
            <Link to="/shop" className="text-accent underline underline-offset-4">
              הקטלוג נמצא כאן
            </Link>
            , ואפשר לקרוא עוד{" "}
            <Link to="/about" className="text-accent underline underline-offset-4">
              על החנות ועל מי שעומד מאחוריה
            </Link>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
