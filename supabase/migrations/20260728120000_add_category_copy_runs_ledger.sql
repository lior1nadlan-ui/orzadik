-- Per-row restore ledger for bulk edits to categories.description /
-- categories.long_description.
--
-- public.product_copy_runs already gives products this, but it is keyed on
-- product_id, so category copy edits had NO restore path at all. Category rows
-- are far higher-leverage than a single product row (one `plastic` row fronts
-- 383 active products and supplies that hub's <meta description>), so they are
-- the last place that should be editable without an undo.
--
-- Restore is conditional on md5(current) = md5_after, exactly like the product
-- ledger: if the owner has edited the row by hand since the run, the restore
-- skips it rather than clobbering their words.
--
-- APPLIED TO PRODUCTION 2026-07-28 (via MCP), together with run
-- 'honesty-2026-07-28-b1' which rewrote 6 category rows.
create table if not exists public.category_copy_runs (
  id                        bigint generated always as identity primary key,
  category_id               uuid not null references public.categories(id) on delete cascade,
  run_id                    text not null,
  description_before        text,
  description_after         text,
  long_description_before   text,
  long_description_after    text,
  md5_after                 text,
  generated_at              timestamptz not null default now()
);

create index if not exists category_copy_runs_category_id_idx on public.category_copy_runs (category_id);
create index if not exists category_copy_runs_run_id_idx      on public.category_copy_runs (run_id);

-- Audit data, not customer data: no anon/authenticated access. RLS on with no
-- policy = deny-all to those roles; the service role bypasses RLS and is the
-- only writer, which mirrors how product_copy_runs is used.
alter table public.category_copy_runs enable row level security;

comment on table public.category_copy_runs is
  'Restore ledger for bulk category copy edits. Roll back with: update categories c set description = r.description_before, long_description = r.long_description_before from category_copy_runs r where r.category_id = c.id and r.run_id = ''<run>'' and md5(coalesce(c.description,'''') || ''|'' || coalesce(c.long_description,'''')) = r.md5_after;';
