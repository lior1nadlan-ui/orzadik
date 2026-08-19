-- Recovered from the production migration ledger on 2026-08-19. This migration
-- was applied via MCP and never had a file in the repo.
--
-- 528 supplier name-collisions cover 1,636 active products (largest family: 43),
-- and every one of them is self-canonical while all appear in the sitemap. So
-- Google is offered up to 43 URLs with the same H1, material, dimensions and
-- price band — 1,108 of the catalog's 4,641 pages are duplicates of another.
-- On a domain with no authority that suppresses the good pages along with the
-- redundant ones.
--
-- This returns the ONE representative slug per name group. The ordering is
-- deliberately identical to the row_number() pick inside
-- list_products_collapsed (has an image, then in stock, then cheapest, then
-- stable by id), so the page Google is pointed at is exactly the page the
-- listings link to — never a URL the shopper cannot reach from the grid.
CREATE OR REPLACE FUNCTION public.canonical_product_slug(p_slug text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH me AS (
    SELECT name_norm FROM public.products WHERE slug = p_slug AND is_active LIMIT 1
  )
  SELECT p.slug
    FROM public.products p, me
   WHERE p.is_active AND p.name_norm = me.name_norm
   ORDER BY (coalesce(p.thumbnail_url, '') <> '') DESC,
            (p.stock_status <> 'outofstock') DESC,
            p.price ASC,
            p.id
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.canonical_product_slug(text) TO anon, authenticated, service_role;
