-- Close what the Supabase advisors flagged after the promotions waves
-- (measured 2026-09-27, after #149).
--
-- 1. SECURITY. admin_promotion_preview() and admin_promotion_stats() were
--    executable by anon and authenticated. 20260927070000_promotions_admin.sql
--    revoked EXECUTE from PUBLIC only, but Supabase's default privileges grant
--    it to anon and authenticated directly, so the revoke did not reach them.
--    admin_promotion_stats() returns paid orders and revenue per promotion —
--    business data for the CRM only. No promotion existed yet, so nothing was
--    exposed; both are now service_role only, as that file intended (they are
--    called by server functions behind requireAdmin).
-- 2. PERFORMANCE. order_items.promotion_id is a foreign key with no index
--    (the stats query and on-delete-set-null both scan for it). Partial: the
--    column is null on every line not sold in a promotion.
-- 3. PERFORMANCE. The promotions policy called auth.uid() per row and applied
--    to every role; now (select auth.uid()) once, for authenticated only —
--    which also stops an anon read from erroring on has_role() instead of
--    returning no rows.
--
-- Rollback:
--   grant execute on function public.admin_promotion_preview(text, uuid[], uuid[]) to anon, authenticated;
--   grant execute on function public.admin_promotion_stats() to anon, authenticated;
--   drop index if exists public.order_items_promotion_id_idx;
--   (policy: see 20260927060000_promotions.sql)

revoke execute on function public.admin_promotion_preview(text, uuid[], uuid[]) from anon, authenticated;
revoke execute on function public.admin_promotion_stats() from anon, authenticated;

create index if not exists order_items_promotion_id_idx
  on public.order_items (promotion_id)
  where promotion_id is not null;

drop policy if exists "Admins manage promotions" on public.promotions;
create policy "Admins manage promotions"
  on public.promotions for all
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
