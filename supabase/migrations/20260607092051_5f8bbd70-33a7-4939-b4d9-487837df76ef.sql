
-- Tighten abandoned_carts INSERT: signed-in users may only set their own user_id
DROP POLICY "Anyone can insert abandoned cart" ON public.abandoned_carts;
CREATE POLICY "Anyone can insert abandoned cart" ON public.abandoned_carts
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

-- Lock down SECURITY DEFINER trigger functions: only trigger context (table owner) should run them
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
