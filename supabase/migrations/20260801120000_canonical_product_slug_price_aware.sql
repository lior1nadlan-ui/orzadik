-- Make the product canonical price-aware.
--
-- 20260724120000_collapse_duplicate_listings.sql grouped the supplier's
-- same-name rows by name_norm alone, on the premise that they "differ only by
-- photo". Measured on prod (2026-08-01, 4,648 active products) that premise
-- fails for 753 of the 1,636 rows it governs:
--
--   name families with >1 member            528   covering 1,636 products
--   of those, families with >1 price        190   covering   753 products
--   largest catalogue spread inside a family              ₪432
--
-- canonical_product_slug elects the CHEAPEST member (price ASC), so 466 product
-- pages were serving a rel=canonical that pointed at a strictly cheaper page:
--   /product/polymer-washing-cup-14-cm-83321  ₪202 catalogue → ₪141 shown
--     canonical → …-40594                     ₪134 catalogue → ₪94  shown
-- Both rows are real, active, separately-photographed SKUs. A rel=canonical
-- asserts "this page is a duplicate of that one", which is simply false across
-- a 51% price gap: Google indexes only the cheapest row, so a shopper who
-- searched for the ₪141 model cannot reach it from search at all, and the
-- /feed.xml Merchant feed submits it at ₪141 while the site says it is a
-- duplicate of a ₪94 page.
--
-- Fix: add price to the grouping key. Photo-only twins still collapse exactly
-- as before (that was the whole point of the original migration); genuinely
-- differently-priced rows each keep their own indexable URL. Effect on the
-- catalogue: indexable product URLs 3,540 → 3,778, non-canonical 1,108 → 870.
--
-- The list/browse side is deliberately untouched: list_products_collapsed still
-- shows one tile per NAME with "N דגמים", and list_product_models still offers
-- every sibling, so nothing changes for a shopper browsing. This function only
-- governs what is told to crawlers.
--
-- src/routes/product.$slug.tsx already refuses any canonical candidate whose
-- effective price differs from the page's own, so the site is correct with or
-- without this migration; applying it restores the collapse for the same-priced
-- twins that guard would otherwise leave self-canonical.
--
-- STILL TO DO in code, outside this file's scope: src/routes/sitemap[.]xml.ts
-- picks its one <loc> per family in TypeScript with `const key = name_norm`
-- (line 174) and must mirror this key — `name_norm + '|' + String(p.price)` —
-- otherwise the 238 URLs that become self-canonical here are absent from the
-- sitemap. They are still crawlable via the category grids, so this is a
-- coverage gap, not a regression.
BEGIN;

SET LOCAL search_path = public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION public.canonical_product_slug(p_slug text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH me AS (
    SELECT p.name_norm, p.price
      FROM public.products p
     WHERE p.slug = p_slug
       AND p.is_active
     LIMIT 1
  )
  SELECT coalesce(
    (
      SELECT p.slug
        FROM public.products p, me
       WHERE p.is_active
         AND p.name_norm = me.name_norm
         -- The added term. Without it the winner below is the cheapest row in
         -- the whole name family, which is a different product.
         AND p.price = me.price
       -- Representative pick, identical to list_products_collapsed so the tile
       -- and the canonical elect the same row: one that HAS an image, then in
       -- stock, then cheapest (inert inside a single-price group, kept for
       -- shape parity), then stable by id.
       ORDER BY (coalesce(p.thumbnail_url, '') <> '') DESC,
                (p.stock_status <> 'outofstock') DESC,
                p.price ASC,
                p.id
       LIMIT 1
    ),
    -- Unknown or inactive slug: hand back the input so the caller stays
    -- self-canonical rather than receiving NULL.
    p_slug
  )
$$;

GRANT EXECUTE ON FUNCTION public.canonical_product_slug(text)
  TO anon, authenticated, service_role;

-- The grouping key is now (name_norm, price); products_name_norm_active_idx
-- covers only the first column.
CREATE INDEX IF NOT EXISTS products_name_norm_price_active_idx
  ON public.products (name_norm, price) WHERE is_active;

COMMIT;
