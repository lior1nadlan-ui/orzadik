-- CRM upgrade: internal customer notes + indexes for the admin CRM queries.
--
-- crm_customer_notes holds owner-only annotations about a customer ("ביקש
-- הקדשה עד חמישי", "לקוח חוזר — לתת הנחה"). Keyed by customer_email because
-- guest checkout means most customers have no auth.users row — the email is
-- the only stable customer identity across orders.
BEGIN;

CREATE TABLE public.crm_customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_customer_notes_email_idx ON public.crm_customer_notes (customer_email);

ALTER TABLE public.crm_customer_notes ENABLE ROW LEVEL SECURITY;
-- Admin-only in both directions; no anon/authenticated access of any kind.
-- (Server functions use the service-role client anyway; this guards the REST
-- surface.)
CREATE POLICY "Admins manage customer notes" ON public.crm_customer_notes
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Indexes the CRM screens lean on. orders currently has none of these —
-- only payment_txn_id / shipping_status / cardcom_low_profile_id.
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON public.orders (customer_email);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders (payment_status);

COMMIT;
