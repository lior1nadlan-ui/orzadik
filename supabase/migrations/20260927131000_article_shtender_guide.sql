-- A buying guide for the "מוצרי בית כנסת ושטנדרים" shelf — 64 active
-- products, next in docs/improvement-workflow.md (measured 2026-09-27).
--
-- GROUNDED IN THE CATALOGUE (live, 2026-09-27, distinct):
--   * 44 shtenders: table-top wood (natural, mahogany, white, lacquered),
--     6 bamboo, 4 acrylic (one "3 קומות"); faux-leather plaques ("כותל",
--     raised letters), 15 engraved "והגית בו", designs "שער וילנה" and
--     "ירושלים", an א"ב one for children; 3 adjustable ("מתכוונן 3
--     קומות"), 3 with a drawer, 2 folding (wood and metal), 2 floor models
--     for a synagogue (adjustable iron and wood; modular metal and wood);
--     table-top sizes mostly 26-45 cm;
--   * 10 pairs of rimonim, 32 cm, silver- or gold-plated metal, with bells;
--   * 7 Torah pointers (יד), 17-24 cm, metal in nickel, silver or gold tone;
--   * 2 memorial lights (solar; electric plug-in).
--   The one pointer whose copy claimed "24 karat" gold was corrected first
--   (20260927130000_honesty_karat_claims.sql); the guide says "metal" and
--   "plating", which is what the specs say.
--
-- ON ACCURACY. "והגית בו יומם ולילה" is cited (יהושע א, ח). Not touching the
-- parchment and lighting a yahrzeit candle are stated as custom; whether an
-- electric light will do is deferred to a rabbi. Rimonim fit is sent to the
-- shop, since it depends on the scroll's עצי חיים. No prices.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'shtender-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'shtender-guide',
  'שטנדר: איך בוחרים — לבית, לבית הכנסת ולילדים, ורימונים ויד לספר תורה',
  'מדריך לבחירת שטנדר: עץ, במבוק או אקריליק, שולחני או לבית הכנסת, מתכוונן, מתקפל או עם מגירה, איזה גודל לאיזה ספר — וגם רימונים ויד לספר תורה ונר נשמה.',
  '<h2>שטנדר — מה ולמה</h2>
<p>שטנדר הוא מעמד שמחזיק את הספר פתוח ומוטה לעבר הקורא — ללימוד, לתפילה או לקריאה ארוכה בלי להחזיק את הספר ביד. על רבים מהם חקוק הפסוק &quot;וְהָגִיתָ בּוֹ יוֹמָם וָלַיְלָה&quot; (יהושע א, ח). באתר יש כ-45 שטנדרים, ולצדם רימונים ויד לספר תורה ונרות נשמה. המדריך מסביר את ההבדלים ומה לבדוק לפני שבוחרים.</p>

<h2>שולחני או לבית הכנסת</h2>
<ul>
  <li><strong>שטנדר שולחני:</strong> רוב השטנדרים באתר. מניחים אותו על שולחן, ורובם בגודל 26-45 ס&quot;מ.</li>
  <li><strong>שטנדר לבית הכנסת:</strong> שטנדר עומד על הרצפה — יש באתר דגם מתכוונן מברזל ועץ ודגם מודולרי ממתכת ועץ.</li>
</ul>

<h2>חומר</h2>
<ul>
  <li><strong>עץ:</strong> טבעי, מהגוני, לבן או בלכה. רבים עם פלקטה מדמוי עור (למשל &quot;כותל&quot;) או עם חריטה, ויש עיצובים כמו &quot;שער וילנה&quot; ו&quot;ירושלים&quot;.</li>
  <li><strong>במבוק:</strong> קל ובגוון טבעי או כהה.</li>
  <li><strong>אקריליק:</strong> שקוף ומודרני, כולל דגם &quot;3 קומות&quot;.</li>
</ul>

<h2>מה לבדוק</h2>
<ul>
  <li><strong>גודל מול הספר:</strong> ספר גדול, כמו גמרא, צריך משטח רחב; לסידור או לתהילים מספיק שטנדר קטן. המידות כתובות בשם המוצר או בתיאור שלו.</li>
  <li><strong>מתכוונן:</strong> יש דגמים מתכווננים, שאפשר לכוון לנוחות שלכם — נוח למי שלומד שעות. מה בדיוק מתכוונן כתוב בתיאור של כל דגם.</li>
  <li><strong>מגירה:</strong> יש דגמים עם מגירה לעט, למשקפיים או לדפים.</li>
  <li><strong>מתקפל:</strong> שטנדר מתקפל מעץ ומתכת קל לאחסן כשלא צריך אותו.</li>
  <li><strong>לילדים:</strong> יש שטנדר עם אותיות א&quot;ב — התחלה טובה לילד שמתחיל ללמוד לקרוא.</li>
</ul>

<h2>רימונים ויד לספר תורה</h2>
<p><strong>רימונים</strong> הם העיטורים שמולבשים על ראשי עצי החיים של ספר התורה, לרוב עם פעמונים קטנים. באתר יש זוגות רימונים בגובה 32 ס&quot;מ, ממתכת בציפוי כסף או זהב. לפני שמזמינים כדאי לוודא שהם מתאימים לעצי החיים של הספר — שאלו אותנו.</p>
<p><strong>יד לספר תורה</strong> היא מחוג שבעזרתו הקורא עוקב אחרי המילים, כי נוהגים שלא לגעת בקלף ביד. באתר יש ידיים באורך 17-24 ס&quot;מ, ממתכת בגימור ניקל, כסף או זהב. רימונים ויד הם מתנה מקובלת לבית הכנסת או להכנסת ספר תורה.</p>

<h2>נר נשמה</h2>
<p>נוהגים להדליק נר נשמה ביום השנה לפטירה (יארצייט). באתר יש נר סולרי ונר חשמלי שנכנס לשקע. יש המקפידים על נר של שמן או שעווה — אם נר חשמלי מתאים לכם, שאלו רב.</p>

<h2>שטנדר כמתנה</h2>
<p>שטנדר הוא מתנה נפוצה לבר מצווה — הוא מלווה את הנער בלימוד ובתפילה — וגם לרב, למלמד או לחתן. שטנדר עם חריטה או פלקטה נראה מכובד גם כשהוא לא בשימוש.</p>

<p data-guide-cat-link="1">להתרשמות ולרכישה: כל <a href="/category/beit-knesset-shtenderim">השטנדרים ומוצרי בית הכנסת</a> של אור זרוע לצדיק.</p>',
  5,
  'שטנדר, שטנדר עץ, שטנדר לבית כנסת, שטנדר מתכוונן, שטנדר מתקפל, שטנדר אקריליק, שטנדר במבוק, שטנדר לילדים, רימונים לספר תורה, יד לספר תורה, נר נשמה',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T03:35:00Z'
)
ON CONFLICT (slug) DO NOTHING;
