-- Growth tools: the embeddable lead widget, prospect audits, leads, and the
-- AI Prompt Intent Strategy Engine. Audits are written only by edge functions
-- (service role); agency members read them through RLS.

-- ---------------------------------------------------------------------------
-- Plan allowances and metering
-- ---------------------------------------------------------------------------
create table public.plan_allowances (
  plan text primary key,
  widget_scans int not null,                 -- per calendar month (UTC)
  strategy_runs int not null,
  widget_overage_usd numeric(8, 2) not null, -- 0 = no overage on this plan
  strategy_overage_usd numeric(8, 2) not null
);
insert into public.plan_allowances values
  ('trial',    10,   3, 0,    0),
  ('starter',  50,  10, 1.00, 4.00),
  ('growth',  200,  30, 0.75, 3.00),
  ('scale',  1000, 100, 0.50, 2.00);
alter table public.plan_allowances enable row level security;
create policy allowances_select on public.plan_allowances for select to authenticated using (true);

alter table public.agencies add column if not exists overage_enabled boolean not null default false;

-- Platform safety rails for public, paid traffic.
alter table public.platform_limits
  add column if not exists dfs_total_max_spend_usd numeric(10, 4) not null default 0.60,  -- all DataForSEO spend, every feature
  add column if not exists mentions_enabled boolean not null default false,               -- LLM Mentions is ~$0.10+ per call
  add column if not exists widget_scans_per_ip_hour int not null default 3,
  add column if not exists widget_scans_per_day int not null default 50;                  -- platform-wide, fresh (uncached) scans

-- ---------------------------------------------------------------------------
-- Widgets: one per agency for now. public_key is safe to publish.
-- ---------------------------------------------------------------------------
create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies (id) on delete cascade,
  public_key text not null unique default ('pk_' || replace(gen_random_uuid()::text, '-', '')),
  enabled boolean not null default true,
  headline text not null default 'How visible is your business in AI search?' check (char_length(headline) <= 120),
  subhead text not null default 'See how ChatGPT, Perplexity, Gemini and Claude answer when buyers ask about your category.' check (char_length(subhead) <= 240),
  brand_color text not null default '#5f86e0' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  sender_name text,                          -- "From" name on the prospect email; defaults to the agency name
  contact_name text,
  contact_email text,
  contact_phone text,
  booking_url text,
  allowed_hosts text[] not null default '{}', -- empty = any site may embed
  default_region text not null default 'GB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.widgets enable row level security;
create policy widgets_select on public.widgets for select to authenticated using (public.is_member(agency_id));
create policy widgets_insert on public.widgets for insert to authenticated
  with check (public.has_role(agency_id, '{owner,admin}'));
create policy widgets_update on public.widgets for update to authenticated
  using (public.has_role(agency_id, '{owner,admin}')) with check (public.has_role(agency_id, '{owner,admin}'));

-- What the public embed may know about a widget. Never exposes contact email to scrapers beyond what the agency chose to show.
create function public.widget_public(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'key', w.public_key, 'enabled', w.enabled, 'headline', w.headline, 'subhead', w.subhead,
    'brand_color', w.brand_color, 'logo_url', coalesce(w.logo_url, a.favicon_url),
    'agency_name', a.name, 'agency_domain', a.domain, 'contact_name', w.contact_name,
    'booking_url', w.booking_url, 'default_region', w.default_region
  )
  from public.widgets w join public.agencies a on a.id = w.agency_id
  where w.public_key = p_key
$$;

-- ---------------------------------------------------------------------------
-- Audits: one prospect x keyword x competitor analysis.
--   report = what the prospect sees (score, share of voice, invisible prompts, source gaps)
--   hub    = agency only (25 variations with volumes, citation map, sentiment, raw answers)
--   assets = AI-written sales kit (cold email, talk track, closing script)
-- ---------------------------------------------------------------------------
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  widget_id uuid references public.widgets (id) on delete set null,
  source text not null check (source in ('widget', 'manual')),
  depth text not null default 'lite' check (depth in ('lite', 'full')),
  prospect_domain text not null,
  prospect_name text,
  keyword text not null check (char_length(keyword) between 2 and 120),
  competitor_domain text,
  competitor_name text,
  region text not null default 'GB',
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed')),
  stage text,
  score int check (score between 0 and 100),
  risk text check (risk in ('high', 'at_risk', 'visible')),
  deflection_rate numeric(5, 4),
  report jsonb not null default '{}',
  hub jsonb not null default '{}',
  assets jsonb not null default '{}',
  cost_usd numeric(10, 6) not null default 0,
  error text,
  cache_key text,
  cached_from uuid references public.audits (id) on delete set null,
  ip_hash text,
  host text,                                   -- site the widget was embedded on
  triggered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index audits_agency_idx on public.audits (agency_id, created_at desc);
create index audits_cache_idx on public.audits (cache_key, created_at desc) where status = 'complete';
create index audits_ip_idx on public.audits (ip_hash, created_at desc) where ip_hash is not null;
create index audits_widget_idx on public.audits (widget_id);
create index audits_cached_from_idx on public.audits (cached_from);
create index audits_triggered_by_idx on public.audits (triggered_by);
alter table public.audits enable row level security;
create policy audits_select on public.audits for select to authenticated using (public.is_member(agency_id));
create policy audits_delete on public.audits for delete to authenticated using (public.has_role(agency_id, '{owner,admin}'));

-- ---------------------------------------------------------------------------
-- Leads captured by the widget's gate.
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  widget_id uuid references public.widgets (id) on delete set null,
  audit_id uuid not null unique references public.audits (id) on delete cascade,
  name text,
  email text not null check (position('@' in email) > 1),
  phone text not null check (char_length(phone) between 6 and 32),
  status text not null default 'new' check (status in ('new', 'contacted', 'meeting', 'won', 'lost')),
  notes text,
  report_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index leads_agency_idx on public.leads (agency_id, created_at desc);
