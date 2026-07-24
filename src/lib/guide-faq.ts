// Guide-level FAQ used for Answer Engine Optimization (AEO): concise, honest,
// quotable Q&A that feeds voice assistants, Google's "People also ask", and AI
// answer engines, and is emitted as FAQPage JSON-LD on the guide page. Pure
// module — safe on both client and server (read in the route head and in the
// component from the SAME source, so the visible accordion and the structured
// data stay byte-for-byte identical, per Google's FAQPage policy).
//
// Honesty rules enforced by the content below:
//   - Grounded in general, widely-verifiable Judaica facts implied by each
//     guide's topic — nothing store-specific (no stock / price / delivery /
//     guarantees).
//   - No halachic ruling beyond widely-accepted basics; where custom varies
//     (edah, right/left-handed, disputed shiur) the answer says so and defers
//     to a competent rabbi rather than deciding.
//   - Plain-text answers (no markup), so the on-page text equals the JSON-LD
//     string exactly.
//   - A guide whose topic does not support honest Q&A simply has no entry, and
//     `guideFaq` returns undefined for it.

import type { FaqItem } from "@/lib/category-faq";
// Re-exported so the guide route imports every FAQ helper it needs from one
// place; the JSON-LD builder is shared with the category FAQ so both surfaces
// emit identically-shaped schema.
export { faqJsonLd } from "@/lib/category-faq";
export type { FaqItem } from "@/lib/category-faq";

