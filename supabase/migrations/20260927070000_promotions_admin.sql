-- Promotions, wave B: what the CRM screen (/admin/promotions) needs from the
-- database, on top of 20260927060000_promotions.sql.
--
--   * admin_promotion_preview(scope, category_ids, product_ids) — the products
--     a scope WOULD cover, summarised: how many, the cheapest and dearest
--     catalogue price, and six examples. It expands categories exactly the way
--     active_promotion_index() does (down the parent_slug tree, active products
--     only), so the preview the owner approves is the set the site will price.
--     It returns one JSON object rather than rows: a store-wide scope is 4,600+
--     products, past PostgREST's 1,000-row cap on RPC results.
--   * admin_promotion_stats() — paid orders and revenue per promotion, from
--     order_items.promotion_id (placeOrder stamps it), for the list and wave C.
--
-- Both are service_role only: they are called by server functions behind
-- requireAdmin, never by a browser.
--
-- Rollback: drop function public.admin_promotion_preview(text, uuid[], uuid[]);
--           drop function public.admin_promotion_stats();

create or replace function public.admin_promotion_preview(
  p_scope text,
  p_category_ids uuid[],
  p_product_ids uuid[]
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree (category_id, slug) as (
    select c.id, c.slug
      from public.categories c
     where p_scope = 'categories' and c.id = any (coalesce(p_category_ids, '{}'))
    union
    select c.id, c.slug
      from tree t
      join public.categories c on c.parent_slug = t.slug
  ),
  ids (id) as (
    select p.id from public.products p where p_scope = 'all'
    union
    select pc.product_id
      from tree t
      join public.product_categories pc on pc.category_id = t.category_id
    union
    select unnest(coalesce(p_product_ids, '{}')) where p_scope = 'products'
  ),
  covered as (
    select p.id, p.name, p.price
      from ids
      join public.products p on p.id = ids.id
     where p.is_active
  )
  select json_build_object(
    'count', (select count(*) from covered),
    'min_price', (select min(price) from covered where price > 0),
    'max_price', (select max(price) from covered where price > 0),
    'sample', coalesce(
      (select json_agg(s) from (
         select id, name, price from covered where price > 0 order by price desc, name limit 6
       ) s),
      '[]'::json
    )
  );
$$;

revoke all on function public.admin_promotion_preview(text, uuid[], uuid[]) from public;
grant execute on function public.admin_promotion_preview(text, uuid[], uuid[]) to service_role;

create or replace function public.admin_promotion_stats()
returns table (promotion_id uuid, orders bigint, units bigint, revenue numeric)
language sql
stable
security definer
set search_path = public
as $$
  select oi.promotion_id,
         count(distinct oi.order_id),
         coalesce(sum(oi.quantity), 0),
         coalesce(sum(oi.line_total), 0)
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.promotion_id is not null
     and o.payment_status = 'paid'
   group by oi.promotion_id;
$$;

revoke all on function public.admin_promotion_stats() from public;
grant execute on function public.admin_promotion_stats() to service_role;