create index leads_widget_idx on public.leads (widget_id);
alter table public.leads enable row level security;
create policy leads_select on public.leads for select to authenticated using (public.is_member(agency_id));
create policy leads_update on public.leads for update to authenticated
  using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy leads_delete on public.leads for delete to authenticated using (public.has_role(agency_id, '{owner,admin}'));

-- Members may change a lead's status and notes, nothing else.
create function public.leads_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.agency_id := old.agency_id; new.widget_id := old.widget_id; new.audit_id := old.audit_id;
    new.name := old.name; new.email := old.email; new.phone := old.phone;
    new.report_sent_at := old.report_sent_at; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger leads_guard before update on public.leads for each row execute function public.leads_guard();

-- ---------------------------------------------------------------------------
-- Credit ledger: one row per metered run. Overage rows are billed later (Stripe).
-- ---------------------------------------------------------------------------
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  kind text not null check (kind in ('widget_scan', 'strategy_run')),
  audit_id uuid references public.audits (id) on delete set null,
  overage boolean not null default false,
  unit_price_usd numeric(8, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index credit_ledger_agency_idx on public.credit_ledger (agency_id, kind, created_at desc);
create index credit_ledger_audit_idx on public.credit_ledger (audit_id);
alter table public.credit_ledger enable row level security;
create policy ledger_select on public.credit_ledger for select to authenticated using (public.is_member(agency_id));

-- Take one credit, or refuse. Locks the agency row so parallel scans can't overspend.
create function public.consume_credit(p_agency uuid, p_kind text, p_audit uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record; al record; used int; allowance int; price numeric;
begin
  select id, plan, overage_enabled into a from public.agencies where id = p_agency for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_agency'); end if;
  select * into al from public.plan_allowances where plan = a.plan;
  if not found then select * into al from public.plan_allowances where plan = 'trial'; end if;
  allowance := case p_kind when 'widget_scan' then al.widget_scans else al.strategy_runs end;
  price := case p_kind when 'widget_scan' then al.widget_overage_usd else al.strategy_overage_usd end;
  select count(*) into used from public.credit_ledger
    where agency_id = p_agency and kind = p_kind and created_at >= date_trunc('month', now());
  if used < allowance then
    insert into public.credit_ledger (agency_id, kind, audit_id) values (p_agency, p_kind, p_audit);
    return jsonb_build_object('ok', true, 'overage', false, 'used', used + 1, 'allowance', allowance);
  end if;
  if a.overage_enabled and price > 0 then
    insert into public.credit_ledger (agency_id, kind, audit_id, overage, unit_price_usd) values (p_agency, p_kind, p_audit, true, price);
    return jsonb_build_object('ok', true, 'overage', true, 'used', used + 1, 'allowance', allowance, 'price', price);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'allowance', 'used', used, 'allowance', allowance);
end $$;

-- A run that produced nothing gives its credit back.
create function public.refund_credit(p_audit uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.credit_ledger where audit_id = p_audit
$$;

-- This month's usage for the dashboard meters.
create function public.credit_summary(p_agency uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_member(p_agency) then null else (
    select jsonb_build_object(
      'plan', a.plan, 'overage_enabled', a.overage_enabled,
      'widget_scans', jsonb_build_object('used', (select count(*) from public.credit_ledger l where l.agency_id = a.id and l.kind = 'widget_scan' and l.created_at >= date_trunc('month', now())),
        'allowance', coalesce(al.widget_scans, 10), 'overage_usd', coalesce(al.widget_overage_usd, 0),
        'overage_count', (select count(*) from public.credit_ledger l where l.agency_id = a.id and l.kind = 'widget_scan' and l.overage and l.created_at >= date_trunc('month', now()))),
      'strategy_runs', jsonb_build_object('used', (select count(*) from public.credit_ledger l where l.agency_id = a.id and l.kind = 'strategy_run' and l.created_at >= date_trunc('month', now())),
        'allowance', coalesce(al.strategy_runs, 3), 'overage_usd', coalesce(al.strategy_overage_usd, 0),
        'overage_count', (select count(*) from public.credit_ledger l where l.agency_id = a.id and l.kind = 'strategy_run' and l.overage and l.created_at >= date_trunc('month', now()))),
      'resets_at', date_trunc('month', now()) + interval '1 month'
    )
    from public.agencies a left join public.plan_allowances al on al.plan = a.plan
    where a.id = p_agency
  ) end
$$;

-- ---------------------------------------------------------------------------
-- Email: prospect report (white-label, PDF attached) and new-lead alert.
-- ---------------------------------------------------------------------------
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check check (kind in (
  'welcome', 'invite', 'member_joined', 'weekly_digest', 'visibility_drop', 'limit_reached', 'trial_ending',
  'prospect_report', 'new_lead'
));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.widget_public(text) from public;
grant execute on function public.widget_public(text) to anon, authenticated;
revoke execute on function public.consume_credit(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.refund_credit(uuid) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, text, uuid) to service_role;
grant execute on function public.refund_credit(uuid) to service_role;
revoke execute on function public.credit_summary(uuid) from public, anon;
grant execute on function public.credit_summary(uuid) to authenticated;
revoke execute on function public.leads_guard() from public, anon, authenticated;
grant execute on function public.enqueue_email(text, text, uuid, uuid, jsonb, text, timestamptz) to service_role;

-- Live progress in the dashboard.
alter publication supabase_realtime add table public.audits, public.leads;

-- When the current run began (an audit can run twice: lite, then the full upgrade).
alter table public.audits add column started_at timestamptz not null default now();
