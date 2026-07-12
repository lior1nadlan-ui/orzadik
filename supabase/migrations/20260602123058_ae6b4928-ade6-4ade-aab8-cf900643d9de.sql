
-- Tighten orders INSERT: user_id must match auth.uid() or be NULL for guests
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
CREATE POLICY "Place own or guest order"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL AND auth.uid() IS NULL)
  OR (user_id = auth.uid())
);

-- Tighten order_items INSERT: order must belong to caller (or be a guest order)
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Insert items for own order"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        (o.user_id IS NULL AND auth.uid() IS NULL)
        OR o.user_id = auth.uid()
      )
  )
);

-- Restrict public bucket listing while keeping direct-URL public reads working
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
