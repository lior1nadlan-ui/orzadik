-- Coupons, part 4: full control from the CRM.
--
--   * What a coupon applies to: the whole shop (default — every coupon so far),
--     chosen categories (with all their sub-categories, walked the way
--     active_promotion_index() walks them) or chosen products; and whether it
--     applies to items already priced by a promotion. coupon_eligible_products()
--     answers, for a cart's product ids, which of them the coupon covers.
--   * Higher caps — percent up to 90, shekels up to 5,000 — now that the CRM
--     form asks for an explicit confirmation above 50% / ₪1,000. A typo still
--     cannot give the shop away.
--   * site_settings: the shop's switches the CRM owns, starting with
--     'coupons_enabled' — one switch that turns every coupon off on the site
--     (the checkout box disappears and placeOrder refuses codes) and back on.
--     coupon_box_visible() tells the checkout whether to offer the box at all:
--     coupons on AND at least one coupon live right now.
--
-- All functions are service_role only (server functions behind them), per
-- CLAUDE.md revoked from public, anon AND authenticated.
--
-- Rollback:
--   drop function if exists public.coupon_box_visible();
--   drop function if exists public.coupon_eligible_products(uuid, uuid[]);
--   drop table if exists public.site_settings;
--   alter table public.coupons drop constraint if exists coupons_scope_targets,
--     drop column if exists apply_to_sale_items, drop column if exists product_ids,
--     drop column if exists category_ids, drop column if exists scope;
--   (and restore coupons_value with 50 / 2000 — only if no coupon exceeds them)

alter table public.coupons
  add column if not exists scope text not null default 'all'
    check (scope in ('all', 'categories', 'products')),
  add column if not exists category_ids uuid[] not null default '{}',
  add column if not exists product_ids uuid[] not null default '{}',
  add column if not exists apply_to_sale_items boolean not null default true;

alter table public.coupons
  add constraint coupons_scope_targets check (
    scope = 'all'
    or (scope = 'categories' and cardinality(category_ids) > 0)
    or (scope = 'products' and cardinality(product_ids) > 0)
  );

alter table public.coupons drop constraint if exists coupons_value;
alter table public.coupons
  add constraint coupons_value check (
    discount_value >= 0
    and (discount_type <> 'percent' or discount_value <= 90)
    and (discount_type <> 'fixed' or discount_value <= 5000)
    and (discount_value > 0 or free_shipping)
  );

-- Which of the given products the coupon covers (scope only — whether a
-- promotion-priced line counts is decided by the caller, which knows the
-- line's promotion_id).
create or replace function public.coupon_eligible_products(p_coupon_id uuid, p_product_ids uuid[])
returns setof uuid
language sql
stable
set search_path = public
as $$
  with recursive c as (
    select scope, category_ids, product_ids from public.coupons where id = p_coupon_id
  ),
  tree (category_id, slug) as (
    select cat.id, cat.slug
      from c
      join public.categories cat on cat.id = any (c.category_ids)
     where c.scope = 'categories'
    union
    select cat.id, cat.slug
      from tree t
      join public.categories cat on cat.parent_slug = t.slug
  )
  select distinct x.id
    from unnest(p_product_ids) as x(id)
    cross join c
   where c.scope = 'all'
      or (c.scope = 'products' and x.id = any (c.product_ids))
      or (c.scope = 'categories' and exists (
            select 1
              from public.product_categories pc
              join tree t on t.category_id = pc.category_id
             where pc.product_id = x.id));
$$;

revoke all on function public.coupon_eligible_products(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.coupon_eligible_products(uuid, uuid[]) to service_role;

create table if not exists public.site_settings (
  key        text primary key check (key ~ '^[a-z_]{2,60}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.site_settings is
  'Switches the owner controls from the CRM (e.g. coupons_enabled). Read by server functions only.';

alter table public.site_settings enable row level security;
create policy "Admins manage site settings" on public.site_settings
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

insert into public.site_settings (key, value) values ('coupons_enabled', 'true'::jsonb)
  on conflict (key) do nothing;

create or replace function public.coupon_box_visible()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
           (select value = 'true'::jsonb from public.site_settings where key = 'coupons_enabled'),
           true)
     and exists (
           select 1 from public.coupons
            where is_active and starts_at <= now() and (ends_at is null or ends_at > now()));
$$;

revoke all on function public.coupon_box_visible() from public, anon, authenticated;
grant execute on function public.coupon_box_visible() to service_role;
