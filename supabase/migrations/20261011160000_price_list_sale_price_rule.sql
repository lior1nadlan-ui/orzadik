-- Fix 20261011140000: the former ("struck") price was required to be above the
-- catalog price. That is not the site's rule: getDisplayOriginal (src/lib/pricing.ts)
-- shows it when it is above what the customer PAYS (price minus the 30% site
-- discount), and all 170 live former prices sit below their catalog price. The
-- client (parsePriceList) enforces the real rule with a clear message; the
-- database only refuses non-positive or absurd values.
--
-- Rollback: re-apply 20261011140000_price_list_sale_price.sql.

CREATE OR REPLACE FUNCTION public.admin_set_product_price_list(p_actor uuid, p_items jsonb)
RETURNS TABLE (batch_id uuid, updated integer, skipped integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_batch   uuid := gen_random_uuid();
  v_total   integer := COALESCE(jsonb_array_length(p_items), 0);
  v_updated integer := 0;
BEGIN
  IF v_total = 0 OR v_total > 2000 THEN
    RAISE EXCEPTION 'invalid item count %', v_total;
  END IF;

  CREATE TEMP TABLE _price_items ON COMMIT DROP AS
  SELECT (e->>'id')::uuid                                 AS id,
         round((e->>'price')::numeric, 2)                 AS price,
         (e ? 'sale_price')                               AS has_sale,
         round(NULLIF(e->>'sale_price', '')::numeric, 2)  AS sale_price
    FROM jsonb_array_elements(p_items) AS e;

  IF EXISTS (
    SELECT 1 FROM _price_items i
     WHERE i.id IS NULL OR i.price IS NULL OR i.price <= 0 OR i.price > 1000000
        OR (i.sale_price IS NOT NULL AND (i.sale_price <= 0 OR i.sale_price > 1000000))
  ) THEN
    RAISE EXCEPTION 'invalid price list';
  END IF;

  PERFORM set_config('app.price_batch', v_batch::text, true);
  PERFORM set_config('app.price_source', 'price_list', true);
  PERFORM set_config('app.price_actor', COALESCE(p_actor::text, ''), true);

  UPDATE public.products p
     SET price = i.price,
         sale_price = CASE WHEN i.has_sale THEN i.sale_price ELSE p.sale_price END
    FROM _price_items i
   WHERE p.id = i.id
     AND (p.price IS DISTINCT FROM i.price
          OR (i.has_sale AND p.sale_price IS DISTINCT FROM i.sale_price));
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN QUERY SELECT v_batch, v_updated, v_total - v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_product_price_list(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_price_list(uuid, jsonb) TO service_role;
