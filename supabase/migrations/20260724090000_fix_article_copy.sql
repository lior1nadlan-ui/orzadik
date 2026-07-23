-- Fix seeded article copy + wire articles into the category tree.
--
-- NOT YET APPLIED. This file was written but never executed: no `supabase db
-- push`, no manual run against the project. Apply it deliberately.
--
-- Two problems in 20260626030000_seed_articles.sql (which is left untouched —
-- it has already run in production, so the correction belongs in a new
-- migration rather than in an edit to history):
--
--   1. The flagship talit guide misspells its own head keyword: 'טליה' instead
--      of 'טלית'. It leaks straight into the <h1>, <title>, og:title and the
--      Article.headline of schema.org, because all four are rendered from
--      articles.title_he.
--   2. Every seeded article has category_id = NULL, so the article layer is
--      disconnected from the catalog: no related-articles rail, and nothing to
--      link a reader from a guide to the products it describes.
--
-- Both statements are idempotent: replace() is a no-op once the typo is gone
-- (the replacement string does not contain the search string), and the
-- category backfill only touches rows where category_id IS NULL.
--
-- Article bodies are NOT rewritten here, and no internal links are injected
-- into body_html — this migration only corrects a spelling and fills a FK.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 'טליה' -> 'טלית' across every column that surfaces the keyword.
--    Targeted by slug so it can never touch another article. The strpos()
--    guard keeps a re-run from firing the updated_at trigger for nothing.
-- ---------------------------------------------------------------------------
UPDATE public.articles
   SET title_he     = replace(title_he,     'טליה', 'טלית'),
       description  = replace(description,  'טליה', 'טלית'),
       body_html    = replace(body_html,    'טליה', 'טלית'),
       seo_keywords = replace(seo_keywords, 'טליה', 'טלית')
 WHERE slug = 'bechira-talit'
   AND (
        strpos(title_he,                 'טליה') > 0
     OR strpos(description,              'טליה') > 0
     OR strpos(body_html,                'טליה') > 0
     OR strpos(coalesce(seo_keywords,''),'טליה') > 0
   );

-- ---------------------------------------------------------------------------
-- 2. Attach each seeded article to the closest real category.
--
--    Slugs are resolved through subselects and COALESCE'd from most-specific
--    to fallback, so a missing category simply yields NULL and that row is
--    skipped instead of erroring. Note the two oddly-named slugs, both real
--    and both verified against the imported catalog:
--      * the talitot category slug is stored percent-encoded ('טליתות-וציציות')
--      * the top-level מזוזות category carries the legacy slug 'plastic'
-- ---------------------------------------------------------------------------
WITH wanted(article_slug, category_id) AS (
  SELECT 'bechira-talit'::text, COALESCE(
    (SELECT id FROM public.categories
      WHERE slug = '%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa'),
    (SELECT id FROM public.categories WHERE slug = 'talit-tefilin')
  )
  UNION ALL
  SELECT 'tefillin-guide'::text, COALESCE(
    (SELECT id FROM public.categories WHERE slug = 'batei-tefilin-marot'),
    (SELECT id FROM public.categories WHERE slug = 'talit-tefilin')
  )
  UNION ALL
  SELECT 'mezuza-guide'::text, COALESCE(
    (SELECT id FROM public.categories WHERE slug = 'plastic'),
    (SELECT id FROM public.categories WHERE slug = 'mezuzot-matechet')
  )
  UNION ALL
  SELECT 'kiddush-cup-guide'::text, COALESCE(
    (SELECT id FROM public.categories WHERE slug = 'gviei-kidush'),
    (SELECT id FROM public.categories WHERE slug = 'gviei-kidush-matechet')
  )
  UNION ALL
  SELECT 'hanukkia-guide'::text, COALESCE(
    (SELECT id FROM public.categories WHERE slug = 'hanukkah'),
    (SELECT id FROM public.categories WHERE slug = 'chagim')
  )
)
UPDATE public.articles a
   SET category_id = w.category_id
  FROM wanted w
 WHERE a.slug = w.article_slug
   AND a.category_id IS NULL
   AND w.category_id IS NOT NULL;

COMMIT;
