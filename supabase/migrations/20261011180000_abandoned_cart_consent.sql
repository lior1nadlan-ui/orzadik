-- Abandoned-cart reminders only go to addresses with marketing consent (Spam
-- Law §30א). The checkout's optional "אשמח לקבל דיוור" box was saved only with
-- the ORDER — so a shopper who ticked it and then left before paying (exactly
-- the person a cart reminder is for) never counted as consented. Of 7 open
-- carts, 1 ever got a reminder.
--
-- Store the box with the cart snapshot, with the time it was given, so the
-- reminder can rely on consent the shopper actually gave on that form.
--
-- Rollback:
--   ALTER TABLE public.abandoned_carts
--     DROP COLUMN IF EXISTS marketing_consent, DROP COLUMN IF EXISTS marketing_consent_at;

ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;
