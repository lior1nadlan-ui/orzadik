-- Two gold claims the product pages cannot stand behind, found while
-- measuring the shtender / synagogue shelf for its guide (2026-09-27):
--
--   * "יד לספר תורה זהב 24 ס"מ חלקה ירושלים" (₪83 on the site): the copy
--     says "עשויה זהב 24 קראט". The 24 in the name is the length in cm, the
--     spec line says "חומר: מתכת", and a solid 24-karat pointer at this price
--     does not exist. Rewritten to say what the name and the spec say: a metal
--     pointer in a gold tone, smooth, "ירושלים" design.
--   * "שרשרת זהב 'האש שלי' - תליון קלאסי": the short description says
--     "מזהב טהור" while the product's own description says "מזהב 14K". 14K
--     is not pure gold (58.5%). The short description now says 14K.
--
-- Left for the owner (docs/improvement-workflow.md): three items describe 24K
-- GILDING (a crystal vase, a ceramic kiddush cup's lettering, a 925 silver
-- necklace's plating). That is a plausible supplier term, not a solid-gold
-- claim, and only the supplier can confirm it.
--
-- LEDGER: product_copy_runs, run 'honesty-2026-09-27-karat'. Rollback:
--   update products p set description = r.description_before,
--          short_description = coalesce(r.short_description_before, p.short_description)
--     from product_copy_runs r
--    where r.product_id = p.id and r.run_id = 'honesty-2026-09-27-karat'
--      and md5(p.description) = r.md5_after;
--
-- Idempotent: rows whose text already matches are neither logged nor changed.

with rewrite(id, new_sd, new_desc) as (values
  ('629cfedc-789f-45e2-8aad-a379248ef41d'::uuid,
   'יד לספר תורה ממתכת בגוון זהב, חלקה, בעיצוב "ירושלים". משמשת את הקורא לעקוב אחרי המילים בספר התורה בלי לגעת בקלף.',
   'יד לספר תורה ממתכת בגוון זהב, חלקה, בעיצוב "ירושלים". היד משמשת את הקורא בתורה לעקוב אחרי המילים בלי לגעת בקלף, ומתאימה גם כמתנה להכנסת ספר תורה. את המראה רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.

חומר: מתכת | מידות: אורך 25.5 ס"מ'),
  ('bab5f72c-2198-4a51-9bd7-0c95508b5e0d'::uuid,
   'תליון "האש שלי" בעיצוב להבה מזהב 14K, על שרשרת עדינה. ✦ המחיר משתנה לפי שער הזהב היומי - להזמנה צרו קשר.',
   null)
),
target as (
  select p.id, p.short_description, p.description, r.new_sd,
         coalesce(r.new_desc, p.description) as new_desc
    from public.products p
    join rewrite r on r.id = p.id
   where p.short_description is distinct from r.new_sd
      or (r.new_desc is not null and p.description is distinct from r.new_desc)
),
logged as (
  insert into public.product_copy_runs
    (product_id, run_id, description_before, description_after, md5_after,
     short_description_before, short_description_after, generated_at)
  select id, 'honesty-2026-09-27-karat', description, new_desc, md5(new_desc),
         short_description, new_sd, now()
    from target
  returning product_id
)
update public.products p
   set short_description = t.new_sd,
       description = t.new_desc,
       updated_at = now()
  from target t
 where p.id = t.id
   and exists (select 1 from logged l where l.product_id = t.id);
