-- Release 1 of the v2 scope: the Starter / Growth / Scale entitlements from Cliff's PRD,
-- and the Stripe subscription fields the webhook keeps in sync.

-- ---------------------------------------------------------------------------
-- Entitlements per plan. widget_scans = branded PDF audits, strategy_runs = pitch decks
-- (a full Strategy Engine run is what builds the deck). Both stay metered by credit_ledger.
-- ---------------------------------------------------------------------------
alter table public.plan_allowances
  add column if not exists price_usd int not null default 0,
  add column if not exists seats int not null default 1,
  add column if not exists clients int not null default 5,
  add column if not exists leads int not null default 0,              -- new leads per month
  add column if not exists prompts_per_client int not null default 5,
  add column if not exists widget_sites int not null default 0,       -- sites the widget may run on
  add column if not exists agency_domains int not null default 1,     -- agency audit + agency Day-1 fixes
  add column if not exists fix_packs int not null default 0;          -- client Day-1 fix packs per month

update public.plan_allowances set price_usd = 0,   seats = 3,  clients = 10,  leads = 10,  prompts_per_client = 5,  widget_sites = 0,  agency_domains = 1, fix_packs = 0,   widget_scans = 0,   strategy_runs = 0   where plan = 'trial';
update public.plan_allowances set price_usd = 299, seats = 1,  clients = 5,   leads = 25,  prompts_per_client = 5,  widget_sites = 2,  agency_domains = 1, fix_packs = 10,  widget_scans = 25,  strategy_runs = 10  where plan = 'starter';
update public.plan_allowances set price_usd = 699, seats = 5,  clients = 30,  leads = 100, prompts_per_client = 10, widget_sites = 10, agency_domains = 1, fix_packs = 25,  widget_scans = 100, strategy_runs = 50  where plan = 'growth';
update public.plan_allowances set price_usd = 999, seats = 10, clients = 100, leads = 500, prompts_per_client = 20, widget_sites = 25, agency_domains = 3, fix_packs = 100, widget_scans = 500, strategy_runs = 200 where plan = 'scale';

-- ---------------------------------------------------------------------------
-- Stripe state on the agency. Written only by the stripe-webhook / billing functions.
--   plan stays 'trial' (features locked) while the Stripe subscription is trialing;
--   subscribed_plan is what they picked at checkout and becomes the plan once it's paid.
-- ---------------------------------------------------------------------------
alter table public.agencies
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status text,     -- trialing | active | past_due | canceled | unpaid | incomplete
  add column if not exists subscribed_plan text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

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
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_status := old.subscription_status;
    new.subscribed_plan := old.subscribed_plan;
    new.current_period_end := old.current_period_end;
    new.cancel_at_period_end := old.cancel_at_period_end;
    new.overage_enabled := old.overage_enabled;
  end if;
  return new;
end $$;

-- Move an agency onto a plan: limits come from plan_allowances. Never shrinks below what they already
-- have, so a downgrade can't strand existing clients or seats (they just can't add more).
create or replace function public.apply_plan(p_agency uuid, p_plan text) returns void
language plpgsql security definer set search_path = '' as $$
declare al record;
begin
  select * into al from public.plan_allowances where plan = p_plan;
  if not found then raise exception 'Unknown plan %', p_plan; end if;
  update public.agencies a set
    plan = p_plan,
    seat_limit = greatest(al.seats, least(500, (select count(*) from public.agency_members m where m.agency_id = a.id)::int)),
    client_limit = greatest(al.clients, least(5000, (select count(*) from public.clients c where c.agency_id = a.id)::int))
  where a.id = p_agency;
end $$;
revoke execute on function public.apply_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_plan(uuid, text) to service_role;

-- Webhook idempotency: Stripe retries, we process each event once.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  agency_id uuid references public.agencies (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;  -- service role only

-- Card up front for the free audits. Off until Stripe keys are in; flip with:
--   update platform_limits set require_card = true;
alter table public.platform_limits add column if not exists require_card boolean not null default false;

-- ---------------------------------------------------------------------------
-- Prompts per client follow the plan (was a flat 10).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_prompt_limit() returns trigger
language plpgsql set search_path = '' as $$
declare lim int;
begin
  if not new.active then return new; end if;
  select coalesce(al.prompts_per_client, 5) into lim
    from public.agencies a left join public.plan_allowances al on al.plan = a.plan where a.id = new.agency_id;
  if (select count(*) from public.prompts p where p.client_id = new.client_id and p.active and p.id <> new.id) >= lim then
    raise exception 'Your plan tracks up to % prompts per client. Upgrade to track more.', lim using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Widget sites follow the plan. An empty list still means "any site" on the trial preview.
create or replace function public.enforce_widget_sites() returns trigger
language plpgsql set search_path = '' as $$
declare lim int;
begin
  select coalesce(al.widget_sites, 0) into lim
    from public.agencies a left join public.plan_allowances al on al.plan = a.plan where a.id = new.agency_id;
  if cardinality(new.allowed_hosts) > greatest(lim, 1) then
    raise exception 'Your plan runs the widget on up to % sites.', greatest(lim, 1) using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists widgets_sites_limit on public.widgets;
create trigger widgets_sites_limit before insert or update of allowed_hosts on public.widgets
for each row execute function public.enforce_widget_sites();
revoke execute on function public.enforce_widget_sites() from public, anon, authenticated;
