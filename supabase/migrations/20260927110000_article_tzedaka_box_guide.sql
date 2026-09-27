-- A buying guide for tzedakah boxes — the "קופות צדקה" shelf, 68 active
-- products, the largest gift shelf left without a guide (measured
-- 2026-09-27; the key-chain shelf is bigger but its buying question is thin).
--
-- GROUNDED IN THE CATALOGUE (live, 2026-09-27, across the 68):
--   * acrylic / perspex — the majority, many with gold or silver glitter, a
--     print or a plaque, 11-16 cm;
--   * crystal with plaques ("צדקה", "ירושלים", "בית הרבי", עיטורים), 12-15 cm;
--   * wood — white, mahogany, "פיאנו", with a plaque or with epoxy, 14-18 cm,
--     and one larger box with a lock and a clock;
--   * polymer sculpted designs — "כותל", "הבית של הרבי", "האש שלי", 11-14 cm;
--   * tin, 10 cm — round and square, printed ("בבא סאלי", "הרבי מלובביץ",
--     שיש, עיטורים); the square ones are described as coming with a lock and
--     keys;
--   * stands of 24 small tzedakah pouches (faux leather, corduroy).
--   Several short descriptions contradict their names on material or size
--   (a "פח" box listed as perspex, an acrylic one as crystal), so the guide
--   sends readers to the name and the photos and does not quote those fields.
--
-- ON ACCURACY. The mitzvah is cited (דברים טו, ז-ח); giving before prayer is
-- cited to שולחן ערוך אורח חיים צב, י; giving before candle lighting and
-- ma'aser are described as custom, and practical questions (how much, where
-- the money goes) are deferred to a rabbi. No prices in the text.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'kupat-tzedaka-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'kupat-tzedaka-guide',
  'קופת צדקה: איך בוחרים — לבית, לעסק, לבית הכנסת ולילדים',
  'מדריך לבחירת קופת צדקה: אקריליק, קריסטל, עץ, פולימר או פח; איזה גודל לאיזה מקום, מנעול ופתיחה, קופה לילדים ולבית הכנסת, מתי נוהגים לתת — ומה עושים עם הכסף שבקופה.',
  '<h2>קופה בבית</h2>
<p>קופת צדקה היא הדרך הפשוטה להפוך נתינה להרגל: מטבע לפני הדלקת נרות, לפני תפילה, או סתם כשעוברים ליד. מצוות הצדקה כתובה בתורה — "פָּתֹחַ תִּפְתַּח אֶת יָדְךָ לוֹ" (דברים טו, ח) — וקופה גלויה בבית מזכירה אותה לכל בני הבית, ובמיוחד לילדים. באתר יש כ-70 קופות צדקה. המדריך מסביר את ההבדלים ביניהן ומה כדאי לבדוק לפני שבוחרים.</p>

<h2>לאן הקופה מיועדת</h2>
<ul>
  <li><strong>לבית:</strong> קופה בגובה 11-16 ס&quot;מ, על מדף או ליד הפמוטים. זו רוב הקופות באתר.</li>
  <li><strong>לעסק או לדלפק:</strong> קופה יציבה וקלה לזיהוי, עם הכיתוב &quot;צדקה&quot; ברור.</li>
  <li><strong>לבית הכנסת:</strong> קופה גדולה יותר, עדיף עם מנעול. יש גם סטנדים של ארנקי צדקה קטנים (רובם 24 יחידות) — לחלוקה בבית כנסת, בחנות או באירוע.</li>
  <li><strong>לילד:</strong> קופת פח קטנה (10 ס&quot;מ) היא התחלה טובה — קלה ועמידה, והילד יכול לשים בה בעצמו.</li>
</ul>

