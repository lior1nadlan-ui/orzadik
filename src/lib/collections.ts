// Occasion / holiday HUB config — the config-driven generalization of the
// bespoke /collection/personalized page.
//
// Judaica is calendar- and lifecycle-driven: people shop by OCCASION (בר מצווה,
// חתונה, בית חדש) and by HOLIDAY (ראש השנה, חנוכה, פסח), not only by product
// category. Each entry here becomes a rankable landing page at
// /collection/<slug> that curates several REAL category slugs into one
// gift-guide surface.
//
// Pure data + pure helpers. NO React and NO browser globals, so this is safe to
// import from the server (SSR / route loaders) as well as client components.
//
// HONESTY RULES baked in: intros and FAQ answers state only facts that are true
// of this catalog — no stock, delivery, return, price or review promises, and
// no urgency/scarcity. Personalization (רקמה/חריטה) is described exactly as the
// PDP and /collection/personalized already promise it: coordinated with the
// customer AFTER the order.
//
// SLUG DISCIPLINE: every slug in `categorySlugs` is a REAL row in
// public.categories that was verified to hold active, imaged products. The
// percent-encoded constants below are the literal Hebrew slugs stored in the
// DB (WordPress-era imports), reused verbatim so `.in("slug", …)` matches.

/** Literal percent-encoded Hebrew category slugs as stored in public.categories. */
const SIDDURIM = "sidurim"; // סידורים
const HATAN_MARAZIM = "marazim-chatanim"; // מארזים לחתנים

export type CollectionFaq = { q: string; a: string };

export type OccasionCollection = {
  /** URL segment: /collection/<slug>. Lowercase ASCII, hyphenated. */
  slug: string;
  /** Hebrew page <h1>. */
  title: string;
  /** Hebrew eyebrow above the title (calm cadence, per the design system). */
  eyebrow: string;
  /** 2-3 honest Hebrew sentences. No fabricated stock/delivery/review claims. */
  intro: string;
  /** <title> tag. Falls back to `${title} | אור זרוע לצדיק` if omitted. */
  metaTitle?: string;
  /** Meta description (≤ ~160 chars). Honest, keyword-aware. */
  metaDescription: string;
  /**
   * REAL category slugs (verified to hold active + imaged products) whose
   * products this collection lists. The loader unions them and dedupes by id.
   */
  categorySlugs: string[];
  /** Optional FAQ, grounded in true facts — feeds FAQPage JSON-LD + AEO. */
  faq?: CollectionFaq[];
};

/**
 * The curated occasion collections. ~7 lifecycle + holiday occasions, each
 * assembled only from category slugs that genuinely exist and are populated.
 */
