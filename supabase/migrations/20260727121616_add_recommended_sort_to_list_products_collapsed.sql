-- Recovered from the production migration ledger on 2026-08-19. This migration
-- was applied via MCP and never had a file in the repo.
--
-- NOTE: list_products_collapsed was replaced again by
-- 20260730172508_search_hebrew_plural_recall_v2_cheap.sql, which is the version
-- live today. This file is the historical record of the 'recommended' sort.
--
-- /shop's default sort was 'newest', but 4,184 of the 4,641 active products
-- (90%) were bulk-imported within a single minute, so `created_at DESC` has no
-- signal and the ORDER BY fell through to `r.id` — i.e. the main shopping page
-- presented the catalog in arbitrary UUID order, burying in-stock, photographed
-- product behind whatever sorted first.
--
-- This adds a 'recommended' branch that merchandises instead: in stock first,
-- then has a photo, then has real copy, then price descending. It mirrors the
-- quality gates the homepage pool already uses (FeaturedProductsCarousel.tsx)
-- and the price-DESC intent of /category's own 'recommended', so the two
-- discovery surfaces finally agree.
--
-- Signature, return shape and every existing p_sort value are unchanged, so
-- callers that pass 'newest' / 'price-asc' / 'price-desc' / 'name' / 'relevance'
-- behave exactly as before.
CREATE OR REPLACE FUNCTION public.list_products_collapsed(
  p_term text DEFAULT '',
  p_category_id uuid DEFAULT NULL,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_sort text DEFAULT 'relevance'
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  price numeric,
  sale_price numeric,
  thumbnail_url text,
  stock_status text,
  model_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH nq AS (
    SELECT public.norm_he(coalesce(p_term, '')) AS q
  ),
  words AS (
    SELECT unnest(string_to_array((SELECT q FROM nq), ' ')) AS w
  ),
  base AS (
    SELECT p.id, p.slug, p.name, p.price, p.sale_price, p.thumbnail_url,
           p.stock_status, p.name_norm, p.created_at,
           -- Merchandising signals, computed once here so the ORDER BY below
           -- stays a plain column reference.
           (coalesce(p.thumbnail_url, '') <> '')                AS has_image,
           (length(coalesce(p.description, '')) > 40)           AS has_copy
      FROM public.products p, nq
     WHERE p.is_active
       AND (
         p_category_id IS NULL
         OR EXISTS (
           SELECT 1 FROM public.product_categories pc
            WHERE pc.product_id = p.id AND pc.category_id = p_category_id
         )
       )
       AND (
         nq.q = ''
         OR (SELECT bool_and(
                      p.search_blob LIKE '%' || w || '%'
                   OR (length(w) >= 3 AND word_similarity(w, p.name_norm) > 0.6))
               FROM words)
       )
  ),
  ranked AS (
    SELECT b.*,
           count(*)     OVER (PARTITION BY b.name_norm) AS model_count,
           row_number() OVER (
             PARTITION BY b.name_norm
             -- Representative pick, in order: one that HAS an image (so a
             -- collapsed group never shows the placeholder while its siblings
             -- have photos), then in stock, then cheapest, then stable by id.
             ORDER BY (coalesce(b.thumbnail_url, '') <> '') DESC,
                      (b.stock_status <> 'outofstock') DESC,
                      b.price ASC,
                      b.id
           ) AS rn
      FROM base b
  )
  SELECT r.id, r.slug, r.name, r.price, r.sale_price, r.thumbnail_url,
         r.stock_status, r.model_count,
         count(*) OVER () AS total_count
    FROM ranked r, nq
   WHERE r.rn = 1
   ORDER BY
     -- Merchandised default: sellable and presentable product first.
     CASE WHEN p_sort = 'recommended' THEN (r.stock_status <> 'outofstock') END DESC,
     CASE WHEN p_sort = 'recommended' THEN r.has_image END DESC,
     CASE WHEN p_sort = 'recommended' THEN r.has_copy  END DESC,
     CASE WHEN p_sort = 'recommended' THEN r.price     END DESC,
     CASE WHEN p_sort = 'price-asc'  THEN r.price END ASC,
     CASE WHEN p_sort = 'price-desc' THEN r.price END DESC,
     CASE WHEN p_sort = 'name'       THEN r.name  END ASC,
     CASE WHEN p_sort = 'newest'     THEN r.created_at END DESC,
     -- Relevance tail. Inert when a term-less browse is sorted explicitly.
     (nq.q <> '' AND r.name_norm LIKE nq.q || '%') DESC,
     CASE WHEN nq.q <> '' THEN word_similarity(nq.q, r.name_norm) END DESC,
     r.created_at DESC,
     r.id
   LIMIT p_limit OFFSET p_offset
$$;

GRANT EXECUTE ON FUNCTION public.list_products_collapsed(text, uuid, int, int, text)
  TO anon, authenticated, service_role;
