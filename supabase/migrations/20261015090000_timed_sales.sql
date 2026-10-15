-- "מבצע עד תאריך": a percentage off the price the customer pays, for a set of
-- products, until a date — then the regular price comes back by itself.
--
-- public.product_sales remembers, per product, the price and former price from
-- before the sale and the catalog price the sale set. admin_start_sale writes
-- both (one logged, undoable batch, source 'sale_start'); end_due_sales runs
-- from the 10-minute cron and restores products whose sale has ended (source
-- 'sale_end'). A product whose price was changed by hand during the sale is
-- NOT overwritten: its sale row is closed and the owner's price stays.
--
-- The former price shown struck-through is the real price the customer paid
-- just before the sale (Consumer Protection Law §2: no invented "before").
--
-- Server-only (service_role); per CLAUDE.md revoked from public, anon AND
-- authenticated.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.end_due_sales();
--   DROP FUNCTION IF EXISTS public.admin_start_sale(uuid, uuid[], numeric, timestamptz);
--   DROP TABLE IF EXISTS public.product_sales;

CREATE TABLE IF NOT EXISTS public.product_sales (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id        uuid NOT NULL,
  pct             numeric NOT NULL,
  regular_price   numeric NOT NULL,
  regular_sale_price numeric,
  sale_catalog_price numeric NOT NULL,
  ends_at         timestamptz NOT NULL,
  ended_at        timestamptz,
  ended_how       text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_sales_one_active
  ON public.product_sales (product_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS product_sales_due
  ON public.product_sales (ends_at) WHERE ended_at IS NULL;

ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_sales admin read" ON public.product_sales;
CREATE POLICY "product_sales admin read" ON public.product_sales
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.admin_start_sale(
  p_actor uuid, p_ids uuid[], p_pct numeric, p_ends_at timestamptz
)
RETURNS TABLE (batch_id uuid, updated integer, skipped integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_batch   uuid := gen_random_uuid();
  v_total   integer := COALESCE(array_length(p_ids, 1), 0);
  v_updated integer := 0;
BEGIN
  IF v_total = 0 OR v_total > 5000 THEN
    RAISE EXCEPTION 'invalid product count %', v_total;
  END IF;
  IF p_pct IS NULL OR p_pct < 1 OR p_pct > 90 THEN
    RAISE EXCEPTION 'invalid percentage %', p_pct;
  END IF;
  IF p_ends_at IS NULL OR p_ends_at <= now() OR p_ends_at > now() + interval '366 days' THEN
    RAISE EXCEPTION 'invalid end date %', p_ends_at;
  END IF;

  PERFORM set_config('app.price_batch', v_batch::text, true);
  PERFORM set_config('app.price_source', 'sale_start', true);
  PERFORM set_config('app.price_actor', COALESCE(p_actor::text, ''), true);

  -- Products already on sale, or priced 0 ("call for price"), are skipped.
  WITH picked AS (
    SELECT p.id, p.price, p.sale_price,
           GREATEST(1, round(p.price * (1 - p_pct / 100))) AS new_price
      FROM public.products p
     WHERE p.id = ANY (p_ids)
       AND p.price > 0
       AND NOT EXISTS (SELECT 1 FROM public.product_sales s
                        WHERE s.product_id = p.id AND s.ended_at IS NULL)
  ), ins AS (
    INSERT INTO public.product_sales
      (product_id, batch_id, pct, regular_price, regular_sale_price,
       sale_catalog_price, ends_at, created_by)
    SELECT id, v_batch, p_pct, price, sale_price, new_price, p_ends_at, p_actor
      FROM picked
     WHERE new_price < price
    RETURNING product_id, regular_price, regular_sale_price, sale_catalog_price
  )
  UPDATE public.products p
     SET price = ins.sale_catalog_price,
         -- The customer's price just before the sale (site discount 30%),
         -- or the former price already shown if that is higher.
         sale_price = GREATEST(COALESCE(ins.regular_sale_price, 0),
                               round(ins.regular_price * 0.7))
    FROM ins
   WHERE p.id = ins.product_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN QUERY SELECT v_batch, v_updated, v_total - v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_start_sale(uuid, uuid[], numeric, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_sale(uuid, uuid[], numeric, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.end_due_sales()
RETURNS TABLE (restored integer, kept integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_batch    uuid := gen_random_uuid();
  v_restored integer := 0;
  v_kept     integer := 0;
BEGIN
  PERFORM set_config('app.price_batch', v_batch::text, true);
  PERFORM set_config('app.price_source', 'sale_end', true);
  PERFORM set_config('app.price_actor', '', true);

  -- Still at the sale price → back to the regular price and former price.
  WITH due AS (
    SELECT s.id, s.product_id, s.regular_price, s.regular_sale_price
      FROM public.product_sales s
      JOIN public.products p ON p.id = s.product_id
     WHERE s.ended_at IS NULL AND s.ends_at <= now()
       AND p.price = s.sale_catalog_price
     FOR UPDATE OF s
  ), upd AS (
    UPDATE public.products p
       SET price = due.regular_price, sale_price = due.regular_sale_price
      FROM due
     WHERE p.id = due.product_id
    RETURNING due.id
  )
  UPDATE public.product_sales s
     SET ended_at = now(), ended_how = 'restored'
    FROM upd WHERE s.id = upd.id;
  GET DIAGNOSTICS v_restored = ROW_COUNT;

  -- Price changed by hand during the sale (or the sale was undone): close the
  -- row and leave the current price alone.
  UPDATE public.product_sales s
     SET ended_at = now(), ended_how = 'kept_manual_price'
   WHERE s.ended_at IS NULL AND s.ends_at <= now();
  GET DIAGNOSTICS v_kept = ROW_COUNT;

  -- A sale whose start was undone ("היסטוריית מחירים" → ביטול) is over now,
  -- so the product can go on sale again.
  UPDATE public.product_sales s
     SET ended_at = now(), ended_how = 'undone'
   WHERE s.ended_at IS NULL
     AND EXISTS (SELECT 1 FROM public.product_price_changes c
                  WHERE c.batch_id = s.batch_id AND c.product_id = s.product_id
                    AND c.undone_by_batch IS NOT NULL);

  RETURN QUERY SELECT v_restored, v_kept;
END;
$$;
REVOKE ALL ON FUNCTION public.end_due_sales() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_due_sales() TO service_role;
