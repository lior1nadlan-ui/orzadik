-- "האם התכוונתם ל..." for the site search.
--
-- Most of the searches that found nothing by 15.11.2026 were not missing
-- products but spelling: "תיק לתלית" (81 results as "תיק לטלית"), "בירכונים"
-- (43 as "ברכונים"), "גבע מכסף" (24 as "גביע כסף"), "מזוזותו" (322 as
-- "מזוזות"); or one word too many for any single product: "בתי תפילין האש"
-- found 0 while "תפילין האש" has 20. The correction itself is TypeScript
-- (src/lib/did-you-mean.ts, unit-tested, runs in the browser and on the
-- server); the database gives it the two things only the database has:
--
--   search_vocabulary()          every word in an active product's NAME, with
--                                how many products carry it. ~1,100 words, as
--                                one jsonb value so PostgREST's row cap never
--                                truncates it. Read once per tab / isolate.
--
--   search_phrase_hits(text[])   for up to 10 candidate phrases at once, how
--                                many active products match every word of the
--                                phrase by the search's own rules: the word in
--                                search_blob, or one of its plural forms
--                                (he_variants()) in the name. ~140ms for 10
--                                phrases on the two trigram indexes, where the
--                                full list_products_collapsed costs 250-650ms
--                                PER phrase (its per-row subquery cannot use
--                                them). The only rule left out is the search's
--                                fuzzy word_similarity() match, so a phrase
--                                with hits here always opens a non-empty
--                                results page.
--
-- Both read only active products and run as the caller; anon already reads
-- active products by RLS, so neither exposes anything the shop does not show.
-- norm_he() strips % _ \ from the input, so a phrase cannot inject a LIKE
-- wildcard.
--
-- Rollback:
--   drop function if exists public.search_phrase_hits(text[]);
--   drop function if exists public.search_vocabulary();

create or replace function public.search_vocabulary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.w, s.n), '{}'::jsonb)
    from (
      select w, count(distinct p.id)::int as n
        from public.products p,
             -- split on punctuation too: names hold "כסף," "(דגם" and
             -- "פסח+אפיקומן", and a shopper's dash is already a space by the
             -- time the search sees it (normalizeSearchTerm in shop.tsx).
             -- + * = < > | ~ ^ $ are listed by hand: Unicode files them as
             -- symbols, so [:punct:] alone leaves them glued to the words.
             regexp_split_to_table(p.name_norm, '[[:space:][:punct:]+*=<>|~^$]+') as w
       where p.is_active
         and length(w) >= 2
         -- sizes and model numbers ("31x38", "26x33ס", "זהב25") are not
         -- words to correct a search to
         and w !~ '[0-9]'
       group by w
    ) s
$$;

comment on function public.search_vocabulary() is
  'Words of active product names with product counts, as one jsonb object. Feeds the search "did you mean" (src/lib/did-you-mean.ts).';

create or replace function public.search_phrase_hits(p_terms text[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  with q as (
    select distinct left(x, 100) as phrase
      from unnest(p_terms[1:10]) as x
     where x is not null
  ),
  ph as (
    select q.phrase, w,
           '%' || w || '%' as pat,
           array(select '%' || v || '%'
                   from unnest(public.he_variants(w)) as v
                  where v <> w) as var_pats
      from q,
           unnest((string_to_array(public.norm_he(q.phrase), ' '))[1:8]) as w
     where w <> ''
  ),
  need as (
    select ph.phrase, count(distinct ph.w) as k
      from ph
     group by ph.phrase
  ),
  hits as (
    select ph.phrase, p.id, count(distinct ph.w) as k
      from ph
      join public.products p
        on p.is_active
       and (p.search_blob like ph.pat or p.name_norm like any (ph.var_pats))
     group by ph.phrase, p.id
  ),
  full_hits as (
    select hits.phrase, count(*)::int as n
      from hits
      join need on need.phrase = hits.phrase and hits.k = need.k
     group by hits.phrase
  )
  select coalesce(jsonb_object_agg(need.phrase, coalesce(full_hits.n, 0)), '{}'::jsonb)
    from need
    left join full_hits on full_hits.phrase = need.phrase
$$;

comment on function public.search_phrase_hits(text[]) is
  'For up to 10 phrases: active products matching every word by the search rules (search_blob, or a plural variant in the name). Ranks "did you mean" candidates cheaply; a hit implies list_products_collapsed finds the phrase.';

revoke all on function public.search_vocabulary() from public;
revoke all on function public.search_phrase_hits(text[]) from public;
grant execute on function public.search_vocabulary() to anon, authenticated, service_role;
grant execute on function public.search_phrase_hits(text[]) to anon, authenticated, service_role;
