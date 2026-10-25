-- Transactional email: an outbox filled by triggers and schedules, drained by the
-- email-worker edge function (Resend). Nothing here sends directly, so a failed send
-- never rolls back the action that caused it.

alter table public.agencies
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');

-- Per-user email preferences. Essentials (invites, welcome, trial, limits) always send.
create table public.email_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weekly_digest boolean not null default true,
  alerts boolean not null default true,
  product boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);
alter table public.email_preferences enable row level security;
create policy prefs_select on public.email_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy prefs_update on public.email_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into public.email_preferences (user_id) select id from public.profiles on conflict do nothing;

create table public.email_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('welcome', 'invite', 'member_joined', 'weekly_digest', 'visibility_drop', 'limit_reached', 'trial_ending')),
  agency_id uuid references public.agencies (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  to_email text not null check (position('@' in to_email) > 1),
  data jsonb not null default '{}',
  dedupe_key text unique,                         -- one email per event, ever
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  send_after timestamptz not null default now(),
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (send_after) where status = 'pending';
create index email_outbox_agency_idx on public.email_outbox (agency_id);
create index email_outbox_user_idx on public.email_outbox (user_id);
alter table public.email_outbox enable row level security;  -- no policies: service role only

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.enqueue_email(
  p_kind text, p_to text, p_agency uuid, p_user uuid, p_data jsonb, p_dedupe text, p_after timestamptz default now()
) returns void
language sql security definer set search_path = '' as $$
  insert into public.email_outbox (kind, to_email, agency_id, user_id, data, dedupe_key, send_after)
  values (p_kind, lower(p_to), p_agency, p_user, coalesce(p_data, '{}'), p_dedupe, p_after)
  on conflict (dedupe_key) do nothing
$$;

-- Atomically claim a batch for the worker.
create function public.claim_email_batch(n int default 25) returns setof public.email_outbox
language sql security definer set search_path = '' as $$
  update public.email_outbox o set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select id from public.email_outbox
    where status = 'pending' and send_after <= now()
    order by send_after
    limit n
    for update skip locked
  )
  returning o.*
$$;

-- ---------------------------------------------------------------------------
-- Event triggers
-- ---------------------------------------------------------------------------

-- Every new profile gets preferences (and an unsubscribe token).
create function public.profile_email_prefs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.email_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger profiles_email_prefs after insert on public.profiles
for each row execute function public.profile_email_prefs();

-- Welcome: when onboarding finishes.
create function public.email_on_onboarded() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    select * into p from public.profiles where id = new.created_by;
    if p.email is not null then
      perform public.enqueue_email('welcome', p.email, new.id, p.id,
        jsonb_build_object('first_name', split_part(coalesce(p.full_name, ''), ' ', 1)),
        'welcome:' || new.id);
    end if;
  end if;
  return new;
end $$;
create trigger agencies_email_onboarded after update of onboarded_at on public.agencies
for each row execute function public.email_on_onboarded();

-- Invite: when someone is invited.
create function public.email_on_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inviter public.profiles;
begin
  select * into inviter from public.profiles where id = new.invited_by;
  perform public.enqueue_email('invite', new.email, new.agency_id, null,
    jsonb_build_object('token', new.token, 'role', new.role,
      'inviter_name', coalesce(nullif(inviter.full_name, ''), inviter.email, 'A teammate')),
    'invite:' || new.id);
  return new;
end $$;
create trigger invites_email after insert on public.agency_invites
for each row execute function public.email_on_invite();

-- Member joined: tell the owners and admins (not the person who joined).
create function public.email_on_member_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j public.profiles;
begin
  if new.role = 'owner' then return new; end if;
  select * into j from public.profiles where id = new.user_id;
  perform public.enqueue_email('member_joined', p.email, new.agency_id, p.id,
    jsonb_build_object('member_name', coalesce(nullif(j.full_name, ''), j.email), 'member_email', j.email, 'role', new.role),
    'joined:' || new.agency_id || ':' || new.user_id || ':' || p.id)
  from public.agency_members m join public.profiles p on p.id = m.user_id
  where m.agency_id = new.agency_id and m.role in ('owner', 'admin') and m.user_id <> new.user_id;
  return new;
end $$;
create trigger members_email_joined after insert on public.agency_members
for each row execute function public.email_on_member_joined();

-- Limit reached: the moment an agency fills its last client slot or seat.
create function public.email_on_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.agencies; used int; what text;
begin
  select * into a from public.agencies where id = new.agency_id;
  if tg_table_name = 'clients' then
    what := 'clients';
    select count(*) into used from public.clients where agency_id = a.id and status <> 'archived';
    if used < a.client_limit then return new; end if;
  else
    what := 'seats';
    select (select count(*) from public.agency_members where agency_id = a.id)
         + (select count(*) from public.agency_invites where agency_id = a.id and accepted_at is null) into used;
    if used < a.seat_limit then return new; end if;
  end if;
  perform public.enqueue_email('limit_reached', p.email, a.id, p.id,
    jsonb_build_object('what', what, 'limit', case when what = 'clients' then a.client_limit else a.seat_limit end, 'plan', a.plan),
    'limit:' || what || ':' || a.id || ':' || to_char(now(), 'IYYY-MM') || ':' || p.id)
  from public.agency_members m join public.profiles p on p.id = m.user_id
  where m.agency_id = a.id and m.role = 'owner';
  return new;
