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
  // סט הבדלה: איך בוחרים (20260927020000_article_havdalah_guide.sql). Re-cut
  // from the guide's own sections. The blessing order and the torch-like
  // flame (OC 298) are stated at siddur level; the besamim blessing, which
  // differs between communities, and the wine customs are described as such.
  "havdalah-guide": [
    {
      q: "מה צריך להבדלה?",
      a: 'כוס יין, בשמים ונר. מברכים עליהם לפי הסדר המכונה יבנ"ה — יין, בשמים, נר, הבדלה — ומסיימים בברכת "המבדיל בין קודש לחול". סט הבדלה מקבץ יחד כוס, כלי בשמים ומחזיק נר, ולרוב גם מגש.',
    },
    {
      q: "למה נר ההבדלה עשוי כמה פתילות?",
      a: "השולחן ערוך (אורח חיים, סימן רצח) מביא שמצווה מן המובחר לברך על אבוקה — אש של כמה פתילות יחד. לכן נר הבדלה מיוחד עשוי בדרך כלל כמה פתילות, ויש המדליקים שני נרות צמודים.",
    },
    {
      q: "אילו בשמים שמים בכלי הבשמים?",
      a: "ציפורן, הדס, עלי בשמים יבשים או כל צמח ריחני, ומחליפים מדי פעם כשהריח נחלש. נוסח הברכה על הבשמים משתנה בין העדות, ויש המברכים לפי סוג הבשמים; לשאלה מעשית יש לשאול רב.",
    },
    {
      q: "אפשר להבדיל בגביע הקידוש?",
      a: "כן. מי שיש לו גביע קידוש יכול להשתמש בו גם להבדלה, ולהשלים כלי בשמים, מחזיק נר ומגש. סט הבדלה שלם נוח כשרוצים שכל הכלים יעמדו יחד על מגש אחד.",
    },
    {
      q: "למה צריך מגש להבדלה?",
      a: "יש הנוהגים למלא את הכוס עד שהיין גולש, לסימן ברכה, ויש המכבים את הנר ביין שנשפך. המגש אוסף את היין והשעווה ושומר על השולחן, ובחלק מהמגשים נוסח ההבדלה מודפס.",
    },
  ],
  // ברכת הבית (20260927040000_article_birkat_habait_guide.sql). Verses are
  // cited; hanging אשר יצר outside the bathroom and גניזה are stated as common
  // practice and deferred to a rabbi; no segula claim for the chamsa.
  "birkat-habait-guide": [
    {
      q: "איפה תולים ברכת הבית?",
      a: "לרוב בכניסה לבית או בסלון, במקום שרואים אותו. ברכת הבית היא מנהג ולא מצווה, ולכן אין לה מקום קבוע כמו למזוזה. ברכה שנתלית מחוץ לדלת, חשופה לשמש ולגשם, עדיף שתהיה מחומר עמיד כמו אקריליק או מתכת.",
    },
    {
      q: "איפה תולים את ברכת אשר יצר?",
      a: "נוהגים לתלות אותה מחוץ לדלת השירותים ולא בתוכם, כדי שאפשר יהיה לברך מתוכה אחרי היציאה ונטילת הידיים. לשאלה הלכתית למעשה יש לשאול רב.",
    },
    {
      q: "יש הבדל בין אשר יצר אשכנז לאשר יצר עדות המזרח?",
      a: "כן, נוסח הברכה שונה מעט בין העדות. כדאי לבחור את הנוסח שבו מתפללים בבית, ובמתנה — לברר מראש את הנוסח של המשפחה.",
    },
    {
      q: "מה זה מזמור לתודה?",
      a: 'פרק ק בספר תהילים, שנפתח במילים "מזמור לתודה הריעו לה\' כל הארץ". זו מתנה נפוצה של הכרת תודה, לבית חדש או למי שרוצים להודות לו.',
    },
    {
      q: "מה עושים עם ברכה ישנה שמופיע בה שם ה'?",
      a: "נוהגים לא לזרוק אותה לפח אלא להעביר לגניזה, כמו דפים אחרים שיש בהם שם ה'. לשאלה מעשית יש לשאול רב.",
    },
  ],
  // שם אישי (20260927030000_article_personalization_guide.sql). Unlike the
  // guide body, these answers carry nothing store-specific — no price, no
  // turnaround: the methods are described as crafts, the cancellation rule is
  // quoted from the law, and timing is left to the shop to confirm.
  "personalization-guide": [
    {
      q: "מה ההבדל בין רקמה, הטבעה וחריטת לייזר?",
      a: "ברקמה האותיות נתפרות בחוט על בד או על דמוי עור, ולכן היא נפוצה בתיקי טלית ותפילין ובכיסויי חלה. בהטבעה האותיות נלחצות אל תוך החומר, וכך מסמנים שם על כריכת סידור. בחריטת לייזר קרן לייזר חורטת את האותיות על פני החומר בקו חד ומדויק.",
    },
    {
      q: "מה כותבים על תיק טלית ותפילין לבר מצווה?",
      a: "לרוב את השם הפרטי ושם המשפחה של חתן בר המצווה, ויש המוסיפים את תאריך העלייה לתורה. כיתוב קצר קל יותר לקריאה, בייחוד על תיק התפילין הקטן.",
    },
    {
      q: "מה כותבים על כיסוי חלה?",
      a: 'נפוץ לכתוב "משפחת" ואת שם המשפחה. במתנה לחתונה יש הבוחרים בשמות בני הזוג או בתאריך החתונה.',
    },
    {
      q: "אפשר לבטל הזמנה של מוצר עם שם אישי?",
      a: "לפי חוק הגנת הצרכן, זכות הביטול אינה חלה על טובין שיוצרו במיוחד עבור הצרכן, ולכן מוצר עם רקמה, הטבעה או חריטה אישית בדרך כלל אינו ניתן לביטול לאחר שהחלה ההתאמה. הזכויות במקרה של פגם או אי-התאמה נשמרות. לכן חשוב לבדוק את האיות לפני ההזמנה.",
    },
    {
      q: "כמה זמן לפני האירוע כדאי להזמין מוצר עם שם?",
      a: "מוקדם ככל האפשר. מוצר אישי מוכן רק אחרי שהכיתוב, הפונט והמיקום מאושרים, ולכן לוקח לו יותר זמן להגיע ממוצר מהמדף. כשיש תאריך יעד, כמו בר מצווה או חתונה, כדאי לברר עם החנות לפני ההזמנה אם המוצר יגיע בזמן.",
    },
  ],
  // כיסוי חלה ומגש לחלה (20260927010000_article_challah_guide.sql). Re-cut
  // from the guide's own sections. "לחם משנה" is its verse; the reasons for
  // covering and for salt are given as the commonly cited ones, with the
  // Shulchan Aruch chapter for the salt; care defers to the maker's label.
  "challah-guide": [
    {
      q: "למה מכסים את החלות בשבת?",
      a: 'נוהגים לכסות את החלות עד אחרי הקידוש. בטעם המנהג מובאים בעיקר שני הסברים: זכר למן, שירד במדבר כשהוא מכוסה בטל מלמעלה ומלמטה, ושלא תהיה החלה "בבושתה" כשמברכים על היין לפניה. לשאלות למעשה יש לשאול רב.',
    },
    {
      q: "איזה גודל כיסוי חלה לבחור?",
      a: 'הכיסוי צריך לכסות את שתי החלות כולן. מידה של 42 על 52 או 45 על 55 ס"מ מכסה בנוחות שתי חלות רגילות; לחלות גדולות או ליותר משתי חלות כדאי לבחור כיסוי גדול יותר, ורצוי שיהיה מעט גדול מהמגש.',
    },
    {
      q: "מה עדיף — כיסוי חלה מדמוי עור או מבד?",
      a: "דמוי עור שומר על צורתו, לא מתקמט ומתנקה בניגוב במטלית לחה, ולכן נוח לשימוש שבועי. סטן וקטיפה רכים ומסורתיים יותר, לרוב עם רקמה, וצריכים כביסה עדינה לפי הוראות היצרן.",
    },
    {
      q: "מגש לחלה מזכוכית או מעץ?",
      a: "זכוכית נראית מהודרת, קלה לשטיפה ומגיעה גם בגרסה עבה בלתי שבירה. עץ חם למראה ומתאים לחיתוך החלה עליו. על מגש זכוכית או אקריליק עדיף לחתוך על קרש נפרד, כדי לא לשרוט.",
    },
    {
      q: "למה שמים מלח על שולחן השבת?",
      a: "נוהגים לטבול את פרוסת החלה במלח לפני האכילה. השולחן ערוך (אורח חיים, סימן קסז) מביא שמצווה להביא מלח לשולחן לפני הבציעה, משום שהשולחן דומה למזבח.",
    },
  ],
  // פמוטים: איך בוחרים (20260926120000_article_pamotim_guide.sql). Re-cut from
  // the guide's own sections. The two candles are tied to the two verses the
  // guide quotes; a candle per child and oil vs candles are described as
  // custom and deferred to a rav. "בגוון כסף" is kept distinct from silver,
  // because the shelf has no sterling pieces.
  "pamotim-guide": [
    {
      q: "למה מדליקים שני נרות בשבת?",
      a: 'המנהג הנפוץ הוא להדליק שני נרות כנגד שתי הלשונות של מצוות השבת בעשרת הדיברות: "זכור את יום השבת לקדשו" (שמות כ, ח) ו"שמור את יום השבת לקדשו" (דברים ה, יב). לכן פמוטים נמכרים לרוב בזוג.',
    },
    {
      q: "מתי בוחרים פמוט רב-קני?",
      a: "יש נוהגות להוסיף נר על כל ילד שנולד, ולכן יש פמוטים של חמישה ותשעה קנים ומעמדים שמחזיקים כמה פמוטים קטנים יחד. מנהג המשפחה קובע, ולשאלה מעשית יש לשאול רב.",
    },
    {
      q: "מאיזה חומר כדאי לבחור פמוטים?",
      a: 'קריסטל כבד, יציב ומחזיר את אור הנרות. זכוכית קלה יותר ולעיתים מעוטרת. פולימר עמיד בנפילות ומתאים לבית עם ילדים. מתכת כמו אלומיניום וניקל לא נשברת. "בגוון כסף" או "מוכסף" מתאר את הגימור, לא כסף טהור.',
    },
    {
      q: "שמן או נרות — מה עדיף?", // em-dash, not a numeric range: bidi-safe here
      a: "יש המהדרים להדליק בשמן זית, ורבים מדליקים בנרות — שתי הדרכים מקובלות. מי שמדליק בשמן צריך כוסיות שנכנסות לבית הנר של הפמוט, ולכן כדאי למדוד אותו לפני שבוחרים כוסיות.",
    },
    {
      q: "איך מסירים שעווה מפמוטים?",
      a: "מכניסים את הפמוט לזמן קצר למקפיא, והשעווה מתקשה ומתקלפת. את השאריות מסירים אחרי שהפמוט חזר לטמפרטורת החדר, במים פושרים ובלי לגרד בכלי חד, כי שינוי חד בטמפרטורה עלול לסדוק קריסטל וזכוכית.",
    },
  ],
  // ברכון: איך בוחרים (20260926110000_article_birchon_guide.sql). Re-cut from
  // the guide's own sections. The three nusachim are described, not ranked,
  // and the answer names the trap the catalogue itself falls into ("ספרד" is
  // not "ספרדי"). Which foods take which bracha is stated at the level every
  // birchon prints; the quantity that obliges one is deferred to a rav, as is
  // genizah.
  "birchon-guide": [
    {
      q: "מה ההבדל בין נוסח אשכנז, נוסח ספרד ונוסח עדות המזרח בברכון?",
      a: "אלה נוסחי התפילה של קהילות שונות, וברכת המזון נאמרת בכל אחד מהם במילים ובתוספות שונות מעט. נוסח אשכנז הוא של קהילות אשכנז; נוסח עדות המזרח הוא של רוב הקהילות הספרדיות והמזרחיות; ונוסח ספרד, למרות שמו, הוא הנוסח שנוהגים בו החסידים וקהילות נוספות, והוא שונה מנוסח עדות המזרח. בוחרים ברכון בנוסח שנוהגים בו בבית.",
    },
    {
      q: "כמה ברכונים צריך במעמד?",
      a: "כלל אצבע: כמספר היושבים הקבועים סביב השולחן, ועוד אחד או שניים לאורחים. בסעודה שמברכים בה בזימון נוח שיהיה ברכון לפני כל אחד מהמברכים, כדי שכולם יוכלו לעקוב אחרי המזמן.",
    },
    {
      q: "מה ההבדל בין ברכת המזון, מעין שלוש ובורא נפשות?",
      a: 'ברכת המזון נאמרת אחרי סעודה שאכלו בה לחם. הברכה מעין שלוש ("על המחיה") נאמרת אחרי מזונות, יין או פירות משבעת המינים, וברכת "בורא נפשות" אחרי שאר המאכלים והמשקאות. ברכונים רבים כוללים את שלושתן. לשאלות למעשה, כמו כמה צריך לאכול כדי להתחייב בברכה, יש לשאול רב.',
    },
    {
      q: "איך מנקים מעמד ברכונים מאקריליק?",
      a: "במטלית רכה ולחה, ואם צריך עם מעט סבון עדין. לא משתמשים בספוג מחוספס או בחומרי ניקוי חריפים כמו אמוניה או אלכוהול, שעלולים לשרוט את האקריליק או להעכיר אותו. כדאי גם להשאיר רווח בין המעמד ללהבת הנרות.",
    },
    {
      q: "מה עושים עם ברכון ישן או קרוע?",
      a: "בברכון כתובים שמות קדושים, ולכן לא זורקים אותו לפח אלא מעבירים אותו לגניזה. בבתי כנסת רבים יש מקום לאיסוף שמות לגניזה. לשאלות בנושא יש לשאול רב.",
    },
  ],
  // נטלה: איך בוחרים (20260926090000_article_natla_guide.sql). Re-cut from
  // the guide's own sections. The vessel conditions are the Shulchan Aruch's
  // (OC 159) as the guide states them; the revi'it is a range of opinions, as
  // in the kiddush-cup set; how many times to pour and mayim acharonim are
  // described as custom and deferred to a rav.
  "natla-guide": [
    {
      q: "מה נדרש מכלי לנטילת ידיים?",
      a: 'לפי השולחן ערוך (אורח חיים, סימן קנט) הכלי צריך להיות שלם, בלי חור או סדק שהמים דולפים דרכו; להכיל לפחות רביעית — כ-86 מ"ל לפי שיטות מקובלות, ויש המחמירים ביותר; והמים צריכים להישפך מכוחו של אדם. לשאלות למעשה יש לשאול רב.',
    },
    {
      q: "למה לנטלה יש שתי ידיות?",
      a: "כדי שאפשר יהיה להחליף ידיים בנוחות ולשפוך על כל יד בתורה. רבים גם מקפידים שהשפה שממנה שופכים תהיה שלמה וחלקה, ולכן לנטלה אין בדרך כלל פיה.",
    },
    {
      q: "מאיזה חומר כדאי לבחור נטלה?",
      a: "פולימר קל, עמיד ומגיע בגוונים רבים — מתאים לשימוש יומיומי. אקריליק שקוף ומהודר ומתאים גם למתנה, אך יש לנקות אותו ברכות. אלומיניום קל ולא נשבר. עץ חם וייחודי, וצריך לייבש אותו אחרי כל שימוש.",
    },
    {
      q: "מה ההבדל בין נטילת ידיים למים אחרונים?",
      a: 'נטילת ידיים נעשית לפני אכילת לחם, בשפיכת מים על כל יד ובברכת "על נטילת ידיים". מים אחרונים הם שטיפת קצות האצבעות במעט מים בסוף הסעודה, לפני ברכת המזון. יש המקפידים על מים אחרונים ויש שאינם נוהגים בהם — נוהגים לפי מנהג המשפחה.',
    },
    {
      q: "איך מנקים אבנית מנטלה?",
      a: "משרים את הנטלה במים עם מעט חומץ או חומצת לימון, שוטפים ומייבשים. באקריליק ובציפוי זהב מנקים בספוג רך בלבד, בלי חומרים שוחקים, ונטלת עץ לא מכניסים למדיח.",
    },
  ],
  // כיפה: איך בוחרים (20260925140000_article_kippa_guide.sql). Every answer is
  // a re-cut of the guide's own prose — the sources it quotes (Shabbat 156b,
  // Shulchan Aruch OC 2:6), its material sections, its size section and its
  // care list — so nothing here claims more than the page does. The community
  // associations are descriptive ("נפוצה", "מזוהה") and the answer says in as
  // many words that the difference is custom, not law. The size answer points
  // to the cm figure because the store sells the same kind of kippa both by
  // diameter and by a size number that varies between makers.
  "kippa-guide": [
    {
      q: "למה חובשים כיפה?",
      a: 'כיסוי הראש לגברים הוא מנהג קדום ומקובל בכל קהילות ישראל. כבר בגמרא (מסכת שבת קנו ע"ב) נאמר "כסי רישך, כי היכי דתיהוי עלך אימתא דשמיא" — כסה את ראשך כדי שתהיה עליך יראת שמים — והשולחן ערוך (אורח חיים ב, ו) פוסק שלא ילך אדם ארבע אמות בגילוי הראש. לשאלות למעשה יש לשאול רב.',
    },
    {
      q: "מה ההבדל בין כיפת קטיפה לכיפה סרוגה?",
      a: "כיפת קטיפה תפורה מפלחי בד, לרוב שחורה, ונפוצה בציבור החרדי ובקהילות ספרדיות ומסורתיות רבות. כיפה סרוגה נסרגת מחוט במגוון צבעים ודוגמאות, ומזוהה במיוחד עם הציבור הדתי־לאומי. ההבדל הוא בחומר, במראה ובמנהג הקהילה — לא בדין.",
    },
    {
      q: "איך יודעים איזו מידת כיפה לקנות?",
      a: 'מודדים את קוטר הכיפה בסנטימטרים: מניחים כיפה שנוחה לכם על משטח ישר, מודדים מצד לצד ומשווים לקוטר שבתיאור המוצר. רוב הכיפות הנפוצות הן בקוטר 17-20 ס"מ. מספרי מידה כמו "גודל 3" או "גודל 6" אינם אחידים בין יצרנים, ולכן עדיף להסתמך על הס"מ.',
    },
    {
      q: "מה זו כיפת DMC?",
      a: "כיפה הנסרגת ביד מחוט כותנה דק של המותג DMC. הסריגה צפופה ועדינה יותר מכיפה סרוגה רגילה, ובדגמים הקשיחים הכיפה שומרת על צורתה לאורך זמן.",
    },
    {
      q: "איך מנקים כיפה סרוגה?",
      a: "כביסה ביד במים פושרים עם סבון עדין, בלי לסחוט. מייבשים על משטח ישר ומעצבים את הכיפה לצורתה בזמן שהיא עדיין לחה. כיפת קטיפה לא מכבסים — מברישים אותה בעדינות במברשת רכה.",
    },
  ],
  // The three guides linked 2026-09-27 (20260927090000_orphan_guides_honesty.sql).
  // General, not store-specific: no stock, price or delivery. Where custom
  // varies (the chalaka date, the curl) the answer says so and defers to the
  // community rav; kashrut of a synthetic tallit is stated as bechira-talit
  // states it, with the same deferral.
  "mechir-talit-bar-mitzva": [
    {
      q: "מה קובע את המחיר של טלית?",
      a: "בעיקר החומר (צמר או בד סינתטי), הגודל, האם הציציות קשורות וכלולות, ורמת העטרה — מודפסת, רקומה במכונה או בעבודת יד. רקמת שם היא תוספת נפרדת.",
    },
    {
      q: "האם הציציות כלולות במחיר של טלית?",
      a: "לא תמיד. יש טליתות שנמכרות עם ציציות קשורות ויש שנמכרות בלעדיהן, ואז צריך לקנות חוטים ולקשור אותם בנפרד. לפני שמשווים מחירים, כדאי לוודא ששני המחירים כוללים את אותו הדבר.",
    },
    {
      q: "איזו מידת טלית קונים לבר מצווה?",
      a: "נהוג לבחור מידה שתתאים לנער גם כשיגדל, ולא את המידה המדויקת של גיל שלוש עשרה. כדאי לבדוק את המידות בסנטימטרים ולא רק את שם המידה, שאינו אחיד בין יצרנים.",
    },
    {
      q: "האם טלית יקרה יותר היא כשרה יותר?",
      a: "לא. גם טלית מבד סינתטי וגם טלית צמר יכולות להיות כשרות כשהציציות נעשו כהלכה. ההבדל במחיר הוא בחומר, בגודל ובעיטור — הידור ונוחות, לא כשרות. בשאלה הלכתית למעשה יש לשאול רב.",
    },
  ],
  "set-chalaka-madrich": [
    {
      q: "באיזה גיל עושים חלאקה?",
      a: 'נהוג בגיל שלוש. יש העורכים אותה ביום ההולדת או בסמוך לו, ויש הממתינים לל"ג בעומר. המנהג משתנה בין קהילות ועדות, ובשאלות של מועד נהוג לשאול את רב הקהילה.',
    },
    {
      q: "למה החלאקה נחשבת לתחילת החינוך למצוות?",
      a: "מגיל שלוש נוהגים להרגיל את הילד לכיפה ולציצית, ויש המלמדים אותו באותו יום את האותיות הראשונות. לכן הטקס הוא לא רק תספורת, אלא גם צעד ראשון בחינוך.",
    },
    {
      q: "מה עושים עם התלתל שנגזר?",
      a: "אין בכך חובה. יש השומרים את התלתל הראשון למזכרת, בכיסוי או בנרתיק ייעודי, ויש הנוהגים אחרת — כמנהג המשפחה.",
    },
    {
      q: "מה לבדוק לפני שקונים סט חלאקה?",
      a: "מה בדיוק יש בסט, כי ההרכב משתנה מסט לסט; את המידה של פריטי הלבוש, כמו גופיית ציצית; ואם מוסיפים את שם הילד — את האיות, לפני ההזמנה.",
    },
  ],
  // קופת צדקה (20260927110000_article_tzedaka_box_guide.sql). The verse and
  // the Shulchan Aruch line are the ones the body cites; candle lighting and
  // ma'aser are stated as custom, and money questions go to a rabbi.
  // מחזיקי מפתחות (20260927120000_article_keychains_guide.sql). The hamsa is
  // described as tradition, with no promise of protection; תפילת הדרך is
  // cited to its chapter and the key chain is said not to replace it; the
  // restroom question is deferred to a rabbi, as the body does.
  // שטנדרים ומוצרי בית כנסת (20260927131000_article_shtender_guide.sql). The
  // verse is the one the body cites; not touching the parchment and the
  // yahrzeit candle are stated as custom, the electric-candle question and the
  // rimonim fit are deferred, as the body does.
  "shtender-guide": [
    {
      q: "מה זה שטנדר?",
      a: "מעמד שמחזיק ספר פתוח ומוטה לעבר הקורא — ללימוד, לתפילה או לקריאה ארוכה בלי להחזיק את הספר ביד. יש שטנדרים שולחניים ויש שטנדרים שעומדים על הרצפה, כמו בבית הכנסת.",
    },
    {
      q: "איזה גודל שטנדר צריך?",
      a: "לפי הספר: ספר גדול כמו גמרא צריך משטח רחב, ולסידור או לתהילים מספיק שטנדר קטן. כדאי להשוות את מידות השטנדר למידות הספר שבו לומדים.",
    },
    {
      q: "למה משתמשים ביד לספר תורה?",
      a: "היד היא מחוג שבעזרתו הקורא בתורה עוקב אחרי המילים. נוהגים שלא לגעת בקלף של ספר התורה ביד, והיד גם עוזרת לא לאבד את המקום בקריאה.",
    },
    {
      q: "מה הם רימונים לספר תורה?",
      a: "עיטורים שמולבשים על ראשי עצי החיים של ספר התורה, לרוב עם פעמונים קטנים. כדי שיתאימו, הם צריכים להתאים לעובי עצי החיים של הספר.",
    },
    {
      q: "האם אפשר להדליק נר נשמה חשמלי?",
      a: "רבים משתמשים בנר חשמלי או סולרי ביום השנה, ויש המקפידים על נר של שמן או שעווה. זו שאלה של מנהג והלכה, ולכן כדאי לשאול רב.",
    },
  ],
  "machzikei-maftechot-guide": [
    {
      q: "האם מחזיק מפתחות עם תפילת הדרך פוטר מאמירתה?",
      a: "לא. תפילת הדרך נאמרת כשיוצאים לדרך מחוץ לעיר (שולחן ערוך, אורח חיים קי). מחזיק עם הנוסח עוזר לזכור ומאפשר לקרוא ממנו, אבל את התפילה צריך לומר.",
    },
    {
      q: "מה המשמעות של חמסה?",
      a: "החמסה היא צורה של כף יד, סמל מסורתי נפוץ בקהילות צפון אפריקה והמזרח, המזוהה עם ברכה ועם השמירה מעין הרע. זו מסורת עממית ולא מצווה.",
    },
    {
      q: "מה עושים עם מחזיק מפתחות שיש בו תהילים או פסוקים כשהוא מתבלה?",
      a: "טקסט של תהילים, פסוקים או שם ה' לא זורקים לפח — נוהגים להעביר אותו לגניזה. בשאלות למעשה, כמו כניסה איתו לבית השימוש, נהוג לשאול רב.",
    },
    {
      q: "איזה מחזיק מפתחות מתאים כמזכרת מישראל?",
      a: 'מחזיק בצורת מפת ישראל או דגל ישראל, או עם "אם אשכחך ירושלים". הם קטנים וקלים לשליחה, ויש גם דגמים עם כיתוב באנגלית או ברוסית.',
    },
  ],
  "kupat-tzedaka-guide": [
    {
      q: "איפה מעמידים קופת צדקה בבית?",
      a: "במקום גלוי שעוברים בו — במטבח, בכניסה או ליד הפמוטים, כדי שיהיה קל לתת לפני הדלקת נרות. קופה גלויה גם מזכירה לילדים לתת.",
    },
    {
      q: "למה נותנים צדקה לפני הדלקת נרות שבת?",
      a: "זה מנהג נפוץ: בערב שבת, לפני ההדלקה, שמים מטבעות בקופה כהכנה לשבת. זה מנהג ולא חובה, והוא משתנה בין משפחות וקהילות.",
    },
    {
      q: "האם נותנים צדקה לפני תפילה?",
      a: 'השולחן ערוך כותב "טוב ליתן צדקה קודם תפילה" (אורח חיים צב, י). לכן יש המניחים מטבע בקופה לפני שמתפללים, בבית או בבית הכנסת.',
    },
    {
      q: "מה עושים עם הכסף שנאסף בקופה?",
      a: "מעבירים אותו לעמותה, לגבאי צדקה או לנזקקים. כסף שהופרש לצדקה מיועד לה, ובשאלות למעשה — למשל אם אפשר לשנות את ייעודו — נהוג לשאול רב.",
    },
    {
      q: "מהו מעשר כספים?",
      a: "מנהג להפריש עשירית מההכנסה לצדקה. יש בו פרטים רבים — ממה מפרישים ולמי נותנים — ולכן כדאי לשאול רב.",
    },
  ],
  "karit-labrit-madrich": [
    {
      q: "האם יש דין מיוחד בכרית לברית?",
      a: "לא. הכרית אינה תשמיש קדושה ואין בה חובה הלכתית — היא נוהג ונוחות. יש השומרים אותה למזכרת, ויש שמעבירים אותה הלאה במשפחה.",
    },
    {
      q: "אפשר להשתמש באותה כרית לכמה בריתות?",
      a: "כן, וזה נפוץ במשפחות ובבתי כנסת. לשם כך מתאימה כרית עם ברכה או עיטור כללי, ולא כרית עם שם ותאריך של תינוק מסוים.",
    },
    {
      q: "מתי צריך שהכרית תהיה מוכנה?",
      a: "ברית המילה נערכת ביום השמיני ללידה, אלא אם נדחתה מסיבה רפואית. זה חלון קצר, ולכן רבים דואגים לכרית עוד לפני הלידה.",
    },
    {
      q: "מה ההבדל בין כרית מדמוי עור לכרית מסאטן?",
      a: "דמוי עור קל לניגוב ושומר על מראה מסודר לאורך זמן. סאטן רך ומבריק ונראה חגיגי, אבל רגיש יותר לכתמים ולקמטים. ההבדל הוא במראה ובתחזוקה, לא בהלכה.",
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
