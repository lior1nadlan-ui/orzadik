-- Two admins now run the shop (Lior and his wife). Two things that were fine
-- with one person stop being fine with two:
--
-- 1. order_events — who moved an order, and when. "נשלח" pressed on the phone
--    and "נשלח" pressed in the CRM look identical on the order row; with two
--    people the next question is always "who sent it?". Append-only history,
--    written by the server (service role) from the same apply* functions the
--    CRM and the Telegram buttons share. actor_label keeps a readable name even
--    after a user is deleted, and covers the Telegram case, where the presser is
--    a Telegram user rather than a site account.
--
-- 2. staff_alert_prefs — which owner emails each admin wants. Every admin now
--    receives the order / contact / morning-briefing emails
--    (staff-recipients.server.ts); this lets one of them turn a kind off
--    without touching the other. No row = everything on.

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 60),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 500),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text CHECK (actor_label IS NULL OR char_length(actor_label) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON public.order_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS order_events_actor_idx ON public.order_events (actor_user_id);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read order events" ON public.order_events;
CREATE POLICY "Admins read order events" ON public.order_events
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE TABLE IF NOT EXISTS public.staff_alert_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  orders boolean NOT NULL DEFAULT true,
  contacts boolean NOT NULL DEFAULT true,
  digest boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_alert_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage own alert prefs" ON public.staff_alert_prefs;
CREATE POLICY "Admins manage own alert prefs" ON public.staff_alert_prefs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.has_role((SELECT auth.uid()), 'admin'));

COMMIT;
