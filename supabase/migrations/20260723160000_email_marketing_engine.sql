-- Email-marketing engine: global suppression list, review-request guard,
-- guest newsletter list, and campaigns + chunked recipient queue.
--
-- Consent model (Spam Law §30א) — deliberately two-tier and NOT interchangeable:
--   * orders.contact_consent  = operational only. Its checkout label promises
--     "אינם משמשים לדיוור שיווקי", so it can NEVER feed a marketing send.
--   * profiles.marketing_consent / newsletter_subscribers = the only marketing
--     audiences. Every marketing message also carries a "פרסומת" marking, the
--     seller identity line, and a working per-recipient unsubscribe link.
-- email_suppressions is the global kill-switch: an address in it is skipped by
-- every sender regardless of which list it appears on.
BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Global suppression list (checked by every marketing sender).
-- ---------------------------------------------------------------------------
CREATE TABLE public.email_suppressions (
  email text PRIMARY KEY,            -- always stored lowercased by the callers
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
-- Admin-only in both directions; server functions use the service-role client
-- (which bypasses RLS), so this guards only the REST surface.
CREATE POLICY "Admins manage email suppressions" ON public.email_suppressions
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- ---------------------------------------------------------------------------
-- 1a. Review-request one-shot guard, plus a rollout backfill so switching the
--     cron on can never email the entire historical backlog at once.
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN review_request_sent_at timestamptz;

UPDATE public.orders
   SET review_request_sent_at = now()
 WHERE shipped_at IS NOT NULL
   AND shipped_at < now() - interval '7 days';

-- Partial index: the cron scans only orders still awaiting a review request.
CREATE INDEX orders_review_request_idx ON public.orders (shipped_at)
  WHERE review_request_sent_at IS NULL;

-- ---------------------------------------------------------------------------
-- 1b. Guest newsletter list (footer / checkout / account signups).
--     Guests have no auth.users row, so the email is the identity.
-- ---------------------------------------------------------------------------
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,        -- plain unique index: ON CONFLICT cannot
  name text,                         -- infer a PARTIAL one (SQLSTATE 42P10)
  source text NOT NULL,              -- 'footer' | 'checkout' | 'account'
  consented_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage newsletter subscribers" ON public.newsletter_subscribers
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Audience build filters on this; keeps the scan off the unsubscribed rows.
CREATE INDEX newsletter_subscribers_active_idx
  ON public.newsletter_subscribers (created_at)
  WHERE unsubscribed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 1c. Campaigns + per-recipient queue.
-- ---------------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  intro_html text NOT NULL DEFAULT '',
  -- { products: [{id,name,slug,thumbnail_url,price,sale_price}] } — snapshotted
  -- server-side at save time so an edited/deleted product can't rewrite a
  -- campaign that already went out.
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',   -- draft | sending | sent | cancelled
  recipient_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'pending',  -- pending | sending | sent | failed
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

-- The claim query's exact access path: campaign + FIFO over pending rows only.
CREATE INDEX campaign_recipients_pending_idx
  ON public.campaign_recipients (campaign_id, created_at)
  WHERE status = 'pending';
-- Stuck-row recovery scans by (status, sent_at) across campaigns.
CREATE INDEX campaign_recipients_sending_idx
  ON public.campaign_recipients (created_at)
  WHERE status = 'sending';

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins manage campaign recipients" ON public.campaign_recipients
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Atomic batch claim. The 5-minute cron tick and an admin pressing
-- "שלח קבוצה עכשיו" can overlap; FOR UPDATE SKIP LOCKED means each row is
-- handed to exactly one caller, so a recipient can never be double-sent.
CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(p_campaign_id uuid, p_limit int)
RETURNS SETOF public.campaign_recipients
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.campaign_recipients cr
     SET status = 'sending'
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

-- Server-only: called exclusively with the service-role client. Revoking from
-- PUBLIC as well as anon/authenticated is what actually removes the default
-- grant (matches 20260712180000_advisor_security_hardening.sql).
REVOKE EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, int) TO service_role;

COMMIT;
