-- "עדכון מחירים לפי מק״ט": set a different catalog price per product, as ONE
-- logged, undoable batch (source 'price_list').
--
-- admin_set_product_prices (20260926233000_product_price_ledger.sql) gives
-- every product the same value; a pasted supplier list needs a price per row.
-- The existing products_price_log trigger writes the ledger rows; this only
-- sets the batch settings around the update, exactly like its sibling.
--
-- Server-only: callable by service_role (the admin server function runs
-- requireAdmin() first). Per CLAUDE.md, revoked from public, anon AND
-- authenticated.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.admin_set_product_price_list(uuid, jsonb);

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
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS i(id uuid, price numeric)
     WHERE i.id IS NULL OR i.price IS NULL OR i.price <= 0 OR i.price > 1000000
  ) THEN
    RAISE EXCEPTION 'invalid price list';
  END IF;

  PERFORM set_config('app.price_batch', v_batch::text, true);
  PERFORM set_config('app.price_source', 'price_list', true);
  PERFORM set_config('app.price_actor', COALESCE(p_actor::text, ''), true);

  UPDATE public.products p
     SET price = round(i.price, 2)
    FROM jsonb_to_recordset(p_items) AS i(id uuid, price numeric)
   WHERE p.id = i.id
     AND p.price IS DISTINCT FROM round(i.price, 2);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN QUERY SELECT v_batch, v_updated, v_total - v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_product_price_list(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_price_list(uuid, jsonb) TO service_role;
