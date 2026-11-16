-- The owner's push for a stuck payment (src/lib/unpaid-nudge.ts): one
-- Telegram message per order, an hour after it was placed and not paid, with
-- a tap-to-WhatsApp link carrying a fresh payment link. This stamps it, so it
-- goes once.
--
-- By 16.11.2026, 5 of 18 orders (₪3,340) never paid and never came back; four
-- timed out on CardCom's card form. The owner heard about each when it was
-- placed, before anyone could tell whether it would be paid, and not again
-- in time to call.
--
-- Rollback:
--   alter table public.orders drop column if exists payment_nudge_sent_at;

alter table public.orders
  add column if not exists payment_nudge_sent_at timestamptz;

comment on column public.orders.payment_nudge_sent_at is
  'When the owner was pushed (Telegram) about this order still being unpaid an hour after it was placed. Once per order.';
