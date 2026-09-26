-- Price ledger + undo for the admin products screen.
--
-- WHY. The owner asked for price editing to be easy. Easy includes "safe to
-- undo": until now a bulk percentage change rewrote up to 200 shelf prices
-- with no record of what they were, and the dialog itself warned it was "not
-- reversible in one click". CLAUDE.md already requires bulk content edits to go
-- through a ledger that allows rollback; prices had none.
--
-- HOW.
--   * product_price_changes: one row per product per change — old and new
--     price and former (struck) price, who, when, which batch, from where.
--   * A trigger on products writes that row for EVERY price change, whichever
--     path made it: the admin dialog (anon client under RLS), the new inline
--     edit and bulk actions (service role, below), even hand-written SQL. A
--     side table, like product_copy_runs, so the products table is not
--     rewritten.
--   * The server functions group a change into a batch by setting three
--     transaction-local settings (app.price_batch / app.price_source /
--     app.price_actor) inside the two functions below; anything else is
--     logged with source 'edit' and the caller's auth.uid().
--   * admin_undo_price_batch restores a batch — but only rows whose price is
--     still exactly what the batch set, so undoing an old batch never
--     overwrites a later edit. The undo is itself a logged batch.
--
-- The functions are callable by service_role only (the admin server functions
-- run requireAdmin() first); anon and authenticated cannot execute them.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS products_price_log ON public.products;
--   DROP FUNCTION IF EXISTS public.tg_log_product_price_change();
--   DROP FUNCTION IF EXISTS public.admin_set_product_prices(uuid, text, uuid[], text, numeric);
--   DROP FUNCTION IF EXISTS public.admin_undo_price_batch(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.admin_recent_price_batches(integer);
--   DROP TABLE IF EXISTS public.product_price_changes;

CREATE TABLE IF NOT EXISTS public.product_price_changes (
  id              bigserial PRIMARY KEY,
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id        uuid,
  source          text NOT NULL DEFAULT 'edit',
  old_price       numeric(10,2),
  new_price       numeric(10,2),
  old_sale_price  numeric(10,2),
  new_sale_price  numeric(10,2),
  changed_by      uuid,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  undone_by_batch uuid
);

CREATE INDEX IF NOT EXISTS product_price_changes_product_idx
  ON public.product_price_changes (product_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS product_price_changes_batch_idx
  ON public.product_price_changes (batch_id) WHERE batch_id IS NOT NULL;

-- Owner-only. Nothing public ever reads this.
ALTER TABLE public.product_price_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_price_changes admin all" ON public.product_price_changes;
CREATE POLICY "product_price_changes admin all"
  ON public.product_price_changes FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- SECURITY DEFINER so the admin dialog's update (anon client, RLS) can still
-- write the ledger row. It only ever inserts the row describing the update
-- that fired it.
CREATE OR REPLACE FUNCTION public.tg_log_product_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
    INSERT INTO public.product_price_changes
      (product_id, batch_id, source, old_price, new_price, old_sale_price, new_sale_price, changed_by)
    VALUES (
      NEW.id,
      NULLIF(current_setting('app.price_batch', true), '')::uuid,
      COALESCE(NULLIF(current_setting('app.price_source', true), ''), 'edit'),
      OLD.price, NEW.price, OLD.sale_price, NEW.sale_price,
      COALESCE(NULLIF(current_setting('app.price_actor', true), '')::uuid, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_log_product_price_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS products_price_log ON public.products;
CREATE TRIGGER products_price_log
  AFTER UPDATE OF price, sale_price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_product_price_change();

-- Set the catalog price of a list of products, as one logged batch.
--   p_mode 'set': every product gets p_value (> 0, at most 2 decimals).
--   p_mode 'pct': price * (1 + p_value/100), whole shekels, never below 1;
--                 products at price 0 ("call for price") are left alone.
CREATE OR REPLACE FUNCTION public.admin_set_product_prices(
  p_actor uuid, p_source text, p_ids uuid[], p_mode text, p_value numeric
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
  IF p_source NOT IN ('inline', 'bulk_set', 'bulk_pct') THEN
    RAISE EXCEPTION 'invalid source %', p_source;
  END IF;
  IF v_total = 0 OR v_total > 5000 THEN
    RAISE EXCEPTION 'invalid product count %', v_total;
  END IF;

  PERFORM set_config('app.price_batch', v_batch::text, true);
  PERFORM set_config('app.price_source', p_source, true);
  PERFORM set_config('app.price_actor', COALESCE(p_actor::text, ''), true);

  IF p_mode = 'set' THEN
    IF p_value IS NULL OR p_value <= 0 OR p_value > 1000000 THEN
      RAISE EXCEPTION 'invalid price %', p_value;
    END IF;
    UPDATE public.products
       SET price = round(p_value, 2)
     WHERE id = ANY (p_ids)
       AND price IS DISTINCT FROM round(p_value, 2);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_mode = 'pct' THEN
    IF p_value IS NULL OR p_value < -90 OR p_value > 300 OR p_value = 0 THEN
      RAISE EXCEPTION 'invalid percentage %', p_value;
    END IF;
    UPDATE public.products
       SET price = GREATEST(1, round(price * (1 + p_value / 100)))
     WHERE id = ANY (p_ids)
       AND price > 0
       AND price IS DISTINCT FROM GREATEST(1, round(price * (1 + p_value / 100)));
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'invalid mode %', p_mode;
  END IF;

  RETURN QUERY SELECT v_batch, v_updated, v_total - v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_product_prices(uuid, text, uuid[], text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_prices(uuid, text, uuid[], text, numeric)
  TO service_role;

-- Undo one batch. Restores price and former price for every product in the
-- batch whose current values are still exactly what the batch wrote; anything
-- edited since is skipped and counted.
CREATE OR REPLACE FUNCTION public.admin_undo_price_batch(p_actor uuid, p_batch uuid)
RETURNS TABLE (batch_id uuid, restored integer, skipped integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_batch    uuid := gen_random_uuid();
  v_total    integer;
  v_changes  bigint[];
  v_restored integer := 0;
BEGIN
  SELECT count(*) INTO v_total
    FROM public.product_price_changes c
   WHERE c.batch_id = p_batch AND c.undone_by_batch IS NULL AND c.source <> 'undo';
  IF v_total = 0 THEN
    RAISE EXCEPTION 'nothing to undo in batch %', p_batch;
  END IF;

  SELECT array_agg(c.id) INTO v_changes
    FROM public.product_price_changes c
    JOIN public.products p ON p.id = c.product_id
   WHERE c.batch_id = p_batch
     AND c.undone_by_batch IS NULL
     AND c.source <> 'undo'
     AND p.price IS NOT DISTINCT FROM c.new_price
     AND p.sale_price IS NOT DISTINCT FROM c.new_sale_price;

  IF v_changes IS NOT NULL THEN
    PERFORM set_config('app.price_batch', v_batch::text, true);
    PERFORM set_config('app.price_source', 'undo', true);
    PERFORM set_config('app.price_actor', COALESCE(p_actor::text, ''), true);

    UPDATE public.products p
       SET price = c.old_price, sale_price = c.old_sale_price
      FROM public.product_price_changes c
     WHERE c.id = ANY (v_changes) AND p.id = c.product_id;
    GET DIAGNOSTICS v_restored = ROW_COUNT;

    UPDATE public.product_price_changes
       SET undone_by_batch = v_batch
     WHERE id = ANY (v_changes);
  END IF;

  RETURN QUERY SELECT v_batch, v_restored, v_total - v_restored;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_undo_price_batch(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_undo_price_batch(uuid, uuid) TO service_role;

-- The most recent batches, for the "היסטוריית מחירים" list.
CREATE OR REPLACE FUNCTION public.admin_recent_price_batches(p_limit integer DEFAULT 20)
RETURNS TABLE (
  batch_id uuid, source text, changed_at timestamptz, products integer,
  undone integer, old_total numeric, new_total numeric, sample text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.batch_id,
         min(c.source),
         min(c.changed_at),
         count(*)::integer,
         count(*) FILTER (WHERE c.undone_by_batch IS NOT NULL)::integer,
         COALESCE(sum(c.old_price), 0),
         COALESCE(sum(c.new_price), 0),
         min(p.name)
    FROM public.product_price_changes c
    JOIN public.products p ON p.id = c.product_id
   WHERE c.batch_id IS NOT NULL
   GROUP BY c.batch_id
   ORDER BY min(c.changed_at) DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.admin_recent_price_batches(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_price_batches(integer) TO service_role;
