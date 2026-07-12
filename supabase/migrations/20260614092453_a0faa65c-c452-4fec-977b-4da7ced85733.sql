
-- Public read tables (storefront catalog)
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;

-- Admin-managed via RLS (admins also need write)
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

-- User-scoped tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abandoned_carts TO anon, authenticated;

-- service_role (server-side via supabaseAdmin) bypasses RLS but still needs grants
GRANT ALL ON public.products, public.product_images, public.product_variants,
            public.product_categories, public.categories,
            public.profiles, public.orders, public.order_items,
            public.order_payment_secrets, public.user_roles, public.abandoned_carts
      TO service_role;
