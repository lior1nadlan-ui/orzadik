-- Clean the four PRODUCT-BEARING categories that still carried percent-encoded
-- Hebrew slugs (e.g. '%d7%98%d7%9c...'). Those URLs were effectively broken: the
-- router decodes %d7.. back to Hebrew bytes, which never match the literal
-- encoded string stored in categories.slug, so /category/<natural-encoded> 404'd
-- and the categories were only reachable via ugly double-encoded links.
--
-- Renamed to clean ASCII slugs. Verified before running that NO category has one
-- of these as parent_slug, and product_categories / articles key on category_id
-- (not slug), so nothing else needs updating in the DB. App code that referenced
-- the old slugs (cross-sells.ts, personalization.ts, collections.ts,
-- SiteHeader.tsx, index.tsx) was repointed, and category.$slug.tsx 301s the old
-- encoded slugs to the new ones. The 0-product encoded categories (מוצרי חגים,
-- סט טלית תפילין, מיתוג, אקססוריז) were intentionally left as-is — no page traffic.
--
-- Applied to production via the Supabase MCP on 2026-07-26; mirrored here.
update public.categories set slug = 'talitot', updated_at = now()
  where slug = '%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa';
update public.categories set slug = 'sidurim', updated_at = now()
  where slug = '%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d';
update public.categories set slug = 'yehudaika', updated_at = now()
  where slug = '%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%99%d7%95%d7%93%d7%90%d7%99%d7%a7%d7%94';
update public.categories set slug = 'marazim-chatanim', updated_at = now()
  where slug = '%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94';
