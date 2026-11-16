-- "חבר מביא חבר" (src/lib/referral.ts): every paying customer gets a FRIEND-
-- code to share; a friend's first order with it gets a discount, and once that
-- order is paid and settled the customer who shared it gets a personal THANKS-
-- coupon. Off until the owner turns it on in the CRM (site_settings
-- 'referral_program'; no row = off).
--
--   coupons.referrer_email    whose FRIEND- code this is. Unique, so a customer
--                             has one code however many orders they place and
--                             however many tabs ask for it at once.
--   coupons.referrer_notify   the customer asked, on their order page, to get
--                             the thank-you coupon by email. A coupon is an
--                             offer, so it is emailed only with this or an
--                             active newsletter subscription.
--   orders.referral_reward_coupon_id
--                             the THANKS- coupon a friend's order earned, so a
--                             referrer is thanked once per friend's order.
--
-- Rollback:
--   alter table public.orders drop column if exists referral_reward_coupon_id;
--   drop index if exists public.coupons_referrer_email_key;
--   alter table public.coupons drop column if exists referrer_notify,
--     drop column if exists referrer_email;

alter table public.coupons
  add column if not exists referrer_email text,
  add column if not exists referrer_notify boolean not null default false;

create unique index if not exists coupons_referrer_email_key
  on public.coupons (lower(referrer_email))
  where referrer_email is not null;

alter table public.orders
  add column if not exists referral_reward_coupon_id uuid
    references public.coupons(id) on delete set null;

comment on column public.coupons.referrer_email is
  'For a FRIEND- referral code: the customer who shares it. One code per address.';
comment on column public.coupons.referrer_notify is
  'The referrer asked to get the THANKS- coupon by email when a friend orders.';
comment on column public.orders.referral_reward_coupon_id is
  'The THANKS- coupon this friend''s order earned its referrer. Once per order.';
