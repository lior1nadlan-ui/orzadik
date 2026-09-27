-- Three articles published 2026-09-01 that nothing on the site linked to —
-- set-chalaka-madrich, karit-labrit-madrich, mechir-talit-bar-mitzva — are
-- being registered as guides (src/lib/guide-links.ts), which puts them on the
-- category pages and PDPs of their shelves. Measured against those shelves
-- first (2026-09-27), each one says something the shop cannot stand behind:
--
--   set-chalaka-madrich
--     * "מה בדרך כלל כלול: כיפה, טלית קטן עם ציציות …" — the 40 chalaka
--       products show no kippa; a tzitzit undershirt is in two sets. Their
--       names list what they add: engraved scissors, a curl pouch, a tzitzit
--       undershirt, a tallit + curl cover, a toy Torah.
--     * "המידות מצוינות בכל מוצר" / "בכל מוצר באתר מצוין מה כלול" — the
--       product copy (rewritten in 20260927051000_honesty_chalaka_shelf.sql)
--       sends the reader to the photos and to the shop for contents and sizes.
--   karit-labrit-madrich
--     * "קטיפה היא הבחירה המסורתית" — the shelf holds faux leather and
--       satin only.
--     * "מי שרוצה רקמה עם השם צריך לתאם זאת מראש עם החנות" — karit-labrit
--       is not a personalizable category (no name box); the pillows carry a
--       fixed blessing. The category description said the same; fixed below.
--     * its in-body "שאלות שחוזרות" block moves to src/lib/guide-faq.ts, which
--       renders the guide's one FAQ (and its FAQPage schema).
--   mechir-talit-bar-mitzva
--     * "בכל טלית באתר מצוין מה כלול" (tzitzit tied or not) — 1 of 55
--       tallitot mentions tzitzit at all.
--     * "כמחצית מעל כ-900 ש\"ח" — 29% are above 900; 53% are 900 and up.
--       The floor is 235, not 240. (Effective prices, 2026-09-27.)
--     * "רקמת שם … על הטלית" — tallitot are not personalizable; the atara
--       and the tallit bag are.
--
-- LEDGER. article_copy_runs gains description_before/after (the meta
-- description changed on two). Everything is logged under run
-- 'orphan-guides-2026-09-27'. Rollback:
--   update articles a set body_html = r.body_html_before,
--          description = coalesce(r.description_before, a.description)
--     from article_copy_runs r
--    where r.article_id = a.id and r.run_id = 'orphan-guides-2026-09-27'
--      and md5(a.body_html) = r.md5_after;
--   update categories c set description = r.description_before
--     from category_copy_runs r
--    where r.category_id = c.id and r.run_id = 'orphan-guides-2026-09-27'
--      and md5(c.description) = r.md5_after;
--
-- Idempotent: rows whose text already matches are neither logged nor changed.

alter table public.article_copy_runs
  add column if not exists description_before text,
  add column if not exists description_after text;

