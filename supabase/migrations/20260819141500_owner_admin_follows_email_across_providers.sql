-- Make the owner's admin role follow the EMAIL, not one particular auth row.
--
-- APPLIED TO PRODUCTION 2026-08-19 via MCP.
--
-- The owner registered with the email/password provider and then asked that
-- signing in with Google at the same address also open the CRM. Admin is keyed
-- to user_id (requireAdmin() in admin-authz.server.ts, plus 23 RLS policies via
-- has_role), so the worry was that Google would produce a SECOND auth.users row
-- with a new id — a successful sign-in "with the same email" that still gets
-- bounced out of /admin.
--
-- Two halves were written for that:
--
--   1. Backfill. Grants admin to EVERY auth.users row carrying that address.
--   2. Trigger. Covers a row that does not exist yet.
--
-- ⚠️ The trigger's premise turned out to be FALSE and it is dropped again in
-- 20260819142000 — auth.users carries a unique index on email, so the second row
-- it guarded against cannot exist. Read that file before reinstating anything
-- here. The backfill below stands on its own and is still correct.
--
-- Backfill every existing row with that address. Idempotent; a no-op once the
-- grant is in place. Kept for the re-run and restore cases.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
  from auth.users u
 where lower(u.email) = 'lior1nadlan@gmail.com'
   and not exists (
     select 1 from public.user_roles r
      where r.user_id = u.id and r.role = 'admin'::public.app_role
   );

-- The trigger that was created here is deliberately NOT reproduced in this file,
-- because it was removed minutes later and re-creating it on a fresh database
-- would reintroduce a privilege-escalation path that nothing needs. The history
-- is in the migration ledger and in 20260819142000's comment.
