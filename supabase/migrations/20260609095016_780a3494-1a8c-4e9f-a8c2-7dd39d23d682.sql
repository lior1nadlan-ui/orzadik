DROP POLICY IF EXISTS "Anyone can insert abandoned cart" ON public.abandoned_carts;
REVOKE INSERT ON public.abandoned_carts FROM anon, authenticated;