-- Internal links from each guide article to its category.
--
-- The 5 guides are the site's best informational-ranking candidates but passed
-- ZERO link equity to the money pages — the reader hit a generic /shop CTA. This
-- appends a contextual paragraph to each guide's body_html linking to the
-- guide's own category (the FK is already set by 20260724090000).
--
-- Deliberately links to the CATEGORY, not to individual product slugs: products
-- get hidden/deactivated (31 were just hidden), and a hardcoded product slug in
-- immutable article HTML would 404. Live per-guide product discovery is rendered
-- by the article component from the same category_id — always fresh, never dead.
--
-- Idempotent: the WHERE guard skips any row that already carries the marker, so
-- a re-run appends nothing.
BEGIN;

WITH link_html(slug, html) AS (
  VALUES
    ('bechira-talit',
     '<p data-guide-cat-link="1">מוכנים לבחור? עיינו במבחר ה<a href="/category/%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa">טליתות והציציות</a> של אור זרוע לצדיק — לכל מנהג ולכל גיל.</p>'),
    ('hanukkia-guide',
     '<p data-guide-cat-link="1">לרכישה: כל ה<a href="/category/hanukkah">חנוכיות ומוצרי חנוכה</a> באתר, מהקלאסי ועד המודרני.</p>'),
    ('kiddush-cup-guide',
     '<p data-guide-cat-link="1">להתרשמות ולרכישה: מבחר <a href="/category/gviei-kidush">גביעי הקידוש והסטים ליין</a> של אור זרוע לצדיק.</p>'),
    ('mezuza-guide',
     '<p data-guide-cat-link="1">לרכישה: מבחר ה<a href="/category/plastic">מזוזות והנרתיקים</a> באתר — כשרות מהודרת ומגוון עיצובים.</p>'),
    ('tefillin-guide',
     '<p data-guide-cat-link="1">לרכישה: <a href="/category/batei-tefilin-marot">בתי תפילין, תיקים ואביזרים</a> — כשרות ממהדרין, לכל מנהג.</p>')
)
UPDATE public.articles a
   SET body_html = a.body_html || l.html
  FROM link_html l
 WHERE a.slug = l.slug
   AND strpos(a.body_html, 'data-guide-cat-link') = 0;

COMMIT;