// Keyed by the article slug (see supabase/migrations/*_seed_articles.sql).
const GUIDE_FAQ: Record<string, FaqItem[]> = {
  // בחירת טלית
  "bechira-talit": [
    {
      q: "איך בוחרים את גודל הטלית?",
      a: "גודל הטלית נמדד לפי רוחב על אורך ונבחר בעיקר לפי גיל, גובה ונוחות. גדלים גדולים (בערך 50 אינץ' ומעלה) מאפשרים לכסות גם את הראש בזמן התפילה, בעוד גדלים קטנים יותר נפוצים לנערים לקראת בר מצווה.",
    },
    {
      q: "מה ההבדל בין טלית צמר לטלית מבד סינתטי?",
      a: "טליות צמר בעלות מסורת הלכתית ארוכה ונחשבות מהודרות, והן חמות וכבדות יותר. טליות מבד סינתטי או ויסקוז קלות ונוחות יותר לאקלים חם ולרוב זולות יותר. שני הסוגים יכולים להיות כשרים כאשר הציציות נעשו כהלכה.",
    },
    {
      q: "כמה קשרים צריכים להיות בכל ציצית?",
      a: "המנהג הרווח הוא חמישה קשרים כפולים בכל פינה, עם כריכות ביניהם. מאחר שכשרות הציצית היא עיקר המצווה, כדאי לקנות ציציות שנעשו בפיקוח ולבדוק אותן מעת לעת.",
    },
    {
      q: "מהי העטרה בטלית והאם היא חובה?",
      a: "העטרה היא הפס העליון של הטלית, המסמן את חלקה העליון ומשמש לעיטור, ולעיתים נרקמת בכסף או עם כיתוב אישי. אין לה משמעות הלכתית מחייבת, והיא עניין של נוי ומנהג.",
    },
  ],

  // תפילין
  "tefillin-guide": [
    {
      q: 'מה ההבדל בין תפילין "כשרות" ל"מהדרין"?',
      a: "תפילין כשרות עומדות בדרישות ההלכה הבסיסיות לכתיבה ולעשייה. תפילין מהדרין ומהדרין מן המהדרין נכתבות בהקפדה יתרה בידי סופר בעל הסמכה גבוהה יותר ולרוב עוברות בדיקה נוספת, ולכן הן מהודרות ויקרות יותר — אך שתיהן כשרות לשימוש.",
    },
    {
      q: "על איזו יד מניחים תפילין של יד?",
      a: "רוב האנשים מניחים את תפילין של יד על הזרוע השמאלית. מי שהוא איטר יד נוהג לרוב להפך, ולכן במקרה זה כדאי לברר את המנהג עם רב.",
    },
    {
      q: "כל כמה זמן מומלץ לבדוק תפילין?",
      a: 'נהוג להביא את התפילין לבדיקה אצל סופר סת"ם מוסמך מעת לעת, במיוחד אם הן ישנות או נחשפו ללחות ולחום. בדיקה תקופתית מסייעת לוודא שהאותיות נותרו שלמות וכשרות.',
    },
  ],

  // מזוזה
  "mezuza-guide": [
    {
      q: "על אילו דלתות בבית קובעים מזוזה?",
      a: "קובעים מזוזה בפתחי החדרים המשמשים למגורים קבועים, כגון חדרי שינה, סלון ומטבח. לגבי חדרי שירותים, מחסנים ופתחים מיוחדים המנהגים משתנים, ובמקרה של ספק כדאי לשאול רב.",
    },
    {
      q: "באיזה צד ובאיזה גובה קובעים את המזוזה?",
      a: 'את המזוזה קובעים בצד ימין של הכניסה לחדר, בשליש העליון של המשקוף, כשהיא נטויה מעט כלפי פנים. לפני הקביעה מברכים "לקבוע מזוזה".',
    },
    {
      q: "כל כמה זמן צריך לבדוק מזוזות?",
      a: "מקובל לבדוק מזוזות כדי לוודא שהקלף נותר כשר; לפי שיטת השולחן ערוך נהוג לבדוק פעמיים בשבע שנים. בדירה בשכירות נהוג לבדוק גם בעת מעבר דירה.",
    },
    {
      q: "האם בית המזוזה (הנרתיק) משפיע על הכשרות?",
      a: "לא. עיקר המצווה הוא הקלף הכתוב בכתב יד כשר; הנרתיק נועד להגנה ולנוי בלבד, וניתן לבחור אותו לפי טעם וסגנון.",
    },
  ],

  // גביע קידוש
  "kiddush-cup-guide": [
    {
      q: "מהו הנפח המזערי הנדרש בגביע קידוש?",
      a: 'הגביע צריך להכיל לפחות שיעור "רביעית", שהערכתו נעה בין כ-86 מ"ל לכ-150 מ"ל לפי שיטות הפוסקים השונות. לכן נהוג לבחור גביע שמכיל בבירור יותר מהשיעור המזערי כדי לצאת ידי חובה לכל הדעות.',
    },
    {
      q: "האם חובה שגביע הקידוש יהיה מכסף?",
      a: "לא. אפשר לקדש על כל כוס שלמה ונקייה המחזיקה את השיעור הנדרש, לרבות זכוכית או קריסטל. גביע כסף נחשב הידור מצווה ומנהג רווח, אך אינו חובה.",
    },
    {
      q: "כיצד שומרים על גביע כסף שטרלינג?",
      a: "מנגבים את הגביע במטלית רכה ומאחסנים אותו במקום יבש; ניקוי עדין מונע הכהיה. כדאי להימנע מחומרי ניקוי חריפים העלולים לפגוע בכסף.",
    },
  ],

  // חנוכיה
  "hanukkia-guide": [
    {
      q: "כמה קנים צריכים להיות בחנוכיה כשרה?",
      a: 'חנוכיה כוללת שמונה מקומות לנרות בגובה שווה ובמרווח המאפשר להבחין בכל נר בנפרד, ובנוסף מקום נפרד ל"שמש" המשמש להדלקה. סך הכול תשעה מקומות.',
    },
    {
      q: "כמה זמן צריך כל נר לדלוק?",
      a: "לכתחילה כל נר צריך לדלוק לאחר צאת הכוכבים פרק זמן מספיק — לכל הפחות כחצי שעה. לכן חשוב לוודא שכמות השמן או אורך הנרות מספיקים למשך זמן זה.",
    },
    {
      q: "היכן מניחים את החנוכיה?",
      a: "נהוג להניח את החנוכיה בפתח הבית או סמוך לחלון הפונה לרשות הרבים, כדי לפרסם את הנס. המקום והזמן המדויקים תלויים במנהג ובתנאי המגורים.",
    },
    {
      q: "האם יוצאים ידי חובה בחנוכיה חשמלית?",
      a: "לדעת רוב הפוסקים אין יוצאים ידי חובת ההדלקה בחנוכיה חשמלית לכתחילה, ומעדיפים נרות שמן או שעווה. חנוכיה חשמלית יכולה לשמש לקישוט או בנוסף להדלקה כשרה.",
    },
  ],
};

/**
 * Curated, honest FAQ for a guide, keyed by article slug. Returns undefined
 * when the slug has no curated Q&A (unknown guide, or a topic that does not
 * support conservative, verifiable Q&A) — the caller then emits no FAQPage
 * schema and renders no accordion.
 */
export function guideFaq(slug: string): FaqItem[] | undefined {
  const items = GUIDE_FAQ[slug];
  return items && items.length > 0 ? items : undefined;
}
