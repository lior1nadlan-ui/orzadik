
-- 1. Add columns for category banner and long description
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS long_description TEXT;

-- 2. Add custom_text (embroidery name) on order items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custom_text TEXT;

-- 3. Raise base prices by 20% (and copy original to sale_price as the "before" price).
--    Only run on rows where sale_price hasn't already been seeded to the original.
UPDATE public.products
SET sale_price = price,
    price = ROUND(price * 1.2)
WHERE sale_price IS NULL OR sale_price <= price;
