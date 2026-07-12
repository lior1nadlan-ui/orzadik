
-- 1) Lock down order_payment_secrets: only service_role
REVOKE ALL ON public.order_payment_secrets FROM anon, authenticated;
GRANT ALL ON public.order_payment_secrets TO service_role;

-- Explicit "deny all" policy for clarity (no policy already blocks, but make intent explicit)
DROP POLICY IF EXISTS "No client access to payment secrets" ON public.order_payment_secrets;
CREATE POLICY "No client access to payment secrets"
ON public.order_payment_secrets
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 2) abandoned_carts: server-only writes (service role). Block all client INSERT/DELETE.
-- Keep existing SELECT/UPDATE policies for authenticated users on their own rows.
REVOKE INSERT, DELETE ON public.abandoned_carts FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;

-- 3) Lock down SECURITY DEFINER functions exposed via the API.
-- has_role is intentional and required by RLS policies; restrict EXECUTE narrowly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- handle_new_user is an auth trigger function — must not be callable from the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- tg_set_updated_at is a trigger function — must not be callable from the API.
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
