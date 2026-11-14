-- Coupon codes ("קופונים") managed from the CRM — e.g. one code per influencer
-- ("קופון למפורסמים"), so the owner can see who bought through whom.
--
-- A shopper types a code at checkout. placeOrder re-reads the coupon (never
-- trusting the browser) and takes its discount off the items amount — after
-- promotions and the club member's 5%, never off shipping, unless the coupon
-- also waives shipping. The order keeps which coupon it used: coupon_id, the
-- code itself (still readable if the coupon is deleted later) and the shekels
-- it took off. orders.subtotal stays the items amount actually charged, so
-- subtotal + shipping = total still holds for CardCom and every receipt.
--
-- Guard rails in the schema, not only in the CRM form:
--   * code: 3-30 characters — capital Latin letters, Hebrew letters, digits,
--     "-" or "_". It is stored normalised (upper case), so the UNIQUE
--     constraint is also case-insensitive for shoppers ("dana10" = "DANA10");
--   * percent coupons are capped at 50%, fixed ones at ₪2,000 — a typo cannot
--     give the shop away;
--   * a coupon must give something: a discount, free shipping, or both;
--   * ends_at, when set, comes after starts_at.
--
-- coupons is admin-only (RLS). The storefront never reads it: the checkout
-- asks a server function for ONE code's terms. coupon_usage() and
-- admin_coupon_stats() are service_role only — per CLAUDE.md revoked from
-- public, anon AND authenticated.
--
-- Rollback:
--   drop function if exists public.admin_coupon_stats();
--   drop function if exists public.coupon_usage(uuid, text, text);
--   alter table public.orders drop column if exists coupon_discount,
--     drop column if exists coupon_code, drop column if exists coupon_id;
--   drop table if exists public.coupons;

create table if not exists public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9א-ת_-]{3,30}$'),
  influencer_name   text check (influencer_name is null or char_length(influencer_name) <= 120),
  notes             text check (notes is null or char_length(notes) <= 1000),
  discount_type     text not null check (discount_type in ('percent', 'fixed')),
  discount_value    numeric(10,2) not null,
  free_shipping     boolean not null default false,
  min_order         numeric(10,2) check (min_order is null or min_order > 0),
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  max_uses          integer check (max_uses is null or max_uses > 0),
  once_per_customer boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text,
  constraint coupons_value check (
    discount_value >= 0
    and (discount_type <> 'percent' or discount_value <= 50)
    and (discount_type <> 'fixed' or discount_value <= 2000)
    and (discount_value > 0 or free_shipping)
  ),
  constraint coupons_window check (ends_at is null or ends_at > starts_at)
);

comment on table public.coupons is
  'CRM coupon codes (e.g. per influencer). Applied by placeOrder; orders.coupon_id records who used which.';

alter table public.coupons enable row level security;
create policy "Admins manage coupons" on public.coupons
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount numeric not null default 0 check (coupon_discount >= 0);

create index if not exists orders_coupon_id_idx
  on public.orders (coupon_id) where coupon_id is not null;

-- How often a coupon was used on PAID orders: in total, and by one customer
-- (same email, or same phone by its last 9 digits so 050-… and +97250… match).
-- Unpaid orders do not count: a declined card must not burn the customer's
-- one use, and a limit should count real sales.
create or replace function public.coupon_usage(p_coupon_id uuid, p_email text, p_phone text)
returns table (total_uses bigint, customer_uses bigint)
language sql
stable
set search_path = public
as $$
  with n as (
    select lower(btrim(coalesce(p_email, ''))) as email,
           right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) as phone9
  )
  select count(*)::bigint,
         (count(*) filter (
            where (n.email <> '' and lower(btrim(o.customer_email)) = n.email)
               or (length(n.phone9) = 9
                   and right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9) = n.phone9)
         ))::bigint
    from public.orders o
    cross join n
   where o.coupon_id = p_coupon_id
     and o.payment_status = 'paid';
$$;

revoke all on function public.coupon_usage(uuid, text, text) from public, anon, authenticated;
grant execute on function public.coupon_usage(uuid, text, text) to service_role;

-- Per coupon, for the CRM list: paid orders, their sales (items amount after
-- every discount, without shipping — the figure an influencer's commission is
-- usually worked out from), the shekels the coupon gave, distinct customers,
-- orders still unpaid, and the last time it was used.
create or replace function public.admin_coupon_stats()
returns table (
  coupon_id     uuid,
  paid_orders   bigint,
  sales         numeric,
  discount      numeric,
  customers     bigint,
  unpaid_orders bigint,
  last_order_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select o.coupon_id,
         count(*) filter (where o.payment_status = 'paid'),
         coalesce(sum(o.subtotal) filter (where o.payment_status = 'paid'), 0),
         coalesce(sum(o.coupon_discount) filter (where o.payment_status = 'paid'), 0),
         count(distinct lower(btrim(o.customer_email))) filter (where o.payment_status = 'paid'),
         count(*) filter (where o.payment_status <> 'paid'),
         max(o.created_at)
    from public.orders o
   where o.coupon_id is not null
   group by o.coupon_id;
$$;

revoke all on function public.admin_coupon_stats() from public, anon, authenticated;
grant execute on function public.admin_coupon_stats() to service_role;
