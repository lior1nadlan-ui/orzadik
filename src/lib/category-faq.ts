// Category-level FAQ used for Answer Engine Optimization (AEO): concise,
// quotable Q&A that feeds voice assistants, Google's "People also ask", and
// AI answer engines, and is emitted as FAQPage JSON-LD. Pure module — safe on
// both client and server (used in the route loader head and the component).

import { CONSUMER_POLICY } from "@/lib/business";

export type FaqItem = { q: string; a: string };

/**
 * Build a small, factual FAQ for a category. Answers are short (≈1-3 sentences)
 * so they are directly quotable as featured snippets / AI answers.
 *
 * Category names come from a supplier import and are arbitrary noun phrases
 * ("מפות שולחן + רנר", "סטים לחלאקה"), so the templates never glue a definite
 * article or a preposition straight onto the name — that produced broken
 * Hebrew like "האם המפות שולחן + רנר באתר כשרים?". Instead the category is
 * always addressed as a quoted noun phrase after "בקטגוריית …", which stays
 * grammatical for any name, in any gender or number.
 */
/**
 * Bespoke Q&A for the categories that actually earn impressions, keyed by slug.
 *
 * WHY THIS EXISTS. The generic builder below produces the SAME five questions
 * for all ~218 categories with only the name swapped in — five near-identical
 * FAQPage blocks per page, 218 times over. That is exactly the templated markup
 * Google discounts, and it answers nothing a shopper actually typed.
 *
 * Every entry here is written against a REAL query pulled from Search Console
 * (28 days to 2026-09-01) for that category's own page, with its impression
 * count recorded. They are the queries the store already appears for and loses:
 * positions 27-37, i.e. pages 3-4 — close enough that a page which genuinely
 * answers the question can move, unlike the 60-75 crowd where the gap is
 * authority, not copy.
 *
 * RULES FOR ADDING ONE: answer the question asked, in 1-3 sentences, factually.
 * Never state a price — the catalogue is 4,600 products wide and any number
 * here would be wrong for most of them and stale for the rest; say what the
 * price depends on instead. Never promise a stock level or a delivery date the
 * shipping policy does not already carry.
 */
const CATEGORY_FAQ_OVERRIDES: Record<string, FaqItem[]> = {
  // /category/marazim-chatanim — 120 impressions, position 31.0.
  // Real queries: "מארז לחתן" (73), "מארזים לחתן" (10), "ערכה לחתן" (32).
  "marazim-chatanim": [
    {
      q: "מה כולל מארז לחתן?",
      a: "מארז לחתן מרכז את מה שהחתן מקבל לקראת החתונה — לרוב טלית, כיסוי לטלית ולתפילין, ולעיתים גם סידור, ברכון או כיפה. ההרכב משתנה בין מארז למארז, והפריטים המדויקים מפורטים בעמוד של כל מארז.",
    },
    {
      q: "כמה עולה מארז לחתן?",
      a: "המחיר נגזר מהטלית שבמארז ומהפריטים הנלווים — טלית צמר מהודרת ומארז עשיר יעלו יותר ממארז בסיסי. באתר יש מארזים בכמה רמות, וכל מחיר מופיע בעמוד המארז עצמו.",
    },
    {
      q: "אפשר לרקום את שם החתן על המארז?",
      a: "כן, בחלק מהמארזים ניתן להוסיף רקמה אישית או חריטת לייזר עם שם החתן ותאריך החתונה. האפשרות מופיעה בעמוד המוצר כשהיא זמינה, ומומלץ להזמין מוקדם — פריט בהתאמה אישית דורש זמן הכנה נוסף.",
    },
    {
      q: "מתי כדאי להזמין מארז לחתן לפני החתונה?",
      a: "כדאי להזמין כמה שבועות לפני, ובמיוחד כשמבקשים רקמה או חריטה. מארז מוכן מהמדף נשלח לפי זמני המשלוח הרגילים; פריט מותאם אישית מתווסף לזה זמן הכנה.",
    },
  ],

  // /category/mezuzot-zchuchit — 173 impressions, position 36.5.
  // Real queries: "מזוזות זכוכית" (95), "מזוזות מעוצבות מזכוכית" (76).
  "mezuzot-zchuchit": [
    {
      q: "האם נרתיק מזוזה מזכוכית מתאים לחוץ?",
      a: "זכוכית עמידה בשמש ובגשם ואינה מתעוותת, ולכן נרתיקי זכוכית משמשים גם בפתחים חיצוניים. חשוב שהנרתיק יהיה אטום למים ומחובר היטב למשקוף, ובפתח חשוף לגשם ישיר עדיף נרתיק שסגור לחלוטין.",
    },
    {
      q: "איזה גודל נרתיק מזוזה צריך?",
      a: 'הגודל נקבע לפי הקלף, לא לפי המשקוף: קלף של 10 ס"מ דורש נרתיק שהחלל הפנימי שלו 10 ס"מ. הגודל המצוין בכל נרתיק באתר הוא מידת הקלף שהוא מיועד לו.',
    },
    {
      q: "האם הקלף כלול בנרתיק המזוזה?",
      a: 'לא. אנחנו מוכרים את הנרתיק בלבד ואיננו מוכרים קלף כתוב. את הקלף יש לרכוש מסופר סת"ם מוסמך, ומומלץ להביאו לבדיקה מעת לעת.',
    },
    {
      q: "איך מנקים נרתיק מזוזה מזכוכית?",
      a: "מטלית לחה ומעט חומר ניקוי עדין מספיקים. אין להשרות את הנרתיק במים כשהקלף בתוכו, ואין להשתמש בחומרים שוחקים שעלולים לשרוט את הזכוכית או לפגוע בהדפס.",
    },
  ],

  // /category/talitot — the tallit cluster is the store's biggest paid spend
  // ("טלית מהודרת": 392 impressions / 20 clicks in Google Ads, 90 days) and its
  // weakest organic showing. "כמה עולה טלית לבר מצווה" alone drew 24 organic
  // impressions at position 61.7 — a question query with no answer anywhere on
  // the site.
  talitot: [
    {
      q: "כמה עולה טלית?",
      a: "המחיר תלוי בעיקר בחומר ובגודל: טלית צמר מהודרת עולה יותר מטלית ממשי סינתטי, וטלית גדולה יותר מטלית קטנה. עטרה רקומה או פסים בעבודת יד מוסיפים גם הם. הטווח באתר רחב, וכל מחיר מופיע בעמוד הטלית.",
    },
    {
      q: "איזה גודל טלית לבחור?",
      a: "הגודל נמדד לפי הגובה של הלובש ולפי המנהג: יש הנוהגים בטלית שמכסה את רוב הגוף ויש המסתפקים בקטנה יותר. בכל טלית באתר מצוינות המידות המדויקות בסנטימטרים, ובבר מצווה נהוג לבחור מידה שתתאים גם כשהנער יגדל.",
    },
    {
      q: "מה ההבדל בין טלית צמר לטלית ממשי סינתטי?",
      a: "צמר הוא החומר שעליו חובת הציצית מן התורה לכל הדעות, והוא כבד וחם יותר. משי סינתטי קל, נוח בקיץ ופחות יקר. שתיהן נמכרות באתר, וההבחנה מופיעה בתיאור של כל טלית.",
    },
    {
      q: "האם הציציות קשורות?",
      a: "יש טליתות שמגיעות עם ציציות קשורות ויש שנמכרות בלעדיהן. מה שכלול מצוין בעמוד המוצר; אם לא צוין שהציציות כלולות — יש לרכוש ולקשור אותן בנפרד.",
    },
  ],
};

