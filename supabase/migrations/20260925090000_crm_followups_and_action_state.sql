-- CRM: follow-up reminders, and server-side state for the daily action queue.
--
-- crm_followups — "call Ruth on Thursday about the engraving". A reminder is
-- tied to a customer by email (guest checkout means the email is the only
-- stable identity, same as crm_customer_notes) and surfaces in the admin's
-- "מה לעשות היום" queue and the owner's morning briefing from its due date
-- until it is marked done.
--
-- crm_action_state — what the owner decided about a queue item: handled for
-- today, snoozed until a date, or dismissed for good. Until now that lived in
-- the browser's localStorage, so the phone and the computer disagreed, and a
-- failed payment the owner had already called about came back every single
-- morning. The key is "<action type>:<entity id>" (e.g.
-- "stuck_unpaid:<order uuid>"), deliberately WITHOUT a date, so a snooze or a
-- dismissal outlives the day it was made.
--
-- Both tables are admin-only in both directions, like crm_customer_notes. The
-- server functions use the service-role client; these policies guard the REST
-- surface.
BEGIN;

CREATE TABLE public.crm_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  due_at timestamptz NOT NULL,
  done_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- The queue and the briefing ask one question: which open reminders are due.
CREATE INDEX crm_followups_open_due_idx ON public.crm_followups (due_at) WHERE done_at IS NULL;
CREATE INDEX crm_followups_email_idx ON public.crm_followups (customer_email);
-- Covering index for the FK (the advisor flags unindexed foreign keys).
CREATE INDEX crm_followups_created_by_idx ON public.crm_followups (created_by);

ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage follow-ups" ON public.crm_followups
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE TABLE public.crm_action_state (
  action_key text PRIMARY KEY CHECK (char_length(action_key) BETWEEN 3 AND 200),
  snoozed_until timestamptz,
  dismissed_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A row with neither is meaningless; "restore" deletes the row instead.
  CHECK (snoozed_until IS NOT NULL OR dismissed_at IS NOT NULL)
);
CREATE INDEX crm_action_state_updated_by_idx ON public.crm_action_state (updated_by);

ALTER TABLE public.crm_action_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage action state" ON public.crm_action_state
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

COMMIT;
