-- Free gift options at checkout.
--
-- These are DATA-ONLY columns. Gift wrap and the printed dedication are offered
-- at no charge — that is the product decision, and it is also what keeps this
-- change away from the money path: nothing here participates in the subtotal /
-- shipping / total computation, and src/lib/pricing.ts is untouched.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN is_gift boolean NOT NULL DEFAULT false,
  ADD COLUMN gift_note text,
  ADD COLUMN gift_wrap boolean NOT NULL DEFAULT false;

COMMIT;
