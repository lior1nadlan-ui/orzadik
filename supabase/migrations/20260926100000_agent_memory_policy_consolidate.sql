-- agent_memory: one admin policy instead of two, with the auth call hoisted.
--
-- The Supabase performance advisor flagged this table twice (2026-09-25):
--   * auth_rls_initplan — both policies called auth.uid() bare, so Postgres
--     re-evaluated it for every row instead of once per statement;
--   * multiple_permissive_policies — "admin read" (SELECT) and "admin write"
--     (ALL) both applied to SELECT for `authenticated`, so every read ran two
--     identical checks.
--
-- Access is unchanged: admins may read and write, nobody else may do either.
-- "ALL" already covers SELECT, so one policy says exactly what the two did.
-- Same (select auth.uid()) form as 20260712180500_advisor_perf_rls_initplan.

drop policy if exists "agent_memory admin read" on public.agent_memory;
drop policy if exists "agent_memory admin write" on public.agent_memory;

create policy "agent_memory admin all"
  on public.agent_memory
  for all
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
