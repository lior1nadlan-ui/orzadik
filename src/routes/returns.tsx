import { createFileRoute, Link } from "@tanstack/react-router";
import { BUSINESS, CONSUMER_POLICY } from "@/lib/business";
import { PolicyHeader, PolicySection, PolicyFootnote } from "@/components/PolicyPage";

// Standalone cancellation/returns policy. The binding text is /terms §7 ("ביטול
// עסקה, החזרות והחזרים", #bitul); this page is the findable summary — "החזרות"
// is one of the first things a first-time buyer looks for, and until now it had
// no page of its own. Every window and cap is read from CONSUMER_POLICY, so this
// summary and the terms can never quote different numbers.

export const Route = createFileRoute("/returns")({
  component: ReturnsPage,
  head: () => ({
    meta: [
      { title: "ביטול עסקה והחזרות | אור זרוע לצדיק" },
      {
        name: "description",
        content: `מדיניות הביטול וההחזרות של אור זרוע לצדיק: זכות ביטול עד ${CONSUMER_POLICY.cancellationDays} ימים מקבלת המוצר לפי חוק הגנת הצרכן, אופן הביטול, מועדי ההחזר הכספי והחריגים למוצרים בהתאמה אישית.`,
      },
      { property: "og:title", content: "ביטול עסקה והחזרות | אור זרוע לצדיק" },
      {
        property: "og:description",
        content: `זכות ביטול עד ${CONSUMER_POLICY.cancellationDays} ימים מקבלת המוצר, אופן הביטול, מועדי ההחזר הכספי והחריגים למוצרים בהתאמה אישית.`,
      },
      { property: "og:url", content: "https://orzadik.com/returns" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/returns" }],
  }),
});

function ReturnsPage() {
  return (
    <article className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
      <PolicyHeader
        eyebrow="ביטול והחזרות"
        title="ביטול עסקה והחזרות"
        intro="רכישה באתר היא עסקת מכר מרחוק, ולכן עומדת לכם זכות ביטול לפי חוק הגנת הצרכן. כאן מרוכז מה שחשוב לדעת: תוך כמה זמן, איך מודיעים, ומתי מתקבל ההחזר."
      />

      <PolicySection id="zchut" title={`זכות ביטול — ${CONSUMER_POLICY.cancellationDays} ימים`}>
        <p>
          ניתן לבטל את העסקה החל ממועד ביצועה ועד{" "}
          <strong>{CONSUMER_POLICY.cancellationDays} ימים</strong> מיום קבלת המוצר או מיום קבלת מסמך
          פרטי העסקה — לפי המאוחר מביניהם — וללא צורך בנימוק.
        </p>
        <p>
          לאדם עם מוגבלות, לאזרח ותיק (מעל גיל 65) ולעולה חדש עומדת זכות הביטול במשך{" "}
          <strong>ארבעה חודשים</strong> מאותם מועדים, ובלבד שההתקשרות בעסקה כללה שיחה (לרבות תקשורת
          אלקטרונית).
        </p>
      </PolicySection>

      <PolicySection id="eich" title="איך מבטלים">
        <p>ניתן להודיע לנו על הביטול בכל אחת מהדרכים הבאות:</p>
        <ul>
          <li>
            בטלפון <a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phoneDisplay}</a>
          </li>
          <li>
            בדוא"ל <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </li>
          <li>
            בהודעה דרך <Link to="/contact">עמוד יצירת הקשר</Link>
          </li>
        </ul>
        <p>
          בהודעה יש לציין את שם הלקוח ואת מספר ההזמנה (ובמקרה הרלוונטי — מספר תעודת זהות). נמסור לכם
          אישור בכתב על קבלת הודעת הביטול.
        </p>
      </PolicySection>

      <PolicySection id="hechzer" title="החזר כספי">
        <p>
          ההחזר מתבצע לאותו אמצעי תשלום שבו בוצעה העסקה, בתוך{" "}
          <strong>{CONSUMER_POLICY.refundDays} ימים</strong> ממועד קבלת הודעת הביטול.
        </p>
        <p>
          <strong>בביטול עקב פגם או אי-התאמה</strong> — מוחזר מלוא הסכום ששולם, ללא דמי ביטול,
          ואינכם נושאים בעלות ההחזרה.
        </p>
        <p>
          <strong>בביטול שאינו עקב פגם</strong> ("התחרטות") — מוחזר הסכום ששולם בניכוי דמי ביטול
          בלבד, בכפוף להחזרת המוצר כשלא נעשה בו שימוש ולא נפגם. דמי הביטול לא יעלו על{" "}
          {CONSUMER_POLICY.cancellationFeePct}% ממחיר המוצר או{" "}
          {CONSUMER_POLICY.cancellationFeeCapIls} ש"ח — לפי הנמוך מביניהם.
        </p>
      </PolicySection>

      <PolicySection id="hachzarat-mutzar" title="החזרת המוצר עצמו">
        <p>
          בביטול שאינו עקב פגם, החזרת המוצר היא באחריות הלקוח ועל חשבונו. יש להחזיר את המוצר שלם,
          ללא שימוש, באריזתו המקורית וככל הניתן בצירוף החשבונית.
        </p>
      </PolicySection>

      <PolicySection id="harig" title="חריג — מוצרים בהתאמה אישית">
        <p>
          לפי חוק הגנת הצרכן, זכות הביטול אינה חלה על טובין שיוצרו במיוחד עבור הלקוח בעקבות העסקה.
          בהתאם, מוצרים הכוללים{" "}
          <strong>חריטת לייזר, רקמה, הקדשה אישית, שמות או הזמנה מיוחדת לפי מידות</strong> אינם
          ניתנים לביטול או להחזרה לאחר תחילת תהליך ההתאמה.
        </p>
        <p>
          לכן חשוב לוודא את פרטי ההתאמה — כיתוב, שמות, איות ומידות — לפני אישור ההזמנה. אנחנו מתאמים
          איתכם את הפרטים לאחר ההזמנה ולפני תחילת העבודה, כדי שלא תהיה אי-הבנה.
        </p>
        <p>
          חריג זה <strong>אינו גורע</strong> מזכותכם לביטול ולהחזר במקרה של פגם או אי-התאמה במוצר.
        </p>
      </PolicySection>

      <PolicySection id="pagum" title="מוצר פגום, שגוי או שאינו תואם">
        <p>
          אם קיבלתם מוצר פגום, שגוי או שאינו תואם להזמנה — פנו אלינו בהקדם ובתוך זמן סביר ממועד
          גילוי הפגם, בצירוף מספר ההזמנה ותיעוד (כגון תמונה). נפעל לתיקון, החלפה או החזר כספי בהתאם
          לזכויותיכם על פי דין. בלאי טבעי או נזק שנגרם משימוש בלתי סביר אינם מכוסים.
        </p>
      </PolicySection>

      <PolicyFootnote>
        עמוד זה מסכם את מדיניות הביטול לנוחותכם. הנוסח המחייב הוא סעיף 7 — "ביטול עסקה, החזרות
        והחזרים" — ב
        <Link to="/terms" hash="bitul">
          תקנון ותנאי השימוש
        </Link>
        . בכל מקרה של סתירה בין עמוד זה לבין הוראה קוגנטית בחוק לטובת הצרכן — הוראת הדין גוברת.
      </PolicyFootnote>
    </article>
  );
}
