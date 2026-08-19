-- Collapse overlapping PERMISSIVE policies so each (role, action) pair is
-- covered by exactly ONE policy.
--
-- Postgres evaluates EVERY permissive policy that matches a (role, action) and
-- ORs the results, so a table with three SELECT policies pays for three
-- predicate evaluations on every row of every read. On `products` (4,648 active
-- rows, read on every catalogue page) that is the hot path.
--
-- Two shapes are being fixed:
--
--   A. Strictly redundant policies. A `FOR ALL` admin policy already covers
--      SELECT, so a second admin-only SELECT policy with the IDENTICAL predicate
--      adds nothing at all. Three of those are simply dropped.
--
--   B. Genuine overlap: an admin `FOR ALL` policy sitting beside a public/owner
--      SELECT policy. The admin policy is narrowed to INSERT/UPDATE/DELETE and
--      its read intent is folded into the single SELECT policy as an OR branch.
--
-- Access is preserved exactly in both shapes: every predicate that could grant a
-- row before still grants it, and no predicate is widened.
--
-- ⚠️ READ 20260819125124_split_public_select_policies_by_role.sql BEFORE editing
-- this file. The `to public` SELECT policies created here were WRONG and are
-- replaced there — an RLS predicate runs with the CALLING role's privileges, and
-- `anon` has no EXECUTE on has_role().

-- ---------------------------------------------------------------------------
-- A. Strictly redundant admin SELECT policies (superset FOR ALL policy remains)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins view all order items" on public.order_items;
drop policy if exists "Admins can view all products" on public.products;
drop policy if exists "Admins can view all roles"   on public.user_roles;

-- ---------------------------------------------------------------------------
-- B1. products — public reads active rows, admins read everything
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can manage products"     on public.products;
drop policy if exists "Public can view active products" on public.products;

create policy "Products are readable by public, all rows by admins"
  on public.products for select to public
  using ( is_active = true or public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins insert products" on public.products for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update products" on public.products for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete products" on public.products for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

-- ---------------------------------------------------------------------------
-- B2. articles — public reads published rows, admins read drafts too
-- ---------------------------------------------------------------------------
drop policy if exists "Only admin can manage articles"          on public.articles;
drop policy if exists "Published articles are readable by anyone" on public.articles;

create policy "Published articles readable by public, all by admins"
  on public.articles for select to public
  using ( is_published = true or public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins insert articles" on public.articles for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update articles" on public.articles for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete articles" on public.articles for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

-- ---------------------------------------------------------------------------
-- B3. Fully-public catalogue tables. The existing SELECT policy is already
--     `true` for everyone, so the admin FOR ALL policy contributed nothing on
--     reads — it only ever mattered for writes. Narrow it to writes.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can manage categories"       on public.categories;
create policy "Admins insert categories" on public.categories for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update categories" on public.categories for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete categories" on public.categories for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Admins manage product_categories" on public.product_categories;
create policy "Admins insert product_categories" on public.product_categories for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update product_categories" on public.product_categories for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete product_categories" on public.product_categories for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins insert product images" on public.product_images for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update product images" on public.product_images for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete product images" on public.product_images for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Admins manage product variants" on public.product_variants;
create policy "Admins insert product variants" on public.product_variants for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update product variants" on public.product_variants for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete product variants" on public.product_variants for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

-- ---------------------------------------------------------------------------
-- B4. reviews — the SELECT policy already ORs in the admin branch, so the admin
--     FOR ALL policy only needs to stop covering SELECT.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins manage reviews" on public.reviews;
create policy "Admins insert reviews" on public.reviews for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update reviews" on public.reviews for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete reviews" on public.reviews for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

-- ---------------------------------------------------------------------------
-- B5. Owner-or-admin tables — merge the two SELECT branches into one policy.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins view all orders" on public.orders;
drop policy if exists "Users view own orders"  on public.orders;
create policy "Users view own orders, admins view all"
  on public.orders for select to authenticated
  using ( (select auth.uid()) = user_id
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "Users view own profile"   on public.profiles;
create policy "Users view own profile, admins view all"
  on public.profiles for select to authenticated
  using ( (select auth.uid()) = id
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Admins manage order items"  on public.order_items;
drop policy if exists "Users view own order items" on public.order_items;
create policy "Users view own order items, admins view all"
  on public.order_items for select to authenticated
  using ( exists ( select 1 from public.orders o
                    where o.id = order_items.order_id
                      and o.user_id = (select auth.uid()) )
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins insert order items" on public.order_items for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update order items" on public.order_items for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete order items" on public.order_items for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

drop policy if exists "Admins can manage roles"   on public.user_roles;
drop policy if exists "Users can view own roles"  on public.user_roles;
create policy "Users view own roles, admins view all"
  on public.user_roles for select to authenticated
  using ( (select auth.uid()) = user_id
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins insert roles" on public.user_roles for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins update roles" on public.user_roles for update to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete roles" on public.user_roles for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );

-- ---------------------------------------------------------------------------
-- B6. abandoned_carts — owner-or-admin on both SELECT and UPDATE. The
--     RESTRICTIVE anon deny-all policy is untouched and still applies on top.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins manage abandoned carts"    on public.abandoned_carts;
drop policy if exists "Users view own abandoned carts"   on public.abandoned_carts;
drop policy if exists "Users update own abandoned carts" on public.abandoned_carts;
create policy "Users view own abandoned carts, admins view all"
  on public.abandoned_carts for select to authenticated
  using ( (select auth.uid()) = user_id
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Users update own abandoned carts, admins update all"
  on public.abandoned_carts for update to authenticated
  using ( (select auth.uid()) = user_id
          or public.has_role((select auth.uid()), 'admin'::public.app_role) )
  with check ( (select auth.uid()) = user_id
          or public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins insert abandoned carts" on public.abandoned_carts for insert to authenticated
  with check ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
create policy "Admins delete abandoned carts" on public.abandoned_carts for delete to authenticated
  using ( public.has_role((select auth.uid()), 'admin'::public.app_role) );