-- 1. The chalaka and brit-pillow guides: whole bodies, rewritten.
with rewrite(slug, new_desc, new_keywords, new_body) as (values
  ('set-chalaka-madrich',
   'סט חלאקה לגיל שלוש: מה יש בסטים — רקמה, מספריים עם חריטה, נרתיק לתלתל, גופיית ציצית — איך משווים בין סטים, שם הילד, ומתי כדאי להזמין לקראת ל"ג בעומר.',
   'סט חלאקה, סט חאלקה, חלאקה, ערכת חלאקה לילדים, אפשערן, תספורת ראשונה',
   '<h2>מה זו חלאקה</h2>
<p>חלאקה (ביידיש "אפשערן") היא התספורת הראשונה של הילד, בגיל שלוש. היא מסמנת את תחילת החינוך למצוות: מאותו יום נוהגים להרגיל את הילד לכיפה ולציצית, ויש המלמדים אותו באותו יום את האותיות הראשונות. סט חלאקה הוא מה שמכינים לטקס, והוא נשאר אחריו מזכרת.</p>

<h2>מה יש בסטים באתר</h2>
<p>באתר יש כ-40 פריטים לחלאקה. ההרכב משתנה מסט לסט, ולכן כדאי לקרוא את שם המוצר ולהסתכל בתמונות לפני שמשווים מחירים:</p>
<ul>
  <li><strong>סטים קלאסיים ופרימיום</strong> — פריטים רקומים בדגם אחיד (כתר, מגן דוד, פרי, "האש שלי" או "יברכך"), בגוון לבחירה: זהב, כסף, שמנת, קרם, תכלת או שחור.</li>
  <li><strong>מספריים עם חריטה ונרתיק לתלתל</strong> — בחלק מהסטים, כפי שכתוב בשם המוצר.</li>
  <li><strong>סטים מורחבים</strong> — עם גופיית ציצית, עם כיסוי לטלית וכיסוי לתלתל, או עם ספר תורה לילד (פריט מזכרת, לא ספר תורה על קלף).</li>
  <li><strong>פריטים בודדים</strong> — כיסוי לטלית החלאקה, וכיסוי "התלתל שלי" לשמירת התלתל שנגזר בטקס.</li>
</ul>
<p>מה שלא כתוב בשם המוצר ולא נראה בתמונות — שאלו אותנו לפני ההזמנה.</p>

<h2>מה חשוב לבדוק</h2>

<h3>מה בדיוק יש בסט</h3>
<p>סט עם גופיית ציצית, כיסוי לתלתל או ספר תורה כולל יותר פריטים מסט בסיסי, ולכן גם המחיר שונה. כשמשווים בין שני סטים, השוו את מה שיש בהם ולא רק את המחיר.</p>

<h3>מידת גופיית הציצית</h3>
<p>בסטים שכוללים גופיית ציצית, המידה צריכה להתאים לילד: גופייה גדולה מדי לא יושבת טוב ומפריעה לו. אם המידה לא מופיעה בעמוד המוצר, שאלו אותנו לפני ההזמנה.</p>

<h3>שם הילד</h3>
<p>בפריטי החלאקה אפשר להוסיף את שם הילד בשדה "הוספת שם אישי" שבעמוד המוצר, והפרטים — גופן, גוון ומיקום — מתואמים איתכם אחרי ההזמנה. בדקו את האיות לפני ששולחים: מוצר עם שם אישי מיוצר במיוחד, ולכן בדרך כלל אי אפשר לבטל אותו אחרי שההתאמה התחילה. עוד על כך ב<a href="/articles/personalization-guide">מדריך השם האישי</a>.</p>

<h2>מתי עורכים את החלאקה, ומתי להזמין</h2>
<p>נהוג לערוך את החלאקה בגיל שלוש. יש העורכים אותה ביום ההולדת או בסמוך לו, ויש הממתינים לל"ג בעומר, ורבים עולים אז למירון. המנהגים משתנים בין קהילות ועדות, ובשאלות של מועד ואופן נהוג לשאול את רב הקהילה.</p>
<p>סט בלי שם נשלח לפי <a href="/shipping">זמני המשלוח הרגילים</a>, ושם אישי מוסיף זמן הכנה. לכן כדאי להזמין כמה שבועות מראש, ובמיוחד לפני ל"ג בעומר.</p>

<h2>לראות את הסטים</h2>
<p>אפשר לעבור על <a href="/category/chalaka-set">כל פריטי החלאקה שבאתר</a> ולראות בשם ובתמונות של כל אחד מה יש בו.</p>'),

  ('karit-labrit-madrich',
   'כרית לברית: מה תפקידה בברית המילה, דמוי עור או סאטן, איזה גודל, מה כתוב עליה ולמה כדאי להזמין עוד לפני הלידה.',
   null,
   '<h2>מה זו כרית לברית</h2>
<p>כרית הברית היא הכרית שעליה מונח התינוק בברית המילה. מניחים אותה על כיסא של אליהו או על ברכי הסנדק, ותפקידה מעשי: להחזיק את התינוק יציב ובנוחות. היא גם אחד הפריטים הבודדים מהברית שנשמרים אחר כך, ולכן בוחרים כרית מהודרת — ולא פעם היא מתנה מהסבים.</p>

<h2>מה יש באתר</h2>
<ul>
  <li><strong>דמוי עור</strong> — במידות 70x45 או 74x50 ס"מ, עם אותיות בולטות או רקמה. חלק מהדגמים בעיצוב מיוחד, כמו "בבא סאלי" או "האש שלי".</li>
  <li><strong>סאטן</strong> — עם דנטל מסביב ורקמה של ברכה, כמו "וזה הקטן גדול יהיה" או "כיסא אליהו".</li>
  <li><strong>שמלה לבנה לתינוק</strong> — מסאטן עם רקמה, לטקס.</li>
</ul>

<h2>איך בוחרים</h2>

<h3>החומר</h3>
<p>אין כאן שאלה הלכתית, אלא מראה ותחזוקה. דמוי עור קל לניגוב ושומר על מראה מסודר לאורך זמן. סאטן נראה רך וחגיגי, אבל רגיש יותר לכתמים ולקמטים.</p>

<h3>הגודל והיציבות</h3>
<p>כרית לברית לא צריכה להיות רכה מדי: תינוק בן שמונה ימים צריך משטח שתומך בו ולא שוקע. בדגמי דמוי העור המידות כתובות בשם המוצר; בדגמים אחרים — בתיאור. אם חסר לכם נתון, שאלו אותנו.</p>

<h3>מה כתוב על הכרית</h3>
<p>הכריות באתר מגיעות עם רקמה או אותיות קבועות — ברכה או עיטור — ולא עם שם התינוק. שם התינוק נודע לרוב רק בברית עצמה, ולכן כרית עם ברכה כללית היא גם הבחירה המעשית: אפשר לקנות אותה מראש, והיא משמשת גם לבריתות הבאות במשפחה.</p>

<h2>מתי להזמין</h2>
<p>הברית נערכת ביום השמיני ללידה, וזה חלון קצר. הכרית נשלחת לפי <a href="/shipping">זמני המשלוח הרגילים</a>, ולכן כדאי להזמין אותה עוד לפני הלידה.</p>

<h2>לראות את הדגמים</h2>
<p>אפשר לעבור על <a href="/category/karit-labrit">הכריות והשמלות לברית שבאתר</a> ולראות את המידות, החומר והרקמה של כל דגם.</p>')
),
target as (
  select a.id, a.body_html, a.description, r.new_desc, r.new_keywords, r.new_body
    from public.articles a
    join rewrite r on r.slug = a.slug
   where a.body_html is distinct from r.new_body
      or a.description is distinct from r.new_desc
),
logged as (
  insert into public.article_copy_runs
    (article_id, run_id, body_html_before, body_html_after, md5_after, description_before, description_after)
  select id, 'orphan-guides-2026-09-27', body_html, new_body, md5(new_body), description, new_desc
    from target
  returning article_id
)
update public.articles a
   set body_html = t.new_body,
       description = t.new_desc,
       seo_keywords = coalesce(t.new_keywords, a.seo_keywords),
       updated_at = now()
  from target t
 where a.id = t.id
   and exists (select 1 from logged l where l.article_id = t.id);

-- 2. The tallit-price guide: three sentences, edited in place. Each replace
--    must find its text, or the whole migration stops.
do $$
declare
  cur text;
  nxt text;
begin
  select body_html into cur from public.articles where slug = 'mechir-talit-bar-mitzva';
  if cur is null then
    raise exception 'mechir-talit-bar-mitzva not found';
  end if;
  -- Already applied: nothing to do.
  if position('במחיר של כ-900 ש"ח ומעלה' in cur) > 0 then
    return;
  end if;

  nxt := cur;
  if position('בין כ-240 ש"ח לכ-1,100 ש"ח' in nxt) = 0
     or position('וכמחצית מעל כ-900 ש"ח' in nxt) = 0
     or position('בכל טלית באתר מצוין מה כלול.' in nxt) = 0
     or position('רקמת שם הנער על הטלית או על הכיסוי' in nxt) = 0 then
    raise exception 'mechir-talit-bar-mitzva: expected text not found';
  end if;
  nxt := replace(nxt, 'בין כ-240 ש"ח לכ-1,100 ש"ח', 'בין כ-235 ש"ח לכ-1,100 ש"ח');
  nxt := replace(nxt, 'וכמחצית מעל כ-900 ש"ח', 'וכמחצית במחיר של כ-900 ש"ח ומעלה');
  nxt := replace(nxt, 'בכל טלית באתר מצוין מה כלול.',
                 'לא בכל עמוד מוצר זה כתוב במפורש, ולכן אם זה לא ברור — שאלו אותנו לפני ההזמנה.');
  nxt := replace(nxt, 'רקמת שם הנער על הטלית או על הכיסוי', 'רקמת שם הנער על העטרה או על תיק הטלית');

  insert into public.article_copy_runs (article_id, run_id, body_html_before, body_html_after, md5_after)
  select id, 'orphan-guides-2026-09-27', cur, nxt, md5(nxt)
    from public.articles where slug = 'mechir-talit-bar-mitzva';
  update public.articles set body_html = nxt, updated_at = now() where slug = 'mechir-talit-bar-mitzva';
end $$;

-- 3. The brit-pillow category promised a name the shelf does not take.
with target as (
  select c.id, c.description,
         'כרית לברית, שעליה מונח התינוק בטקס ברית המילה. הכריות מדמוי עור או מסאטן, עם רקמה או אותיות בולטות של ברכה, ונשמרות אחר כך כמזכרת. בקטגוריה גם שמלות לבנות לתינוק לטקס.'::text as new_desc
    from public.categories c
   where c.slug = 'karit-labrit'
),
changed as (
  select * from target where description is distinct from new_desc
),
logged as (
  insert into public.category_copy_runs (category_id, run_id, description_before, description_after, md5_after)
  select id, 'orphan-guides-2026-09-27', description, new_desc, md5(new_desc) from changed
  returning category_id
)
update public.categories c
   set description = ch.new_desc, updated_at = now()
  from changed ch
 where c.id = ch.id
   and exists (select 1 from logged l where l.category_id = ch.id);
