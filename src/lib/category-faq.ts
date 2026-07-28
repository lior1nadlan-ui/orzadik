// Category-level FAQ used for Answer Engine Optimization (AEO): concise,
// quotable Q&A that feeds voice assistants, Google's "People also ask", and
// AI answer engines, and is emitted as FAQPage JSON-LD. Pure module — safe on
// both client and server (used in the route loader head and the component).

import { CONSUMER_POLICY } from "@/lib/business";

export type FaqItem = { q: string; a: string };

/**
 * Build a small, factual FAQ for a category. Answers are short (≈1–3 sentences)
 * so they are directly quotable as featured snippets / AI answers.
 *
 * Category names come from a supplier import and are arbitrary noun phrases
 * ("מפות שולחן + רנר", "סטים לחלאקה"), so the templates never glue a definite
 * article or a preposition straight onto the name — that produced broken
 * Hebrew like "האם המפות שולחן + רנר באתר כשרים?". Instead the category is
 * always addressed as a quoted noun phrase after "בקטגוריית …", which stays
 * grammatical for any name, in any gender or number.
 */
export function categoryFaq(categoryName: string): FaqItem[] {
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
      a: `אנו שולחים עד הבית בכל רחבי ישראל. זמן האספקה המשוער הוא ${CONSUMER_POLICY.deliveryMinDays}–${CONSUMER_POLICY.deliveryMaxDays} ימי עסקים ממועד אישור ההזמנה.`,
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
