-- Correct the admin grant: it went to the wrong account.
--
-- APPLIED TO PRODUCTION 2026-08-19 via MCP.
--
-- 20260819133055_seed_owner_admin_role.sql granted admin to
-- nitukbeclick@gmail.com, inferred from the session's own email address. The
-- owner has since stated the admin address is lior1nadlan@gmail.com. An inferred
-- grant is not a granted one, so the inferred row is withdrawn here — admin
-- carries read access to every order and every customer's name, address and
-- phone, and that is not something to leave switched on for an account nobody
-- asked to switch it on for.
delete from public.user_roles r
 using auth.users u
 where u.id = r.user_id
   and u.email = 'nitukbeclick@gmail.com'
   and r.role = 'admin'::public.app_role;

-- Grant the real one. This is a no-op TODAY: lior1nadlan@gmail.com has never
-- registered, so auth.users holds no row for it and there is nothing to key to.
-- The trigger below is what actually delivers the grant, the moment it does
-- register. Kept anyway so that re-running this file against a database where
-- the account already exists does the right thing directly.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
  from auth.users u
 where u.email = 'lior1nadlan@gmail.com'
   and not exists (
     select 1 from public.user_roles r
      where r.user_id = u.id and r.role = 'admin'::public.app_role
   );

-- Deferred grant, because the account does not exist yet and the alternatives
-- are both bad: hand-inserting a row into auth.users skips the identity and
-- password-hash rows Supabase Auth expects and yields an account that cannot
-- sign in, and waiting means someone has to remember to come back and run one
-- INSERT at exactly the right moment.
--
-- Scope is one hardcoded address, matched exactly and case-insensitively. It is
-- NOT a pattern, NOT a domain, and NOT a column anyone can write to — so the
-- only way to obtain admin through this path is to control that Gmail account
-- and register with it, which is the owner and nobody else.
--
-- Verified by simulating both signups inside a rolled-back transaction:
-- "LIOR1nadlan@gmail.com" (mixed case) received admin, "someone.else@gmail.com"
-- received nothing.
--
-- ⚠️ This is a standing privilege-escalation path by design. It is safe only for
-- as long as that address belongs to the owner. Once the owner has signed up and
-- the row exists, DROP IT — it has done its job:
--     drop trigger if exists grant_owner_admin_on_signup on auth.users;
--     drop function if exists public.grant_owner_admin_on_signup();
create or replace function public.grant_owner_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) = 'lior1nadlan@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists grant_owner_admin_on_signup on auth.users;
create trigger grant_owner_admin_on_signup
  after insert on auth.users
  for each row execute function public.grant_owner_admin_on_signup();
