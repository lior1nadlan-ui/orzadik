-- The suggestion a search was answered with ("האם התכוונתם ל...", see
-- src/lib/did-you-mean.ts), when the typed words found nothing. The search is
-- still logged with results_count 0 — what the typed words found — so it stays
-- on the owner's "searched and did not find" list; this says the shopper was
-- shown results anyway, which the growth goals count separately from a search
-- that truly ended empty (src/lib/growth-goals.ts).
--
-- Rollback:
--   alter table public.site_searches drop column if exists corrected_to;

alter table public.site_searches
  add column if not exists corrected_to text
    check (corrected_to is null or char_length(corrected_to) between 1 and 100);

comment on column public.site_searches.corrected_to is
  'The phrase shown instead when the typed search found nothing ("did you mean"); null when none was.';
