-- auth.uid() inside an RLS predicate is re-evaluated once PER ROW. Wrapping it in
-- a scalar subquery turns it into an InitPlan the planner evaluates once per
-- query. Same semantics, same policy, one evaluation instead of N.
--
-- This is the identical treatment 20260712180500_advisor_perf_rls_initplan.sql
-- applied to the other tables; product_copy_runs was created a fortnight after
-- it (20260727121842) and so was never covered.
drop policy if exists "Only admin can manage product_copy_runs" on public.product_copy_runs;

create policy "Only admin can manage product_copy_runs"
  on public.product_copy_runs
  for all
  using ( (select public.has_role((select auth.uid()), 'admin'::public.app_role)) )
  with check ( (select public.has_role((select auth.uid()), 'admin'::public.app_role)) );