export function categoryFaq(categoryName: string, categorySlug?: string): FaqItem[] {
  // A bespoke set REPLACES the template rather than adding to it: the point is
  // that this page stops looking like the other 217.
  const bespoke = categorySlug ? CATEGORY_FAQ_OVERRIDES[categorySlug] : undefined;
  if (bespoke) return bespoke;

  const raw = categoryName?.trim();
  // Fallback keeps the sentences valid when a name is missing.
  const inCat = raw ? `בקטגוריית "${raw}"` : "באתר";
  return [
    {
      q: `לפי מה נבחרים המוצרים ${inCat}?`,
      a: `המוצרים ${inCat} נבחרים ב"אור זרוע לצדיק" בהקפדה על כשרות והידור, מתוך מחויבות לאיכות בכל פריט. לפרטים על ההכשר של פריט מסוים — צרו קשר ונשמח לסייע.`,
    },
    {
      q: `האם ניתן להוסיף רקמה או חריטה אישית למוצרים ${inCat}?`,
      a: `בחלק מהמוצרים ניתן להוסיף רקמה אישית או חריטת לייזר (למשל שם או ברכה). האפשרות מופיעה בעמוד המוצר כאשר היא זמינה.`,
    },
    {
      q: `מהם זמני המשלוח למוצרים ${inCat}?`,
      a: `אנו שולחים עד הבית בכל רחבי ישראל. זמן האספקה המשוער הוא ${CONSUMER_POLICY.deliveryMinDays}-${CONSUMER_POLICY.deliveryMaxDays} ימי עסקים ממועד אישור ההזמנה.`,
    },
    {
      q: `מה מדיניות ההחזרות וההחלפות?`,
      a: `ניתן להחזיר או להחליף מוצרים בהתאם למדיניות המפורטת בתקנון ובהתאם לחוק הגנת הצרכן. מוצרים שהותאמו אישית (רקמה/חריטה) מוגבלים להחזרה.`,
    },
    {
      q: `כיצד משלמים באתר?`,
      a: `התשלום מתבצע בכרטיס אשראי בעמוד סליקה מאובטח (Cardcom), בתקן אבטחה מלא.`,
    },
  ];
}

/** FAQPage JSON-LD object for a set of FAQ items. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
