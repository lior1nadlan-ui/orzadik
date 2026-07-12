-- Product reviews / star ratings.
--
-- Trust + SEO: approved reviews feed the product page and the Product/AggregateRating
-- JSON-LD, which is what surfaces star ratings in Google results.
--
-- Trust model:
--   • Reviews are inserted server-side (service role) via a server function and
--     start UNAPPROVED (is_approved = false) — they are moderated before showing.
--   • The public may SELECT only approved reviews; admins see all.
--   • No direct client INSERT/UPDATE/DELETE grants — all writes go through the
--     server functions (service role) or admin tools.

CREATE TABLE IF NOT EXISTS public.reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  author_name  text NOT NULL,
  rating       int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        text,
  body         text,
  is_approved  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_approved
  ON public.reviews(product_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON public.reviews(created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone may read approved reviews; admins may read everything (for moderation).
GRANT SELECT ON public.reviews TO anon, authenticated;
CREATE POLICY "Public can view approved reviews" ON public.reviews
  FOR SELECT
  USING (is_approved = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins may moderate directly (approve / edit / delete) from the client.
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
CREATE POLICY "Admins manage reviews" ON public.reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- service_role (server functions) bypasses RLS for moderated inserts.
GRANT ALL ON public.reviews TO service_role;
