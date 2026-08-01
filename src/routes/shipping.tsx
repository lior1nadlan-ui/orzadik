import { createFileRoute, Link } from "@tanstack/react-router";
import { BUSINESS, CONSUMER_POLICY } from "@/lib/business";
import { PolicyHeader, PolicySection, PolicyFootnote } from "@/components/PolicyPage";

// Standalone delivery policy. The binding text is /terms §6 ("אספקה ומשלוחים",
// #mishloch); this page is the findable summary a shopper actually searches for.
// Every number comes from CONSUMER_POLICY so the two surfaces can never disagree
// — and no shipping FEE is written here on purpose: the flat rate is computed in
// pricing.ts and shown live at checkout, so any figure typed into copy would go
// stale the moment it changes.

const DELIVERY_WINDOW = `${CONSUMER_POLICY.deliveryMinDays}-${CONSUMER_POLICY.deliveryMaxDays}`;

export const Route = createFileRoute("/shipping")({
  component: ShippingPage,
  head: () => ({
    meta: [
      { title: "משלוחים ואספקה | אור זרוע לצדיק" },
      {
        name: "description",
        content: `זמני האספקה, דמי המשלוח ואזורי החלוקה של אור זרוע לצדיק: אספקה משוערת ${DELIVERY_WINDOW} ימי עסקים ממועד אישור ההזמנה, משלוח עד הבית בכל ישראל ומעקב אחר ההזמנה.`,
      },
      { property: "og:title", content: "משלוחים ואספקה | אור זרוע לצדיק" },
      {
        property: "og:description",
        content: `אספקה משוערת ${DELIVERY_WINDOW} ימי עסקים ממועד אישור ההזמנה, משלוח עד הבית בכל ישראל, ומעקב אחר ההזמנה בכל שלב.`,
      },
      { property: "og:url", content: "https://orzadik.com/shipping" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/shipping" }],
  }),
});

function ShippingPage() {
  return (
    <article className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
      <PolicyHeader
        eyebrow="משלוחים"
        title="משלוחים ואספקה"
        intro="כל מה שצריך לדעת על הדרך מההזמנה ועד הדלת: זמני האספקה, דמי המשלוח, אזורי החלוקה והמעקב אחר ההזמנה."
      />

      <PolicySection id="zmanim" title="זמני אספקה">
        <p>
          אנו פועלים לספק את המוצרים בתוך <strong>{DELIVERY_WINDOW} ימי עסקים</strong> ממועד אישור
          ההזמנה. אישור ההזמנה הוא הרגע שבו התקבל אישור החיוב מחברת האשראי ואומתה זמינות המוצר
          במלאי — ולא רגע שליחת ההזמנה באתר.
        </p>
        <p>
          ימי עסקים אינם כוללים ימי שישי, שבת, ערבי חג, חגים וימי שבתון. מועדי האספקה הם משוערים
          ותלויים גם בחברת השילוח.
        </p>
        <p>
          פריטים הכוללים <strong>התאמה אישית</strong> (רקמה, חריטה או הקדשה) — פרטי ההתאמה מתואמים
          איתכם לאחר ההזמנה, וההכנה מתחילה לאחר אישור הפרטים מולכם.
        </p>
      </PolicySection>

      <PolicySection id="dmey-mishloach" title="דמי משלוח">
        <p>
          בגין המשלוח נגבים דמי משלוח אחידים, זהים לכל הארץ. הסכום המדויק מוצג לכם בעמוד התשלום,
          בשורה נפרדת בסיכום ההזמנה, <strong>לפני</strong> אישור התשלום — כך שהסכום הסופי לחיוב ידוע
          לכם מראש.
        </p>
      </PolicySection>

      <PolicySection id="ezorim" title="אזורי אספקה">
        <p>
          המשלוחים מתבצעים בתחומי מדינת ישראל בלבד, באמצעות חברת שילוח או דואר. ייתכנו אזורים
          מסוימים שאליהם האספקה אינה מתאפשרת, או שבהם חלים זמני אספקה שונים.
        </p>
        <p>
          אם אינכם בטוחים לגבי אזור המגורים שלכם — <Link to="/contact">צרו איתנו קשר</Link> לפני
          ההזמנה ונבדוק עבורכם.
        </p>
      </PolicySection>

      <PolicySection id="maakav" title="מעקב אחר ההזמנה">
        <p>
          עם אישור ההזמנה נשלח אליכם אישור בדוא"ל עם פרטי ההזמנה ומספרה. בכל שלב ניתן לבדוק את מצב
          ההזמנה בעמוד <Link to="/track">מעקב הזמנה</Link>, באמצעות מספר ההזמנה וכתובת הדוא"ל שאיתה
          הזמנתם. לקוחות רשומים רואים את כל ההזמנות שלהם ב<Link to="/account">אזור האישי</Link>.
        </p>
      </PolicySection>

      <PolicySection id="ikuvim" title="עיכובים וכתובת למשלוח">
        <p>
          באחריותכם למסור כתובת מדויקת ומלאה ולוודא זמינות לקבלת המשלוח. עיכוב או כשל באספקה
          שנובעים מכתובת שגויה או חסרה, או מאי-מענה לשליח, הם באחריות הלקוח ואינם מזכים בהחזר דמי
          משלוח.
        </p>
        <p>
          איננו נושאים באחריות לעיכובים שמקורם בחברת השילוח, בדואר או בכוח עליון — לרבות מזג אוויר,
          שביתות ונסיבות שאינן בשליטתנו הסבירה. אם המשלוח מתעכב מעבר לצפוי, פנו אלינו בטלפון{" "}
          <a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phoneDisplay}</a> או בדוא"ל{" "}
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> ונבדוק מול חברת השילוח.
        </p>
      </PolicySection>

      <PolicySection id="hachzara" title="קיבלתם משלוח פגום או שגוי?">
        <p>
          אם המוצר הגיע פגום, שגוי או שאינו תואם להזמנה — פנו אלינו בהקדם בצירוף מספר ההזמנה ותמונה,
          ונטפל בכך. פירוט מלא של זכות הביטול, ההחזרים והחריגים מופיע בעמוד{" "}
          <Link to="/returns">ביטול עסקה והחזרות</Link>.
        </p>
      </PolicySection>

      <PolicyFootnote>
        עמוד זה מסכם את מדיניות המשלוחים לנוחותכם. הנוסח המחייב הוא סעיף 6 —
        "אספקה ומשלוחים" — ב<Link to="/terms" hash="mishloch">תקנון ותנאי השימוש</Link>.
      </PolicyFootnote>
    </article>
  );
}
