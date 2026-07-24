-- Fix the two duplicate category NAMES created when the WordPress catalog and
-- the ART Judaica supplier catalog were merged. Both show the same label twice
-- in the category menu. Idempotent — safe to run more than once.
--
-- NOTE: this needs the service role (DDL/DML on categories + product_categories),
-- so it is applied by the owner in the Supabase dashboard SQL editor, like the
-- earlier content migrations. Nothing here changes prices or products, only how
-- categories are named/linked.

-- 1) 'כיסויים לטלית ותפילין' appears twice: talit-tefillin-covers (46 products)
--    and talit-tefillin-sets (55 products) are DIFFERENT groupings that were
--    given the same name. Rename the "sets" one so the two are distinct.
update public.categories
set name = 'סטים לטלית ותפילין', updated_at = now()
where slug = 'talit-tefillin-sets'
  and name = 'כיסויים לטלית ותפילין';

-- 2) 'כיפות' appears twice: kipot (742 products) is canonical; the percent-encoded
--    twin slug (14 products) is a redundant import artifact. Move its products
--    onto kipot, re-point anything that referenced it, then remove it.
do $$
declare
  twin_id uuid;
  canon_id uuid;
begin
  select id into twin_id  from public.categories where slug = '%d7%9b%d7%99%d7%a4%d7%95%d7%aa';
  select id into canon_id from public.categories where slug = 'kipot';

  -- Nothing to do if the twin is already gone or kipot is missing.
  if twin_id is null or canon_id is null then
    return;
  end if;

  -- Move the twin's product links onto kipot, skipping pairs that already exist.
  insert into public.product_categories (product_id, category_id)
  select pc.product_id, canon_id
  from public.product_categories pc
  where pc.category_id = twin_id
    and not exists (
      select 1 from public.product_categories x
      where x.product_id = pc.product_id and x.category_id = canon_id
    );

  -- Re-point any child categories or articles that referenced the twin.
  update public.categories set parent_slug = 'kipot' where parent_slug = '%d7%9b%d7%99%d7%a4%d7%95%d7%aa';
  update public.articles   set category_id = canon_id where category_id = twin_id;

  -- Drop the twin's now-migrated links and the redundant category row.
  delete from public.product_categories where category_id = twin_id;
  delete from public.categories where id = twin_id;
end $$;
