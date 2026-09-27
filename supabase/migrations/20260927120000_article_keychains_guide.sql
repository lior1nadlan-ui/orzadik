-- A buying guide for key chains and magnets — "מחזיקי מפתחות ומגנטים", 198
-- active products, the largest shelf on the site with no guide (measured
-- 2026-09-27, backlog item 1 in docs/improvement-workflow.md).
--
-- GROUNDED IN THE CATALOGUE (live, 2026-09-27, across the 198, distinct):
--   * nearly all small metal key chains, 3-6.5 cm, gold or nickel finish;
--     74 set with stones;
--   * shapes and symbols: 71 hamsa, then Star of David, menorah, חי,
--     pomegranate, the map or flag of Israel (18 Israel-themed);
--   * texts: "שמע ישראל", "אם אשכחך ירושלים", "מזל", "בלי עין הרע",
--     "הצלחה"; 4 carry תפילת הדרך (Hebrew and Russian), 5 are in Russian;
--   * 26 hold a tiny Tehillim (3 cm cases, or faux leather); 2 are small
--     scrolls with ברכת כהנים or another text inside;
--   * 11 are pens on a key ring; 4 are fridge magnets (ceramic, polyresin,
--     epoxy).
--
-- ON ACCURACY. The hamsa and "עין הרע" are described as tradition, with no
-- promise of protection — the same line the honesty migrations drew for
-- product copy (20260927050000). תפילת הדרך is cited to שולחן ערוך אורח
-- חיים קי, and the guide says a key chain reminds, it does not replace
-- saying it. Worn items that carry verses or the Name go to גניזה, as the
-- blessings guide says; the restroom question is deferred to a rabbi. No
-- prices.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'machzikei-maftechot-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'machzikei-maftechot-guide',
  'מחזיק מפתחות עם משמעות: חמסה, תהילים, תפילת הדרך ומזכרת מישראל',
  'מדריך לבחירת מחזיק מפתחות יהודי: חמסה, מגן דוד ושמע ישראל, מחזיק עם תהילים קטן, תפילת הדרך, מזכרת מישראל ומגנטים — מה ההבדלים, מה לבדוק, ומה עושים עם מחזיק שיש בו פסוקים כשהוא מתבלה.',
  '<h2>מחזיק מפתחות עם משמעות</h2>
<p>מחזיק מפתחות הוא הפריט שהולך איתנו לכל מקום — ולכן רבים בוחרים בו סמל או פסוק: חמסה, מגן דוד, שמע ישראל, תהילים קטן או תפילת הדרך. זו גם מתנה קטנה ונוחה: לאורחים באירוע, לחבר שיוצא לדרך, או מזכרת מישראל לבני משפחה בחו&quot;ל. באתר יש כמאתיים פריטים כאלה, רובם ממתכת בגימור זהב או ניקל. המדריך מסביר את ההבדלים ביניהם.</p>

<h2>מה יש באתר</h2>
<ul>
  <li><strong>חמסה:</strong> הצורה הנפוצה ביותר — כ-70 דגמים, רבים משובצים באבנים, חלקם עם כיתוב כמו &quot;מזל&quot;, &quot;הצלחה&quot; או &quot;בלי עין הרע&quot;.</li>
  <li><strong>סמלים:</strong> מגן דוד, מנורה, חי, רימון, ומפת ישראל או דגל ישראל.</li>
  <li><strong>פסוקים ותפילות:</strong> &quot;שמע ישראל&quot;, &quot;אם אשכחך ירושלים&quot;, ומחזיקים עם תפילת הדרך — בעברית וברוסית.</li>
  <li><strong>תהילים קטן:</strong> ספר תהילים זעיר בתוך נרתיק מתכת קטן או בכריכת דמוי עור, וגם מחזיק בצורת מגילה עם ברכת כהנים בתוכה.</li>
  <li><strong>עט על מחזיק מפתחות:</strong> עט קטן ממתכת שנתלה על הצרור.</li>
  <li><strong>מגנטים למקרר:</strong> מקרמיקה, פולירזין או אפוקסי.</li>
</ul>
<p>הצורה, הגימור, המידות והכיתוב של כל דגם כתובים בשם המוצר ונראים בתמונות שלו. אם משהו לא ברור — שאלו אותנו לפני ההזמנה.</p>

<h2>איך בוחרים</h2>
<ul>
  <li><strong>גודל:</strong> רוב המחזיקים באורך 3-6.5 ס&quot;מ. מחזיק קטן נוח בכיס; גדול יותר קל למצוא בתיק.</li>
  <li><strong>גימור:</strong> זהב או ניקל (כסוף). שיבוץ אבנים מוסיף ברק, אבל שווה לבדוק שהאבנים מוגנות אם הצרור נזרק הרבה לתיק.</li>
  <li><strong>כיתוב:</strong> פסוק, ברכה או סמל בלבד — לפי מה שמדבר אליכם או אל מי שמקבל את המתנה.</li>
  <li><strong>שפה:</strong> יש דגמים ברוסית ובאנגלית — מתאים למי שקורא בשפות האלה או למזכרת לחו&quot;ל.</li>
</ul>

<h2>חמסה — מה היא</h2>
<p>החמסה היא צורה של כף יד, סמל מסורתי נפוץ בקהילות צפון אפריקה והמזרח, ומזוהה עם ברכה ועם השמירה מעין הרע. זו מסורת עממית ולא מצווה, ובחירה בה היא עניין של טעם ושל מנהג המשפחה.</p>

<h2>תפילת הדרך</h2>
<p>תפילת הדרך נאמרת כשיוצאים לדרך מחוץ לעיר (שולחן ערוך, אורח חיים קי). מחזיק מפתחות עם הנוסח עוזר לזכור ומאפשר לקרוא ממנו — אבל הוא לא פוטר מאמירת התפילה. מתי בדיוק אומרים אותה ובאילו נסיעות — כדאי לשאול רב.</p>

<h2>מחזיק עם תהילים או פסוקים</h2>
<p>במחזיק שיש בו תהילים, פסוקים או שם ה&#39; — יש קדושה לטקסט. כשהוא מתבלה, נוהגים לא לזרוק אותו לפח אלא להעביר לגניזה. בשאלות כמו כניסה איתו לבית השימוש — נהוג לשאול רב.</p>

<h2>מחזיק מפתחות כמתנה</h2>
<p>מחזיקים קטנים מתאימים למתנה לאורחים באירוע — בר מצווה או חתונה — או כתוספת קטנה למתנה גדולה. מחזיק עם תפילת הדרך הוא מתנה נפוצה למי שמתחיל לנהוג או יוצא לטיול, ומחזיק בצורת מפת ישראל או עם &quot;אם אשכחך ירושלים&quot; הוא מזכרת מישראל.</p>

<p data-guide-cat-link="1">להתרשמות ולרכישה: כל <a href="/category/machzikei-maftechot-magnetim">מחזיקי המפתחות והמגנטים</a> של אור זרוע לצדיק.</p>',
  4,
  'מחזיק מפתחות, מחזיק מפתחות חמסה, מחזיק מפתחות תפילת הדרך, מחזיק מפתחות עם תהילים, מחזיק מפתחות מגן דוד, מחזיק מפתחות שמע ישראל, מזכרת מישראל, מגנט ירושלים',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T03:05:00Z'
)
ON CONFLICT (slug) DO NOTHING;
