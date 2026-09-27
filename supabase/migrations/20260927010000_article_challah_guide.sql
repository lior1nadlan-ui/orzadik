-- A buying guide for the Shabbat bread table — challah covers (128 active
-- products under /category/challah-covers) and challah trays, salt holders
-- and pot trivets (79 under /category/karshei-chala-sakinim). Neither shelf
-- had a guide of its own.
--
-- WHY THIS TOPIC. First in the content backlog of docs/improvement-workflow.md
-- after the candlesticks guide: 207 products on the same table, with real
-- buying questions (what size covers two challot, which material wipes clean,
-- glass or wood, what the salt is for).
--
-- GROUNDED IN THE CATALOGUE (live, 2026-09-27):
--   * covers: 97 faux leather, 16 satin, 4 velvet; sizes in the names run
--     42x42 to 61x45 cm, most 42x52 or 45x55; some embroidered "שבת ויום טוב"
--     or "שבת קודש", with raised letters, rivets or stones;
--   * trays: 57, about 46 glass (7 of them "בלתי שבירה"), 11 wood (with
--     epoxy), 6 acrylic; mostly 45x30 cm, the smallest 32x17; one comes with
--     a knife, some with a built-in salt holder or a "שבת ויום טוב" plaque;
--   * 12 crystal salt holders (מפיון), 10 glass pot trivets 19x19 cm.
--
-- ON ACCURACY. "לחם משנה" is quoted from its verse (Shemot 16:22). The reasons
-- for covering the bread and for salt are given as the reasons commonly
-- cited, with the Shulchan Aruch chapter for the salt (OC 167) and no seif
-- number claimed. Care advice is general and defers to the maker's label.
-- No prices.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'challah-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'challah-guide',
  'כיסוי חלה ומגש לחלה: איך בוחרים — גודל, חומר, מלחייה ותחתית לסיר',
  'מדריך לשולחן השבת: למה מכסים את החלות, איזה גודל כיסוי חלה מכסה שתי חלות, דמוי עור, סטן או קטיפה, מגש חלה מזכוכית, עץ או אקריליק, מלחייה, תחתית לסיר, מתנה ושמירה.',
  '<h2>שתי חלות, מגש וכיסוי</h2>
<p>בסעודות השבת בוצעים על שתי חלות — &quot;לחם משנה&quot;, זכר למן שירד במדבר כפול ביום השישי, כמו שנאמר &quot;ויהי ביום הששי לקטו לחם משנה&quot; (שמות טז, כב). החלות מונחות על מגש או קרש, ובזמן הקידוש הן מכוסות בכיסוי חלה. המדריך עוסק בצד המעשי: איזה כיסוי ואיזה מגש לבחור, ומה עוד כדאי שיהיה על השולחן. לשאלות הלכתיות למעשה יש לשאול רב.</p>

<h2>למה מכסים את החלות</h2>
<p>נוהגים לכסות את החלות מרגע שמניחים אותן על השולחן ועד אחרי הקידוש. בטעם המנהג מובאים בעיקר שני הסברים: זכר למן, שירד כשהוא מכוסה בטל מלמעלה ומלמטה — ולכן החלות מונחות בין המגש או המפה לבין הכיסוי; ושלא תהיה החלה &quot;בבושתה&quot; כשמברכים על היין לפניה. כך או כך, הכיסוי צריך לכסות את שתי החלות כולן.</p>

<h2>כיסוי חלה: איזה גודל</h2>
<p>מידות הכיסויים באתר נעות בין 42 על 42 ל-61 על 45 ס&quot;מ, ורובם 42 על 52 או 45 על 55 ס&quot;מ — מידה שמכסה בנוחות שתי חלות רגילות זו לצד זו. מי שאופה חלות גדולות או קלועות רחבות, או שמניח על השולחן יותר משתי חלות, ייטיב לבחור בכיסוי מהמידות הגדולות. כדאי למדוד את המגש: כיסוי שגדול מעט מהמגש מסתיר גם אותו ונראה מסודר.</p>

<h2>כיסוי חלה: איזה חומר</h2>
<ul>
  <li><strong>דמוי עור:</strong> כשלושה רבעים מהכיסויים באתר. שומר על צורתו, לא מתקמט וקל לניגוב — פירורים ושומן יורדים במטלית לחה. מגיע בגוונים לבן, שמנת, זהב ושמפניה, עם הבלטות, אותיות בולטות, ניטים או אבנים.</li>
  <li><strong>סטן:</strong> בד רך ומבריק, לרוב לבן עם רקמה, בהם כיתובים כמו &quot;שבת ויום טוב&quot; ו&quot;שבת קודש&quot;. מראה קלאסי, וצריך כביסה עדינה.</li>
  <li><strong>קטיפה:</strong> מראה מסורתי ועשיר. דורשת טיפול עדין כדי לשמור על הסיבים ועל הרקמה.</li>
