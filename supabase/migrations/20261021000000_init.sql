-- Partner AEO: initial schema
-- Multi-tenant: every row belongs to an agency. Access is decided by membership
-- in agency_members, checked by RLS on every table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.scan_status as enum ('queued', 'running', 'complete', 'partial', 'failed');
create type public.result_status as enum ('pending', 'done', 'failed', 'skipped');
create type public.prompt_intent as enum ('best_for', 'problem', 'comparison', 'local', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  last_agency_id uuid,
  created_at timestamptz not null default now()
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  website text,
  domain text,
  favicon_url text,
  logo_path text,                                   -- storage: brand-assets/{agency_id}/logo.*
  client_count_band text,                           -- '1-5' | '6-20' | '21-50' | '51-100' | '100+'
  regions text[] not null default '{}',             -- ISO 3166-1 alpha-2, or 'GLOBAL'
  engines text[] not null default '{chatgpt,claude,gemini,perplexity}'
    check (cardinality(engines) between 1 and 10),
  plan text not null default 'trial',               -- trial | starter | growth | scale (Stripe later)
  seat_limit int not null default 3 check (seat_limit between 1 and 500),
  client_limit int not null default 10 check (client_limit between 1 and 5000),
  monthly_budget_usd numeric(10, 4) not null default 5,
  onboarding_step int not null default 0,
  onboarded_at timestamptz,
  tour_completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,  -- profiles cascade from auth.users
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members (user_id);

create table public.agency_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.member_role not null default 'member' check (role <> 'owner'),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agency_id, email)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  domain text not null,
  website text,
  favicon_url text,
  description text,
  industry text,
  region text not null default 'GB',
  aliases text[] not null default '{}',             -- extra brand spellings for mention matching
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (agency_id, domain)
);
create index clients_agency_idx on public.clients (agency_id);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);
create index competitors_client_idx on public.competitors (client_id);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  text text not null check (char_length(text) between 3 and 400),
  intent public.prompt_intent not null default 'other',
  source text not null default 'manual' check (source in ('haiku', 'template', 'manual')),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index prompts_client_idx on public.prompts (client_id);

-- Max 10 active prompts per client.
create function public.enforce_prompt_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.active and (
    select count(*) from public.prompts p
    where p.client_id = new.client_id and p.active and p.id <> new.id
  ) >= 10 then
    raise exception 'A client can track at most 10 prompts' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger prompts_limit before insert or update of active on public.prompts
for each row execute function public.enforce_prompt_limit();

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  status public.scan_status not null default 'queued',
  engines text[] not null default '{}',
  is_test boolean not null default false,
  cost_usd numeric(12, 6) not null default 0,
  triggered_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index scans_client_idx on public.scans (client_id, started_at desc);

