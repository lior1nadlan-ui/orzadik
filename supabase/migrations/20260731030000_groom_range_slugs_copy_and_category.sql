-- Groom range: de-personalise the URLs, give each box its own copy, and file the
-- line under the category shoppers actually browse.
--
-- APPLIED TO PRODUCTION 2026-07-31 via MCP.
--
-- THREE PROBLEMS, one migration.
--
-- 1. FOUR SLUGS WERE CUSTOMERS' PERSONAL NAMES.
--    /product/groom-set-liam-shalom-goli, -oren-realov, -yaron-ben-dror,
--    -yaron-biton. These are the people whose bespoke boxes were photographed.
--    The names were live in the sitemap, in the canonical tag and in og:url, so
--    they travelled with every WhatsApp share and were queued for indexing.
--    (Worse, the homepage rendered "מארז חתן — ליאם שלום גולי" as the visible
--    card label and image alt text — fixed in the same PR, in LuxuryShowcase.tsx.)
--    The remaining seven were opaque (groom-set-06), a poor URL for the store's
--    highest-ticket line. All eleven now describe the product.
--    src/server.ts 301s every old slug, so nothing already crawled 404s.
--
-- 2. ALL ELEVEN SHARED ONE IDENTICAL DESCRIPTION.
--    Verified: md5(description) = d5b6aa17870973e7f64c20ad92880f8e on all 11,
--    160 chars, a single run-on sentence with no punctuation between "רקמה
--    אישית" and "טלית צמר". Eleven pages of duplicate content on the flagship
--    line, and a shopper comparing two boxes read exactly the same words about
--    both. Each now has its own prose in the house format (prose paragraph,
--    blank line, pipe-delimited spec), differentiating on colour and material —
--    the only axes that actually differ between them.
--    Logged to product_copy_runs as run 'groom-range-2026-07-31'.
--
-- 3. NONE OF THEM WERE IN chatan-kala.
--    All eleven sat in marazim-chatanim ONLY. marazim-chatanim is a SIBLING of
--    chatan-kala (both parent_slug IS NULL), not a child, so a shopper browsing
--    "חתן כלה" — 34 products, the obvious groom entry point — saw none of the
--    eleven boxes the store leads with. ADDITIVE: they keep marazim-chatanim.
--
-- NOT TOUCHED: short_description (owner-authored, and the "האש שלי" one is a
-- real design line used on 116 products across the catalogue — kippot, kiddush
-- cups, tallit sets, slugged ha-aish-sheli in English. It is NOT leaked bespoke
-- text; only the quoting was normalised to match the other 116).
--
-- REVERSE: product_copy_runs holds description_before per product; the slug and
-- name changes are the `values` list below, read right-to-left.