export const OCCASION_COLLECTIONS: OccasionCollection[] = [
  {
    slug: "bar-mitzva",
    eyebrow: "אירוע",
    title: "מתנות לבר מצווה",
    intro:
      "בר המצווה הוא רגע הכניסה לעול מצוות — וטלית, תפילין וסידור הם המתנות שמלוות אותו לשנים. כאן ריכזנו טליתות, סטים לטלית ותפילין, כיסויים, תיקי תפילין, סידורים ועטרות מתוך הקטלוג. חלק מהפריטים ניתנים להוספת רקמת שם או חריטה אישית, שאותה נתאם איתכם לאחר ההזמנה.",
    metaTitle: "מתנות לבר מצווה — טלית, כיסויים ותיקי תפילין, סידור ועטרה | אור זרוע לצדיק",
    metaDescription:
      "מתנות לבר מצווה במקום אחד: טליתות, סטים לטלית ותפילין, כיסויים ותיקים, סידורים ועטרות. ניתן להוסיף רקמת שם או חריטה אישית בתיאום לאחר ההזמנה.",
    categorySlugs: [
      "talit-tefilin", // טלית ותפילין (קטגוריית-על)
      "talit-tefillin-sets", // כיסויים/סטים לטלית ותפילין (covers merged in, 2026-07)
      "tefillin-cases", // תיקי תפילין
      SIDDURIM, // סידורים
      "atara", // עטרה
    ],
    faq: [
      {
        q: "אילו מתנות מתאימות לבר מצווה?",
        a: "המתנות הקלאסיות לבר מצווה הן טלית, תפילין וכיסוי או תיק לתפילין, לצד סידור ועטרה. בעמוד זה מרוכזים מתוך הקטלוג של אור זרוע לצדיק טליתות, סטים וכיסויים לטלית ולתפילין, תיקי תפילין, סידורים ועטרות — התפילין עצמן אינן נמכרות בחנות.",
      },
      {
        q: "האם אפשר להוסיף רקמת שם או חריטה אישית?",
        a: "כן. בחלק מהפריטים — בהם כיסויים לטלית ותפילין, תיקי תפילין וסידורים — ניתן להוסיף רקמת שם או חריטת לייזר. את הגופן, הצבע והמיקום נתאם איתכם לאחר ההזמנה.",
      },
    ],
  },
  {
    slug: "chatan-kala",
    eyebrow: "אירוע",
    title: "מתנות לחתן ולכלה",
    intro:
      "לקראת החתונה נהוג להעניק לחתן טלית ומארז אישי, ולזוג פריטי יודאיקה לפתיחת הבית המשותף. כאן אספנו מארזים לחתנים, פריטי חתונה, כיסויים לטלית וברכונים לחלוקה לאורחים. בחלק מהפריטים ניתן להוסיף התאמה אישית ברקמה או בחריטה, בתיאום איתכם לאחר ההזמנה.",
    metaTitle: "מתנות לחתן ולכלה — מארזים לחתן, טלית וברכונים | אור זרוע לצדיק",
    metaDescription:
      "מתנות לחתן ולכלה: מארזים לחתנים, פריטי חתונה, כיסויים לטלית וברכונים לחלוקה לאורחים. חלק מהפריטים ניתנים להתאמה אישית בתיאום לאחר ההזמנה.",
    categorySlugs: [
      "chatan-kala", // חתן כלה
      "wedding", // חתונה
      HATAN_MARAZIM, // מארזים לחתנים
      "talit-tefillin-sets", // כיסויים/סטים לטלית ותפילין (לטלית החתן; covers merged in, 2026-07)
      "birchonim", // ברכונים (מזכרת לאורחים)
    ],
    faq: [
      {
        q: "מה נהוג להעניק לחתן ולכלה?",
        a: "לחתן נהוג להעניק טלית ומארז אישי, ולזוג פריטי יודאיקה לבית המשותף. ברכונים לחלוקה לאורחים הם מזכרת מקובלת מהאירוע. בעמוד זה מרוכזים פריטים מכל הקטגוריות האלה.",
      },
    ],
  },
  {
    slug: "chalaka",
    eyebrow: "אירוע",
    title: "סט חלאקה — לתספורת הראשונה",
    intro:
      "התספורת הראשונה (חלאקה) בגיל שלוש היא הצעד הראשון של הילד אל עולם המצוות. כאן ריכזנו סטים ופריטים לחלאקה מתוך הקטלוג, במגוון סגנונות. בחלק מהפריטים ניתן להוסיף כיתוב שם אישי, שאותו נתאם איתכם לאחר ההזמנה.",
    metaTitle: "סט חלאקה לתספורת הראשונה — כיפה וציצית | אור זרוע לצדיק",
    metaDescription:
      "סטים ופריטים לחלאקה (תספורת ראשונה) בגיל שלוש, במגוון סגנונות. בחלק מהפריטים ניתן להוסיף כיתוב שם אישי בתיאום לאחר ההזמנה.",
    categorySlugs: [
      "chalaka-set", // סט חלאקה
    ],
    faq: [
      {
        q: "מה כולל סט חלאקה?",
        a: "סטים לחלאקה כוללים בדרך כלל כיפה וציצית לתספורת הראשונה, ולעיתים אביזרים נלווים. בעמוד זה מרוכזים הסטים והפריטים לחלאקה מתוך הקטלוג של אור זרוע לצדיק.",
      },
    ],
  },
  {
    slug: "bait-chadash",
    eyebrow: "אירוע",
    title: "מתנות לבית חדש",
    intro:
      "כניסה לבית חדש היא הזדמנות להעניק מתנה שמלווה את המשפחה לאורך שנים. כאן אספנו מזוזות, פמוטים, כיסויי חלה, גביעי קידוש וברכות לבית — כל מה שמעצב פינה יהודית בבית. בחלק מהפריטים אפשר להוסיף שם או הקדשה אישית, בתיאום איתכם לאחר ההזמנה.",
    metaTitle: "מתנות לבית חדש — מזוזות, פמוטים, גביעי קידוש וברכות | אור זרוע לצדיק",
    metaDescription:
      "מתנות לבית חדש: מזוזות, פמוטים, כיסויי חלה, גביעי קידוש וברכות לבית. בחלק מהפריטים ניתן להוסיף שם או הקדשה אישית בתיאום לאחר ההזמנה.",
    categorySlugs: [
      "plastic", // מזוזות (קטגוריית-על)
      "candlesticks", // פמוטים
      "challah-covers", // כיסויי חלה
      "gviei-kidush", // גביעי קידוש וסטים ליין
      "blessings", // ברכות
    ],
    faq: [
      {
        q: "מהי מתנה מסורתית לבית חדש?",
        a: "מתנות נפוצות לבית חדש הן מזוזה, פמוטים לשבת, כיסוי חלה וגביע קידוש — פריטים שמעצבים פינה יהודית קבועה בבית. בעמוד זה מרוכזים פריטים מכל הקטגוריות האלה.",
      },
      {
        q: "האם אפשר להתאים את המתנה אישית?",
        a: "בחלק מהפריטים, כמו כיסויי חלה, ניתן להוסיף שם או הקדשה אישית. את פרטי ההתאמה נתאם איתכם לאחר ההזמנה.",
      },
    ],
  },
  {
    slug: "matanot-rosh-hashana",
    eyebrow: "חג",
    title: "מתנות לראש השנה",
    intro:
      "ראש השנה הוא זמן של איחולים מתוקים ושל שולחן חג ערוך. כאן ריכזנו את פריטי ראש השנה מהקטלוג לצד כיסויי חלה וגביעי קידוש שמשלימים את שולחן החג — מתנה מכובדת למארחים ולמשפחה. אפשר להוסיף לחלק מהפריטים כיתוב אישי בתיאום איתכם לאחר ההזמנה.",
    metaTitle: "מתנות לראש השנה — פריטי חג, כיסויי חלה וגביעי קידוש | אור זרוע לצדיק",
    metaDescription:
      "מתנות לראש השנה: פריטי חג לצד כיסויי חלה וגביעי קידוש שמשלימים את שולחן החג. מתנה מכובדת למארחים ולמשפחה מתוך הקטלוג.",
    categorySlugs: [
      "rosh-hashana", // ראש השנה
      "challah-covers", // כיסויי חלה (חלה עגולה)
      "gviei-kidush", // גביעי קידוש וסטים ליין
    ],
    faq: [
      {
        q: "מה מתאים לתת כמתנה לראש השנה?",
        a: "מתנות מקובלות לראש השנה כוללות כיסוי חלה, גביע קידוש ופריטים לשולחן החג. בעמוד זה מרוכזים פריטי ראש השנה לצד פריטי שולחן שמשלימים אותם.",
      },
    ],
  },
  {
    slug: "matanot-hanukkah",
    eyebrow: "חג",
    title: "מתנות לחנוכה",
    intro:
      "חנוכה הוא חג של אור, ומתנה לחנוכה מלווה את המשפחה בכל שנה מחדש. כאן ריכזנו את פריטי החנוכה מהקטלוג — חנוכיות ואביזרים נלווים — במגוון סגנונות וגדלים. בחרו מתנה שמדליקה את הבית באור של חג.",
    metaTitle: "מתנות לחנוכה — חנוכיות ואביזרים | אור זרוע לצדיק",
    metaDescription:
      "מתנות לחנוכה: חנוכיות ואביזרים נלווים במגוון סגנונות וגדלים מתוך הקטלוג של אור זרוע לצדיק. מתנה שמלווה את המשפחה בכל שנה מחדש.",
    categorySlugs: [
      "hanukkah", // חנוכה
    ],
    faq: [
      {
        q: "איזו מתנה מתאימה לחנוכה?",
        a: "חנוכייה היא המתנה הקלאסית לחנוכה, במגוון סגנונות וחומרים. בעמוד זה מרוכזים פריטי החנוכה מתוך הקטלוג של אור זרוע לצדיק.",
      },
    ],
  },
  {
    slug: "matanot-pesach",
    eyebrow: "חג",
    title: "מתנות לפסח",
    intro:
      "ליל הסדר מרכז סביבו את כל המשפחה, ופריטי הסדר הם מתנה שמלווה את החג שנה אחר שנה. כאן אספנו את פריטי הפסח מהקטלוג לצד נטלות וגביעי קידוש שמשלימים את שולחן הסדר — מתנה מכובדת למארחים ולכל בית.",
    metaTitle: "מתנות לפסח — פריטי סדר, נטלות וגביעי קידוש | אור זרוע לצדיק",
    metaDescription:
      "מתנות לפסח: פריטי ליל הסדר לצד נטלות וגביעי קידוש שמשלימים את שולחן הסדר. מתנה מכובדת למארחים ולכל בית מתוך הקטלוג.",
    categorySlugs: [
      "passover", // פסח
      "washing-cups", // נטלות
      "metal-kiddush-cups", // גביעי קידוש ממתכת
    ],
    faq: [
      {
        q: "מה נהוג לתת כמתנה לפסח?",
        a: "פריטי ליל הסדר — כמו נטלה וגביע קידוש — הם מתנה שמלווה את החג שנה אחר שנה. בעמוד זה מרוכזים פריטי פסח לצד פריטי שולחן הסדר.",
      },
    ],
  },
];

/** Look up a collection by its URL slug. Returns undefined if not curated. */
export function getCollection(slug: string): OccasionCollection | undefined {
  return OCCASION_COLLECTIONS.find((c) => c.slug === slug);
}
