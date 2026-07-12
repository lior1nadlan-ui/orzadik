REVOKE ALL ON public.abandoned_carts FROM anon;

CREATE POLICY "Deny anonymous access to abandoned carts"
  ON public.abandoned_carts
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);