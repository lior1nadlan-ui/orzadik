-- 1) Remove client-side INSERT on orders (orders are created server-side only)
DROP POLICY IF EXISTS "Place own or guest order" ON public.orders;
REVOKE INSERT ON public.orders FROM anon, authenticated;

-- 2) Remove client-side INSERT on order_items (items are created server-side only)
DROP POLICY IF EXISTS "Insert items for own order" ON public.order_items;
REVOKE INSERT ON public.order_items FROM anon, authenticated;

-- 3) Move card payment tokens to a server-only table (no client access at all)
CREATE TABLE public.order_payment_secrets (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  cardcom_token text,
  cardcom_token_card_year integer,
  cardcom_token_card_month integer,
  cardcom_token_approval_number text,
  cardcom_token_card_owner_identity_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_payment_secrets TO service_role;
ALTER TABLE public.order_payment_secrets ENABLE ROW LEVEL SECURITY;
-- No policies and no grants for anon/authenticated: server-only access.

-- Migrate any existing token data
INSERT INTO public.order_payment_secrets (
  order_id, cardcom_token, cardcom_token_card_year, cardcom_token_card_month,
  cardcom_token_approval_number, cardcom_token_card_owner_identity_number
)
SELECT id, cardcom_token, cardcom_token_card_year, cardcom_token_card_month,
       cardcom_token_approval_number, cardcom_token_card_owner_identity_number
FROM public.orders
WHERE cardcom_token IS NOT NULL
   OR cardcom_token_card_owner_identity_number IS NOT NULL;

-- Drop sensitive columns from orders
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS cardcom_token,
  DROP COLUMN IF EXISTS cardcom_token_card_year,
  DROP COLUMN IF EXISTS cardcom_token_card_month,
  DROP COLUMN IF EXISTS cardcom_token_approval_number,
  DROP COLUMN IF EXISTS cardcom_token_card_owner_identity_number;