-- The free trial "sprint": one audit of an agency's existing client, five local prospects
-- with weak AI readiness (found on Google Maps), and an optional audit of the agency itself.
-- Each audit also carries a technical AI-readiness check (crawler access, llms.txt, schema, Q&A).

alter table public.audits drop constraint if exists audits_source_check;
alter table public.audits add constraint audits_source_check check (source in ('widget', 'manual', 'sprint'));

alter table public.audits
  add column if not exists sprint_role text check (sprint_role in ('client', 'lead', 'self')),
  add column if not exists tech jsonb not null default '{}',      -- technical audit: pillars, checks
  add column if not exists business jsonb not null default '{}';  -- Google Maps listing for sprint leads
create index if not exists audits_sprint_idx on public.audits (agency_id, sprint_role) where sprint_role is not null;

alter table public.agencies
  add column if not exists sprint jsonb,                -- { client_url, niche, location } as entered
  add column if not exists sprint_used_at timestamptz;  -- one sprint per agency

-- Only the server sets these.
create or replace function public.agencies_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.plan := old.plan;
    new.seat_limit := old.seat_limit;
    new.client_limit := old.client_limit;
    new.monthly_budget_usd := old.monthly_budget_usd;
    new.trial_ends_at := old.trial_ends_at;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.sprint := old.sprint;
    new.sprint_used_at := old.sprint_used_at;
  end if;
  return new;
end $$;

-- On the trial, the widget and the Strategy Engine sandbox are paid features; the sprint is the free taste.
update public.plan_allowances set widget_scans = 0, strategy_runs = 0 where plan = 'trial';
