-- A buying guide for havdalah — 111 active products under /category/havdalah,
-- which until now borrowed the kiddush-cup guide.
--
-- WHY THIS TOPIC. Next in the content backlog of docs/improvement-workflow.md
-- after the challah guide: a whole ritual with four objects (cup, besamim,
-- candle, and the text), bought mostly as sets.
--
-- GROUNDED IN THE CATALOGUE (live, 2026-09-27):
--   * 45 sets, most crystal (51 of the 111 products name crystal), 7 with a
--     rotating tray; set descriptions list tray, cup, besamim holder and
--     candle holder in varying combinations — hence "check what is included";
--   * 27 besamim holders (crystal with a plaque; some come filled with cloves
--     or a flower mix), 15 havdalah candles of 9-30 cm (one pack of 24),
--     7 candle holders, 10 acrylic trays, 7 havdalah text cards in nusach
--     Ashkenaz or Edot HaMizrach; acrylic, polymer, ceramic and aluminium too.
--
-- ON ACCURACY. The order of the blessings (יבנ"ה) and the preference for a
-- torch-like flame (Shulchan Aruch OC 298) are stated at the level every
-- siddur prints; the reasons for besamim and fire are given as the reasons
-- commonly cited; pouring wine over and dousing the candle are described as
-- customs, and the besamim blessing, which differs between communities, is
-- deferred to a rabbi. No prices.
--
-- The guide's FAQ lives in src/lib/guide-faq.ts, so the body carries none.
--
-- Rollback: DELETE FROM articles WHERE slug = 'havdalah-guide';

INSERT INTO articles (slug, title_he, description, body_html, read_time_minutes, seo_keywords, author, is_published, published_at)
VALUES (
  'havdalah-guide',
  'סט הבדלה: איך בוחרים — כוס, בשמים, נר ומגש',
  'מדריך לבחירת סט הבדלה: מה צריך להבדלה, מה כולל סט, נר הבדלה ואבוקה, כלי בשמים ואילו בשמים, מגש, סדר הבדלה בנוסח שלכם, מתנה וניקוי.',
  '<h2>הבדלה — מה צריך על השולחן</h2>
<p>במוצאי שבת נפרדים מהשבת בהבדלה: מברכים על כוס יין, על בשמים ועל נר, ומסיימים בברכת &quot;המבדיל בין קודש לחול&quot;. את סדר הברכות נוהגים לזכור בקיצור יבנ&quot;ה — יין, בשמים, נר, הבדלה. לכן סט הבדלה מקבץ יחד את מה שהטקס צריך: כוס, כלי לבשמים ומחזיק לנר, ולרוב גם מגש. המדריך עוסק בצד המעשי: מה לבחור ולמה לשים לב. לשאלות הלכתיות למעשה יש לשאול רב.</p>

<h2>סט הבדלה: מה יש בו</h2>
<p>כ-45 מהמוצרים בקטגוריה הם סטים. הרכב הסט משתנה מדגם לדגם — יש סטים של מגש, גביע, כלי בשמים ומחזיק נר, ויש שבלי חלק מהם — ולכן כדאי לבדוק בעמוד המוצר מה בדיוק כלול. רוב הסטים עשויים קריסטל, שקוף או בגוון זהב, רוז גולד וענבר, ויש גם סטים מאקריליק, פולימר, קרמיקה ואלומיניום.</p>
<ul>
  <li><strong>מגש מסתובב:</strong> בחלק מהסטים המגש מסתובב, כך שהכלים מגיעים לכל מי שיושב סביב השולחן בלי להעביר אותם מיד ליד.</li>
  <li><strong>גודל:</strong> הסטים באתר נעים בין כ-20 ס&quot;מ לסטים מוארכים של 34 על 15 ס&quot;מ. סט קומפקטי נוח לשולחן קטן ולאחסון בארון; סט גדול בולט על השולחן ומתאים לסעודה משפחתית.</li>
</ul>
<p>מי שכבר יש לו גביע קידוש שהוא אוהב יכול להשתמש בו גם להבדלה, ולהשלים רק כלי בשמים, מחזיק נר ומגש.</p>

<h2>נר הבדלה</h2>
<p>על הנר מברכים &quot;בורא מאורי האש&quot;. השולחן ערוך (אורח חיים, סימן רצח) מביא שמצווה מן המובחר לברך על אבוקה — אש של כמה פתילות יחד — ולכן נר הבדלה מיוחד עשוי בדרך כלל כמה פתילות, ויש המדליקים שני נרות צמודים. נרות ההבדלה באתר צבעוניים, באורכים של 9-30 ס&quot;מ, ויש גם מארז של 24 נרות למי שרוצה מלאי לכל השנה. נר ארוך נוח לאחיזה ביד בזמן הברכה; נר קצר נכנס למחזיק נר שעומד על המגש.</p>

<h2>כלי בשמים — ואילו בשמים</h2>
<p>אחרי היין מברכים על הבשמים ומריחים אותם. נהוג להסביר שהריח משיב את הנפש ביציאת השבת. כלי הבשמים באתר עשויים ברובם קריסטל עם פלקטה, ויש כאלה שמגיעים מלאים — בציפורן או בתערובת פרחים. אפשר למלא כלי בשמים בציפורן, בהדס, בעלי בשמים יבשים או בכל צמח ריחני שאתם אוהבים, ולהחליף מדי פעם כשהריח נחלש. נוסח הברכה על הבשמים משתנה בין העדות, ויש המברכים לפי סוג הבשמים; לשאלה מעשית פונים לרב.</p>

<h2>מגש, יין ונר</h2>
<p>יש הנוהגים למלא את כוס ההבדלה עד שהיין גולש, לסימן ברכה, ויש המכבים את הנר ביין שנשפך בסוף ההבדלה. מגש מתחת לכלים אוסף את היין והשעווה ושומר על השולחן. המגשים באתר עשויים אקריליק, חלקם עם נוסח ההבדלה מודפס עליהם.</p>

<h2>סדר הבדלה בנוסח שלכם</h2>
<p>מי שלא יודע את ההבדלה בעל פה, או שמארח, ייעזר בסדר הבדלה מודפס: לוחות אקריליק וכרטיסי דמוי עור, בנוסח אשכנז או בנוסח עדות המזרח. יש כרטיסים שמגיעים יחד עם ציפורן לבשמים.</p>

<h2>סט הבדלה כמתנה</h2>
<p>סט הבדלה מהודר הוא מתנה נפוצה לחנוכת בית ולזוג צעיר, ומשלים יפה גביע קידוש ופמוטים. כשקונים מתנה, סט שכולל את כל הכלים — מגש, גביע, כלי בשמים ומחזיק נר — מוכן לשימוש כבר במוצאי השבת הראשונה.</p>

<h2>ניקוי ושמירה</h2>
<ul>
  <li><strong>יין:</strong> לשטוף את הגביע והמגש זמן קצר אחרי ההבדלה, לפני שהיין מתייבש ומשאיר כתם.</li>
  <li><strong>שעווה:</strong> להניח לשעווה להתקשות ולהסיר אותה בעדינות; שאריות יורדות במים פושרים. בקריסטל ובזכוכית להימנע משינוי חד בטמפרטורה, שעלול לסדוק.</li>
  <li><strong>קריסטל ואקריליק:</strong> שטיפה ביד וניגוב במטלית רכה, בלי ספוג מחוספס.</li>
  <li><strong>בשמים:</strong> לרענן או להחליף מדי כמה שבועות, ולשמור את הכלי סגור אם יש לו מכסה.</li>
</ul>

<p data-guide-cat-link="1">להתרשמות ולרכישה: מבחר <a href="/category/havdalah">סטי ההבדלה, כלי הבשמים ונרות ההבדלה</a> של אור זרוע לצדיק.</p>',
  6,
  'סט הבדלה, הבדלה, כלי בשמים, בשמים להבדלה, נר הבדלה, אבוקה, מגש הבדלה, סדר הבדלה, סט הבדלה קריסטל, מתנה לחנוכת בית',
  'צוות אור זרוע לצדיק',
  true,
  '2026-09-27T00:15:00Z'
)
ON CONFLICT (slug) DO NOTHING;
