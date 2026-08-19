-- Recovered from the production migration ledger on 2026-08-19. This migration
-- was applied via MCP and never had a file in the repo.
--
-- NOTE: the RLS policy created here was later rewritten by
-- 20260819124924_product_copy_runs_rls_initplan.sql to wrap auth.uid() in a
-- scalar subquery. This file is kept as the historical record of the original.
--
-- Ledger for every bulk copy change made to products.description.
--
-- Deliberately a SIDE TABLE, not a column on `products`: that table carries two
-- STORED generated columns (name_norm, search_blob) plus two GIN indexes, so
-- adding a column would force a full rewrite of all of it. This costs nothing
-- and gives an exact, per-row rollback path.
CREATE TABLE IF NOT EXISTS public.product_copy_runs (
  id                  bigserial PRIMARY KEY,
  product_id          uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  run_id              text NOT NULL,
  description_before  text,
  description_after   text,
  md5_after           text,
  generated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_copy_runs_product_idx ON public.product_copy_runs(product_id);
CREATE INDEX IF NOT EXISTS product_copy_runs_run_idx     ON public.product_copy_runs(run_id);

-- Owner-only. Nothing public ever reads this.
ALTER TABLE public.product_copy_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admin can manage product_copy_runs" ON public.product_copy_runs;
CREATE POLICY "Only admin can manage product_copy_runs"
  ON public.product_copy_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 680 product descriptions begin with a literal "[[" import artifact, e.g.
-- "[[ כיפה בד מהודרת 19 ס\"מ". It renders verbatim on the live product page.
-- Strip the marker and any whitespace that follows it; nothing else is touched,
-- and short_description (the structured spec source) is not involved at all.
-- Idempotent: after this runs, no row matches '[[%', so re-running is a no-op.
WITH targets AS (
  SELECT id, description,
         regexp_replace(description, '^\[\[\s*', '') AS cleaned
    FROM public.products
   WHERE description LIKE '[[%'
),
logged AS (
  INSERT INTO public.product_copy_runs
    (product_id, run_id, description_before, description_after, md5_after)
  SELECT id, 'strip_import_artifacts_v1', description, cleaned, md5(cleaned)
    FROM targets
  RETURNING product_id, description_after
)
UPDATE public.products p
   SET description = l.description_after
  FROM logged l
 WHERE p.id = l.product_id;
