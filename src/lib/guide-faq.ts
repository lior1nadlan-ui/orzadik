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
//
// MERGED SET (this file is now the ONLY FAQ a guide has). Every stored
// `body_html` also carried its own <h2>שאלות נפוצות</h2> with 3 <h3> questions,
// so each guide rendered TWO "שאלות נפוצות" headings — measured live: 2 on
// /articles/kiddush-cup-guide — and the FAQPage schema described only this one.
// Worse, some pairs answered the same thing twice ~200 words apart (body "האם
// אפשר לקדש על כל כוס?" vs the schema's "האם חובה שגביע הקידוש יהיה מכסף?").
// The body block is now stripped at render (see stripInBodyFaq in
// articles/$slug.tsx) and its questions live here, so there is one visible
// section and one schema, byte-identical, as this file's contract already
// promised. Answers moved from body_html are reproduced as written, minus
// cross-references like "כמפורט למעלה" that do not survive extraction.
//
// The kiddush-cup set additionally carries three questions in the exact form
// Search Console shows the page ALREADY ranking for (positions 12.0, 17.0 and
// 23.0; the site's four best positions are all long-tail questions on guides,
// versus 26-77 for every commercial term). Their answers are re-cut from the
// guide's own "סוגי חומרים", "כסף שטרלינג", "כסף ציפוי" and "טיפול, ניקוי
// ותחזוקה" prose — a re-phrasing of published text, not a new claim.

import type { FaqItem } from "@/lib/category-faq";
// Re-exported so the guide route imports every FAQ helper it needs from one
// place; the JSON-LD builder is shared with the category FAQ so both surfaces
// emit identically-shaped schema.
export { faqJsonLd } from "@/lib/category-faq";
export type { FaqItem } from "@/lib/category-faq";

