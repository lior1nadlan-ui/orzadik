-- Coupons, part 6: a cap per order, codes for new customers only, and how many
-- people each influencer's link brings.
--
--   * coupons.max_discount — percent coupons: the most shekels taken off one
--     order ("10% הנחה (עד ₪100)"). 20% of a ₪2,500 tallit is ₪500 without it.
--     NULL = no cap. Applied in couponDiscount (src/lib/coupons.ts), which the
--     checkout and placeOrder share, so what is shown is what is charged.
--   * coupons.new_customers_only — the code works only for a customer with no
--     paid order yet, by email or phone (customer_paid_orders below, matched
--     the way coupon_usage matches). Checked again by placeOrder.
--   * coupon_visits — visits that arrived through a coupon link (?coupon=),
--     counted per coupon per Israel day. A number only: no IP, no person.
--     The site logs one visit per browser tab (logCouponVisit, rate limited).
--
-- Both functions are server-only (service_role); per CLAUDE.md, revoked from
-- public, anon and authenticated explicitly.
--
-- Rollback:
--   drop function if exists public.increment_coupon_visit(uuid);
--   drop function if exists public.customer_paid_orders(text, text);
--   drop table if exists public.coupon_visits;
--   alter table public.coupons drop column if exists new_customers_only,
--     drop column if exists max_discount;

alter table public.coupons
  add column if not exists max_discount numeric(10,2)
    check (max_discount is null or (max_discount >= 1 and max_discount <= 5000)),
  add column if not exists new_customers_only boolean not null default false;

create table if not exists public.coupon_visits (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  day date not null,
  visits integer not null default 0 check (visits >= 0),
  primary key (coupon_id, day)
);

alter table public.coupon_visits enable row level security;

create policy "coupon_visits admin read" on public.coupon_visits
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Paid orders a customer already has, by email or phone — the same matching
-- as coupon_usage (lower-case email; the last 9 digits of the phone).
create or replace function public.customer_paid_orders(p_email text, p_phone text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with n as (
    select lower(btrim(coalesce(p_email, ''))) as email,
           right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) as phone9
  )
  select count(*)::integer
    from public.orders o, n
   where o.payment_status = 'paid'
     and ((n.email <> '' and lower(btrim(o.customer_email)) = n.email)
          or (length(n.phone9) = 9
              and right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9) = n.phone9));
$$;

-- One more visit for a coupon, today (Israel time).
create or replace function public.increment_coupon_visit(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.coupon_visits as cv (coupon_id, day, visits)
  values (p_coupon_id, (now() at time zone 'Asia/Jerusalem')::date, 1)
  on conflict (coupon_id, day) do update set visits = cv.visits + 1;
$$;

revoke execute on function public.customer_paid_orders(text, text) from public, anon, authenticated;
revoke execute on function public.increment_coupon_visit(uuid) from public, anon, authenticated;
grant execute on function public.customer_paid_orders(text, text) to service_role;
grant execute on function public.increment_coupon_visit(uuid) to service_role;
