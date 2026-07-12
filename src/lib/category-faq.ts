// Category-level FAQ used for Answer Engine Optimization (AEO): concise,
// quotable Q&A that feeds voice assistants, Google's "People also ask", and
// AI answer engines, and is emitted as FAQPage JSON-LD. Pure module — safe on
// both client and server (used in the route loader head and the component).

export type FaqItem = { q: string; a: string };

/**
 * Build a small, factual FAQ for a category. Answers are short (≈1–3 sentences)
 * so they are directly quotable as featured snippets / AI answers.
 */
export function categoryFaq(categoryName: string): FaqItem[] {
  const name = categoryName?.trim() || "המוצרים";
  return [
    {
      q: `האם ה${name} באתר כשרים ומהודרים?`,
      a: `כן. ה${name} ב"אור זרוע לצדיק" נבחרים בהקפדה על כשרות והידור, מתוך מחויבות לאיכות בכל פריט.`,
    },
    {
      q: `אפשר להוסיף רקמה או חריטה אישית ל${name}?`,
      a: `בחלק מהמוצרים ניתן להוסיף רקמה אישית או חריטת לייזר (למשל שם או ברכה). האפשרות מופיעה בעמוד המוצר כאשר היא זמינה.`,
    },
    {
      q: `מהם זמני המשלוח ל${name}?`,
      a: `אנו שולחים עד הבית בכל רחבי ישראל. זמן האספקה המשוער הוא 3–7 ימי עסקים ממועד ההזמנה.`,
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
