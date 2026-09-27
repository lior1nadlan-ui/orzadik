-- Remove false material and product claims from 26 product pages.
--
-- FOUND while measuring the chalaka articles for docs/improvement-workflow.md
-- (2026-09-27). The generated copy on these products states things the
-- shop cannot stand behind, and several of them are claims a customer relies
-- on when paying — which is what חוק הגנת הצרכן §2 (הטעיה) is about:
--
--   * 19 products on the chalaka shelf: sets "עשוי מכסף טהור", a toy
--     Torah scroll with a "בסיס העשוי זהב טהור", "עשוי קלף משובח" and
--     "מבטיח לשמור על ערכו"; the five "כיסוי לתלתל" pouches described as
--     TEFILLIN covers; sets pitched "לחתן בר המצווה" and "לחינה"; one set
--     said to contain "חלוק רחצה, מגבת ומכנסונים";
--   * "טלית דגם פאר זהב": "עשויה כולה מכסף טהור 925 … בחיתוך לייזר";
--   * "בכסף טהור" for silver-coloured embroidery or lettering on a tallit
--     atara, a tallit bag and a siddur cover; "כריכת עור" / "עור משובח" /
--     "עור איכותי" on three siddurim whose names say nothing of leather;
--   * a "סגולת ברכה והצלחה" promised by a tallit atara.
--
-- THE REPLACEMENT COPY says only what the product's own name says (model,
-- colour, what the name lists as included), points to the photos for the
-- rest, and sends questions to the shop. For the chalaka shelf it adds what a
-- chalaka is and that the child's name can be added in the page's
-- personalization box (chalaka-set is in PERSONALIZABLE_CATEGORY_SLUGS). The
-- toy Torah (₪329) now says it is a keepsake, not a scroll written on klaf.
--
-- NOT TOUCHED, and handed to the owner in docs/improvement-workflow.md: the
-- "פאר" tallit line describes one model as silk, another as "100% צמר
-- רחלים" and a third as "100% צמר מרינו", all at ₪500. Those may be true
-- per variant; only the owner can say, and wool vs. synthetic matters for
-- tzitzit. Only the impossible 925-silver claim is removed there.
--
-- LEDGER. product_copy_runs gains short_description_before/after (the
-- short description renders above the fold and carried the same claims).
-- Every changed row is logged under run 'honesty-2026-09-27-materials'.
-- Rollback:
--   update products p set description = r.description_before,
--          short_description = coalesce(r.short_description_before, p.short_description)
--     from product_copy_runs r
--    where r.product_id = p.id and r.run_id = 'honesty-2026-09-27-materials'
--      and md5(p.description) = r.md5_after;
--
-- Idempotent: the target CTE keeps only rows whose text still differs, so a
-- second run logs and changes nothing.
--
-- FOLLOW-UP: 20260927051000_honesty_chalaka_shelf.sql rewrites the other 21
-- chalaka products, whose copy invented set contents (a robe, a towel, a
-- knife and bowl) without a material claim this file's filter caught.

alter table public.product_copy_runs
  add column if not exists short_description_before text,
  add column if not exists short_description_after text;

