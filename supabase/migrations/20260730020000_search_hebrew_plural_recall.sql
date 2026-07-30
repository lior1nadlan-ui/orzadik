-- Hebrew plural recall in on-site search.
--
-- APPLIED TO PRODUCTION 2026-07-30 via MCP (two steps: he_variants, then the
-- function replacement below).
--
-- ⚠️ The previous repo migration for list_products_collapsed
-- (20260724120000_collapse_duplicate_listings.sql) had drifted from production.
-- The body below was rebuilt from `pg_get_functiondef` against the LIVE function,
-- not from that file, and only the word-matching predicate differs from what was
-- deployed. If you edit this function again, read pg_proc.prosrc first.
--
-- THE PROBLEM. Israelis search in the plural — "כיפות", "טליתות", "גביעים" — while
-- the catalogue names products in the singular. Trigram similarity did not bridge
-- it: "כיפות"/"כיפה" share too few trigrams to clear the 0.6 threshold. Measured on
-- live data before this change:
--     כיפות   37 results        (כיפה  → 688)
--     טליתות  14                (~491 tallitot exist)
--     מזוזות   8                (מזוזה → 391)
--     גביעים   1                (גביע  → 119)
--     שופרות   0                (11 exist)
-- The natural way to search returned roughly 5% of the catalogue.
--
-- THE FIX is morphological rather than a hand-written synonym list, so it
-- generalises across all 4,641 products instead of the few nouns someone thought
-- to enumerate. It is also STRICTLY ADDITIVE: the original predicate is untouched
-- and one clause is appended, so no result that matched before can be lost.
--
-- WHY name_norm AND NOT search_blob for the variants. The first version tested
-- every variant against search_blob (a large text column that cannot use the GIN
-- index inside this correlated subquery) and took 'כיפות' from 330 ms to 639 ms.
-- Matching variants against name_norm only costs +55 ms over the equivalent
-- singular, and gives up only description-only matches — exactly where the
-- expensive version measured 57% precision. Better on both axes, not a trade.
--
-- AFTER (live, post-collapse totals): כיפות 675 · מזוזות 338 · טליתות 336 ·
-- חנוכיות 119 · גביעים 114 · שופרות 8. Multi-word queries stay conjunctive
-- ("טלית צמר" → 42, not 866) because bool_and still spans words.

create or replace function public.he_variants(w text)
returns text[]
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select array(
    select distinct v from unnest(
      array[
        w,
        -- feminine plural: כיפות → כיפ / כיפה, טליתות → טלית, מזוזות → מזוז / מזוזה
        case when w like '%ות' and length(w) >= 4 then left(w, length(w) - 2) end,
        case when w like '%ות' and length(w) >= 4 then left(w, length(w) - 2) || 'ה' end,
        -- ־יות nouns: חנוכיות → חנוכיה / חנוכייה (both spellings occur in the data)
        case when w like '%יות' and length(w) >= 5 then left(w, length(w) - 3) || 'יה' end,
        case when w like '%יות' and length(w) >= 5 then left(w, length(w) - 3) || 'ייה' end,
        -- masculine plural: פמוטים → פמוט, גביעים → גביע, סידורים → סידור
        case when w like '%ים' and length(w) >= 4 then left(w, length(w) - 2) end,
        -- construct plural: גביעי (קידוש) → גביע
        case when w like '%י'  and length(w) >= 4 then left(w, length(w) - 1) end
      ]
    ) as v
    -- Below 3 characters a substring match sprays across the whole catalogue.
    where v is not null and length(v) >= 3
  );
$$;

comment on function public.he_variants(text) is
  'Hebrew plural→singular expansion used by list_products_collapsed. Returns the term plus conservative singular stems (>=3 chars).';

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
                      -- Hebrew plural recall, added. Matched against name_norm
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
