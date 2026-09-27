-- Promotions ("מבצעים") managed from the CRM — wave A of docs/promotions-wave.md.
--
-- A promotion is an EXTRA percentage off the price the site charges today
-- (getEffectivePrice), for a scope — the whole store, categories (with all of
-- their sub-categories), or chosen products — between a start and a REQUIRED
-- end. It never touches products.price or products.sale_price: the price
-- ledger (20260926233000) stays the record of catalogue prices, and a
-- promotion ends by itself without anyone having to put prices back.
--
-- Where it is read:
--   * active_promotion_index() below → the storefront (root loader, every price
--     on the site), placeOrder (the authoritative charge) and /feed.xml;
--   * order_items.promotion_id — which promotion priced a line, for the CRM
--     report in wave C.
--
-- Guard rails in the schema, not only in the form:
--   * percent_off in (0, 70] — a typo cannot sell at 3% of the price;
--   * ends_at > starts_at, and ends_at NOT NULL — a "promotion" with no end is
--     a new price, and is presented to shoppers with its end date;
--   * a categories/products scope must name at least one target.
--
-- Rollback: drop function public.active_promotion_index();
--           alter table public.order_items drop column promotion_id;
--           drop table public.promotions;

create table if not exists public.promotions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  badge_label  text check (badge_label is null or char_length(badge_label) <= 40),
  percent_off  numeric(5,2) not null check (percent_off > 0 and percent_off <= 70),
  scope        text not null check (scope in ('all', 'categories', 'products')),
  category_ids uuid[] not null default '{}',
  product_ids  uuid[] not null default '{}',
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   text,
  updated_at   timestamptz not null default now(),
  updated_by   text,
  constraint promotions_window check (ends_at > starts_at),
  constraint promotions_scope_targets check (
    scope = 'all'
    or (scope = 'categories' and cardinality(category_ids) > 0)
    or (scope = 'products' and cardinality(product_ids) > 0)
  )
);

create index if not exists promotions_live_idx on public.promotions (ends_at) where is_active;

-- Admin-only table. Shoppers never read it directly: the storefront reads the
-- narrow, public projection that active_promotion_index() returns.
alter table public.promotions enable row level security;
drop policy if exists "Admins manage promotions" on public.promotions;
create policy "Admins manage promotions"
  on public.promotions for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

comment on table public.promotions is
  'CRM promotions: extra percent_off on the charged price for a scope and a window. Read by active_promotion_index().';

alter table public.order_items
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null;

-- The live promotions, one row per product they price, plus at most one
-- store-wide row (product_id NULL). Category scopes are expanded to every
-- sub-category by walking categories.parent_slug; only active products are
-- listed. When promotions overlap on a product, the highest percent wins —
-- promotions never stack — with the earlier end breaking a tie.
--
-- SECURITY DEFINER so anon can read the projection without reading the table;
-- it exposes only what the storefront already shows (label, percent, end).
create or replace function public.active_promotion_index()
returns table (
  product_id   uuid,
  promotion_id uuid,
  percent_off  numeric,
  badge_label  text,
  ends_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive live as (
    select *
      from public.promotions
     where is_active
       and starts_at <= now()
       and ends_at > now()
  ),
  cat_tree (promotion_id, category_id, slug) as (
    select l.id, c.id, c.slug
      from live l
      join public.categories c on c.id = any (l.category_ids)
     where l.scope = 'categories'
    union
    select t.promotion_id, c.id, c.slug
      from cat_tree t
      join public.categories c on c.parent_slug = t.slug
  ),
  expanded (product_id, promotion_id) as (
    select null::uuid, l.id from live l where l.scope = 'all'
    union all
    select pc.product_id, t.promotion_id
      from cat_tree t
      join public.product_categories pc on pc.category_id = t.category_id
    union all
    select unnest(l.product_ids), l.id from live l where l.scope = 'products'
  )
  select distinct on (e.product_id)
         e.product_id, l.id, l.percent_off, l.badge_label, l.ends_at
    from expanded e
    join live l on l.id = e.promotion_id
    left join public.products p on p.id = e.product_id
   where e.product_id is null or p.is_active
   order by e.product_id, l.percent_off desc, l.ends_at asc, l.id;
$$;

revoke all on function public.active_promotion_index() from public;
grant execute on function public.active_promotion_index() to anon, authenticated, service_role;
