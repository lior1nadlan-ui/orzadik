-- Prevent privilege escalation via the self-service profile UPDATE policy.
--
-- The "Users update own profile" RLS policy allows an authenticated user to
-- update ANY column of their own profiles row (USING/WITH CHECK auth.uid()=id),
-- including `is_member`, which grants the 5% club discount enforced server-side
-- in placeOrder. A user could flip that flag directly via the REST/JS client.
--
-- We lock it down with a BEFORE UPDATE trigger that reverts changes to the
-- privileged `is_member` column unless the caller is an admin. Service-role
-- calls (server code) run without an end-user JWT, so auth.uid() IS NULL there
-- and legitimate admin/server updates are allowed through.

CREATE OR REPLACE FUNCTION public.tg_profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_member IS DISTINCT FROM OLD.is_member THEN
    -- Block the change only for authenticated end users who are not admins.
    -- auth.uid() IS NULL  => service_role / trusted server context (allow).
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      NEW.is_member := OLD.is_member;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_guard_privileged();
