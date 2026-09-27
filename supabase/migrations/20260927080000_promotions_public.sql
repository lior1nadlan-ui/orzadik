-- Promotions, wave C: what the storefront's promotions page (/mivtzaim) reads,
-- on top of 20260927060000_promotions.sql.
--
--   * active_promotions_public() — the promotions live right now, with only what
--     a shopper already sees on a product (label, percent, end date) plus what
--     the promotion covers: its scope and, for a category promotion, the
--     categories it was set on (slug + name, for links). The internal `name`,
--     who created it and the product id list stay private; promotions itself
--     is still admin-only under RLS.
--   * list_promotion_products(p_limit) — the products the live promotions price,
--     one tile per product name (the same collapse list_products_collapsed and
--     collapseSameName() use: the representative has an image, then is in
--     stock, then is cheapest), with model_count and model_price_max for the
--     card, and total_count = how many tiles exist beyond the limit. Built on
--     active_promotion_index(), so the page lists exactly what the site prices.
--     A store-wide promotion has no per-product rows and is not listed here —
--     the page sends shoppers to /shop for it.
--
-- Both are readable by anon: they expose nothing the product pages don't.
--
-- Rollback: drop function public.active_promotions_public();
--           drop function public.list_promotion_products(integer);

create or replace function public.active_promotions_public()
returns table (
  id          uuid,
  badge_label text,
  percent_off numeric,
  ends_at     timestamptz,
  scope       text,
  categories  json
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id,
         l.badge_label,
         l.percent_off,
         l.ends_at,
         l.scope,
         coalesce(
           (select json_agg(json_build_object('slug', c.slug, 'name', c.name) order by c.sort_order, c.name)
              from public.categories c
             where l.scope = 'categories' and c.id = any (l.category_ids)),
           '[]'::json
         )
    from public.promotions l
   where l.is_active
     and l.starts_at <= now()
     and l.ends_at > now()
   order by l.percent_off desc, l.ends_at asc, l.id;
$$;

revoke all on function public.active_promotions_public() from public;
grant execute on function public.active_promotions_public() to anon, authenticated, service_role;

create or replace function public.list_promotion_products(p_limit integer default 48)
returns table (
  id              uuid,
  slug            text,
  name            text,
  price           numeric,
  sale_price      numeric,
  thumbnail_url   text,
  stock_status    text,
  model_count     bigint,
  model_price_max numeric,
  percent_off     numeric,
  total_count     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with promo as (
    select x.product_id, x.percent_off
      from public.active_promotion_index() x
     where x.product_id is not null
  ),
  covered as (
    select p.id, p.slug, p.name, p.price, p.sale_price, p.thumbnail_url, p.stock_status,
           x.percent_off,
           count(*)     over (partition by p.name_norm) as model_count,
           max(p.price) over (partition by p.name_norm) as model_price_max,
           row_number() over (
             partition by p.name_norm
             order by (coalesce(p.thumbnail_url, '') <> '') desc,
                      (p.stock_status <> 'outofstock') desc,
                      p.price asc,
                      p.id
           ) as rn
      from promo x
      join public.products p on p.id = x.product_id
     where p.is_active
       and p.price > 0
  )
  select c.id, c.slug, c.name, c.price, c.sale_price, c.thumbnail_url, c.stock_status,
         c.model_count, c.model_price_max, c.percent_off,
         count(*) over () as total_count
    from covered c
   where c.rn = 1
   -- Biggest discount first; within it, tiles that can be bought and shown.
   order by c.percent_off desc,
            (coalesce(c.thumbnail_url, '') <> '') desc,
            (c.stock_status <> 'outofstock') desc,
            c.model_count desc,
            c.id
   limit greatest(1, least(coalesce(p_limit, 48), 200));
$$;

revoke all on function public.list_promotion_products(integer) from public;
grant execute on function public.list_promotion_products(integer) to anon, authenticated, service_role;
