-- A buying guide for the "תכשיטים" shelf — 64 active products (children:
-- תכשיטים כסף טהור 37, תכשיטי נרוסטה ורודיום 12, צמידים טבעות ועגילים
-- 13), next in docs/improvement-workflow.md (measured 2026-09-27).
--
-- GROUNDED IN THE CATALOGUE (live, 2026-09-27, distinct):
--   * 34 named "כסף טהור 925": 25 necklaces (plain, מגן דוד, חי, חמסה,
--     שמע ישראל, מפת ישראל, "האש שלי") and 9 bracelets (חי, חמסה, מגן דוד,
--     שמע ישראל);
--   * stainless steel ("נירוסטה" / "סטיינלס" / "פלדת אל חלד"), gold- or
--     silver-toned: a Star-of-David bracelet (22 cm), a חי necklace and an
--     "אני לדודי" necklace (50 cm);
--   * rhodium plating: a "יברכך" pendant, a mezuzah-shaped pendant (its
--     copy: a parchment can be added, screw at the bottom), a Star-of-David
--     necklace sold 5 to a pack, "עין" necklaces set with stones (45 cm);
--   * 4 jewelry boxes (plastic, printed, 1-3 tiers);
--   * 15 retail display stands and sets. 11 of them hold 20-100 pieces yet
--     cost 13-47 NIS on the site, a per-piece price against a name that
--     says a full stand; that is for the owner (docs/improvement-workflow.md),
--     so the guide does not point to them.
--
-- ON ACCURACY. "כסף טהור 925" is how the names say it; the guide explains
-- that 925 is sterling (92.5% silver), not 999 fine silver, and that
-- plating is a coat that wears. Stones are "stones", not gems. Verses are
-- cited (דברים ו, ד; שיר השירים ו, ג; במדבר ו, כד); the hamsa is tradition;
-- a mezuzah pendant is jewelry, not a doorpost mezuzah, and the parchment
-- question goes to a rabbi. No prices.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'tachshitim-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'tachshitim-guide',
  'תכשיטים יהודיים: מגן דוד, חי, חמסה ושמע ישראל — כסף 925, נירוסטה או ציפוי',
  'מדריך לבחירת תכשיט יהודי: מה ההבדל בין כסף 925, נירוסטה וציפוי רודיום, איזה סמל ואיזה פסוק, אורך שרשרת וצמיד, תליון בצורת מזוזה, ואיך שומרים על תכשיט כסף שלא יושחר.',
  '<h2>תכשיט עם משמעות</h2>
<p>תליון מגן דוד, חי, חמסה או שמע ישראל הוא תכשיט שנושאים קרוב ללב — ומתנה אישית לחג, ליום הולדת או לאירוע. באתר יש שרשראות וצמידים מכסף 925, תכשיטי נירוסטה וציפוי רודיום, וקופסאות לתכשיטים. המדריך מסביר את ההבדלים בין החומרים ובין הסמלים.</p>

<h2>מה ההבדל בין החומרים</h2>
<ul>
  <li><strong>כסף 925:</strong> כ-35 שרשראות וצמידים באתר, שבשמם &quot;כסף טהור 925&quot;. המספר 925 אומר שבמתכת 92.5% כסף — זה כסף סטרלינג, התקן המקובל לתכשיטים. כסף נקי לגמרי (999) רך מדי לתכשיט, ולכן מוסיפים לו מתכת אחרת לחוזק. כסף משחיר עם הזמן, ומנקים אותו בקלות.</li>
  <li><strong>נירוסטה (פלדת אל חלד):</strong> עמידה, לא מחלידה ולא משחירה. יש באתר צמיד מגן דוד, שרשרת חי ושרשרת &quot;אני לדודי&quot; — בגוון כסף או זהב.</li>
  <li><strong>ציפוי רודיום:</strong> מתכת בסיס שמצופה שכבה דקה של רודיום, שנותנת ברק. הציפוי יכול להישחק עם הזמן, בחיכוך ובמים.</li>
</ul>
<p>החומר של כל תכשיט כתוב בשם המוצר ובמפרט שלו. אם משהו לא ברור — שאלו אותנו לפני ההזמנה.</p>

<h2>איזה סמל או פסוק</h2>
<ul>
  <li><strong>מגן דוד</strong> — הסמל המוכר ביותר; יש בתליון ובצמיד.</li>
  <li><strong>חי</strong> — המילה &quot;חי&quot;, שערכה בגימטריה 18, ומסמלת חיים.</li>
  <li><strong>חמסה</strong> — צורת כף יד, סמל מסורתי מקהילות צפון אפריקה והמזרח. מסורת עממית, לא מצווה.</li>
  <li><strong>שמע ישראל</strong> — &quot;שמע ישראל ה&#39; אלהינו ה&#39; אחד&quot; (דברים ו, ד).</li>
  <li><strong>אני לדודי</strong> — &quot;אני לדודי ודודי לי&quot; (שיר השירים ו, ג), מתנה נפוצה לבני זוג ולכלה.</li>
  <li><strong>יברכך</strong> — מתוך ברכת כהנים (במדבר ו, כד).</li>
  <li><strong>מפת ישראל</strong> — תליון בצורת הארץ.</li>
</ul>

<h2>מידות</h2>
<p>אורך השרשרת כתוב בשם המוצר: 45 ס&quot;מ יושבת גבוה על הצוואר, 50 ס&quot;מ יורדת מעט נמוך יותר. צמיד הנירוסטה באורך 22 ס&quot;מ. שימו לב גם לכמות: יש דגם שנמכר כחמישייה באריזה, וזה כתוב בשמו.</p>

<h2>תליון בצורת מזוזה</h2>
<p>תליון מזוזה הוא תכשיט — הוא לא מחליף מזוזה על פתח הבית. לפי תיאור המוצר אפשר להכניס לתוכו קלף (יש הברגה בתחתית). שאלות בעניין קלף בתכשיט — נהוג לשאול רב.</p>

<h2>איך שומרים על תכשיט</h2>
<ul>
  <li><strong>כסף:</strong> מנקים במטלית לניקוי כסף; שומרים יבש ומכוסה, רחוק מבושם ומכלור.</li>
  <li><strong>ציפוי:</strong> מורידים לפני מקלחת, בריכה וספורט, כדי שהציפוי יחזיק יותר.</li>
  <li><strong>נירוסטה:</strong> מספיק לנגב במטלית.</li>
</ul>
<p>באתר יש גם קופסאות לתכשיטים, בקומה אחת עד שלוש קומות — מקום מסודר לשמור בו את התכשיטים, וגם מתנה בפני עצמה.</p>

<h2>תכשיט כמתנה</h2>
<p>תליון או צמיד הם מתנה אישית לבת מצווה, ליום הולדת או לחג. שרשרת &quot;אני לדודי&quot; מתאימה לכלה או לבן הזוג, ותליון מפת ישראל הוא מזכרת מישראל.</p>

<p data-guide-cat-link="1">להתרשמות ולרכישה: כל <a href="/category/tachshitim">התכשיטים</a> של אור זרוע לצדיק.</p>',
  5,
  'תכשיטים יהודיים, שרשרת מגן דוד, שרשרת חי, שרשרת חמסה, שרשרת שמע ישראל, צמיד מגן דוד, כסף 925, שרשרת כסף 925, אני לדודי, תליון מזוזה, מתנה לבת מצווה',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T03:50:00Z'
)
ON CONFLICT (slug) DO NOTHING;
