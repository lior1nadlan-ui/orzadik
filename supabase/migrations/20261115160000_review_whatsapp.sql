-- Reviews: the owner's personal WhatsApp ask.
--
-- 8 review-request emails went out by 3.11.2026 and not one review came back.
-- The CRM's action queue now offers a WhatsApp message with the order's signed
-- review link (src/lib/review-ask.ts, waReviewRequest in wa-templates.ts):
-- for delivered orders never emailed, and as a personal follow-up five days
-- after an email that got no answer.
--
--   * orders.review_whatsapp_at — when the owner opened that WhatsApp message
--     from the queue (markReviewWhatsapp). It takes the order out of the queue,
--     stops the email job from asking a second time, and makes the signed
--     review link valid for an order that never got the email (the review page
--     honours a link only for an order that was actually asked:
--     review_request_sent_at OR review_whatsapp_at).
--
-- Rollback:
--   alter table public.orders drop column if exists review_whatsapp_at;

alter table public.orders
  add column if not exists review_whatsapp_at timestamptz;

comment on column public.orders.review_whatsapp_at is
  'When the owner sent the WhatsApp review request from the CRM action queue. NULL = never asked on WhatsApp.';
