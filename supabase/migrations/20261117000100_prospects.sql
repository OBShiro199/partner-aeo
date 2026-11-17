-- Weekly lead drip (Nov 6 call): local businesses found through Treg (Google Maps + contact details
-- scraped from each site), checked with the technical AI-readiness audit, weakest first.
-- Each run is one batch; counts against the plan's monthly leads allowance.

alter table public.api_usage drop constraint if exists api_usage_provider_check;
alter table public.api_usage add constraint api_usage_provider_check check (provider in ('dataforseo', 'anthropic', 'site', 'treg'));

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  batch_id uuid not null,
  source text not null default 'treg',
  niche text,
  location text,
  name text not null,
  domain text,
  website text,
  phone text,
  emails text[] not null default '{}',
  socials jsonb not null default '{}',       -- { facebook: [...], instagram: [...], linkedin: [...] }
  address text,
  category text,
  rating numeric(3, 2),
  reviews int,
  maps_url text,
  tech jsonb not null default '{}',          -- TechAudit
  tech_score int,
  status text not null default 'new' check (status in ('new', 'contacted', 'replied', 'won', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (agency_id, domain)
);
create index prospects_agency_idx on public.prospects (agency_id, created_at desc);
alter table public.prospects enable row level security;
create policy prospects_select on public.prospects for select to authenticated using (public.is_member(agency_id));
create policy prospects_update on public.prospects for update to authenticated
  using (public.is_member(agency_id)) with check (public.is_member(agency_id));