</ul>
<p>כיסוי עם כיתוב &quot;שבת ויום טוב&quot; משמש גם בחגים, ולכן מתאים לכל השנה.</p>

<h2>מגש לחלה</h2>
<p>המגש מחזיק את החלות, אוסף את הפירורים וחוסך מפה מלוכלכת. רוב המגשים באתר במידה של כ-45 על 30 ס&quot;מ, שמתאימה לשתי חלות, ויש גם מגשים קטנים יותר, עד 32 על 17 ס&quot;מ, לחלה אחת או ללחמניות.</p>
<ul>
  <li><strong>זכוכית:</strong> רוב המגשים. חלקם עם פלקטה בכיתוב &quot;שבת ויום טוב&quot;, עם מראה ונצנצים, עם ידיות ורגליות או עם מלחייה מובנית. יש גם זכוכית עבה בלתי שבירה — בחירה טובה לבית עם ילדים.</li>
  <li><strong>עץ:</strong> עץ טבעי, חלקו משולב באפוקסי. חם למראה, וטוב לחיתוך. יש מגש שמגיע יחד עם סכין.</li>
  <li><strong>אקריליק:</strong> קל, עם כיתוב בזהב או בכסף.</li>
</ul>
<p>מי שחותך את החלה על המגש עצמו יעדיף עץ; על זכוכית ואקריליק עדיף לחתוך על קרש נפרד או לבצוע ביד, כדי לא לשרוט.</p>

<h2>מלחייה לשולחן השבת</h2>
<p>נוהגים לטבול את פרוסת החלה במלח לפני האכילה. השולחן ערוך (אורח חיים, סימן קסז) מביא שמצווה להביא מלח לשולחן לפני הבציעה, משום שהשולחן דומה למזבח. באתר יש מפיונים — מלחיות קריסטל קטנות עם פלקטה — שעומדים ליד המגש, ומגשים שהמלחייה משולבת בהם.</p>

<h2>תחתית לסיר</h2>
<p>הסיר החם — החמין או התבשיל — מגיע לשולחן השבת ישר מהפלטה. תחתית זכוכית של 19 על 19 ס&quot;מ, לרוב בכיתוב &quot;שבת ויום טוב&quot;, שומרת על השולחן ועל המפה מחום. יש גם תחתיות מזכוכית בלתי שבירה.</p>

<h2>כמתנה</h2>
<p>כיסוי חלה ומגש לחלה הם מתנה נפוצה לחתונה ולחנוכת בית: זוג שמקים בית מתחיל בהם את שולחן השבת שלו. אפשר להתאים את הכיסוי למגש בגוון — לבן וזהב, לבן וכסף — ולצרף מלחייה באותו סגנון.</p>

<h2>ניקוי ושמירה</h2>
<ul>
  <li><strong>דמוי עור:</strong> ניגוב במטלית לחה ומעט סבון עדין; לא לכבס במכונה.</li>
  <li><strong>סטן וקטיפה:</strong> לפי הוראות היצרן — בדרך כלל כביסה עדינה ביד, בלי לסחוט את הרקמה, וגיהוץ חם מעט מהצד ההפוך.</li>
  <li><strong>זכוכית ואקריליק:</strong> שטיפה ביד וייבוש במטלית רכה; בלי ספוג מחוספס, כדי לא לשרוט את ההדפס והפלקטה.</li>
  <li><strong>עץ:</strong> ניגוב וייבוש מיד, לא במדיח ולא בהשריה.</li>
</ul>

<p data-guide-cat-link="1">להתרשמות ולרכישה: מבחר <a href="/category/challah-covers">כיסויי החלה</a> ו<a href="/category/karshei-chala-sakinim">מגשי החלה, המלחיות ותחתיות הסיר</a> של אור זרוע לצדיק.</p>',
  6,
  'כיסוי חלה, מגש חלה, קרש לחלה, כיסוי חלה דמוי עור, כיסוי חלה רקמה, מגש חלה זכוכית, מגש חלה עץ, מלחייה לשבת, מפיון, תחתית לסיר, לחם משנה, מתנה לחנוכת בית',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T00:10:00Z'
)
ON CONFLICT (slug) DO NOTHING;
