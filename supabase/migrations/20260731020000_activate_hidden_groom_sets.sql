-- Activate the 7 groom boxes that were hidden pending product photography.
--
-- APPLIED TO PRODUCTION 2026-07-31 via MCP, at the owner's explicit request.
--
-- Context: these were switched off in an earlier pass along with ~31 other
-- image-less products, because a flagship item with no photo converts poorly. The
-- owner has now asked for the full groom range to be visible, which is his call to
-- make — the category was showing 4 of its 11 products, i.e. less than half of the
-- store's highest-ticket line (₪1,150–1,800).
--
-- VERIFIED BEFORE APPLYING: all seven carry thumbnail_url = NULL and zero rows in
-- product_images. Nothing from public/groom-sets/ is attached to them, so this does
-- NOT publish the styled photographs that carry customers' embroidered names — that
-- risk lives in the homepage banner imagery, not on these product rows. The site
-- renders its branded "אין תמונה" placeholder instead.
--
-- Trade-off accepted: 7 products at ₪1,150–1,400 now display without a photo.
-- To reverse, run the same statement with is_active = false and the same slug list.
update products set is_active = true
where slug in ('groom-set-06','groom-set-07','groom-set-08','groom-set-09',
               'groom-set-10','groom-set-15','groom-set-16')
  and is_active = false;
