-- Record WHEN a recipient row was claimed for sending.
--
-- The sender resets rows that have been stuck in 'sending' for more than 15
-- minutes (a Worker that died mid-batch) back to 'pending'. created_at cannot
-- drive that: every recipient of a campaign is inserted in the same instant, so
-- a row claimed 50 minutes into a long send would look "stuck" the moment it
-- was claimed, and get handed to a second sender while the first was still
-- working on it — exactly the double-send the SKIP LOCKED claim exists to
-- prevent. claimed_at is the only honest clock for this.
BEGIN;

ALTER TABLE public.campaign_recipients ADD COLUMN claimed_at timestamptz;

-- Recovery scan: in-flight rows, oldest claim first.
DROP INDEX IF EXISTS public.campaign_recipients_sending_idx;
CREATE INDEX campaign_recipients_sending_idx
  ON public.campaign_recipients (claimed_at)
  WHERE status = 'sending';

CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(p_campaign_id uuid, p_limit int)
RETURNS SETOF public.campaign_recipients
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.campaign_recipients cr
     SET status = 'sending',
         claimed_at = now()
   WHERE cr.id IN (
     SELECT id
       FROM public.campaign_recipients
      WHERE campaign_id = p_campaign_id
        AND status = 'pending'
      ORDER BY created_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING cr.*;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, int) TO service_role;

COMMIT;
