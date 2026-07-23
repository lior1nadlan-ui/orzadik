-- Opt-in real inventory.
--
-- `products.stock_qty` has existed all along but was inert (never decremented,
-- never displayed) and `stock_status` was manual-only. Turning automatic
-- decrementing on for 4,672 supplier SKUs the owner does not physically stock
-- would immediately mark the catalog sold out — so tracking is OPT-IN per
-- product via `track_stock`, defaulting to false. With the default, this
-- migration changes no observable behaviour anywhere.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN track_stock boolean NOT NULL DEFAULT false;

-- Idempotency stamp: set by the RPC the first time an order is decremented.
ALTER TABLE public.orders
  ADD COLUMN stock_decremented_at timestamptz;

-- Powers the dashboard low-stock widget without scanning the whole catalog.
CREATE INDEX products_track_stock_idx ON public.products (stock_qty)
  WHERE track_stock = true;

-- Decrement stock for one paid order. Returns the number of product rows
-- actually adjusted (0 when the order was already processed).
--
-- Idempotency is claimed FIRST: the conditional UPDATE on orders succeeds for
-- exactly one caller, so a replayed CardCom webhook — or a manual re-run —
-- returns 0 without touching products. This is belt-and-braces on top of the
-- webhook's own cardcom_tranzaction_id idempotency check.
CREATE OR REPLACE FUNCTION public.decrement_order_stock(p_order_id uuid)
RETURNS int
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_rows int := 0;
BEGIN
  UPDATE public.orders
     SET stock_decremented_at = now()
   WHERE id = p_order_id
     AND stock_decremented_at IS NULL;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- One row per product even when the same product appears on several lines.
  WITH ordered AS (
    SELECT product_id, SUM(quantity)::int AS qty
      FROM public.order_items
     WHERE order_id = p_order_id
       AND product_id IS NOT NULL
     GROUP BY product_id
  )
  UPDATE public.products p
     SET stock_qty = GREATEST(0, COALESCE(p.stock_qty, 0) - o.qty),
         stock_status = CASE
           WHEN COALESCE(p.stock_qty, 0) - o.qty <= 0 THEN 'outofstock'
           ELSE p.stock_status
         END
    FROM ordered o
   WHERE p.id = o.product_id
     AND p.track_stock = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- Server-only: called from the CardCom webhook with the service-role client.
REVOKE EXECUTE ON FUNCTION public.decrement_order_stock(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_order_stock(uuid) TO service_role;

COMMIT;
