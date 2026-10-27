-- Owner request (video 15.10.2026, decision 27.10.2026): four groom boxes
-- photographed on a bed, some with a customer's embroidered name, opened /shop
-- because "recommended" ends on price DESC and they are the dearest rows with a
-- DB photo. They stay for sale; a flag sinks them in the recommended order only.
alter table public.products add column if not exists list_demote boolean not null default false;

create or replace function public.list_products_collapsed(p_term text default ''::text, p_category_id uuid default null::uuid, p_limit integer default 24, p_offset integer default 0, p_sort text default 'relevance'::text)
 returns table(id uuid, slug text, name text, price numeric, sale_price numeric, thumbnail_url text, stock_status text, model_count bigint, total_count bigint)
 language sql
 stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  WITH nq AS (
    SELECT public.norm_he(coalesce(p_term, '')) AS q
  ),
  words AS (
    SELECT unnest(string_to_array((SELECT q FROM nq), ' ')) AS w
  ),
  base AS (
    SELECT p.id, p.slug, p.name, p.price, p.sale_price, p.thumbnail_url,
           p.stock_status, p.name_norm, p.created_at, p.list_demote,
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
                   OR (length(w) >= 3 AND word_similarity(w, p.name_norm) > 0.6)
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
     CASE WHEN p_sort = 'recommended' THEN r.list_demote END ASC,
     CASE WHEN p_sort = 'recommended' THEN (r.stock_status <> 'outofstock') END DESC,
     CASE WHEN p_sort = 'recommended' THEN r.has_image END DESC,
     CASE WHEN p_sort = 'recommended' THEN r.has_copy  END DESC,
     CASE WHEN p_sort = 'recommended' THEN r.price     END DESC,
     CASE WHEN p_sort = 'price-asc'  THEN r.price END ASC,
     CASE WHEN p_sort = 'price-desc' THEN r.price END DESC,
     CASE WHEN p_sort = 'name'       THEN r.name  END ASC,
     CASE WHEN p_sort = 'newest'     THEN r.created_at END DESC,
     (nq.q <> '' AND r.name_norm LIKE nq.q || '%') DESC,
     CASE WHEN nq.q <> '' THEN word_similarity(nq.q, r.name_norm) END DESC,
     r.created_at DESC,
     r.id
   LIMIT p_limit OFFSET p_offset
$function$;

update public.products set list_demote = true
 where slug in ('groom-set-linen-look-premium', 'groom-set-grey-melange',
                'groom-set-black-leather-look', 'groom-set-brown-leather-look');
