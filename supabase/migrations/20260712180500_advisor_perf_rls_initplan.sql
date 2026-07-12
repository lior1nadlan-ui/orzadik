-- Performance-advisor fix: Auth RLS Initialization Plan (Supabase linter 0003).
-- Each affected policy calls auth.uid() bare, so Postgres re-evaluates it per row.
-- Wrapping it in a scalar subquery `(select auth.uid())` turns it into a once-per-
-- statement initplan. This is a surgical rewrite: expressions are taken verbatim
-- from the live pg_policies dump with only `auth.uid()` -> `(select auth.uid())`
-- changed. ALTER POLICY leaves roles/cmd untouched and never drops the policy.
-- Covers the 25 flagged policies; does NOT touch has_role's grant or policy roles.

-- abandoned_carts
ALTER POLICY "Admins manage abandoned carts" ON public.abandoned_carts
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users update own abandoned carts" ON public.abandoned_carts
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users view own abandoned carts" ON public.abandoned_carts
  USING ((select auth.uid()) = user_id);

-- articles
ALTER POLICY "Only admin can manage articles" ON public.articles
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- categories
ALTER POLICY "Admins can manage categories" ON public.categories
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- order_items
ALTER POLICY "Admins manage order items" ON public.order_items
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins view all order items" ON public.order_items
  USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users view own order items" ON public.order_items
  USING (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = (select auth.uid())))));

-- orders
ALTER POLICY "Admins update orders" ON public.orders
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins view all orders" ON public.orders
  USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users view own orders" ON public.orders
  USING ((select auth.uid()) = user_id);

-- product_categories
ALTER POLICY "Admins manage product_categories" ON public.product_categories
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- product_images
ALTER POLICY "Admins manage product images" ON public.product_images
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- product_variants
ALTER POLICY "Admins manage product variants" ON public.product_variants
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- products
ALTER POLICY "Admins can manage products" ON public.products
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view all products" ON public.products
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- profiles
ALTER POLICY "Admins view all profiles" ON public.profiles
  USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users insert own profile" ON public.profiles
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "Users update own profile" ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "Users view own profile" ON public.profiles
  USING ((select auth.uid()) = id);

-- reviews
ALTER POLICY "Admins manage reviews" ON public.reviews
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Public can view approved reviews" ON public.reviews
  USING ((is_approved = true) OR has_role((select auth.uid()), 'admin'::app_role));

-- user_roles
ALTER POLICY "Admins can manage roles" ON public.user_roles
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view all roles" ON public.user_roles
  USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can view own roles" ON public.user_roles
  USING ((select auth.uid()) = user_id);
