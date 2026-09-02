-- Persistent knowledge base for AI agents working on this shop.
-- Admin-only: it describes internals (project refs, integrations, operational
-- rules) that must never be readable by an anonymous shopper, so there is no
-- public SELECT policy at all — only the admin role, via has_role().
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_memory is
  'Durable notes for AI agents about this site and business. Admin-only (RLS). Upsert by `key`.';

alter table public.agent_memory enable row level security;

drop policy if exists "agent_memory admin read" on public.agent_memory;
create policy "agent_memory admin read" on public.agent_memory
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "agent_memory admin write" on public.agent_memory;
create policy "agent_memory admin write" on public.agent_memory
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.set_agent_memory_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agent_memory_updated_at on public.agent_memory;
create trigger agent_memory_updated_at before update on public.agent_memory
  for each row execute function public.set_agent_memory_updated_at();
