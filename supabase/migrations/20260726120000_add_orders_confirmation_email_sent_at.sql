-- Idempotency latch for the paid-order confirmation email. A CardCom webhook can
-- be retried, and the browser redirect races the webhook, so without a latch the
-- "order confirmed / paid" email could go out more than once. The webhook claims
-- the send atomically:
--   update orders set confirmation_email_sent_at = now()
--   where id = ? and confirmation_email_sent_at is null returning id;
-- only the caller that wins the claim sends. Mirrors shipped_at /
-- shipping_notified_at / stock_decremented_at, the existing latch columns.
--
-- Applied to production via the Supabase MCP on 2026-07-26; this file mirrors it
-- for local dev / db reset. Additive + nullable — touches no existing row.

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'Idempotency latch: set atomically when the paid-order confirmation email is sent, so a CardCom webhook retry or the redirect/webhook race cannot send it twice. Mirrors shipping_notified_at / stock_decremented_at.';
