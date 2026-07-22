-- Strip supplier annotations out of customer-facing product titles.
--
-- ~971 imported rows arrive as '[[ כיפה ...' or '[ כיפה ...' — bracket markers
-- the supplier uses internally — and a few lead with a bare '(12345)' item
-- number. They render verbatim in the storefront title, the cart and order
-- emails. scripts/import_art_judaica.py now strips these on import; this fixes
-- the rows already loaded.
--
-- Deliberately NOT touched: the 13 titles containing 'אין החזרת סחורה'. That is
-- a returns term, not formatting, and changing what a shop states about returns
-- is the owner's call, not a data cleanup.
BEGIN;

UPDATE public.products
   SET name = btrim(regexp_replace(regexp_replace(name, '^[\[\]\s]+', ''), '^\(\d+\)\s*', '')),
       updated_at = now()
 WHERE name ~ '^\s*[\[\(]';

COMMIT;
