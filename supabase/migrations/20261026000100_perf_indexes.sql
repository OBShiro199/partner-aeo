-- Covering indexes for the remaining foreign keys (deletes of users cascade through them),
-- and one for the spend-cap totals every paid call reads.
create index if not exists agencies_created_by_idx on public.agencies (created_by);
create index if not exists agency_invites_invited_by_idx on public.agency_invites (invited_by);
create index if not exists clients_created_by_idx on public.clients (created_by);
create index if not exists scans_triggered_by_idx on public.scans (triggered_by);
create index if not exists api_usage_provider_idx on public.api_usage (provider, status) include (cost_usd);
