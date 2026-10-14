-- 33 active products are named as a stand / set of 20-100 units ("סטנד 100
-- טבעות", "סטנד ברכונים ... מכיל 24 יח") but priced as ONE unit (₪11-57). The
-- owner confirmed on 2026-10-11 that a single unit is what is sold. A shopper
-- reading the name would expect the whole stand, so the name now says so:
-- " (המחיר ליחידה אחת)" is appended. Found by the "מחירים חשודים" check
-- (src/lib/price-audit.ts, rule pack_unit_price); none had been ordered yet.
--
-- Restore ledger: product_name_runs, run_id '2026-10-11-pack-unit-price'.
-- Rollback:
--   update products p set name = r.name_before from product_name_runs r
--    where r.product_id = p.id and r.run_id = '2026-10-11-pack-unit-price'
--      and md5(p.name) = r.md5_after;

with targets as (
  select id, name
    from public.products
   where is_active
     and sku in ('UK52224','UK08768','UK55775','UK51174','UK43174','UK55777','UK82077',
                 'UK57256','UK40000','UK47495','UK90634','UK82037','UK81294','UK90875',
                 'UK90585','UK82038','UK81598','UK83240','UK83061','UK83255','UK83062',
                 'UK83230','UK83231','UK90130','UK90884','UK45541','UK67520','UK66714',
                 'UK81623','UK41805','UK97472','UK40938','UK40937')
     and name not like '%(המחיר ליחידה אחת)%'
), ledger as (
  insert into public.product_name_runs (product_id, run_id, name_before, name_after, md5_after)
  select id, '2026-10-11-pack-unit-price', name,
         btrim(name) || ' (המחיר ליחידה אחת)',
         md5(btrim(name) || ' (המחיר ליחידה אחת)')
    from targets
  returning product_id, name_after
)
update public.products p
   set name = l.name_after
  from ledger l
 where p.id = l.product_id;
