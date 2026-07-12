-- Fix: the articles admin policy from 20260626050000 was created FOR ALL with
-- no role restriction and a direct EXISTS(SELECT FROM user_roles) check. Because
-- it applied to every role, an anonymous SELECT on `articles` evaluated that
-- clause and failed hard with "permission denied for table user_roles" (anon has
-- REVOKE ALL on user_roles), breaking the public blog/articles pages.
--
-- Scope the policy to `authenticated` and use the SECURITY DEFINER helper
-- public.has_role(), matching the pattern used by every other admin policy
-- (e.g. the user_roles policies). Anonymous reads now only evaluate the
-- "Published articles are readable by anyone" policy.
DROP POLICY IF EXISTS "Only admin can manage articles" ON public.articles;

CREATE POLICY "Only admin can manage articles"
  ON public.articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