// Keyed by the article slug (see supabase/migrations/*_seed_articles.sql).
const GUIDE_FAQ: Record<string, FaqItem[]> = {
  // בחירת טלית
  // Body FAQ merged in: "מתי מתחילים ללבוש טלית?" and "כמה זמן מחזיקה טלית?".
  // The body's "האם עדיף צמר או ויסקוז?" is dropped as a semantic duplicate of
  // the material question below, which answers the same thing in more detail.
  "bechira-talit": [
    {
      q: "מתי מתחילים ללבוש טלית?",
      a: "לפי מנהג ספרדים ועדות המזרח מגיל בר מצווה (13). לפי מנהג אשכנזים רבים רק לאחר הנישואין. יש בכך שינויי מנהג בין הקהילות, ולמעשה יש לנהוג כמנהג האבות או לשאול רב.",
    },
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
    {
      q: "כמה זמן מחזיקה טלית?",
      a: "טלית איכותית שמטופלת כראוי יכולה ללוות אתכם שנים רבות. הציציות עצמן עשויות להזדקק להחלפה מעת לעת אם נקרעו או נפגמו.",
    },
  ],

  // תפילין
  // Body FAQ merged in: "האם אפשר להשתמש בתפילין של האב או הסבא?" and the
  // edot-custom question. The body's "כל כמה זמן צריך לבדוק תפילין?" is dropped
  // as a duplicate of the inspection question already here, whose answer is the
  // fuller of the two.
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
    {
      q: "האם אפשר להשתמש בתפילין של האב או הסבא?",
      a: 'אפשר, ובלבד שייבדקו על ידי סופר סת"ם ויימצאו כשרות, ושהכתב תואם את המנהג. לעיתים נדרש ריענון שחרות הרצועות או תיקון הבתים.',
    },
    {
      q: "מה ההבדל בין מנהגי העדות בהנחת תפילין?",
      a: "קיימים הבדלים בכיוון הכריכות, בנוסח הברכות ובצורת הקשר. אלו מנהגי עדות שונים, וכל אחד נוהג כמסורת אבותיו; בכל התלבטות יש לשאול רב.",
    },
  ],

  // מזוזה
  // All three body questions merged in — none duplicated an entry here. The
  // כשר/מהדרין answer ended "כמפורט למעלה", a pointer to the body's "רמות כשרות
  // של קלף" section that means nothing to a consumer extracting the FAQPage
  // node on its own, so it is restated self-containedly.
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
    {
      q: "כמה מזוזות צריך לבית שלם?",
      a: "הדבר תלוי במספר הפתחים החייבים בבית. מומלץ לספור את הדלתות מראש, ובמקרי ספק להתייעץ עם רב.",
    },
    {
      q: 'מה ההבדל בין קלף "כשר" לקלף "מהדרין"?',
      a: 'שניהם כשרים לשימוש; "מהדרין" מציין רמת הידור והקפדה נוספת בכתיבה ובבדיקה של הקלף.',
    },
    {
      q: "האם אפשר להשתמש במזוזה שכבר הייתה תלויה?",
      a: "קלף משומש דורש בדיקה לפני שימוש חוזר, כדי לוודא שלא נפגם. למעשה יש לשאול רב.",
    },
  ],

  // גביע קידוש
  // The guide the store ranks best on. Three questions below are worded as
  // Search Console shows searchers actually typing them — "מה ההבדל בין סוגי
  // גביעי קידוש שיש בשוק?" (position 12.0), "מה ההבדל בין גביע קידוש מכסף טהור
  // לגביע מכסף מצופה?" (17.0) and "האם גביע קידוש מכסף דורש תחזוקה מיוחדת?"
  // (23.0). Those three queries were matching body headings that are statements
  // ("סוגי חומרים וכיצד לזהות איכות", "טיפול, ניקוי ותחזוקה"), so the page
  // answered them without ever asking them. Answers are re-cut from that same
  // prose. Body FAQ merged in: "איך יודעים שהכסף אמיתי?". The body's "האם אפשר
  // לקדש על כל כוס?" is dropped (duplicate of the silver question) and its
  // "איזה חומר הכי מומלץ?" is superseded by the materials question below.
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
      q: "מה ההבדל בין סוגי גביעי קידוש שיש בשוק?",
      a: "החומרים הנפוצים הם כסף שטרלינג, כסף מצופה, זכוכית וקריסטל, חרסינה וקרמיקה, ומתכת קלה בגימור מוזהב. כסף שטרלינג נחשב מהודר ועמיד ולרוב שומר על ערכו; כסף מצופה נראה דומה במחיר נגיש יותר אך שכבת הציפוי עלולה להישחק; זכוכית וקריסטל קלים לניקוי ומאפשרים לראות את צבע היין; חרסינה וקרמיקה ייחודיים ופחות נפוצים; ומתכת קלה בגימור מוזהב נוחה במשקל ובתחזוקה.",
    },
    {
      q: "מה ההבדל בין גביע קידוש מכסף טהור לגביע מכסף מצופה?",
      a: 'כסף שטרלינג הוא סגסוגת של 92.5% כסף, ולכן מסומן פעמים רבות בחותמת "925"; הוא מורגש כבד ומוצק ביד, דפנותיו אינן דקות מדי, והוא עמיד לאורך שנים. גביע מכסף מצופה הוא גוף מתכת בסיסי עם שכבת כסף דקה: המראה דומה והמחיר נגיש יותר, אך הציפוי עלול להישחק עם השנים, במיוחד באזורי אחיזה ושפשוף.',
    },
    {
      q: "איך יודעים שהכסף אמיתי?",
      a: 'חותמת "925" מעידה על כסף שטרלינג. גם משקל מוצק ותחושת איכות מסייעים להבחין בין כסף מלא לבין ציפוי.',
    },
    {
      q: "האם גביע קידוש מכסף דורש תחזוקה מיוחדת?",
      a: "תחזוקה פשוטה אך קבועה. מנגבים את הגביע לאחר השימוש במטלית רכה ויבשה, מאחסנים במקום יבש כדי להפחית הכהיה, ונמנעים מחומרי ניקוי חריפים ומספוגיות שוחקות. בגביע מצופה כסף מקפידים על ניגוב רך במיוחד כדי לא לשחוק את הציפוי. חשוב לנגב שאריות יין, שעלולות להכתים או להאיץ את ההכהיה.",
    },
  ],

  // חנוכיה
  // Body FAQ merged in: "שמן או נרות — מה עדיף?" and the shamash-height
  // question. The body's "האם אפשר להשתמש בחנוכיה חשמלית?" is dropped as a
  // duplicate of the electric-menorah question already here.
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
    {
      q: "שמן או נרות — מה עדיף?", // em-dash, not a numeric range: bidi-safe here
      a: "רבים רואים בשמן זית הידור מיוחד בשל אופי האור, בעוד שנרות נוחים ומהירים יותר לשימוש. שתי הדרכים מקובלות, והבחירה תלויה בהעדפה אישית ובמנהג. לשאלה מעשית יש לשאול רב.",
    },
    {
      q: "כמה גבוה צריך להיות השמש?",
      a: "נהוג שהשמש יהיה גבוה או בולט משאר הנרות כדי להבחין בינו לבינם. בדגמים רבים קיים מקום ייעודי ומוגבה עבורו.",
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
