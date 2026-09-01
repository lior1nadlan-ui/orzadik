-- Rename the covers category so its slug stops saying "sets".
--
-- ⚠️  RUN THIS ONLY AFTER THE CODE IN THIS COMMIT IS DEPLOYED. Not a style note —
-- it was learned by breaking production for ~2 minutes on 2026-09-01.
--
-- WHAT IS WRONG TODAY. The 2026-07 dedupe folded a covers category into the slug
-- `talit-tefillin-sets`, while a separate and much larger sets category
-- (`setim-talit-tefilin`, 229 products) kept existing. So the live state is:
--
--   talit-tefillin-sets   "כיסויים לטלית ותפילין"    55 products   ← covers
--   setim-talit-tefilin   "סטים טלית ותפילין"       229 products   ← sets
--
-- Search Console (3 months to 2026-09-01) shows both live and both losing: the
-- covers page ranks for "כיסוי טלית"/"כיסוי לטלית" and the sets page for
-- "סט טלית ותפילין", each around position 67 — with the URL of one describing
-- the other.
--
-- WHY THE ORDER MATTERS. The deployed code 301s `talit-tefillin-covers` →
-- `talit-tefillin-sets` BEFORE looking anything up. Renaming the row under that
-- code leaves both URLs dead: the old slug is gone from the database, and the new
-- one bounces to the slug that is gone. That is exactly what happened when this
-- statement was run early, and it is why the commit alongside this file moves the
-- redirect to fire ON A MISS instead. With that deployed, either order is safe —
-- whichever slug exists is served and the other redirects to it — but until it
-- ships, this statement takes the category offline.
--
-- Guarded on the name as well as the slug so it cannot fire against some future
-- category that happens to reuse the slug.

UPDATE categories
SET slug = 'talit-tefillin-covers'
WHERE slug = 'talit-tefillin-sets'
  AND name = 'כיסויים לטלית ותפילין';
