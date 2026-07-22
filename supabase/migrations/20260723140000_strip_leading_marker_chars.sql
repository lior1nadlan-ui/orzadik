-- Third and final pass on supplier title markers: six titles lead with '.' or
-- '***'. Spotted on the live /shop grid after the first two passes.
--
-- Only [, ], * and . are stripped. A leading double-quote is left alone —
-- several products legitimately open with a quoted phrase, e.g.
-- '"פיטום הקטורת" בלוק אקריליק מסגרת זהב', and stripping it would mangle them.
BEGIN;

UPDATE public.products
   SET name = btrim(regexp_replace(name, '^[\[\]\*\.\s]+', '')),
       updated_at = now()
 WHERE name ~ '^[\[\]\*\.]';

COMMIT;
