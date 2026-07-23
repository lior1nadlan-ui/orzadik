-- Smart catalog search: Hebrew normalization + trigram fuzzy matching.
--
-- Today's search is pure ILIKE, so it fails on the three things Hebrew shoppers
-- actually type: gershayim variants (ס"מ vs ס״מ vs ס׳מ), nikud, and typos.
-- norm_he() folds all of those away, and pg_trgm adds similarity so a one-letter
-- slip still finds the product. Word matching is per-word AND (order-independent),
-- so "קידוש כוס" finds the same rows as "כוס קידוש".
--
-- SECURITY INVOKER (the default): products RLS still applies, and anon already
-- has SELECT on products — this exposes nothing new.
BEGIN;

-- Supabase keeps extensions in the `extensions` schema (advisor linter 0014
-- flags extensions installed into public). Fall back to the default only if
-- that schema is absent, so this migration applies on a bare Postgres too.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
      EXECUTE 'CREATE EXTENSION pg_trgm WITH SCHEMA extensions';
    ELSE
      EXECUTE 'CREATE EXTENSION pg_trgm';
    END IF;
  END IF;
END $$;

-- Resolve gin_trgm_ops / similarity() regardless of which schema pg_trgm
-- landed in, for the rest of this transaction.
SET LOCAL search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Hebrew normalizer.
--   1. lowercase (Latin SKUs / mixed strings)
--   2. quote family + LIKE metacharacters -> space
--        geresh U+05F3, gershayim U+05F4, ` ' " and the curly quotes.
--        % _ \ are folded too: they arrive inside a bound parameter so there is
--        no injection risk, but leaving them in would turn a typed "50%" into a
--        wildcard that matches the whole catalog.
--   3. strip nikud/te'amim U+0591..U+05C7
--   4. collapse whitespace, trim
-- Code points are spelled with chr() rather than pasted literally: combining
-- marks are invisible in a source file and trivially corrupted by an editor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.norm_he(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      translate(
        lower(coalesce(t, '')),
        chr(1523) || chr(1524)                            -- ׳ ״
          || chr(96) || chr(39) || chr(34)                -- ` ' "
          || chr(8216) || chr(8217)                       -- ‘ ’
          || chr(8220) || chr(8221)                       -- “ ”
          || chr(37) || chr(95) || chr(92),               -- % _ \
        '            '                                    -- 12 spaces, 1:1
      ),
      '[' || chr(1425) || '-' || chr(1479) || ']', '', 'g'
    ),
    '\s+', ' ', 'g'
  ))
$$;

-- Accelerates both `norm_he(name) LIKE '%x%'` and the similarity ordering.
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON public.products USING gin (public.norm_he(name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Hybrid search: exact-ish per-word AND across name/descriptions/sku, OR a
-- trigram-similar name (typo tolerance). total_count rides along as a window
-- function so the client gets the result-set size in the same round trip.
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
     AND (
       (SELECT bool_and(
                 public.norm_he(p.name) LIKE '%' || w || '%'
              OR public.norm_he(coalesce(p.short_description, '')) LIKE '%' || w || '%'
              OR public.norm_he(coalesce(p.description, '')) LIKE '%' || w || '%'
              OR lower(coalesce(p.sku, '')) LIKE '%' || w || '%')
          FROM words)
       OR similarity(public.norm_he(p.name), nq.q) > 0.3
     )
   -- Explicit sorts first (all-NULL and therefore inert for other p_sort
   -- values), then relevance: prefix match, then similarity, then recency.
   ORDER BY
     CASE WHEN p_sort = 'price-asc'  THEN p.price END ASC,
     CASE WHEN p_sort = 'price-desc' THEN p.price END DESC,
     CASE WHEN p_sort = 'name'       THEN p.name  END ASC,
     (public.norm_he(p.name) LIKE nq.q || '%') DESC,
     similarity(public.norm_he(p.name), nq.q) DESC,
     p.created_at DESC,
     p.id
   LIMIT p_limit OFFSET p_offset
$$;

-- Public read surface, same audience that already reads products.
GRANT EXECUTE ON FUNCTION public.search_products(text, int, int, text)
  TO anon, authenticated, service_role;

COMMIT;
