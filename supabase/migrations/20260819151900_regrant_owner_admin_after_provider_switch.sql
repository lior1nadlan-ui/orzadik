-- Re-grant the owner's admin role after the account was recreated under Google.
--
-- APPLIED TO PRODUCTION 2026-08-19 via MCP.
--
-- What happened: the owner signed in with Google at lior1nadlan@gmail.com. The
-- email/password user that held the admin row (c551ff68…) no longer exists, and
-- a new user (f2679217…, provider google) exists in its place. user_roles.user_id
-- references auth.users on delete cascade, so the admin row went with the old
-- user and the table was empty again — which is exactly why /admin and the CRM
-- stopped appearing for them.
--
-- 20260819142000 predicted this could not happen, reasoning from
--   CREATE UNIQUE INDEX users_email_partial_key
--     ON auth.users USING btree (email) WHERE (is_sso_user = false);
-- That index is real and it does prevent two rows sharing the address AT ONCE.
-- The mistake was concluding the only outcomes were "link to the existing user"
-- or "fail outright": the old row can also stop existing, and then the new one
-- is created without ever conflicting. Sequential replacement, not concurrent
-- duplication. The index says nothing about which row holds the address over
-- time, and admin is keyed to user_id, so the grant does not survive the swap.
--
-- Keyed by email so it lands on whichever row currently carries the address,
-- rather than a uuid that has already changed once today.
--
-- Deliberately NOT a trigger. A standing rule that re-grants the highest
-- privilege in the system whenever an account with that address appears is a
-- worse trade than re-running one INSERT on the rare occasion the owner changes
-- sign-in provider. If this recurs often, the durable fix is to stop keying
-- authorisation to a row that auth can replace — not to automate the re-grant.
--
-- VERIFIED AFTER APPLY under the new account's own JWT: the user_roles query
-- behind admin.tsx's beforeLoad and useAuth().isAdmin returns 1, and reads see
-- all 4,672 products, the order, 6 profiles and the abandoned cart.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
  from auth.users u
 where lower(u.email) = 'lior1nadlan@gmail.com'
   and not exists (
     select 1 from public.user_roles r
      where r.user_id = u.id and r.role = 'admin'::public.app_role
   );
