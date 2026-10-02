-- Owner-managed search redirects: "when a shopper searches X, search Y".
--
-- The /admin search card lists terms that found nothing. Often the product
-- exists under another word (כיסוי חלה → מפת חלה). Until now the only fix was
-- a code change (HE_SPELLING_SYNONYMS in src/routes/shop.tsx) or renaming
-- products; this lets the owner fix it from the card in one step.
--
-- `term` is stored normalised (normalizeSearchTerm in src/lib/search-terms.ts)
-- and matches the WHOLE search phrase, never a word inside a longer one.
--
-- Readable by everyone (the shop applies it for anonymous visitors, and a
-- redirect is no secret); written only by the admin server functions with the
-- service role.
create table if not exists public.search_redirects (
  term text primary key check (char_length(term) between 1 and 100),
  target text not null check (char_length(target) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table public.search_redirects enable row level security;

drop policy if exists search_redirects_read on public.search_redirects;
create policy search_redirects_read on public.search_redirects
  for select to anon, authenticated using (true);

revoke all on public.search_redirects from public, anon, authenticated;
grant select on public.search_redirects to anon, authenticated;