<h2>חומר</h2>
<ul>
  <li><strong>אקריליק (פרספקס):</strong> החומר הנפוץ באתר. קל, לא נשבר בקלות, ובדגמים השקופים רואים את המטבעות מצטברים. רבים עם נצנצים בזהב או בכסף, הדפס או פלקטה.</li>
  <li><strong>קריסטל:</strong> כבד ומהודר, עם פלקטות מעוטרות. מתאים למתנה ולמקום של כבוד בסלון.</li>
  <li><strong>עץ:</strong> מראה חם — לבן, מהגוני או פיאנו, עם פלקטה או עם אפוקסי. יש דגם גדול עם מנעול ושעון.</li>
  <li><strong>פולימר:</strong> עיצובים מפוסלים — הכותל, &quot;הבית של הרבי&quot; ו&quot;האש שלי&quot;.</li>
  <li><strong>פח:</strong> קופות קטנות ומודפסות, עגולות ומרובעות. המרובעות מתוארות כמגיעות עם מנעול ומפתחות.</li>
</ul>
<p>החומר, המידות והעיצוב של כל דגם כתובים בשם המוצר ונראים בתמונות שלו. אם משהו לא ברור — שאלו אותנו לפני ההזמנה.</p>

<h2>מה לבדוק לפני שקונים</h2>
<ul>
  <li><strong>איך פותחים:</strong> קופה עם מנעול מתאימה למקום ציבורי ולבית הכנסת; בבית נוח יותר מכסה שנפתח בקלות. אם זה לא ברור מהתמונה, שאלו.</li>
  <li><strong>החריץ:</strong> חריץ צר מתאים למטבעות; מי שנותן גם שטרות צריך חריץ רחב יותר.</li>
  <li><strong>יציבות:</strong> קופה שעומדת על דלפק או במקום שעוברים בו צריכה בסיס רחב, שלא תיפול כשהיא מתמלאת.</li>
  <li><strong>הכיתוב:</strong> &quot;צדקה&quot;, ירושלים, הכותל או דמות של צדיק — עניין של טעם ושל מנהג הבית.</li>
</ul>

<h2>מתי נוהגים לתת</h2>
<ul>
  <li><strong>לפני הדלקת נרות שבת:</strong> מנהג נפוץ לשים מטבעות בקופה בערב שבת, לפני ההדלקה. לכן יש המעמידים את הקופה ליד הפמוטים.</li>
  <li><strong>לפני תפילה:</strong> &quot;טוב ליתן צדקה קודם תפילה&quot; (שולחן ערוך, אורח חיים צב, י).</li>
  <li><strong>מעשר כספים:</strong> יש הנוהגים להפריש עשירית מהכנסתם לצדקה. כמה ואיך — שאלה אישית שכדאי לשאול עליה רב.</li>
</ul>

<h2>מה עושים עם הכסף שבקופה</h2>
<p>כשהקופה מתמלאת, מעבירים את הכסף לעמותה, לגבאי הצדקה או לנזקקים — כפי שהחלטתם כשהתחלתם לתת. כסף שהופרש לצדקה מיועד לה, ובשאלות למעשה — למשל אם אפשר להעביר אותו למטרה אחרת — נהוג לשאול רב.</p>

<h2>קופת צדקה כמתנה</h2>
<p>קופת צדקה היא מתנה נפוצה לחנוכת בית — היא פותחת את הבית החדש במצווה — וגם לבר מצווה או לזוג צעיר. קופת פח קטנה היא מתנה טובה לילד, וסטנד של ארנקי צדקה מתאים לחלוקה באירוע.</p>

<p data-guide-cat-link="1">להתרשמות ולרכישה: כל <a href="/category/kupot-tzedaka">קופות הצדקה</a> של אור זרוע לצדיק.</p>',
  5,
  'קופת צדקה, קופת צדקה לבית, קופת צדקה מעוצבת, קופת צדקה קריסטל, קופת צדקה עץ, קופת צדקה לילדים, קופת צדקה עם מנעול, צדקה לפני הדלקת נרות',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T03:00:00Z'
)
ON CONFLICT (slug) DO NOTHING;
