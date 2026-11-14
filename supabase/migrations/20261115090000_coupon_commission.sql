-- Coupons, part 2: the influencer's commission.
--
-- commission_percent is the share of a coupon's sales the shop pays the person
-- behind it (e.g. 10). It is reporting only — nothing in the charge reads it:
-- the CRM multiplies it by the coupon's paid sales (admin_coupon_stats().sales,
-- items after every discount, without shipping) to show what is owed.
-- NULL = no commission agreed.
--
-- Rollback: alter table public.coupons drop column if exists commission_percent;

alter table public.coupons
  add column if not exists commission_percent numeric(5,2)
    check (commission_percent is null or (commission_percent > 0 and commission_percent <= 100));
