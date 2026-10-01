-- Failure-visibility latch for the owner's Telegram order alerts, mirroring
-- confirmation_email_sent_at. sendOrderTelegramAlert() already fails silently
-- into the Worker log on a bad/revoked token, a bot removed from its chat, or
-- a network blip -- this is what lets /admin/orders show the same "not sent"
-- warning + resend action that already exists for the customer's confirmation
-- email, since Telegram is the owner's primary "don't miss an order" channel.
--
-- Two columns, not one: an order needs EITHER alert independently -- a
-- still-unpaid order only ever gets the "created" alert, while a paid order
-- needs both -- so a single column would conflate "not sent" with
-- "not applicable yet".
--
-- Additive + nullable, no backfill: mirrors confirmation_email_sent_at's own
-- migration, which also shipped with no backfill for pre-existing orders.
--
-- Applied to production via the Supabase MCP on 2026-09-04; this file mirrors
-- it for local dev / db reset.

alter table public.orders
  add column if not exists telegram_created_alert_sent_at timestamptz,
  add column if not exists telegram_paid_alert_sent_at timestamptz;

comment on column public.orders.telegram_created_alert_sent_at is
  'Set when the owner''s Telegram alert for a newly created (not-yet-paid) order was sent successfully. NULL means it failed or Telegram was not configured at send time -- surfaced in /admin/orders with a resend action.';

comment on column public.orders.telegram_paid_alert_sent_at is
  'Set when the owner''s Telegram alert for a paid order was sent successfully. NULL on a paid order means it failed -- surfaced in /admin/orders with a resend action.';
