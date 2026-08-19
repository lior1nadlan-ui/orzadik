-- FIX for 20260819125045_consolidate_duplicate_permissive_policies.sql.
--
-- THE BUG: an RLS predicate is evaluated with the privileges of the CALLING
-- role, not the table owner. A policy granted `to public` that calls has_role()
-- therefore requires EVERY role it covers to hold EXECUTE on has_role. `anon`
-- does not hold it — and must not, because that would let a logged-out visitor
-- probe whether a given uuid is an admin.
--
-- So the merged `to public` SELECT policies raised
--   ERROR: 42501: permission denied for function has_role
-- on every anonymous catalogue read: the storefront, for logged-out visitors,
-- i.e. essentially all traffic.
--
-- THE FIX: one policy PER ROLE. The duplicate-permissive lint is scoped to a
-- (role, action) pair, so an anon-only policy and an authenticated-only policy
-- on the same action are NOT duplicates — and the anon branch never mentions
-- has_role at all. This keeps the performance win and restores anonymous reads.
--
-- Verified after apply, by replaying the reads under each role:
--   anon           → 4,648 products (active only), 5 articles (published only)
--   authenticated  → same catalogue, 0 orders/profiles/roles belonging to others
--   admin          → 4,672 products (incl. 24 inactive), all orders and profiles
drop policy if exists "Products are readable by public, all rows by admins" on public.products;
create policy "Anon reads active products"
  on public.products for select to anon
  using ( is_active = true );
create policy "Users read active products, admins read all"
  on public.products for select to authenticated
  using ( is_active = true
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Published articles readable by public, all by admins" on public.articles;
create policy "Anon reads published articles"
  on public.articles for select to anon
  using ( is_published = true );
create policy "Users read published articles, admins read all"
  on public.articles for select to authenticated
  using ( is_published = true
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );

-- Same latent defect, PRE-EXISTING rather than introduced by the previous
-- migration: "Public can view approved reviews" was already `to public` while
-- calling has_role, so anonymous review reads were failing this way before
-- today. Nothing surfaced it because the reviews table is still empty.
drop policy if exists "Public can view approved reviews" on public.reviews;
create policy "Anon reads approved reviews"
  on public.reviews for select to anon
  using ( is_approved = true );
create policy "Users read approved reviews, admins read all"
  on public.reviews for select to authenticated
  using ( is_approved = true
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );
