-- File the groom tallitot under the groom category.
--
-- APPLIED TO PRODUCTION 2026-07-31 via MCP.
--
-- The five "טלית מופת חתנים" products (₪235–282 shelf) were filed only under
-- talitot/tachshitim. Their names say חתנים outright, but nothing groom-facing
-- surfaced them: not /category/chatan-kala, not /category/marazim-chatanim, and
-- not the "מתנות לחתן ולכלה" collection hub — which aggregates chatan-kala,
-- wedding, marazim-chatanim, talit-tefillin-sets and birchonim, none of which
-- they belonged to. A customer browsing for a groom gift could not reach them
-- from any groom entry point; only a direct search for "טלית" would find them.
--
-- ADDITIVE by design: they keep their talitot and tachshitim memberships, because
-- a groom's tallit is still a tallit and should stay in that category. This only
-- adds the second, equally true membership. Reverse by deleting these rows.
--
-- After: /category/chatan-kala 29 → 36 tiles (all 5 present), and the hub surfaces
-- them alongside the groom boxes.
insert into product_categories (product_id, category_id)
select p.id, (select id from categories where slug = 'chatan-kala')
from products p
where p.name ilike '%טלית%חתנים%'
  and p.is_active
  and not exists (
    select 1 from product_categories pc
     where pc.product_id = p.id
       and pc.category_id = (select id from categories where slug = 'chatan-kala')
  );
