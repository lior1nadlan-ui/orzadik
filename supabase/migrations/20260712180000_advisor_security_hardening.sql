-- Security-advisor hardening (Supabase linters 0011 / 0028 / 0029).
-- Pins search_path on the one mutable-search-path function and revokes EXECUTE
-- on SECURITY DEFINER helpers from end-user roles that never call them.
-- Verified against the codebase before writing:
--   * increment_rate_limit is only ever called with the service_role client
--     (supabaseAdmin) in src/lib/rate-limit.server.ts — no anon/authenticated caller.
--   * tg_profiles_guard_privileged & rls_auto_enable are trigger/event-trigger
--     functions — triggers fire regardless of caller EXECUTE.
--   * has_role is intentionally NOT touched: it is used inside admin RLS policies
--     AND called directly via rpc('has_role') in cardcom.functions.ts, so
--     `authenticated` must keep EXECUTE. Linter 0029 will still list it by design.

-- 1. increment_rate_limit: server-only. Pin an empty search_path (schema-qualify
--    the sole public reference; the target is aliased so the ON CONFLICT row
--    reference needs no search_path lookup) and restrict EXECUTE to service_role.
CREATE OR REPLACE FUNCTION public.increment_rate_limit(p_key text, p_ttl_seconds int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM public.rate_limits WHERE expires_at < now();

  INSERT INTO public.rate_limits AS rl (key, count, expires_at)
  VALUES (p_key, 1, now() + (p_ttl_seconds || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE
    SET count = rl.count + 1,
        expires_at = GREATEST(rl.expires_at, now() + (p_ttl_seconds || ' seconds')::interval)
  RETURNING rl.count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(text, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_rate_limit(text, int) TO service_role;

-- 2. tg_profiles_guard_privileged: BEFORE UPDATE trigger fn on public.profiles.
--    Matches the existing pattern used for tg_set_updated_at / handle_new_user.
REVOKE EXECUTE ON FUNCTION public.tg_profiles_guard_privileged() FROM PUBLIC, anon, authenticated;

-- 3. rls_auto_enable: DDL/event-trigger helper created outside these migrations
--    (via the dashboard). Guarded so a clean apply on a DB without it still passes.
--    Not called by application code.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND p.pronargs = 0
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
