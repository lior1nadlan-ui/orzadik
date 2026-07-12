-- Retention / data-minimization: purge old abandoned-cart snapshots so the
-- table does not retain personal data (email/name/cart) indefinitely. Enforces
-- the retention commitment in the privacy policy.

CREATE OR REPLACE FUNCTION public.cleanup_old_abandoned_carts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  DELETE FROM public.abandoned_carts
  WHERE created_at < now() - interval '90 days';
$fn$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_abandoned_carts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_abandoned_carts() TO service_role;

-- Schedule daily IF pg_cron is installed. Guarded so the migration never fails
-- when the extension is absent — in that case schedule the function via an
-- external scheduler (Cloudflare cron / manual) or enable pg_cron and re-run.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-old-abandoned-carts',
      '17 3 * * *',
      $cron$ SELECT public.cleanup_old_abandoned_carts(); $cron$
    );
  END IF;
END;
$do$;
