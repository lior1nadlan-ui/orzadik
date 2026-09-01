-- Real price bands for the "כמה עולה טלית לבר מצווה" article.
--
-- The article shipped WITHOUT any number, deliberately: with ~4,600 products a
-- figure written into prose is wrong for most of them, goes stale, and is a
-- consumer claim the store then has to honour. That reasoning still holds for a
-- per-product price — but it left the article unable to answer the one question
-- its own title asks, which is a weak page for a query whose whole intent is
-- "how much".
--
-- The middle path is a BAND, not a price. The numbers below were read from this
-- database on 2026-09-01 over the 55 active, priced products in `talitot`:
--
--   min ₪336 · p25 ₪572 · median ₪1,286 · p90/max ₪1,572   (catalogue price)
--
-- and then multiplied by (1 - SITE_DISCOUNT) = 0.7, because src/lib/pricing.ts
-- discounts every catalogue price site-wide and the shopper never sees the raw
-- figure. Quoting the raw column would have overstated every price by 43%:
--
--   ≈₪235 · ≈₪400 · ≈₪900 · ≈₪1,100                        (what is charged)
--
-- Rounded to the nearest ₪10/₪100 so ordinary price drift does not falsify the
-- sentence, and the text says in as many words that these are orders of
-- magnitude and that the product page is what binds. Re-read the percentiles
-- and update this if the tallit range is ever repriced.

UPDATE articles
SET body_html = replace(
  body_html,
  '<p>לכן, לפני שמשווים מחירים בין חנויות, כדאי לוודא ששני המחירים כוללים את אותם דברים. זה המקום שבו רוב ההפתעות קורות.</p>',
  '<p>לכן, לפני שמשווים מחירים בין חנויות, כדאי לוודא ששני המחירים כוללים את אותם דברים. זה המקום שבו רוב ההפתעות קורות.</p>

<h3>סדרי גודל, כדי שיהיה עוגן</h3>
<p>הטליתות באתר נעות כיום בין כ-240 ש"ח לכ-1,100 ש"ח. כרבע מהן מתחת לכ-400 ש"ח — בעיקר משי סינתטי ומידות קטנות יותר — וכמחצית מעל כ-900 ש"ח, שם יושבות טליתות הצמר והעטרות המושקעות. אלה סדרי גודל בלבד ולא הצעת מחיר: המחיר המחייב הוא זה שמופיע בעמוד המוצר עצמו, והוא משתנה לפי דגם ומלאי.</p>'
),
updated_at = now()
WHERE slug = 'mechir-talit-bar-mitzva';
