-- Audit trail for the order-time contact notice (Privacy Protection Law §11).
-- Records that the customer was shown the contact/processing notice and
-- acknowledged it when the order was placed. Server-only writes (service_role
-- already holds ALL on public.orders), so no new client grants are required.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contact_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_consent_at timestamptz;
