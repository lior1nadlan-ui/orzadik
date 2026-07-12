-- Create articles table for blog/educational content
create table articles (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  title_he text not null,
  description text not null, -- meta description (160 chars)
  body_html text not null, -- sanitized with DOMPurify
  featured_image text, -- 1200x630 og:image URL
  author text default 'צוות אור זרוע לצדיק',
  category_id uuid references categories(id) on delete set null, -- FK to promoted category
  published_at timestamp with time zone not null default now(),
  read_time_minutes int default 5,
  seo_keywords text, -- comma-separated, for internal use
  is_published boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes for common queries
create index idx_articles_slug on articles(slug);
create index idx_articles_published_at on articles(published_at desc);
create index idx_articles_category_id on articles(category_id);
create index idx_articles_is_published on articles(is_published);

-- RLS: articles are public (anyone can read published articles)
alter table articles enable row level security;

create policy "Published articles are readable by anyone"
  on articles for select
  using (is_published = true);

create policy "Only admin can manage articles"
  on articles for all
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- Timestamp trigger to auto-update updated_at
create trigger update_articles_updated_at
  before update on articles
  for each row
  execute function update_updated_at_column();
