-- Leads (/admin/leads): everyone who started buying and did not pay.
--
-- phone — abandoned_carts stored only an email, so a cart left before an
-- order existed could be answered by email at best. The checkout already
-- asks for a phone and already tells the shopper (beside the email field)
-- that details typed in may be kept to help complete the order; this keeps
-- the phone with the cart so the owner can call or WhatsApp.
--
-- staff_alerted_at — the owner asked to be told about every lead. The hourly
-- job alerts the staff (Telegram + email) once per cart and stamps this.
alter table public.abandoned_carts
  add column if not exists phone text,
  add column if not exists staff_alerted_at timestamptz;

alter table public.abandoned_carts
  drop constraint if exists abandoned_carts_phone_len;
alter table public.abandoned_carts
  add constraint abandoned_carts_phone_len check (phone is null or char_length(phone) <= 50);
