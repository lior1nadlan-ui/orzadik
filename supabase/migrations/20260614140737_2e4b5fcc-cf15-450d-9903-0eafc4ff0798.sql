-- Deactivate the two "numbers" products
UPDATE public.products SET is_active = false
WHERE slug IN ('chal-2871720', 'chal-2872355');

-- Reorder categories: important first
UPDATE public.categories SET sort_order = 1  WHERE slug = 'wedding';
UPDATE public.categories SET sort_order = 2  WHERE slug = '%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94';
UPDATE public.categories SET sort_order = 3  WHERE slug = 'chalaka-set';
UPDATE public.categories SET sort_order = 4  WHERE slug = 'hanukkah';
UPDATE public.categories SET sort_order = 5  WHERE slug = 'passover';
UPDATE public.categories SET sort_order = 6  WHERE slug = 'rosh-hashana';
UPDATE public.categories SET sort_order = 7  WHERE slug = 'purim';
UPDATE public.categories SET sort_order = 8  WHERE slug = '%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%92%d7%99%d7%9d';
UPDATE public.categories SET sort_order = 9  WHERE slug = '%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f';
UPDATE public.categories SET sort_order = 10 WHERE slug = 'tefillin-cases';
UPDATE public.categories SET sort_order = 11 WHERE slug = 'talit-tefillin-covers';
UPDATE public.categories SET sort_order = 12 WHERE slug = 'talit-tefillin-sets';
UPDATE public.categories SET sort_order = 13 WHERE slug = '%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa';
UPDATE public.categories SET sort_order = 14 WHERE slug = '%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d';
UPDATE public.categories SET sort_order = 15 WHERE slug = '%d7%9b%d7%99%d7%a4%d7%95%d7%aa';
UPDATE public.categories SET sort_order = 16 WHERE slug = 'metal-kiddush-cups';
UPDATE public.categories SET sort_order = 17 WHERE slug = 'crystal-ceramic-kiddush-cups';
UPDATE public.categories SET sort_order = 18 WHERE slug = 'havdalah';
UPDATE public.categories SET sort_order = 19 WHERE slug = 'candlesticks';
UPDATE public.categories SET sort_order = 20 WHERE slug = 'challah-covers';
UPDATE public.categories SET sort_order = 21 WHERE slug = 'plastic';
UPDATE public.categories SET sort_order = 22 WHERE slug = 'washing-cups';
UPDATE public.categories SET sort_order = 23 WHERE slug = 'maim-achronim';
UPDATE public.categories SET sort_order = 24 WHERE slug = 'liqueur-sets';
UPDATE public.categories SET sort_order = 25 WHERE slug = 'wine-dividers';
UPDATE public.categories SET sort_order = 26 WHERE slug = 'bencher-stands';
UPDATE public.categories SET sort_order = 27 WHERE slug = 'talit-clips';
UPDATE public.categories SET sort_order = 28 WHERE slug = 'atara';
UPDATE public.categories SET sort_order = 29 WHERE slug = 'pvc-bags';
UPDATE public.categories SET sort_order = 30 WHERE slug = 'mirrors';
UPDATE public.categories SET sort_order = 31 WHERE slug = 'blessings';
UPDATE public.categories SET sort_order = 32 WHERE slug = 'study-books';
UPDATE public.categories SET sort_order = 33 WHERE slug = 'esh-sheli-gold';
UPDATE public.categories SET sort_order = 34 WHERE slug = '%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%99%d7%95%d7%93%d7%90%d7%99%d7%a7%d7%94';
UPDATE public.categories SET sort_order = 35 WHERE slug = '%d7%90%d7%a7%d7%a1%d7%a1%d7%95%d7%a8%d7%99%d7%96';
UPDATE public.categories SET sort_order = 36 WHERE slug = 'aluminum';
UPDATE public.categories SET sort_order = 37 WHERE slug = 'polyrasin-stone';
UPDATE public.categories SET sort_order = 38 WHERE slug = '%d7%9e%d7%99%d7%aa%d7%95%d7%92';
UPDATE public.categories SET sort_order = 90 WHERE slug = 'sale';
UPDATE public.categories SET sort_order = 99 WHERE slug = 'uncategorized';