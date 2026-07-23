-- Give search_products an explicit 'newest' sort.
--
-- /shop's sort dropdown has four options and its ILIKE path maps "החדשים
-- ביותר" to `ORDER BY created_at DESC`. Without a matching branch here, wiring
-- the RPC in would quietly re-rank that option by relevance while the UI still
-- claimed to be sorting by date. Same four options, same meanings, either path.
BEGIN;

SET LOCAL search_path = public, extensions, pg_temp;

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
     CASE WHEN p_sort = 'newest'     THEN p.created_at END DESC,
     -- Relevance tail: exact prefix first, then fuzzy closeness. Inert for the
     -- explicit sorts above, which have already fully ordered the rows.
     (p.name_norm LIKE nq.q || '%') DESC,
     word_similarity(nq.q, p.name_norm) DESC,
     p.created_at DESC,
     p.id
   LIMIT p_limit OFFSET p_offset
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, int, int, text)
  TO anon, authenticated, service_role;

COMMIT;
