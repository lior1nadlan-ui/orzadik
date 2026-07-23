-- Precompute the normalized search text.
--
-- Measured on the live catalog: calling norm_he() on name + short_description +
-- description at query time cost **1.69 s** for a single search across the 4,672
-- active products — two regexp_replace passes per field per row. That is far too
-- slow for search-as-you-type, so the normalization moves to STORED generated
-- columns and the trigram indexes move onto them. Query time now pays for the
-- search term only.
--
-- name_norm and search_blob are kept separate on purpose: fuzzy/typo scoring must
-- see the product NAME alone (blending long descriptions in would drown the
-- signal), while the per-word AND match wants every field.
BEGIN;

SET LOCAL search_path = public, extensions, pg_temp;

ALTER TABLE public.products
  ADD COLUMN name_norm text
    GENERATED ALWAYS AS (public.norm_he(name)) STORED,
  ADD COLUMN search_blob text
    GENERATED ALWAYS AS (
      public.norm_he(
        coalesce(name, '') || ' ' ||
        coalesce(short_description, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(sku, '')
      )
    ) STORED;

CREATE INDEX products_search_blob_trgm_idx
  ON public.products USING gin (search_blob gin_trgm_ops);
CREATE INDEX products_name_norm_trgm_idx
  ON public.products USING gin (name_norm gin_trgm_ops);

-- Superseded by products_name_norm_trgm_idx (same content, stored column).
DROP INDEX IF EXISTS public.products_name_trgm_idx;

-- ---------------------------------------------------------------------------
-- Rewritten hybrid search.
--
-- Per-word AND over search_blob keeps word-order independence; the fuzzy branch
-- switches from similarity() to word_similarity(). Measured on real data,
-- whole-string similarity() scored a one-letter typo at only 0.13–0.22 against
-- these long product names — below any usable threshold — while word_similarity
-- scored the same pairs at 0.83+. Threshold 0.6 was calibrated against the live
-- catalog: it recovers כוס קידוס→קידוש, מזוזא→מזוזה and חנוכיא→חנוכיה while
-- nonsense terms still return exactly zero rows.
--
-- The length(w) >= 3 guard keeps one- and two-letter words on exact matching;
-- fuzzy-matching them would match nearly the whole catalog.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_products(
  p_term text,
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
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH nq AS (
    SELECT public.norm_he(p_term) AS q
  ),
  words AS (
    SELECT unnest(string_to_array((SELECT q FROM nq), ' ')) AS w
  )
  SELECT p.id,
         p.slug,
         p.name,
         p.price,
         p.sale_price,
         p.thumbnail_url,
         p.stock_status,
         count(*) OVER () AS total_count
    FROM public.products p, nq
   WHERE p.is_active
     AND (SELECT bool_and(
                   p.search_blob LIKE '%' || w || '%'
                OR (length(w) >= 3 AND word_similarity(w, p.name_norm) > 0.6))
            FROM words)
   ORDER BY
     CASE WHEN p_sort = 'price-asc'  THEN p.price END ASC,
     CASE WHEN p_sort = 'price-desc' THEN p.price END DESC,
     CASE WHEN p_sort = 'name'       THEN p.name  END ASC,
     (p.name_norm LIKE nq.q || '%') DESC,
     word_similarity(nq.q, p.name_norm) DESC,
     p.created_at DESC,
     p.id
   LIMIT p_limit OFFSET p_offset
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, int, int, text)
  TO anon, authenticated, service_role;

COMMIT;
