
-- ==================================================
-- HARDENING: revoke broad anon/authenticated grants
-- Public catalog: anon SELECT only
-- ==================================================
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.categories FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.product_images FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.product_variants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.product_categories FROM anon;

-- Authenticated users don't need write either — admins do, via service_role
REVOKE INSERT, UPDATE, DELETE ON public.products FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.categories FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_images FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_variants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_categories FROM authenticated;

-- Re-grant explicit SELECT and admin write paths handled by service_role / has_role policies
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.product_categories TO anon, authenticated;

-- Allow authenticated INSERT/UPDATE/DELETE so admin policies (has_role='admin') can act
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;

-- ==================================================
-- Sensitive tables: NO anon access at all
-- ==================================================
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.abandoned_carts FROM anon;

-- Authenticated: only what policies allow; tighten to least-privilege
REVOKE ALL ON public.orders FROM authenticated;
REVOKE ALL ON public.order_items FROM authenticated;
REVOKE ALL ON public.profiles FROM authenticated;
REVOKE ALL ON public.user_roles FROM authenticated;
REVOKE ALL ON public.abandoned_carts FROM authenticated;

GRANT SELECT, UPDATE ON public.orders TO authenticated;     -- admins UPDATE via policy; users SELECT own
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;          -- needed for has_role()
GRANT SELECT, UPDATE ON public.abandoned_carts TO authenticated;

-- service_role keeps full access on everything (server-side ops)
GRANT ALL ON public.orders, public.order_items, public.profiles,
             public.user_roles, public.abandoned_carts,
             public.products, public.categories,
             public.product_images, public.product_variants, public.product_categories
        TO service_role;
