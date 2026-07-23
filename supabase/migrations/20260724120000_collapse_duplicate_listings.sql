-- Collapse same-name products into one listing tile.
--
-- The supplier catalogue gives many genuinely different SKUs the SAME generic
-- name: 43 rows of 'נטלה מהודרת מפולימר 14 ס"מ', 18 of the Pesach cover, and so
-- on — 527 name groups covering 1,630 active products. Every one of those rows
-- is a real distinct product with its own SKU and its own photo (verified: 43
-- rows → 43 SKUs → 43 images, and ZERO duplicate SKUs catalogue-wide), so they
-- must NOT be deleted. The defect is presentational: a category page renders 43
-- tiles that look identical.
--
-- This function returns ONE representative row per name group, plus
-- model_count so the card can say "43 דגמים". Grouping is on name_norm — the
-- stored normalized column — so gershayim/nikud variants of the same name fold
-- together too.
--
-- Collapsing must happen in the DATABASE, not in the client: /shop and the
-- category pages page 24 rows at a time, so collapsing a fetched page would
-- turn 24 tiles into 3 and break both the count and "load more".
BEGIN;

SET LOCAL search_path = public, extensions, pg_temp;

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
           p.stock_status, p.name_norm, p.created_at
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

-- Same-name siblings for the product page's "דגמים נוספים" rail. Excludes the
-- product being viewed and orders images-first for the same reason as above.
CREATE OR REPLACE FUNCTION public.list_product_models(p_product_id uuid, p_limit int DEFAULT 24)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  price numeric,
  sale_price numeric,
  thumbnail_url text,
  stock_status text
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT p.id, p.slug, p.name, p.price, p.sale_price, p.thumbnail_url, p.stock_status
    FROM public.products p
   WHERE p.is_active
     AND p.id <> p_product_id
     AND p.name_norm = (SELECT name_norm FROM public.products WHERE id = p_product_id)
   ORDER BY (coalesce(p.thumbnail_url, '') <> '') DESC,
            (p.stock_status <> 'outofstock') DESC,
            p.price ASC,
            p.id
   LIMIT p_limit
$$;

GRANT EXECUTE ON FUNCTION public.list_product_models(uuid, int)
  TO anon, authenticated, service_role;

-- Grouping and the sibling lookup both key on name_norm.
CREATE INDEX IF NOT EXISTS products_name_norm_active_idx
  ON public.products (name_norm) WHERE is_active;

COMMIT;
