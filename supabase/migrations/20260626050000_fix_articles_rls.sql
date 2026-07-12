-- Fix: article admin policy used auth.jwt() ->> 'role' = 'admin'
-- which reads from the JWT token. Supabase does NOT put custom roles there by default.
-- The app stores roles in the user_roles table (see admin.tsx beforeLoad).
-- Replace with an EXISTS check against user_roles.

DROP POLICY IF EXISTS "Only admin can manage articles" ON articles;

CREATE POLICY "Only admin can manage articles"
  ON articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
