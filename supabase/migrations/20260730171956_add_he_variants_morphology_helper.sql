-- Recovered from the production migration ledger on 2026-08-19. This migration
-- was applied via MCP and never had a file in the repo.
--
-- Hebrew plural → singular expansion for search.
--
-- Israelis search in the plural — "כיפות", "טליתות", "גביעים" — but the catalogue
-- names products in the singular. Measured on this data before the fix:
--   כיפות  →  37 results   (כיפה → 688)
--   טליתות →  14           (~491 tallitot exist)
--   גביעים →   1           (גביע → 119)
-- i.e. the natural way to search returned roughly 5% of what was there. Trigram
-- similarity rescued a little, but "כיפות"/"כיפה" share only one trigram and land
-- under the 0.6 threshold, so it could not close the gap.
--
-- This returns the term plus conservative singular stems. It is deliberately
-- morphological rather than a hand-written synonym list: it generalises to the
-- whole 4,641-product catalogue instead of the handful of nouns anyone thought to
-- enumerate. Stems shorter than 3 characters are dropped — below that a substring
-- match sprays across the catalogue.
--
-- IMMUTABLE + STRICT so it can be inlined in a WHERE clause without per-row cost.
create or replace function public.he_variants(w text)
returns text[]
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select array(
    select distinct v from unnest(
      array[
        w,
        -- feminine plural: כיפות → כיפ / כיפה, טליתות → טלית, מזוזות → מזוז / מזוזה
        case when w like '%ות' and length(w) >= 4 then left(w, length(w) - 2) end,
        case when w like '%ות' and length(w) >= 4 then left(w, length(w) - 2) || 'ה' end,
        -- ־יות nouns: חנוכיות → חנוכיה / חנוכייה
        case when w like '%יות' and length(w) >= 5 then left(w, length(w) - 3) || 'יה' end,
        case when w like '%יות' and length(w) >= 5 then left(w, length(w) - 3) || 'ייה' end,
        -- masculine plural: פמוטים → פמוט, גביעים → גביע, סידורים → סידור
        case when w like '%ים' and length(w) >= 4 then left(w, length(w) - 2) end,
        -- construct plural: גביעי (קידוש) → גביע
        case when w like '%י'  and length(w) >= 4 then left(w, length(w) - 1) end
      ]
    ) as v
    where v is not null and length(v) >= 3
  );
$$;

comment on function public.he_variants(text) is
  'Hebrew plural→singular expansion used by list_products_collapsed. Returns the term plus conservative singular stems (>=3 chars). See migration comment for the measured recall problem it solves.';
