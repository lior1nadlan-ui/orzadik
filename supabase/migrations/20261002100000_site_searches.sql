-- What shoppers type into the site search, and how many products it found.
--
-- Until now these went only to GA4/Meta (trackSearch in src/lib/analytics.ts),
-- which the owner never opens. A zero-result term is the clearest signal the
-- shop gets: a product people want that is missing, or one that exists under a
-- name they do not use. /admin shows the top terms, the zero-result ones first.
--
-- Nothing personal is stored: no user, no IP, no session — the term, the
-- count, the time. Written only by the logSearch server function (service
-- role, rate-limited per IP); read only by the admin dashboard.
create table if not exists public.site_searches (
  id bigint generated always as identity primary key,
  term text not null check (char_length(term) between 1 and 100),
  results_count integer not null check (results_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists site_searches_created_at_idx
  on public.site_searches (created_at desc);

alter table public.site_searches enable row level security;
-- No policies: service role only. Supabase grants anon/authenticated directly,
-- so revoke those as well as public.
revoke all on public.site_searches from public, anon, authenticated;