create table public.scan_results (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  prompt_id uuid references public.prompts (id) on delete set null,
  prompt_text text not null,                        -- kept so history survives prompt edits
  engine text not null,
  model text,
  status public.result_status not null default 'pending',
  response_text text,
  citations jsonb not null default '[]',            -- [{url, domain, title}]
  mentioned boolean,
  position int,
  competitors_mentioned text[] not null default '{}',
  own_domain_cited boolean not null default false,
  cost_usd numeric(12, 6) not null default 0,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index scan_results_client_idx on public.scan_results (client_id, created_at desc);
create index scan_results_agency_idx on public.scan_results (agency_id, created_at desc);

-- Every outbound paid API call. Written only by edge functions (service role).
create table public.api_usage (
  id bigint generated always as identity primary key,
  agency_id uuid references public.agencies (id) on delete cascade,
  provider text not null check (provider in ('dataforseo', 'anthropic', 'site')),
  endpoint text not null,
  status text not null check (status in ('ok', 'error', 'blocked')),
  http_status int,
  cost_usd numeric(12, 6) not null default 0,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index api_usage_agency_idx on public.api_usage (agency_id, created_at desc);

-- Platform-wide safety rails. One row. Only editable from the SQL editor.
create table public.platform_limits (
  id int primary key default 1 check (id = 1),
  dfs_max_calls int not null default 3,             -- total paid DataForSEO calls allowed
  dfs_max_spend_usd numeric(10, 4) not null default 0.30,
  dfs_calls_per_request int not null default 1,     -- one prompt x one engine per request while testing
  anthropic_max_spend_usd numeric(10, 4) not null default 1.00,
  updated_at timestamptz not null default now()
);
insert into public.platform_limits (id) values (1);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create function public.is_member(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = a and m.user_id = (select auth.uid())
  )
$$;

create function public.has_role(a uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = a and m.user_id = (select auth.uid()) and m.role = any (roles)
  )
$$;

-- Child rows must point at a client of the same agency.
create function public.enforce_client_agency() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id
  ) then
    raise exception 'client does not belong to agency' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger competitors_agency before insert or update on public.competitors
for each row execute function public.enforce_client_agency();
create trigger prompts_agency before insert or update on public.prompts
for each row execute function public.enforce_client_agency();

-- Seat limit: members + pending invites can't exceed agencies.seat_limit.
create function public.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare used int; lim int;
begin
  select seat_limit into lim from public.agencies where id = new.agency_id;
  select (select count(*) from public.agency_members where agency_id = new.agency_id)
       + (select count(*) from public.agency_invites where agency_id = new.agency_id and accepted_at is null)
    into used;
  if tg_table_name = 'agency_members' and exists (
    select 1 from public.agency_invites i
    join auth.users u on u.email = i.email
    where i.agency_id = new.agency_id and u.id = new.user_id and i.accepted_at is null
  ) then
    used := used - 1;                               -- accepting an invite reuses its seat
  end if;
  if used >= lim then
    raise exception 'All % seats are in use', lim using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger members_seat_limit before insert on public.agency_members
for each row execute function public.enforce_seat_limit();
create trigger invites_seat_limit before insert on public.agency_invites
for each row execute function public.enforce_seat_limit();

-- Client limit per plan.
create function public.enforce_client_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim int;
begin
  select client_limit into lim from public.agencies where id = new.agency_id;
  if (select count(*) from public.clients where agency_id = new.agency_id and status <> 'archived') >= lim then
    raise exception 'Your plan includes % clients', lim using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger clients_limit before insert on public.clients
for each row execute function public.enforce_client_limit();

-- New auth user -> profile row.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  -- Join every agency that invited this email. The invite's seat is reused.
  insert into public.agency_members (agency_id, user_id, role)
  select i.agency_id, new.id, i.role from public.agency_invites i
  where lower(i.email) = lower(new.email) and i.accepted_at is null
  on conflict do nothing;
  update public.agency_invites set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;
  update public.profiles p set last_agency_id = m.agency_id
  from public.agency_members m where m.user_id = new.id and p.id = new.id;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates an agency and makes the caller its owner, atomically.
create function public.create_agency(
  p_name text,
  p_website text default null,
  p_domain text default null,
  p_favicon_url text default null,
  p_client_count_band text default null,
  p_regions text[] default '{}',
  p_engines text[] default '{chatgpt,claude,gemini,perplexity}'
) returns public.agencies
language plpgsql security definer set search_path = '' as $$
declare a public.agencies;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.agencies (name, website, domain, favicon_url, client_count_band, regions, engines, created_by)
  values (p_name, p_website, p_domain, p_favicon_url, p_client_count_band, p_regions, p_engines, auth.uid())
  returning * into a;
  insert into public.agency_members (agency_id, user_id, role) values (a.id, auth.uid(), 'owner');
  update public.profiles set last_agency_id = a.id where id = auth.uid();
  return a;
end $$;

-- Accept an invite sent to the signed-in user's email.
create function public.accept_invite(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.agency_invites; me text;
begin
  select email into me from auth.users where id = auth.uid();
  select * into inv from public.agency_invites
  where token = p_token and accepted_at is null and lower(email) = lower(me);
  if inv.id is null then
    raise exception 'Invite not found or already used' using errcode = 'P0002';
  end if;
  insert into public.agency_members (agency_id, user_id, role)
  values (inv.agency_id, auth.uid(), inv.role) on conflict do nothing;
  update public.agency_invites set accepted_at = now() where id = inv.id;
  return inv.agency_id;
end $$;

-- Spend summary for the billing page.
create function public.agency_usage(a uuid, since timestamptz default date_trunc('month', now()))
returns table (provider text, calls bigint, cost_usd numeric)
language sql stable security definer set search_path = '' as $$
  select u.provider, count(*), coalesce(sum(u.cost_usd), 0)
  from public.api_usage u
  where u.agency_id = a and u.created_at >= since and public.is_member(a)
  group by u.provider
$$;

revoke execute on function public.create_agency from anon;
revoke execute on function public.accept_invite from anon;
revoke execute on function public.agency_usage from anon;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_invites enable row level security;
alter table public.clients enable row level security;
alter table public.competitors enable row level security;
alter table public.prompts enable row level security;
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;
alter table public.api_usage enable row level security;
alter table public.platform_limits enable row level security;

-- profiles: yourself, plus teammates
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.agency_members m1
    join public.agency_members m2 on m1.agency_id = m2.agency_id
    where m1.user_id = (select auth.uid()) and m2.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- agencies: members read; owner/admin update; owner deletes. Insert only via create_agency().
create policy agencies_select on public.agencies for select to authenticated using (public.is_member(id));
create policy agencies_update on public.agencies for update to authenticated
  using (public.has_role(id, '{owner,admin}')) with check (public.has_role(id, '{owner,admin}'));
create policy agencies_delete on public.agencies for delete to authenticated using (public.has_role(id, '{owner}'));

-- members: teammates read; owner/admin manage; anyone can leave
create policy members_select on public.agency_members for select to authenticated using (public.is_member(agency_id));
create policy members_update on public.agency_members for update to authenticated
  using (public.has_role(agency_id, '{owner}')) with check (public.has_role(agency_id, '{owner}'));
create policy members_delete on public.agency_members for delete to authenticated using (
  (public.has_role(agency_id, '{owner,admin}') and role <> 'owner') or user_id = (select auth.uid())
);

-- invites: owner/admin manage
create policy invites_all on public.agency_invites for all to authenticated
  using (public.has_role(agency_id, '{owner,admin}')) with check (public.has_role(agency_id, '{owner,admin}'));

-- clients, competitors, prompts: any member reads and writes
create policy clients_rw on public.clients for all to authenticated
  using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy competitors_rw on public.competitors for all to authenticated
  using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy prompts_rw on public.prompts for all to authenticated
  using (public.is_member(agency_id)) with check (public.is_member(agency_id));

-- scans, results, usage: members read; edge functions (service role) write
create policy scans_select on public.scans for select to authenticated using (public.is_member(agency_id));
create policy results_select on public.scan_results for select to authenticated using (public.is_member(agency_id));
create policy usage_select on public.api_usage for select to authenticated using (public.is_member(agency_id));
create policy limits_select on public.platform_limits for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage: brand assets (agency logos, client favicons). Path: {agency_id}/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 1048576,
        '{image/png,image/jpeg,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp}')
on conflict (id) do nothing;

create policy brand_assets_write on storage.objects for insert to authenticated with check (
  bucket_id = 'brand-assets' and public.is_member(((storage.foldername(name))[1])::uuid)
);
create policy brand_assets_update on storage.objects for update to authenticated using (
  bucket_id = 'brand-assets' and public.is_member(((storage.foldername(name))[1])::uuid)
);
create policy brand_assets_delete on storage.objects for delete to authenticated using (
  bucket_id = 'brand-assets' and public.is_member(((storage.foldername(name))[1])::uuid)
);

-- Realtime: stream results into the dashboard as they land.
alter publication supabase_realtime add table public.scan_results, public.scans;
