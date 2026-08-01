-- Product NAME hygiene: strip supplier catalogue numbers, complete truncated
-- units. Two defects found by the 2026-07-31 audit, both in data, not code.
--
-- Why names matter more than descriptions here: products.name is the <h1>, the
-- <title>, the og:title, the grid tile and the Google result. It is the first
-- and often only thing a shopper reads. It is also the input to the generated
-- `name_norm` / `search_blob` columns and to the "N דגמים" listing collapse, so
-- a dirty name degrades search and duplicate-grouping too.
--
-- product_copy_runs is keyed to description edits, so names had no restore path
-- at all — hence a ledger of the same shape, following
-- 20260728120000_add_category_copy_runs_ledger.sql.
--
-- NOT APPLIED YET — this session has no DB write access (the Supabase MCP
-- returned "permission denied" mid-session). Owner runs it in the SQL editor.

create table if not exists public.product_name_runs (
  id           bigint generated always as identity primary key,
  product_id   uuid not null references public.products(id) on delete cascade,
  run_id       text not null,
  name_before  text,
  name_after   text,
  md5_after    text,
  generated_at timestamptz not null default now()
);

create index if not exists product_name_runs_product_id_idx on public.product_name_runs (product_id);
create index if not exists product_name_runs_run_id_idx     on public.product_name_runs (run_id);

-- Audit data, not customer data: RLS on with no policy = deny-all to
-- anon/authenticated; the service role bypasses RLS and is the only writer.
alter table public.product_name_runs enable row level security;

comment on table public.product_name_runs is
  'Restore ledger for bulk product NAME edits. Roll back with: update products p set name = r.name_before from product_name_runs r where r.product_id = p.id and r.run_id = ''<run>'' and md5(p.name) = r.md5_after;';


-- ---------------------------------------------------------------------------
-- 1) Supplier catalogue numbers embedded in the name (44 active rows).
--
--    24 carry a leading 3-digit prefix and 20 a trailing 4-6 digit number, and
--    in EVERY case the number is foreign to the row's own SKU — verified row by
--    row against `sku` before this was written:
--      `108 גביע קידוש קריסטל 7 ס"מ תכולה 110 מ"ל`  sku UK82890
--      `דגל ישראל בד 80X110 ס"מ 40128`               sku UK09125
--
--    The trailing ones are worse than noise: `…"שמע ישראל" 2938` and
--    `…21X14 ס"מ 40127` read as a size or model number sitting next to genuine
--    dimensions, so the shopper cannot tell which number describes the product.
--
--    The `position(... in ...) = 0` guard is the safety rail: if the digits DO
--    appear in the row's own SKU the number is plausibly part of the product's
--    real identity, and the row is left alone. That guard currently excludes
--    nothing, which is the point — it protects future imports, not this run.
--
--    Note on duplicates: 10 of the cleaned names then equal a name that already
--    exists in the catalogue (e.g. two `crystal-kiddush-cup-7-cm-without-stem-*`
--    SKUs). That is correct and desirable — those rows ARE the same product from
--    the same supplier, and the store's name_norm collapse will now group them
--    into one "N דגמים" tile instead of showing `108 גביע…` as a separate
--    listing from the identical `גביע…`.
-- ---------------------------------------------------------------------------
with candidates as (
  select id, name,
         btrim(regexp_replace(regexp_replace(name, '^\s*[0-9]{3}\s+', ''), '\s+[0-9]{4,6}\s*$', '')) as cleaned
    from products
   where is_active
     and (name ~ '^\s*[0-9]{3}\s' or name ~ '\s[0-9]{4,6}\s*$')
     -- leading number must not be part of the row's own SKU
     and (name !~ '^\s*[0-9]{3}\s'
          or position(substring(name from '^\s*([0-9]{3})') in regexp_replace(coalesce(sku,''), '\D', '', 'g')) = 0)
     -- trailing number must not be part of the row's own SKU
     and (name !~ '\s[0-9]{4,6}\s*$'
          or position(substring(name from '\s([0-9]{4,6})\s*$') in regexp_replace(coalesce(sku,''), '\D', '', 'g')) = 0)
),
-- Never strip a name down to nothing: require something substantial to remain.
safe as (
  select * from candidates where length(cleaned) >= 8 and cleaned <> name
),
logged as (
  insert into public.product_name_runs (product_id, run_id, name_before, name_after, md5_after)
  select id, 'name-hygiene-2026-08-01', name, cleaned, md5(cleaned) from safe
  returning 1
)
update products p
   set name = s.cleaned
  from safe s
 where s.id = p.id;


-- ---------------------------------------------------------------------------
-- 2) Names truncated mid-unit (28 active rows).
--
--    The supplier feed cut these inside `ס"מ`, leaving a bare `ס` or `ס"`:
--      `פמוטי קריסטל מהודרים עם הדלקת נרות 17x18 ס`
--    which renders that way in the <h1>, the <title> and the Google result.
--
--    Every one of the 28 was independently confirmed to be a centimetre
--    dimension from its own English slug or its description before this was
--    written (28/28 confirmed, 0 unconfirmed) — so completing the unit restores
--    the supplier's wording rather than inventing a measurement.
--
--    Deliberately limited to this one unambiguous class. A further ~100 active
--    names are truncated mid-WORD (`…ופקק גו` for גומי, `…עבור קל` for קלף, and
--    8 ending in a dangling `עם`). Those need the real wording restored, not a
--    regex, so they are left for owner review — see the guard query at the end.
-- ---------------------------------------------------------------------------
with truncated as (
  select id, name,
         btrim(regexp_replace(name, '\sס"?$', ' ס"מ')) as cleaned
    from products
   where is_active
     and name ~ '\sס"?$'
),
safe as (
  select * from truncated where cleaned <> name
),
logged as (
  insert into public.product_name_runs (product_id, run_id, name_before, name_after, md5_after)
  select id, 'name-hygiene-2026-08-01', name, cleaned, md5(cleaned) from safe
  returning 1
)
update products p
   set name = s.cleaned
  from safe s
 where s.id = p.id;


-- ---------------------------------------------------------------------------
-- Import-hygiene guard. Run after any supplier import: it surfaces the same
-- three defect classes before they reach a shopper. Anything it returns is a
-- name that will render badly in the <h1>, the <title> and the Google result.
--
--   select id, sku, name,
--          case
--            when name ~ '^\s*[0-9]{3}\s'      then 'leading catalogue number'
--            when name ~ '\s[0-9]{4,6}\s*$'    then 'trailing catalogue number'
--            when name ~ '\sס"?$'              then 'truncated unit (ס"מ)'
--            else 'truncated mid-word'
--          end as defect
--     from products
--    where is_active
--      and (name ~ '^\s*[0-9]{3}\s'
--        or name ~ '\s[0-9]{4,6}\s*$'
--        or name ~ '\sס"?$'
--        or (split_part(btrim(name), ' ', array_length(string_to_array(btrim(name), ' '), 1))
--              ~ '^["'']?[֐-׿]{1,2}["'']?$'
--            and split_part(btrim(name), ' ', array_length(string_to_array(btrim(name), ' '), 1))
--              not in ('ס"מ','יח','מט','חי','גר','מ"ל')))
--    order by defect, name;
-- ---------------------------------------------------------------------------
