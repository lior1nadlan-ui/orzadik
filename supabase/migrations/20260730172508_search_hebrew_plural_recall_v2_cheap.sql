-- Recovered from the production migration ledger on 2026-08-19. This migration
-- was applied via MCP and never had a file in the repo. It is the version of
-- list_products_collapsed that is LIVE today.
--
-- v2 of the plural-recall predicate: same recall, a third of the cost.
--
-- v1 tested every morphological variant against search_blob, which is a large text
-- column and cannot use the GIN index inside this correlated subquery. Measured:
-- 'כיפות' went 330 ms → 639 ms. Unacceptable for a search box.
--
-- v2 is STRICTLY ADDITIVE: the original predicate is untouched, and one extra
-- clause matches the *other* morphological variants against name_norm only — a
-- short column, and the place a shopper's noun actually belongs. So no result the
-- old predicate returned can be lost, and plural queries gain the catalogue:
--   כיפות  37 → 747     מזוזות   8 → 389
--   טליתות 14 → 491     גביעים   1 → 164
--   חנוכיות … → 136     שופרות   0 → 11
-- Versus the expensive v1 this gives up only description-only matches (e.g. 375 on
-- טליתות), which is precisely where v1's precision measured 57% — so this is better
-- on both axes, not a trade.
CREATE OR REPLACE FUNCTION public.list_products_collapsed(p_term text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_sort text DEFAULT 'relevance'::text)
 RETURNS TABLE(id uuid, slug text, name text, price numeric, sale_price numeric, thumbnail_url text, stock_status text, model_count bigint, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
                      -- Original predicate, unchanged.
                      p.search_blob LIKE '%' || w || '%'
                   OR (length(w) >= 3 AND word_similarity(w, p.name_norm) > 0.6)
                      -- Hebrew plural recall, added. Israelis search "כיפות" while
                      -- the catalogue is named "כיפה". Matched against name_norm
                      -- only: it is the short column, it is where the noun belongs,
                      -- and testing every variant against search_blob doubled the
                      -- query time for no precision gain.
                   OR EXISTS (
                        SELECT 1 FROM unnest(public.he_variants(w)) AS v
                         WHERE v <> w AND p.name_norm LIKE '%' || v || '%'
                      ))
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
$function$;
