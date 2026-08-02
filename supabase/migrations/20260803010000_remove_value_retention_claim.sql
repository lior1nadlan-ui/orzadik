-- Remove a resale-value claim from the kiddush-cup guide's stored body.
--
-- The guide asserts, about sterling silver:
--   "מן המהודרים שבגביעים — יפה, עמיד, ולרוב שומר על ערכו לאורך השנים."
--
-- Three reasons that sentence has to go, and they compound:
--
-- 1. It is a claim about FUTURE RESALE VALUE of a product the shop sells, made
--    inside the passage that steers the reader toward the more expensive
--    material. The business cannot substantiate what silver will be worth later,
--    and "ולרוב" ("usually") is doing load-bearing work it has no evidence for.
--    This store has already had three fabricated trust claims removed
--    ("אלפי לקוחות מרוצים", "במלאי מוגבל", a fake sale); this is the same class.
--
-- 2. It is not merely on-page prose. articles/$slug.tsx builds the Article
--    node's `articleBody` from this same body_html, so the sentence is published
--    as STRUCTURED DATA — which is exactly the string an answer engine quotes
--    back as fact when asked whether a silver kiddush cup holds its value.
--    The parallel claim in guide-faq.ts was rewritten in code; this one lives in
--    the database and code cannot honestly reach it.
--
-- 3. These five guides are the site's best-performing content — Search Console
--    positions 12-26, ahead of every product page — so this is the highest-read,
--    most-quoted prose the shop publishes.
--
-- The replacement keeps every VERIFIABLE property (beauty, durability, the
-- 92.5% alloy, the 925 hallmark, weekly use, passing it down) and drops only the
-- unsupportable one. Nothing a shopper needs in order to choose is lost.
--
-- Idempotent: matches the exact sentence and no-ops once applied. Logged to
-- product_copy_runs' sibling ledger shape so it is reversible.
--
-- NOT APPLIED — this session has no DB write access (the Supabase MCP returned
-- "permission denied" mid-session). Owner runs it in the SQL editor.

create table if not exists public.article_copy_runs (
  id                bigint generated always as identity primary key,
  article_id        uuid not null references public.articles(id) on delete cascade,
  run_id            text not null,
  body_html_before  text,
  body_html_after   text,
  md5_after         text,
  generated_at      timestamptz not null default now()
);

create index if not exists article_copy_runs_article_id_idx on public.article_copy_runs (article_id);
create index if not exists article_copy_runs_run_id_idx     on public.article_copy_runs (run_id);

-- Audit data, not customer data: RLS on with no policy = deny-all to
-- anon/authenticated; the service role bypasses RLS and is the only writer.
alter table public.article_copy_runs enable row level security;

comment on table public.article_copy_runs is
  'Restore ledger for bulk article body edits. Roll back with: update articles a set body_html = r.body_html_before from article_copy_runs r where r.article_id = a.id and r.run_id = ''<run>'' and md5(a.body_html) = r.md5_after;';

with target as (
  select id, body_html,
         replace(
           body_html,
           'יפה, עמיד, ולרוב שומר על ערכו לאורך השנים',
           'יפה, עמיד, ומתאים לשימוש לאורך שנים בטיפול נאות'
         ) as cleaned
    from public.articles
   where slug = 'kiddush-cup-guide'
),
safe as (
  select * from target where cleaned <> body_html
),
logged as (
  insert into public.article_copy_runs (article_id, run_id, body_html_before, body_html_after, md5_after)
  select id, 'honesty-2026-08-03-value-claim', body_html, cleaned, md5(cleaned) from safe
  returning 1
)
update public.articles a
   set body_html = s.cleaned
  from safe s
 where s.id = a.id;

-- Guard query. Run after any content import: it surfaces resale/valuation
-- language in published guides, which the business cannot substantiate and
-- which ships into `articleBody` structured data.
--
--   select slug, title_he
--     from public.articles
--    where is_published
--      and body_html ~ '(שומר על ערכ|שווי עתידי|השבחה|כהשקעה|ערך משתמר)';
--
-- (Column is `title_he`, not `title` — verified against the live schema.)
