-- Coupons, part 3: paying the influencers, and a page of their own.
--
--   * coupon_payouts — every commission payment the shop made to the person
--     behind a coupon (amount, date, a note such as "העברה בנקאית"). The CRM
--     shows owed (commission on paid sales) − paid = balance, so nobody is paid
--     twice or forgotten. Admin-only; written by server functions behind
--     requireAdmin.
--   * coupons.partner_token — the secret in the influencer's private stats link
--     (/partner/<token>). That page shows ONLY aggregates of the code's paid
--     orders — counts, sales, commission, payments — never a customer's name,
--     phone or email. NULL = no link; the owner can replace it to revoke one.
--     Unique, so a token names exactly one coupon.
--
-- Rollback:
--   drop table if exists public.coupon_payouts;
--   alter table public.coupons drop column if exists partner_token;

create table if not exists public.coupon_payouts (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  amount     numeric(10,2) not null check (amount > 0 and amount <= 1000000),
  paid_at    date not null default (now() at time zone 'Asia/Jerusalem')::date,
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists coupon_payouts_coupon_idx on public.coupon_payouts (coupon_id);

comment on table public.coupon_payouts is
  'Commission payments to the person behind a coupon (CRM /admin/coupons).';

alter table public.coupon_payouts enable row level security;
create policy "Admins manage coupon payouts" on public.coupon_payouts
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

alter table public.coupons
  add column if not exists partner_token text unique
    check (partner_token is null or partner_token ~ '^[a-f0-9]{32}$');
