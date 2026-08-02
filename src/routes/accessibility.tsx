import { createFileRoute, Link } from "@tanstack/react-router";
import { BUSINESS, LEGAL_LAST_UPDATED } from "@/lib/business";

// Stable anchor ids for each section, single-sourced here so the table of
// contents and the section headings can never drift: the TOC renders from this
// list, and <Section> looks its own id up by matching its title against it.
const SECTIONS: { id: string; title: string }[] = [
  { id: "mechuyavut", title: "1. המחויבות שלנו לנגישות" },
  { id: "basis", title: "2. בסיס חוקי" },
  { id: "rama", title: "3. רמת הנגישות באתר" },
  { id: "hataamot", title: "4. התאמות הנגישות שבוצעו באתר" },
  { id: "kelim", title: "5. דרכי שימוש בכלי הנגישות בדפדפן ובמערכת ההפעלה" },
  { id: "migbalot", title: "6. מגבלות נגישות ידועות" },
  { id: "fizit", title: "7. הסדרי נגישות פיזית בסניפי החברה" },
  { id: "rakaz", title: "8. פרטי רכז הנגישות" },
  { id: "nohal", title: "9. נוהל טיפול בפניות נגישות" },
  { id: "idkun", title: "10. עדכון ההצהרה" },
];

export const Route = createFileRoute("/accessibility")({
  component: AccessibilityPage,
  head: () => ({
    meta: [
      { title: "הצהרת נגישות | אור זרוע לצדיק" },
      { name: "description", content: "הצהרת הנגישות המלאה של אתר אור זרוע לצדיק לפי ת״י 5568 ברמת AA ו-WCAG 2.1 — התאמות, מגבלות ופרטי רכז נגישות." },
      { property: "og:url", content: "https://orzadik.com/accessibility" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/accessibility" }],
  }),
});

function AccessibilityPage() {
  return (
    <article className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
      <header className="mb-10 md:mb-14 text-center">
        <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase mb-3">נגישות</p>
        <h1 className="font-display text-3xl md:text-5xl tracking-wide text-foreground">הצהרת נגישות</h1>
        <div className="gold-rule mx-auto mt-5 w-24" aria-hidden="true" />
        <p className="glass mt-5 inline-block px-4 py-1.5 text-xs text-muted-foreground [--glass-radius:9999px]">
          עודכן לאחרונה: {LEGAL_LAST_UPDATED}
        </p>
      </header>

      {/* Compact glass table of contents — pure in-page anchors (no JS), so it
          works server-rendered; each section carries scroll-mt to clear the
          sticky header when jumped to. */}
      <nav aria-label="תוכן העניינים" className="glass mb-10 md:mb-12 p-5 md:p-6 [--glass-radius:1.25rem]">
        <p className="mb-3 text-[11px] tracking-[0.2em] text-accent">תוכן העניינים</p>
        <ul className="grid list-none gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block py-1.5 text-sm text-muted-foreground transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section title="1. המחויבות שלנו לנגישות">
        <p>
          חברת <strong>אור זרוע לצדיק</strong> (להלן: "החברה") רואה כל אדם כשווה זכויות וכאזרח בעל
          זכות מלאה לקבל מידע ושירות בצורה נגישה, עצמאית ובכבוד. אנו פועלים באופן שוטף ומתמשך להנגיש
          את אתר האינטרנט שלנו עבור אנשים עם מוגבלויות מסוגים שונים — לרבות מוגבלויות ראייה, שמיעה,
          מוטוריקה, קוגניציה ולמידה — כך שיוכלו לעשות שימוש שווה, מכבד ועצמאי בכל השירותים המוצעים.
        </p>
        <p>
          הנגשת האתר מהווה חלק מתפיסת עולמה של החברה ומחויבותה החברתית והעסקית כאחד, מתוך הבנה
          שנגישות איננה מותרות אלא זכות יסוד.
        </p>
      </Section>

      <Section title="2. בסיס חוקי">
        <p>הצהרת נגישות זו נערכה בהתאם להוראות הדין הישראלי, ובכלל זה:</p>
        <ul>
          <li>חוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998.</li>
          <li>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.</li>
          <li>תקנה 35 לתקנות הנגישות — נגישות שירותי אינטרנט.</li>
          <li>תקן ישראלי ת"י 5568 — קווים מנחים לנגישות תכנים באינטרנט, ברמת AA.</li>
          <li>הנחיות הנגישות הבינלאומיות WCAG 2.1 (Web Content Accessibility Guidelines).</li>
        </ul>
      </Section>

      <Section title="3. רמת הנגישות באתר">
        <p>
          האתר נבנה במטרה לעמוד בדרישות התקן הישראלי ת"י 5568 ברמת <strong>AA</strong>, המבוסס על
          הנחיות הנגישות הבינלאומיות WCAG 2.1. עבודות ההנגשה בוצעו על ידי צוות הפיתוח ונבדקות
          באופן שוטף בכלי בדיקה אוטומטיים ובבדיקות ידניות. למען השקיפות: טרם בוצעה ביקורת נגישות
          על ידי מורשה נגישות שירות, ולא בוצעה בדיקת תאימות מלאה מול כל אחת מהטכנולוגיות
          המסייעות. אנו מתקנים ליקויים שמתגלים, ונשמח לקבל דיווח על כל ליקוי שנתקלתם בו.
        </p>
      </Section>

      <Section title="4. התאמות הנגישות שבוצעו באתר">
        <h3 className="font-display text-lg mt-4 mb-2">4.1 ניווט ומקלדת</h3>
        <ul>
          <li>ניווט מלא באמצעות מקלדת בלבד, ללא תלות בעכבר.</li>
          <li>סדר טאב לוגי וברור לאורך כל הדפים.</li>
          <li>מיקוד גלוי (Focus Visible) על כל אלמנט אינטראקטיבי.</li>
          <li>קישור "דילוג לתוכן הראשי" (Skip to Content) לקוראי מסך.</li>
          <li>אפשרות לסגור חלונות קופצים באמצעות מקש Escape.</li>
        </ul>

        <h3 className="font-display text-lg mt-4 mb-2">4.2 קוראי מסך וטכנולוגיות מסייעות</h3>
        <ul>
          <li>מבנה סמנטי ותוויות ARIA שנועדו לתמוך בקוראי המסך הנפוצים (NVDA, JAWS, VoiceOver, TalkBack) — האתר נבנה לפי התקנים שהם נשענים עליהם.</li>
          <li>תיוג סמנטי תקין (HTML5 Semantic) — header, nav, main, footer, article, section.</li>
          <li>היררכיית כותרות תקינה (h1-h6) על כל דף.</li>
          <li>תוויות ARIA (aria-label, aria-labelledby, aria-describedby) על אלמנטים שדורשים זאת.</li>
          <li>מצבי aria-expanded, aria-current, aria-live לעדכונים דינמיים.</li>
          <li>טקסטים חלופיים (alt) משמעותיים לכל התמונות התוכניות.</li>
          <li>alt ריק (alt="") לתמונות דקורטיביות, כך שקורא המסך מתעלם מהן.</li>
        </ul>

        <h3 className="font-display text-lg mt-4 mb-2">4.3 ראייה וצבעים</h3>
        <ul>
          <li>ניגודיות צבעים תקנית בהתאם לדרישות AA (לפחות 4.5:1 לטקסט רגיל, 3:1 לטקסט גדול).</li>
          <li>אפשרות התקרבות (Zoom) עד 200% מבלי לאבד תוכן או פונקציונליות.</li>
          <li>טקסט ניתן לשינוי גודל בהגדרות הדפדפן ללא שבירת פריסה.</li>
          <li>שימוש בטקסט במקום בתמונות טקסט ככל הניתן.</li>
          <li>אין הסתמכות על צבע בלבד להעברת מידע (למשל הודעות שגיאה).</li>
        </ul>

        <h3 className="font-display text-lg mt-4 mb-2">4.4 תוכן ומבנה</h3>
        <ul>
          <li>שפה ברורה, מובנת ומפורשת.</li>
          <li>הגדרת שפת הדף (lang="he") לקריאה תקינה על ידי קוראי מסך.</li>
          <li>תמיכה מלאה בכיוון מימין לשמאל (RTL).</li>
          <li>טופסי קשר עם תוויות (label) מקושרות, הודעות שגיאה ברורות והכוונה.</li>
          <li>קישורים בעלי טקסט תיאורי משמעותי (ולא "לחץ כאן").</li>
          <li>טבלאות בנויות בתגיות טבלה סמנטיות, עם שורת כותרות מתויגת (thead ו-th).</li>
        </ul>

        <h3 className="font-display text-lg mt-4 mb-2">4.5 מולטימדיה וזמן</h3>
        <ul>
          <li>סרטוני הרקע באתר הם דקורטיביים ומושתקים לחלוטין, ואינם מופעלים כאשר מוגדרת במערכת ההפעלה העדפת הפחתת תנועה.</li>
          <li>אין הפעלה אוטומטית של אודיו או וידאו עם סאונד.</li>
          <li>אנימציות לא חיוניות מצומצמות ומכבדות את הגדרת prefers-reduced-motion.</li>
          <li>אין תוכן מהבהב מעל 3 פעמים בשנייה (למניעת התקפי אפילפסיה).</li>
          <li>הזמן לביצוע פעולות הוא מספק, וניתן להאריך בעת הצורך.</li>
        </ul>

        <h3 className="font-display text-lg mt-4 mb-2">4.6 ניידים ומכשירי מגע</h3>
        <ul>
          <li>חלק מאזורי המגע (Tap Targets) באתר מוגדרים בגודל מינימלי של 44×44 פיקסלים; ברכיבים אחרים אזור המגע קטן מכך, וההתאמה טרם הושלמה.</li>
          <li>תמיכה במחוות מגע פשוטות וחלופות לכל מחווה מורכבת.</li>
          <li>תמיכה בכיוונים אנכי ואופקי של המכשיר.</li>
          <li>תאימות מלאה למסכי מגע ולכלי הנגישות של iOS ו-Android.</li>
        </ul>

        <h3 className="font-display text-lg mt-4 mb-2">4.7 תפריט נגישות באתר</h3>
        <ul>
          <li>בכל עמודי האתר זמין כפתור נגישות קבוע בפינה השמאלית התחתונה, הפותח תפריט התאמות אישיות.</li>
          <li>התפריט מאפשר: הגדלה והקטנה של גודל הטקסט, מצב ניגודיות גבוהה, תצוגה בגווני אפור, הדגשת קישורים, מעבר לגופן קריא, עצירת אנימציות, וסמן עכבר מוגדל.</li>
          <li>ההעדפות נשמרות במכשיר שלך וחלות בכל ביקור, וניתן לאפס אותן בלחיצה אחת. התפריט נגיש למקלדת וניתן לסגירה במקש Escape.</li>
        </ul>
      </Section>

      <Section title="5. דרכי שימוש בכלי הנגישות בדפדפן ובמערכת ההפעלה">
        <p>
          בנוסף להתאמות באתר, ניתן להיעזר בכלים מובנים במחשב ובמכשיר הנייד שלך:
        </p>
        <ul>
          <li><strong>הגדלת תצוגה:</strong> Ctrl + + (Windows) או ⌘ + + (Mac), Ctrl + 0 לאיפוס.</li>
          <li><strong>קוראי מסך מובנים:</strong> Narrator (Windows), VoiceOver (Mac/iOS), TalkBack (Android).</li>
          <li><strong>מצב ניגודיות גבוהה:</strong> זמין בהגדרות הנגישות של מערכת ההפעלה.</li>
          <li><strong>סמן עכבר מוגדל:</strong> דרך הגדרות הנגישות במערכת ההפעלה.</li>
          <li><strong>הקטנת תנועה:</strong> דרך הגדרות הנגישות (Reduce Motion).</li>
        </ul>
      </Section>

      <Section title="6. מגבלות נגישות ידועות">
        <p>
          חרף מאמצינו המתמשכים להנגיש את כל חלקי האתר, ייתכן ויימצאו רכיבים מסוימים בהם טרם הושלמה
          ההנגשה במלואה. הדבר עשוי לנבוע מהיקף השינויים הנדרשים, מאופי תוכן צד שלישי המשולב באתר
          (למשל תכני וידאו חיצוניים, מפות אינטראקטיביות, מודולי תשלום של ספקי סליקה), או מטכנולוגיות
          בהן השימוש אינו מאפשר התאמה מלאה כיום.
        </p>
        <p>
          אנו פועלים בשקיפות מלאה ומתחייבים לפעול להסרת מכשולים אלה בהקדם האפשרי. אם נתקלת בקושי
          כלשהו בשימוש באתר, נשמח שתודיע לנו על מנת שנוכל לטפל בכך באופן יזום.
        </p>
      </Section>

      <Section title="7. הסדרי נגישות פיזית בסניפי החברה">
        <p>
          ככל שלחברה סניפים פיזיים פתוחים לקהל, הם מותאמים נגישות בהתאם להוראות חוק שוויון זכויות
          לאנשים עם מוגבלות ותקנותיו, לרבות גישה לכיסאות גלגלים, שירותים מונגשים ומידע נגיש בכתב.
          לפרטים מלאים על הסדרי הנגישות במיקום ספציפי, ניתן ליצור עמנו קשר מראש.
        </p>
      </Section>

      <Section title="8. פרטי רכז הנגישות">
        <p>
          בהתאם לתקנות, מונה רכז נגישות בחברה. לפניות, הצעות לשיפור, דיווח על תקלת נגישות או בקשה
          לקבלת שירות בדרך מונגשת — ניתן ליצור קשר באחת מהדרכים הבאות:
        </p>
        <ul>
          <li><strong>שם הרכז:</strong> רכז הנגישות, אור זרוע לצדיק</li>
          <li><strong>דוא"ל:</strong> <a href={`mailto:${BUSINESS.accessibilityEmail}`} className="text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">{BUSINESS.accessibilityEmail}</a></li>
          <li><strong>טלפון:</strong> <a href={`tel:${BUSINESS.phone}`} className="text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">{BUSINESS.phoneDisplay}</a> · ניתן גם להשאיר פנייה דרך <Link to="/contact">עמוד צור קשר</Link>.</li>
          {/* Kept in step with /contact and with openingHoursSpecification in
              __root.tsx — all three now state the shop's real Business Profile
              hours. This page is a statutory accessibility declaration under
              תקנות שוויון זכויות, so the response window it publishes has to be
              one the business can actually keep. */}
          <li><strong>שעות מענה:</strong> ראשון-שלישי 9:30-14:00 ו-16:00-19:00, רביעי-חמישי 9:30-12:00 ו-16:00-19:00, שישי 9:30-12:00 (למעט ערבי חג וחגים).</li>
        </ul>
        <p>
          אנו מתחייבים להגיב לפניית נגישות תוך זמן סביר ולא יאוחר מ-30 יום ממועד קבלת הפנייה,
          בהתאם להוראות הדין.
        </p>
      </Section>

      <Section title="9. נוהל טיפול בפניות נגישות">
        <ol className="list-decimal pr-5 space-y-2">
          <li>קבלת הפנייה בדוא"ל, בטלפון, בוואטסאפ או דרך טופס יצירת הקשר באתר.</li>
          <li>מענה אישי לפונה — בדרך כלל תוך יום עסקים אחד.</li>
          <li>בדיקת הליקוי שדווח.</li>
          <li>הצעת פתרון או דרך חלופית לקבלת השירות.</li>
          <li>תיקון הליקוי באתר בהקדם האפשרי, בהתאם למורכבות.</li>
          <li>עדכון הפונה על השלמת הטיפול.</li>
        </ol>
      </Section>

      <Section title="10. עדכון ההצהרה">
        <p>
          הצהרה זו מתעדכנת באופן שוטף בהתאם להתקדמות עבודות ההנגשה, לשיפורים שבוצעו באתר ולעדכוני
          רגולציה רלוונטיים. תאריך העדכון האחרון מופיע בראש מסמך זה.
        </p>
      </Section>
    </article>
  );
}

/* Hairline-separated sections rather than boxed cards: precision rules and
   negative space, and no page-tall backdrop-blur panel to repaint on scroll. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  // Derive the stable anchor id from the single SECTIONS source by title match,
  // so headings and the TOC stay in lockstep without repeating the id at each call.
  const id = SECTIONS.find((s) => s.title === title)?.id;
  return (
    <section id={id} className="mb-9 border-t border-glass-line pt-8 last:mb-0 scroll-mt-24 lg:scroll-mt-32">
      <h2 className="font-display text-xl md:text-2xl mb-3 text-foreground">{title}</h2>
      <div className="text-[15px] leading-[1.85] text-foreground space-y-4 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-2 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}
