-- Two articles for the topics where the CATEGORY is stuck and an article wins.
--
-- THE EVIDENCE, from Search Console (3 months to 2026-09-01):
--   /articles/kiddush-cup-guide          192 impressions, position 35.2
--   /category/crystal-ceramic-kiddush-cups 37 impressions, position 62.0
-- Same topic. The article outranks its own category by ~27 positions and draws
-- five times the impressions. /articles/mezuza-guide sits at position 13. Across
-- the site the pattern holds: articles are this store's strongest organic asset,
-- and category listings are stuck in the 60s because the gap there is authority,
-- not wording — which is why no amount of category copy-editing would move them.
--
-- So this migration adds an article for the two stuck topics carrying the most
-- category impressions and having no article at all:
--   /category/karit-labrit  110 impressions, position 67.7  ("כרית לברית": 64)
--   /category/chalaka-set   122 impressions, position 64.5  ("סט חלאקה": 52)
--
-- Both are gift/ceremony purchases made under time pressure (a brit is eight
-- days after birth; a chalaka is tied to a birthday or to Lag BaOmer), which is
-- exactly when a buyer reads before buying.
--
-- ON ACCURACY. Where a custom varies between communities the text says so and
-- sends the reader to their rabbi rather than ruling. No prices are stated, for
-- the same reason as the tallit article: a number in prose is a consumer claim
-- the store then has to honour, and it goes stale.
--
-- Articles live in the `articles` table and have no admin screen, so a migration
-- is the repository's own way to add one — see 20260626030000_seed_articles.sql.

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, is_published)
VALUES
  ('karit-labrit-madrich', 'כרית לברית — מה זה, איך בוחרים ומתי להזמין', 'כרית לברית: מה תפקידה בברית המילה, איך בוחרים חומר וגודל, מה רוקמים עליה ומתי צריך להזמין כדי להספיק את היום השמיני.', '<h2>מה זו כרית לברית</h2>
<p>כרית הברית היא הכרית שעליה מונח התינוק במהלך ברית המילה. היא מונחת על כיסא של אליהו או מוחזקת בידי הסנדק, ותפקידה מעשי לגמרי — להחזיק את התינוק ביציבות וברכות — אך היא גם אחד הפריטים הבודדים מן הברית שנשמרים אחר כך שנים.</p>
<p>בשל כך רבים בוחרים כרית מרוקמת בשם התינוק ובתאריך הברית, והיא הופכת ממוצר חד־פעמי למזכרת. נפוץ מאוד שהכרית ניתנת כמתנה מן הסבים.</p>

<h2>איך בוחרים כרית לברית</h2>

<h3>החומר</h3>
<p>קטיפה היא הבחירה המסורתית והנפוצה ביותר — היא נראית מכובדת ומחזיקה רקמה היטב. סאטן קל יותר ומבריק. דמוי עור קל לניקוי ועמיד יותר לאורך זמן. אין כאן שאלה הלכתית, אלא העדפה של מראה ותחזוקה.</p>

<h3>הגודל והיציבות</h3>
<p>כרית טובה לברית אינה רכה מדי: תינוק בן שמונה ימים צריך משטח שתומך בו ואינו שוקע. כדאי לבדוק את המידות ואת מידת הקושי של המילוי, ולא רק את המראה.</p>

<h3>הרקמה</h3>
<p>הרקמה הנפוצה כוללת את שם התינוק ואת תאריך הברית, ולעיתים גם ברכה או הכיתוב "כיסא של אליהו". חשוב לזכור ששם התינוק נודע לרוב רק בברית עצמה, ולכן מי שרוצה רקמה עם השם צריך לתאם זאת מראש עם החנות ולהבין מה זמן ההכנה.</p>

<h2>מתי להזמין</h2>
<p>ברית נקבעת לשמונה ימים מהלידה, וזה חלון קצר. כרית מוכנה מהמדף נשלחת לפי זמני המשלוח הרגילים; כרית עם רקמה אישית דורשת זמן הכנה נוסף, ולכן משפחות רבות מזמינות עוד לפני הלידה ומשאירות את הרקמה לשלב מאוחר יותר, או בוחרות רקמה ללא שם.</p>

<h2>שאלות שחוזרות</h2>
<h3>האם יש דין מיוחד בכרית?</h3>
<p>לא. הכרית אינה תשמיש קדושה ואין בה חובה הלכתית — היא נוהג ונוחות. יש הנוהגים לשמור אותה למזכרת ויש שמעבירים אותה הלאה במשפחה.</p>
<h3>אפשר להשתמש באותה כרית לכמה בריתות?</h3>
<p>בהחלט, וזה נפוץ במשפחות ובבתי כנסת. במקרה כזה עדיף לבחור רקמה כללית ולא רקמה עם שם ותאריך.</p>

<h2>לראות את הדגמים</h2>
<p>אפשר לעבור על <a href="/category/karit-labrit">כריות לברית שבאתר</a> ולראות מידות, חומרים ואפשרויות רקמה בכל דגם.</p>', 5, 'כרית לברית, כרית ברית, כרית לברית מילה, כיסא של אליהו, מתנה לברית', true),
  ('set-chalaka-madrich', 'סט חלאקה — מה כלול, מה לבדוק ומתי להזמין', 'סט חלאקה לגיל שלוש: מה בדרך כלל כלול בסט, איך בוחרים מידת טלית קטן, מה לבדוק לגבי הציציות והרקמה, ומתי כדאי להזמין.', '<h2>מה זה סט חלאקה</h2>
<p>חלאקה (או "אפשערן") היא התספורת הראשונה של הילד בגיל שלוש. סט חלאקה הוא האוסף שמכינים לאירוע — לרוב כיפה, טלית קטן עם ציציות, ולעיתים גם שקית מעוצבת, מספריים לטקס וכיסוי לכתפיים. הרעיון אינו רק התספורת: זה גם הרגע שבו מתחילים להרגיל את הילד לכיפה, לציצית ולאותיות.</p>

<h2>מה בדרך כלל כלול</h2>
<ul>
  <li><strong>כיפה</strong> — לרוב במידת ילדים, לעיתים עם רקמת שם.</li>
  <li><strong>טלית קטן עם ציציות</strong> — במידה המתאימה לגיל שלוש; זהו הפריט המשמעותי ביותר בסט.</li>
  <li><strong>שקית או תיק</strong> — לשמירה על הפריטים, ולעיתים כמזכרת.</li>
  <li><strong>אביזרי הטקס</strong> — יש סטים שכוללים מספריים או כיסוי לכתפיים לתספורת עצמה.</li>
</ul>
<p>ההרכב משתנה בין סט לסט, ולכן כדאי לקרוא בעמוד המוצר מה בדיוק נכלל לפני שמשווים מחירים.</p>

<h2>מה חשוב לבדוק</h2>

<h3>מידת הטלית קטן</h3>
<p>זה הפריט שהכי מפספסים. טלית קטן צריכה להתאים למידת הילד, ומידה גדולה מדי לא תשב טוב ותפריע לו. המידות מצוינות בכל מוצר, ורצוי למדוד ולא לנחש.</p>

<h3>הציציות</h3>
<p>כמו בטלית גדולה, יש סטים שמגיעים עם ציציות קשורות ויש שנמכרים בלעדיהן. אם הציציות אינן כלולות, צריך לרכוש ולקשור בנפרד. בכל מוצר באתר מצוין מה כלול.</p>

<h3>רקמה אישית</h3>
<p>רקמת שם הילד על הכיפה, על השקית או על הטלית קטן היא תוספת אהובה, והיא גם מה שהופך את הסט למתנה. היא דורשת זמן הכנה נוסף.</p>

<h2>מתי עורכים את החלאקה, ומתי להזמין</h2>
<p>נהוג לערוך את החלאקה בגיל שלוש. יש הנוהגים לעשותה בל"ג בעומר, ורבים נוסעים למירון; ויש העורכים אותה בבית או בבית הכנסת בסמוך ליום ההולדת. המנהגים משתנים בין קהילות ועדות, ובשאלות של מועד ואופן נהוג לשאול את רב הקהילה.</p>
<p>מבחינת הזמנה: סט מוכן נשלח לפי זמני המשלוח הרגילים, ורקמה אישית מוסיפה זמן הכנה — כדאי להזמין כמה שבועות מראש, ובפרט לקראת ל"ג בעומר שבו הביקוש גבוה.</p>

<h2>לראות את הסטים</h2>
<p>אפשר לעבור על <a href="/category/chalaka-set">סטי החלאקה שבאתר</a> ולראות בכל סט מה כלול, אילו מידות קיימות ואילו אפשרויות רקמה יש.</p>', 5, 'סט חלאקה, סט חאלקה, חלאקה, ערכת חלאקה לילדים, טלית קטן לילד', true)
ON CONFLICT (slug) DO NOTHING;