end $$;
create trigger clients_email_limit after insert on public.clients
for each row execute function public.email_on_limit();
create trigger invites_email_limit after insert on public.agency_invites
for each row execute function public.email_on_limit();

-- ---------------------------------------------------------------------------
-- Scheduled producers (run by pg_cron below)
-- ---------------------------------------------------------------------------

-- Monday digest to every member who wants it, for agencies that have clients.
create function public.queue_weekly_digests() returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.email_outbox (kind, to_email, agency_id, user_id, dedupe_key)
    select 'weekly_digest', lower(p.email), m.agency_id, p.id,
           'digest:' || m.agency_id || ':' || p.id || ':' || to_char(now(), 'IYYY-IW')
    from public.agency_members m
    join public.profiles p on p.id = m.user_id
    join public.email_preferences ep on ep.user_id = p.id and ep.weekly_digest
    join public.agencies a on a.id = m.agency_id and a.onboarded_at is not null
    where p.email is not null and exists (select 1 from public.clients c where c.agency_id = a.id and c.status = 'active')
    on conflict (dedupe_key) do nothing
    returning 1
  ) select count(*)::int from ins
$$;

-- Trial ends in 3 days: tell the owner once.
create function public.queue_trial_reminders() returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.email_outbox (kind, to_email, agency_id, user_id, data, dedupe_key)
    select 'trial_ending', lower(p.email), a.id, p.id,
           jsonb_build_object('trial_ends_at', a.trial_ends_at, 'clients', (select count(*) from public.clients c where c.agency_id = a.id)),
           'trial:' || a.id || ':' || p.id
    from public.agencies a
    join public.agency_members m on m.agency_id = a.id and m.role = 'owner'
    join public.profiles p on p.id = m.user_id
    where a.plan = 'trial' and a.trial_ends_at between now() + interval '2 days' and now() + interval '3 days'
    on conflict (dedupe_key) do nothing
    returning 1
  ) select count(*)::int from ins
$$;

-- Visibility drop: a client's score fell 10+ points this week vs last week (8+ answers each week).
create function public.queue_visibility_drops() returns int
language sql security definer set search_path = '' as $$
  with w as (
    select r.client_id, r.agency_id,
      case when r.created_at > now() - interval '7 days' then 'cur' else 'prev' end as wk,
      count(*) as n,
      70.0 * avg(case when r.mentioned then 1 else 0 end) + 30.0 * avg(case when r.own_domain_cited then 1 else 0 end) as vis
    from public.scan_results r
    where r.status = 'done' and r.created_at > now() - interval '14 days'
    group by 1, 2, 3
  ), drops as (
    select c.client_id, c.agency_id, round(p.vis, 1) as before, round(c.vis, 1) as after
    from w c join w p on p.client_id = c.client_id and p.wk = 'prev'
    where c.wk = 'cur' and c.n >= 8 and p.n >= 8 and p.vis - c.vis >= 10
  ), ins as (
    insert into public.email_outbox (kind, to_email, agency_id, user_id, data, dedupe_key)
    select 'visibility_drop', lower(pr.email), d.agency_id, pr.id,
           jsonb_build_object('client_id', d.client_id, 'client_name', cl.name, 'client_domain', cl.domain, 'before', d.before, 'after', d.after),
           'drop:' || d.client_id || ':' || pr.id || ':' || to_char(now(), 'IYYY-IW')
    from drops d
    join public.clients cl on cl.id = d.client_id and cl.status = 'active'
    join public.agency_members m on m.agency_id = d.agency_id
    join public.profiles pr on pr.id = m.user_id
    join public.email_preferences ep on ep.user_id = pr.id and ep.alerts
    on conflict (dedupe_key) do nothing
    returning 1
  ) select count(*)::int from ins
$$;

-- Nothing in this file is callable over the API.
revoke execute on function public.enqueue_email(text, text, uuid, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_email_batch(int) from public, anon, authenticated;
revoke execute on function public.profile_email_prefs() from public, anon, authenticated;
revoke execute on function public.email_on_onboarded() from public, anon, authenticated;
revoke execute on function public.email_on_invite() from public, anon, authenticated;
revoke execute on function public.email_on_member_joined() from public, anon, authenticated;
revoke execute on function public.email_on_limit() from public, anon, authenticated;
revoke execute on function public.queue_weekly_digests() from public, anon, authenticated;
revoke execute on function public.queue_trial_reminders() from public, anon, authenticated;
revoke execute on function public.queue_visibility_drops() from public, anon, authenticated;
grant execute on function public.claim_email_batch(int) to service_role;