with rewrite(id, new_sd, new_desc) as (values
  ('c16b202c-ce8f-4e59-bce3-d6d26a5362b4'::uuid, 'כיסוי "התלתל שלי" לבן בגוון זהב, לשמירת התלתל מהחלאקה — התספורת הראשונה בגיל שלוש.', '<p>כיסוי "התלתל שלי" לבן בגוון זהב, לשמירת התלתל שנגזר בחלאקה — התספורת הראשונה של הילד, בגיל שלוש. כך התלתל נשמר כמזכרת מהטקס. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('b8f1897c-5214-4a2e-97f3-e2fad14ae086'::uuid, 'כיסוי "התלתל שלי" לבן בגוון כסף, לשמירת התלתל מהחלאקה — התספורת הראשונה בגיל שלוש.', '<p>כיסוי "התלתל שלי" לבן בגוון כסף, לשמירת התלתל שנגזר בחלאקה — התספורת הראשונה של הילד, בגיל שלוש. כך התלתל נשמר כמזכרת מהטקס. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('5f2af112-16db-40a9-8efb-b01a9390e902'::uuid, 'כיסוי "התלתל שלי" לבן בגוון קרם, לשמירת התלתל מהחלאקה — התספורת הראשונה בגיל שלוש.', '<p>כיסוי "התלתל שלי" לבן בגוון קרם, לשמירת התלתל שנגזר בחלאקה — התספורת הראשונה של הילד, בגיל שלוש. כך התלתל נשמר כמזכרת מהטקס. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('131b7769-e6d5-4340-8b1a-7572c03d42d6'::uuid, 'כיסוי "התלתל שלי" לבן בשחור, לשמירת התלתל מהחלאקה — התספורת הראשונה בגיל שלוש.', '<p>כיסוי "התלתל שלי" לבן בשחור, לשמירת התלתל שנגזר בחלאקה — התספורת הראשונה של הילד, בגיל שלוש. כך התלתל נשמר כמזכרת מהטקס. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('554c967c-ae81-41db-bd10-84cb137ff45d'::uuid, 'כיסוי "התלתל שלי" לבן בתכלת, לשמירת התלתל מהחלאקה — התספורת הראשונה בגיל שלוש.', '<p>כיסוי "התלתל שלי" לבן בתכלת, לשמירת התלתל שנגזר בחלאקה — התספורת הראשונה של הילד, בגיל שלוש. כך התלתל נשמר כמזכרת מהטקס. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('3708d397-7cb8-43d2-8e47-f789f98b236d'::uuid, 'סט חלאקה משודרג בדגם "יברכך", בגוון כסף. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה משודרג בדגם "יברכך", בגוון כסף. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('f8030579-6722-4a47-bc8b-72ddab70eda5'::uuid, 'סט חלאקה פרימיום בדגם "האש שלי", עם רקמה בגוון כסף. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "האש שלי", עם רקמה בגוון כסף. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('2b18e172-f2bb-46b7-9588-a6f5d1035490'::uuid, 'סט חלאקה פרימיום בדגם "האש שלי", עם רקמה בגוון כסף. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "האש שלי", עם רקמה בגוון כסף. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('af7ac312-0f49-40b2-a1c6-73058fca2aba'::uuid, 'סט חלאקה פרימיום בדגם "כתר", עם רקמה בגוון כסף. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "כתר", עם רקמה בגוון כסף. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('ea5485c9-a92b-46e4-b517-28b9a22641dc'::uuid, 'סט חלאקה פרימיום בדגם "כתר", עם רקמה בגוון כסף, וגופיית ציצית בסט. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "כתר", עם רקמה בגוון כסף, וגופיית ציצית בסט. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('20db5f7e-e75c-4c10-8817-1fe5193e7da9'::uuid, 'סט חלאקה פרימיום בדגם "כתר", עם רקמה בגוון כסף, ובסט כיסוי לטלית וכיסוי לתלתל. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "כתר", עם רקמה בגוון כסף, ובסט כיסוי לטלית וכיסוי לתלתל. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('4571edd1-a942-4efa-8c90-1fdfb137517f'::uuid, 'סט חלאקה פרימיום בדגם "מגן דוד", עם רקמה בתכלת. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "מגן דוד", עם רקמה בתכלת. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('fbca8565-97cb-43f6-9262-6c7ef616a1e5'::uuid, 'סט חלאקה פרימיום בדגם "פרי", עם רקמה בתכלת. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה פרימיום בדגם "פרי", עם רקמה בתכלת. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('89aea257-9bc4-48a6-94bb-73d795cf57d7'::uuid, 'סט חלאקה קלאסי בדגם "כתר", עם רקמה כסופה. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה קלאסי בדגם "כתר", עם רקמה כסופה. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('899e5078-4f95-4a29-a8ec-4bc90e20363b'::uuid, 'סט חלאקה קלאסי בדגם "כתר", עם רקמה כסופה, חריטה על המספריים ונרתיק לתלתל. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה קלאסי בדגם "כתר", עם רקמה כסופה, חריטה על המספריים ונרתיק לתלתל. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('b7be1e85-9c46-4cbc-bae8-f72f44ceb2a5'::uuid, 'סט חלאקה קלאסי בדגם "מגן דוד", עם רקמה שחורה וחריטה על המספריים. מזכרת מטקס החלאקה בגיל שלוש.', '<p>סט חלאקה קלאסי בדגם "מגן דוד", עם רקמה שחורה וחריטה על המספריים. החלאקה היא התספורת הראשונה של הילד, בגיל שלוש, והסט מלווה את הטקס ונשאר אחריו מזכרת. הפריטים שבסט מופיעים בתמונות המוצר; לשאלה על ההרכב או על המידות — פנו אלינו לפני ההזמנה. את שם הילד אפשר להוסיף בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה.</p>'),
  ('40db59d9-4e7b-4421-b274-f034e1c93582'::uuid, 'ספר תורה לבן לילד, עם חריטת שם הילד על בסיס בגוון זהב — פריט מזכרת, לא ספר תורה על קלף.', '<p>ספר תורה לבן לילד, עם חריטת שם הילד על בסיס בגוון זהב. זהו פריט מזכרת מעוצב, ולא ספר תורה שנכתב בידי סופר על קלף. את שם הילד מוסיפים בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('7c503a1c-6234-475f-8a5b-f0542bff16c0'::uuid, 'ספר תורה לבן לילד, עם חריטת שם הילד על בסיס בגוון כסף — פריט מזכרת, לא ספר תורה על קלף.', '<p>ספר תורה לבן לילד, עם חריטת שם הילד על בסיס בגוון כסף. זהו פריט מזכרת מעוצב, ולא ספר תורה שנכתב בידי סופר על קלף. את שם הילד מוסיפים בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('7468b046-a5c6-44b1-8f90-5ddfb9627f8b'::uuid, 'ספר תורה לבן לילד, עם חריטת שם הילד על בסיס שחור — פריט מזכרת, לא ספר תורה על קלף.', '<p>ספר תורה לבן לילד, עם חריטת שם הילד על בסיס שחור. זהו פריט מזכרת מעוצב, ולא ספר תורה שנכתב בידי סופר על קלף. את שם הילד מוסיפים בשדה "הוספת שם אישי" שבעמוד זה, והפרטים מתואמים איתכם לאחר ההזמנה. את המראה והמידות רואים בתמונות המוצר; לשאלות — פנו אלינו לפני ההזמנה.</p>'),
  ('7db6607f-fc4f-442a-9c9a-6872879a4432'::uuid, 'טלית דגם פאר בגוון זהב, עם עיטורי רקמה.', '<p>טלית דגם פאר בגוון זהב, עם עיטורי רקמה. את הדגם והעיטורים רואים בתמונות המוצר. לשאלה על חומר הבד, על המידות או על הציציות — פנו אלינו לפני ההזמנה.</p>')
),
fixed(id, new_sd, new_desc) as (
  select p.id, p.short_description, replace(p.description, 'בכסף טהור', 'בגוון כסף') from public.products p where p.id = '66c64b1e-66e9-4422-9a3e-9c4bfb71570c'::uuid
  union all
  select p.id, p.short_description, replace(p.description, ', ומביאה עמה סגולת ברכה והצלחה', '') from public.products p where p.id = 'd6195393-9b2b-42e2-aaa9-40f85af833c8'::uuid
  union all
  select p.id, replace(p.short_description, 'לדלית', 'לטלית'), replace(p.description, 'בכסף טהור', 'בגוון כסף') from public.products p where p.id = '6644b65f-72d0-4c1c-9bfb-f2490697e7b9'::uuid
  union all
  select p.id, replace(p.short_description, 'עם הטבעה בכסף טהור', 'עם הטבעה בגוון כסף'), replace(p.description, 'מעוצב בקפידה מנייר איכותי ובכריכת עור אלגנטית. במרכז הכריכה, הטבעת כסף טהור', 'מעוצב בקפידה, בכריכה לבנה. במרכז הכריכה, הטבעה בגוון כסף') from public.products p where p.id = 'ec8f7edc-8017-4797-bf9c-5699d6bd8a0e'::uuid
  union all
  select p.id, p.short_description, replace(p.description, 'בגוון חום עתיק ומרקם עור משובח,', 'בגוון חום עתיק,') from public.products p where p.id = '101fe139-4c09-45a9-a096-528ef2eed44c'::uuid
  union all
  select p.id, replace(p.short_description, 'בעיצוב עור יוקרתי בצבע ג''ינס תכלת', 'בכריכה בצבע ג''ינס תכלת'), replace(p.description, 'עור איכותי בגוון ג''ינס תכלת רגוע, מעוטר בהטבעת כתר מוזהב בולטת, מעניק', 'כריכה בגוון ג''ינס תכלת רגוע, מעוטרת בהטבעת כתר בולטת בגוון זהב, מעניקה') from public.products p where p.id = 'da580eb4-7e0a-4d1f-8e3a-943373211ac4'::uuid
),
copy as (
  select * from rewrite
  union all
  select * from fixed
),
target as (
  select p.id, p.description, p.short_description, c.new_sd, c.new_desc
    from public.products p
    join copy c on c.id = p.id
   where p.description is distinct from c.new_desc
      or p.short_description is distinct from c.new_sd
),
logged as (
  insert into public.product_copy_runs
    (product_id, run_id, description_before, description_after, md5_after,
     short_description_before, short_description_after)
  select id, 'honesty-2026-09-27-materials', description, new_desc, md5(new_desc),
         short_description, new_sd
    from target
  returning 1
)
update public.products p
   set description = t.new_desc,
       short_description = t.new_sd
  from target t
 where t.id = p.id;

-- Guard query. Run after any copy import: outside real jewelry, nothing in the
-- catalogue should claim pure silver or gold, a klaf it does not have, or a
-- resale value. Expected after this migration: only real-gold jewelry rows.
--
-- select p.name, c.slug
--   from products p
--   join product_categories pc on pc.product_id = p.id
--   join categories c on c.id = pc.category_id
--  where p.is_active
--    and (coalesce(p.description,'') || coalesce(p.short_description,''))
--        ~ 'כסף טהור|זהב טהור|קלף משובח|שומר על ערכו|לשמור על ערכו'
--    and c.slug not in ('tachshitei-kesef-tahor', 'esh-sheli-gold');
