-- Follow-up to 20260723120000: six titles lead with '(כמו 16409)' — the
-- supplier's "same as item N" cross-reference. The earlier pass only stripped a
-- bare '(12345)', so these survived. Kept as a separate migration rather than
-- editing the applied one, to avoid a checksum mismatch on the recorded history.
BEGIN;

UPDATE public.products
   SET name = btrim(regexp_replace(name, '^\(\s*כמו\s*\d+\s*\)\s*', '')),
       updated_at = now()
 WHERE name ~ '^\(\s*כמו\s*\d+\s*\)';

COMMIT;