with copy(old_slug, new_slug, new_name, new_desc) as (values
  ('groom-set-06', 'groom-set-grey-print',
   'מארז לחתן - דגם אפור עם הדפס',
   'גוון אפור עם הדפס, לחתן שרוצה מארז מוקפד בלי ניגודיות חדה. התיקים, הכיפה והטלית מגיעים כמכלול תואם — כך שהמארז נקרא כסט אחד ולא כפריטים שנאספו בנפרד. הרקמה האישית והחריטה בלייזר הן מה שהופך אותו לפריט שנשאר עם החתן שנים אחרי החופה.

גוון: אפור עם הדפס | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-07', 'groom-set-white-crown',
   'מארז לחתן - דגם לבן עם כתר',
   'לבן עם עיטור כתר — הבחירה הקלאסית לחופה, כשרוצים שהמארז ייראה טוב גם בתמונות. הרקע הלבן מדגיש את הרקמה, ועיטור הכתר חוזר על התיקים ועל הכיפה כך שהמכלול נקרא כסט אחד. אפשר להוסיף את שם החתן ברקמה או בחריטת לייזר.

גוון: לבן | עיטור: כתר | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-08', 'groom-set-beige-suede',
   'מארז לחתן - דגם זמש בז''',
   'גימור זמש בגוון בז'', רך למגע ומאופק במראה. זו האפשרות לחתן שמעדיף מרקם על פני ברק, והגוון החם מסתדר עם חליפה בכל צבע. התיקים, הכיפה והטלית תואמים זה לזה, ואפשר להוסיף רקמה אישית או חריטת שם בלייזר.

חומר: זמש | גוון: בז'' | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-09', 'groom-set-light-blue',
   'מארז לחתן - דגם תכלת',
   'תכלת בהיר — יציאה מהשחור והלבן המקובלים, בלי לוותר על מראה מוקפד. הגוון בולט על רקע החליפה ומצטלם היטב תחת החופה. המארז מגיע כמכלול תואם, עם אפשרות לרקמה אישית ולחריטת שם בלייזר.

גוון: תכלת | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-10', 'groom-set-blue-denim',
   'מארז לחתן - דגם ג''ינס כחול',
   'מרקם ג''ינס בגוון כחול, לחתן שרוצה מארז עכשווי ולא מסורתי במראה. הכחול העמוק סלחני לסימני שימוש יותר מגוונים בהירים, כך שהתיקים נשארים מוקפדים גם אחרי שנים של שבתות וחגים. כולל אפשרות לרקמה אישית ולחריטת שם בלייזר.

מרקם: ג''ינס | גוון: כחול | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-15', 'groom-set-white-embroidered',
   'מארז לחתן - דגם לבן מעוצב',
   'לבן מלא עם רקמה כסופה לאורך התיקים. הצירוף של לבן וכסף נותן מראה חגיגי, ומתאים לחתן שרוצה שהמארז יהיה חלק מהמראה של החופה עצמה ולא רק פריט שימושי. הכיפה והטלית תואמים, ואפשר להוסיף שם ברקמה או בחריטת לייזר.

גוון: לבן | רקמה: כסופה | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-16', 'groom-set-beige-linen-classic',
   'מארז לחתן - דגם בז'' פשתן קלאסי',
   'פשתן בגוון בז'' — המראה השקט והקלאסי בסדרה. מרקם הפשתן נותן לתיקים מראה טבעי שלא מתיישן, והגוון הניטרלי מתאים גם כשקונים את המארז כמתנה ולא מכירים את הטעם המדויק של החתן. כולל רקמה אישית וחריטת שם בלייזר לפי בחירה.

חומר: פשתן | גוון: בז'' | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-liam-shalom-goli', 'groom-set-linen-look-premium',
   'מארז לחתן - דמוי פשתן עם רקמת "האש שלי" בגב',
   'דמוי פשתן עם רקמת "האש שלי" בגב התיק, דגם הפרימיום של הסדרה, ועם טלית מעוטרת. הרקמה בגב היא מה שמבדיל אותו: היא נראית כשהתיק מונח על הספסל, לא רק כשמחזיקים אותו ביד. כולל אפשרות לרקמת שם ולחריטה בלייזר.

חומר: דמוי פשתן | רקמה: "האש שלי" בגב | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-oren-realov', 'groom-set-black-leather-look',
   'מארז לחתן - דמוי עור שחור',
   'דמוי עור שחור — הבחירה הבטוחה. שחור מתאים לכל חליפה, לא מראה אבק, ונשאר מוקפד גם אחרי שנים של שימוש בשבתות ובחגים. התיקים, הכיפה והטלית תואמים, ואפשר להוסיף רקמה אישית או חריטת שם בלייזר.

חומר: דמוי עור | גוון: שחור | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-yaron-ben-dror', 'groom-set-grey-melange',
   'מארז לחתן - אפור מלאנז''',
   'אריג אפור מלאנז'' — שילוב גוונים באותו בד, שנותן עומק במקום צבע שטוח. זו האפשרות המאופקת לחתן שלא רוצה שחור ולא רוצה בהיר. המארז מגיע כמכלול תואם, עם אפשרות לרקמה אישית ולחריטת שם בלייזר.

אריג: מלאנז'' | גוון: אפור | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר'),

  ('groom-set-yaron-biton', 'groom-set-brown-leather-look',
   'מארז לחתן - דמוי עור חום',
   'דמוי עור חום — חם יותר משחור ופחות שגרתי, בלי לצאת מהמראה הקלאסי. הגוון מתאים במיוחד לחתנים שבוחרים חליפה בגוונים חמים. כולל תיקים תואמים, כיפה וטלית, ואפשרות לרקמה אישית וחריטת שם בלייזר.

חומר: דמוי עור | גוון: חום | כולל: תיק טלית, תיק תפילין, טלית צמר רכלים תשב"צ עם עטרה ופינות, כיפה תואמת וסידור | התאמה אישית: רקמה על התיקים או חריטת שם בלייזר')
),
-- Data-modifying CTEs are guaranteed to run exactly once and to completion even
-- though the primary query never reads this output, and every CTE sees the same
-- snapshot — so description_before is the pre-UPDATE value.
logged as (
  insert into product_copy_runs (product_id, run_id, description_before, description_after, md5_after)
  select p.id, 'groom-range-2026-07-31', p.description, c.new_desc, md5(c.new_desc)
    from products p
    join copy c on c.old_slug = p.slug
  returning 1
)
update products p
   set slug = c.new_slug,
       name = c.new_name,
       description = c.new_desc
  from copy c
 where c.old_slug = p.slug;

-- File the whole groom line under the category a shopper actually browses.
-- Additive: marazim-chatanim membership is untouched.
insert into product_categories (product_id, category_id)
select p.id, (select id from categories where slug = 'chatan-kala')
  from products p
 where p.slug in (
         'groom-set-grey-print','groom-set-white-crown','groom-set-beige-suede',
         'groom-set-light-blue','groom-set-blue-denim','groom-set-white-embroidered',
         'groom-set-beige-linen-classic','groom-set-linen-look-premium',
         'groom-set-black-leather-look','groom-set-grey-melange',
         'groom-set-brown-leather-look')
   and not exists (
         select 1 from product_categories pc
          where pc.product_id = p.id
            and pc.category_id = (select id from categories where slug = 'chatan-kala'));
