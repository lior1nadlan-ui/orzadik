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
//   - No claim about what a product will be WORTH later. An FAQPage
//     acceptedAnswer is the exact string an answer engine quotes as fact, and
//     resale/value-retention is not something the shop can substantiate about
//     goods it sells; material composition, durability and care are. See the
//     kiddush-cup materials answer, which said "ולרוב שומר על ערכו" inside the
//     answer that steers a reader toward the dearer material.
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
// stripInBodyFaq deletes that block WHOLESALE, so every one of its 15 stored
// questions (3 per guide, verified against the live `articles` rows) has to be
// accounted for here or it silently stops existing on the page. Disposition,
// per question rather than per guide:
//   carried  — 11 questions, one Q&A each.
//   folded   — 4 questions whose exact phrasing is redundant but whose ANSWER
//              carried content the kept entry lacked; that content was merged
//              into the kept answer rather than dropped with the heading:
//                "כל כמה זמן צריך לבדוק תפילין?" → the kept מומלץ variant, which
//                  had no actual cadence; the body's "אחת לכמה שנים" and its
//                  defer-to-a-scribe line are now in it.
//                "האם אפשר להשתמש בחנוכיה חשמלית?" → the kept ידי-חובה entry,
//                  whose answer now says "אפשר להשתמש בה" in as many words and
//                  carries the body's "לשאול רב".
//                "האם אפשר לקדש על כל כוס?" → the kept מכסף entry, whose answer
//                  already opened with that exact phrase; the body's
//                  "לפרטים ולמנהגים המדויקים יש לשאול רב" was missing and is
//                  restored.
//                "איזה חומר הכי מומלץ?" → the materials entry. Its "אין תשובה
//                  אחת" is the guide's one explicit refusal to name a best
//                  (i.e. dearest) material, so it is the last line to lose.
// Nothing is dropped for being merely inconvenient: an earlier pass justified
// four of these as "duplicates" and three of the strings then existed nowhere
// on the page at all — "האם עדיף צמר או ויסקוז?" among them, which is now back
// as its own Q&A because "which is better" and "what is the difference" are
// different questions with different answers.
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
  // All three body questions carried. "האם עדיף צמר או ויסקוז?" was previously
  // dropped as a duplicate of the material question — it is not one. The
  // material question is descriptive (what each fabric IS: weight, warmth,
  // climate, kashrut) and the עדיף question is a choice question whose honest
  // answer is that it is custom and personal preference, ending in a deferral
  // to a rav. Different query, different answer, and the dropped one was the
  // only place the guide said "ויסקוז" in the reader's own words. To keep the
  // two from re-converging, the hiddur/custom framing now lives ONLY in the
  // עדיף answer — "ונחשבות מהודרות" was removed from the material answer.
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
      a: "טליות צמר בעלות מסורת הלכתית ארוכה, והן חמות וכבדות יותר. טליות מבד סינתטי או ויסקוז קלות ונוחות יותר לאקלים חם ולרוב זולות יותר. שני הסוגים יכולים להיות כשרים כאשר הציציות נעשו כהלכה.",
    },
    {
      q: "האם עדיף צמר או ויסקוז?",
      a: "רבים נוהגים להעדיף צמר משום הידור המצווה, בעוד אחרים בוחרים ויסקוז מטעמי נוחות ואקלים. זו שאלה של מנהג והעדפה אישית, ובמקרה של התלבטות הלכתית יש לשאול רב.",
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
  // edot-custom question. The body's "כל כמה זמן צריך לבדוק תפילין?" is folded
  // into the inspection question below — the two strings differ by one word
  // (צריך / מומלץ), so keeping both would be the same question twice. But the
  // body answer was not the poorer of the two: it was the only one that
  // answered "how often" with an actual interval and that deferred to a
  // scribe/rav, and this entry said only "מעת לעת". Both are now here.
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
      a: 'רבים נוהגים להביא את התפילין לבדיקה אצל סופר סת"ם מוסמך אחת לכמה שנים, וכן בכל חשש לפגיעה — במיוחד אם הן ישנות או נחשפו ללחות ולחום. הבדיקה מוודאת שהאותיות נותרו שלמות וכשרות. יש מנהגים שונים בתדירות המדויקת, ולמעשה יש לשאול סופר או רב לפי המצב.',
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
  // prose. Body FAQ merged in: "איך יודעים שהכסף אמיתי?"; "האם אפשר לקדש על כל
  // כוס?" and "איזה חומר הכי מומלץ?" are folded (see the disposition list at
  // the top of this file — both left content behind, and it was brought over).
  //
  // The three middle entries used to answer sterling-vs-plated three times in a
  // row: the materials survey compared the two, the dedicated comparison
  // compared them again, and "איך יודעים שהכסף אמיתי?" repeated the comparison's
  // own first sentence (the 925 hallmark and the solid-weight cue) almost word
  // for word. All three questions are real — two are Search Console queries and
  // the third is what a shopper actually does holding the cup — so the fix is to
  // give each ONE job and let it keep it:
  //   survey     → which materials exist and on what axis you pick between them;
  //                it now only notes that silver and plate LOOK alike and points
  //                at the next answer for why they age differently.
  //   comparison → what each one is made of and what that does over years.
  //   verifying  → how to tell them apart in the hand. The hallmark and weight
  //                cues moved out of the comparison and live only here.
  //
  // The survey's "כסף שטרלינג נחשב מהודר ועמיד ולרוב שומר על ערכו" is gone. It
  // was a value-retention claim about goods the shop sells, sitting in the
  // acceptedAnswer that pushes toward the dearer material — unsubstantiable, and
  // shaped exactly like the string an answer engine repeats as fact. What is
  // verifiable took its place: composition, how the finish ages, and care. The
  // hiddur-mitzvah framing is not repeated here either; it already has its own
  // answer two entries up ("האם חובה שגביע הקידוש יהיה מכסף?").
  "kiddush-cup-guide": [
    {
      q: "מהו הנפח המזערי הנדרש בגביע קידוש?",
      a: 'הגביע צריך להכיל לפחות שיעור "רביעית", שהערכתו נעה בין כ-86 מ"ל לכ-150 מ"ל לפי שיטות הפוסקים השונות. לכן נהוג לבחור גביע שמכיל בבירור יותר מהשיעור המזערי כדי לצאת ידי חובה לכל הדעות.',
    },
    {
      q: "האם חובה שגביע הקידוש יהיה מכסף?",
      a: "לא. אפשר לקדש על כל כוס שלמה ונקייה המחזיקה את השיעור הנדרש, לרבות זכוכית או קריסטל. גביע כסף נחשב הידור מצווה ומנהג רווח, אך אינו חובה. לפרטים ולמנהגים המדויקים יש לשאול רב.",
    },
    {
      q: "מה ההבדל בין סוגי גביעי קידוש שיש בשוק?",
      a: "החומרים הנפוצים הם כסף שטרלינג, כסף מצופה, זכוכית וקריסטל, חרסינה וקרמיקה, ומתכת קלה בגימור מוזהב. כסף שטרלינג וכסף מצופה נראים דומים זה לזה ונבדלים בעיקר בהרכב ובעמידות הגימור לאורך השנים; זכוכית וקריסטל קלים לניקוי ומאפשרים לראות את צבע היין; חרסינה וקרמיקה ייחודיים ופחות נפוצים; ומתכת קלה בגימור מוזהב נוחה במשקל ובתחזוקה. אין חומר אחד שמתאים לכולם, והבחירה נעשית לפי המראה, המשקל ביד, נוחות התחזוקה, התקציב והמנהג.",
    },
    {
      q: "מה ההבדל בין גביע קידוש מכסף טהור לגביע מכסף מצופה?",
      a: "כסף שטרלינג הוא סגסוגת של 92.5% כסף, וגוף הגביע כולו עשוי ממנה, ולכן שריטה או שחיקה אינן חושפות מתכת אחרת. גביע מכסף מצופה הוא גוף מתכת בסיסי עם שכבת כסף דקה: המראה דומה והמחיר נגיש יותר, אך הציפוי עלול להישחק עם השנים, במיוחד באזורי אחיזה ושפשוף, ואז נחשפת המתכת שמתחתיו.",
    },
    {
      q: "איך יודעים שהכסף אמיתי?",
      a: 'מחפשים את חותמת "925", המוטבעת לרוב בבסיס הגביע או בשוליו — היא מציינת כסף שטרלינג. בנוסף, גביע מכסף מלא מורגש כבד ומוצק ביד ודפנותיו אינן דקות מדי. בגביע מצופה שהציפוי בו כבר נשחק אפשר להבחין בגוון מתכת שונה בשוליים ובאזורי האחיזה.',
    },
    {
      q: "האם גביע קידוש מכסף דורש תחזוקה מיוחדת?",
      a: "תחזוקה פשוטה אך קבועה. מנגבים את הגביע לאחר השימוש במטלית רכה ויבשה, מאחסנים במקום יבש כדי להפחית הכהיה, ונמנעים מחומרי ניקוי חריפים ומספוגיות שוחקות. בגביע מצופה כסף מקפידים על ניגוב רך במיוחד כדי לא לשחוק את הציפוי. חשוב לנגב שאריות יין, שעלולות להכתים או להאיץ את ההכהיה.",
    },
  ],

  // חנוכיה
  // Body FAQ merged in: "שמן או נרות — מה עדיף?" and the shamash-height
  // question. The body's "האם אפשר להשתמש בחנוכיה חשמלית?" is folded into the
  // electric-menorah question below rather than kept alongside it — one topic,
  // one answer. Its two missing pieces are restored: the answer now says
  // "אפשר להשתמש בה" in the asker's own words (and, crucially, "אך לא במקומה",
  // which the body said and this entry did not), and it defers to a rav, as
  // this file's own honesty rule requires wherever practice varies.
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
      a: "לדעת רוב הפוסקים אין יוצאים ידי חובת ההדלקה בחנוכיה חשמלית לכתחילה, ומעדיפים נרות שמן או שעווה. אפשר להשתמש בה לקישוט או בנוסף להדלקה כשרה, אך לא במקומה, ולמעשה יש לשאול רב.",
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
