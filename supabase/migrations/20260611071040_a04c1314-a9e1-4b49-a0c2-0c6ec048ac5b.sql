ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cardcom_low_profile_id text,
  ADD COLUMN IF NOT EXISTS cardcom_operation text,
  ADD COLUMN IF NOT EXISTS cardcom_tranzaction_id bigint,
  ADD COLUMN IF NOT EXISTS cardcom_token text,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_year int,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_month int,
  ADD COLUMN IF NOT EXISTS cardcom_token_approval_number text,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_owner_identity_number text,
  ADD COLUMN IF NOT EXISTS cardcom_response_code text,
  ADD COLUMN IF NOT EXISTS cardcom_description text,
  ADD COLUMN IF NOT EXISTS cardcom_document_type text,
  ADD COLUMN IF NOT EXISTS cardcom_document_number bigint;
CREATE INDEX IF NOT EXISTS idx_orders_cardcom_low_profile_id ON public.orders (cardcom_low_profile_id);