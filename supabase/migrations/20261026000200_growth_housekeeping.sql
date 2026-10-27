-- Housekeeping for the growth tools.
-- 1. An edge function that dies mid-run leaves its audit "running" forever. After 15 minutes
--    mark it failed, and give the credit back if it never produced a report.
-- 2. IP hashes exist only for the hourly rate limit; drop them after 30 days.
create function public.sweep_stale_audits() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with stale as (
    select id, report from public.audits
    where status in ('queued', 'running') and started_at < now() - interval '15 minutes'
    for update skip locked
  ), refunded as (
    delete from public.credit_ledger l using stale s
    where l.audit_id = s.id and s.report = '{}'::jsonb
  )
  update public.audits a set
    status = case when s.report = '{}'::jsonb then 'failed' else 'complete' end,
    stage = null,
    error = case when s.report = '{}'::jsonb then 'This analysis stopped before it finished. Try again.' else a.error end,
    finished_at = coalesce(a.finished_at, now())
  from stale s where a.id = s.id;
  get diagnostics n = row_count;
  update public.audits set ip_hash = null where ip_hash is not null and created_at < now() - interval '30 days';
  return n;
end $$;
revoke execute on function public.sweep_stale_audits() from public, anon, authenticated;

select cron.schedule('sweep-stale-audits', '*/10 * * * *', $$ select public.sweep_stale_audits() $$);
