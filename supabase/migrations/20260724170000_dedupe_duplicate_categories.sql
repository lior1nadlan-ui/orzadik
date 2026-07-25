-- Merge the three duplicate category NAMES created when the WordPress catalog and
-- the ART Judaica supplier catalog were combined. Each showed the same label
-- twice in the category menu. Owner-confirmed (2026-07-26) that all three pairs
-- are true duplicates to be MERGED (not renamed). Idempotent — safe to re-run.
--
-- NOTE: needs the service role (DML on categories + product_categories), so it is
-- applied by the owner in the Supabase dashboard SQL editor. Touches only how
-- categories are named/linked — never products, orders, or prices.
--
-- The three pairs (canonical = the one with more products, kept):
--   1. כיפות                    canon slug 'kipot' (742)            <- twin: percent-encoded 'כיפות' (14)
--   2. טליתות                   canon: the main 'טליתות' (50)       <- twin: slug 'tachshitei-talitot' (5, groom tallitot)
--   3. כיסויים לטלית ותפילין    canon slug 'talit-tefillin-sets' (55) <- twin: slug 'talit-tefillin-covers' (46)
--
-- The כיפות twin and the טליתות canon both carry percent-encoded slugs that are
-- hard to reference literally, so twins are resolved by "same name, other id"
-- rather than by their encoded slug.

begin;

-- Session-local helper: move every product link and reference from `twin` onto
-- `canon`, then delete the twin category. No-op if either id is null (idempotent).
create or replace function pg_temp.merge_category(twin uuid, canon uuid)
returns void language plpgsql as $fn$
begin
  if twin is null or canon is null or twin = canon then
    return;
  end if;

  -- Move the twin's product links onto canon, skipping pairs canon already has.
  insert into public.product_categories (product_id, category_id)
  select pc.product_id, canon
  from public.product_categories pc
  where pc.category_id = twin
    and not exists (
      select 1 from public.product_categories x
      where x.product_id = pc.product_id and x.category_id = canon
    );

  -- Re-point anything that referenced the twin: child categories, and articles.
  update public.categories
     set parent_slug = (select slug from public.categories where id = canon)
   where parent_slug = (select slug from public.categories where id = twin);
  update public.articles set category_id = canon where category_id = twin;

  -- Drop the twin's now-migrated links and the redundant category row.
  delete from public.product_categories where category_id = twin;
  delete from public.categories where id = twin;
end;
$fn$;

do $$
declare
  canon uuid;
  twin  uuid;
begin
  -- 1) כיפות — canon = kipot; twin = the other category named 'כיפות'.
  select id into canon from public.categories where slug = 'kipot';
  select id into twin  from public.categories where name = 'כיפות' and id <> canon;
  perform pg_temp.merge_category(twin, canon);

  -- 2) טליתות — twin = tachshitei-talitot; canon = the other category named 'טליתות'.
  select id into twin  from public.categories where slug = 'tachshitei-talitot';
  select id into canon from public.categories where name = 'טליתות' and id <> twin;
  perform pg_temp.merge_category(twin, canon);

  -- 3) כיסויים לטלית ותפילין — canon = sets (55); twin = covers (46).
  select id into canon from public.categories where slug = 'talit-tefillin-sets';
  select id into twin  from public.categories where slug = 'talit-tefillin-covers';
  perform pg_temp.merge_category(twin, canon);
end $$;

commit;
