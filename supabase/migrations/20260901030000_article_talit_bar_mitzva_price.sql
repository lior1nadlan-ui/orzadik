-- Article: "כמה עולה טלית לבר מצווה" — written against a real Search Console query.
--
-- WHY THIS ARTICLE EXISTS, AND WHY IT IS A MIGRATION.
-- Search Console (3 months to 2026-09-01) shows the query "כמה עולה טלית לבר
-- מצווה" drawing 25 impressions at average position 61.8 — and the page Google
-- picks for it is /collection/bar-mitzva, a product listing that answers no
-- question at all. Meanwhile /articles/kiddush-cup-guide ranks 14th for
-- "האם גביע קידוש מכסף דורש תחזוקה מיוחדת?" and shows up for three more
-- question queries: on this site, articles are what win question intent, and
-- listings are not. This is the missing article for the tallit cluster, which
-- is also the store's largest Google Ads spend ("טלית מהודרת": 392 impressions,
-- 20 clicks in 90 days) and its weakest organic showing.
--
-- Articles live in the `articles` table, seeded by migration — see
-- 20260626030000_seed_articles.sql. There is no admin screen for them, so a
-- migration is the repository's own way to add one.
--
-- NO PRICES ARE STATED, deliberately. The catalogue is ~4,600 products wide and
-- any number written into an article body is wrong for most of them and stale
-- for the rest; worse, a price in prose is a consumer claim the store then has
-- to honour. The article explains what the price DEPENDS on and sends the
-- reader to the live product pages, which is both honest and what the searcher
-- actually needs in order to compare offers.
--
-- It does not cannibalise /articles/bechira-talit: that one answers "which
-- tallit", this one answers "what does it cost". They link to each other.

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, is_published)
VALUES (
  'mechir-talit-bar-mitzva',
  'כמה עולה טלית לבר מצווה? מה קובע את המחיר',
  'כמה עולה טלית לבר מצווה? מה קובע את המחיר — חומר, גודל, ציציות קשורות ועטרה רקומה — ומה לבדוק לפני שמשווים מחירים בין חנויות.',
  '<h2>התשובה הקצרה</h2>
<p>אין מחיר אחד לטלית לבר מצווה, והטווח רחב מאוד. את ההפרש קובעים בעיקר <strong>החומר</strong> (צמר לעומת משי סינתטי), <strong>הגודל</strong>, האם <strong>הציציות קשורות</strong> וכלולות במחיר, והאם נוספת <strong>עטרה רקומה או רקמת שם</strong>. טלית ממשי סינתטי בגודל נערים היא הקצה הזול; טלית צמר גדולה עם עטרה בעבודת יד היא הקצה היקר, ובין השניים יש כמה מדרגות.</p>
<p>לכן, לפני שמשווים מחירים בין חנויות, כדאי לוודא ששני המחירים כוללים את אותם דברים. זה המקום שבו רוב ההפתעות קורות.</p>

<h2>מה בעצם קובע את המחיר</h2>

<h3>1. החומר</h3>
<p>צמר הוא החומר שעליו חובת הציצית מן התורה לכל הדעות, והוא גם היקר יותר. טלית ממשי סינתטי קלה, נוחה בקיץ ועולה פחות. שתי האפשרויות כשרות ונפוצות; ההבדל הוא הידור, משקל ותחושה — לא כשרות.</p>

<h3>2. הגודל</h3>
<p>ככל שהטלית גדולה יותר, כך היא עולה יותר — פשוט מפני שיש בה יותר בד. לבר מצווה נהוג לבחור מידה שתשרת את הנער גם כשיגדל, ולא את המידה המדויקת של גיל שלוש עשרה.</p>

<h3>3. האם הציציות קשורות</h3>
<p>זהו הסעיף שהכי מפספסים בהשוואת מחירים. יש טליתות שנמכרות עם ציציות קשורות ויש שנמכרות בלעדיהן, ואז יש לרכוש חוטים ולקשור בנפרד — עלות ועבודה שאינן במחיר המדבקה. בכל טלית באתר מצוין מה כלול.</p>

<h3>4. עטרה ורקמה אישית</h3>
<p>עטרה — הפס שבראש הטלית — קיימת בכמה רמות: מודפסת, רקומה במכונה, או בעבודת יד בחוטי כסף. ההפרש ביניהן משמעותי. רקמת שם הנער על הטלית או על הכיסוי היא תוספת נפרדת, ובדרך כלל מוסיפה גם זמן הכנה.</p>

<h3>5. מה עוד במארז</h3>
<p>מארז לבר מצווה כולל לרוב יותר מטלית: כיסוי לטלית ולתפילין, ולעיתים גם כיפה, ברכון או סידור. מארז שלם יעלה יותר מטלית בודדת, ולעיתים פחות מאשר רכישת אותם פריטים בנפרד.</p>

<h2>מה כדאי לשאול לפני שקונים</h2>
<ul>
  <li>האם הציציות כלולות וקשורות?</li>
  <li>מה מידות הטלית בסנטימטרים, ולא רק שם המידה?</li>
  <li>האם העטרה רקומה או מודפסת?</li>
  <li>כמה זמן לוקחת רקמה אישית, ומתי צריך להזמין כדי להספיק?</li>
</ul>

<h2>מתי להזמין</h2>
<p>טלית מהמדף נשלחת לפי זמני המשלוח הרגילים. ברגע שמבקשים רקמה או חריטה מתווסף זמן הכנה, ולכן כדאי להזמין כמה שבועות לפני האירוע ולא בשבוע האחרון.</p>

<h2>איפה לראות מחירים מעודכנים</h2>
<p>המחירים משתנים לפי דגם ומלאי, ולכן המקום המדויק לראות אותם הוא עמוד המוצר עצמו. אפשר לעבור על <a href="/category/talitot">קטגוריית הטליתות</a> ולסנן, או לראות את <a href="/collection/bar-mitzva">האוסף לבר מצווה</a> שמרכז טליתות, כיסויים ומארזים שמתאימים לגיל הזה.</p>
<p>ואם רוצים להבין קודם כול <em>איזו</em> טלית מתאימה — ולא רק כמה היא עולה — יש לנו <a href="/articles/bechira-talit">מדריך נפרד לבחירת טלית</a> שנכנס לסוגים, לחומרים ולמנהגי העדות.</p>',
  6,
  'כמה עולה טלית לבר מצווה, מחיר טלית, טלית לבר מצווה, סט טלית ותפילין לבר מצווה, עטרה רקומה',
  true
)
ON CONFLICT (slug) DO NOTHING;
