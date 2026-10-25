-- Schedules. The worker takes no input and only drains the outbox, so it can be
-- called without credentials; calling it more often just sends queued email sooner.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule('email-worker', '* * * * *', $$
  select net.http_post(
    url := 'https://nfnrezdqbunlrmdqmxzj.supabase.co/functions/v1/email-worker',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
$$);

-- Monday 08:05 UTC
select cron.schedule('weekly-digests', '5 8 * * 1', $$ select public.queue_weekly_digests() $$);
-- Daily 09:10 UTC
select cron.schedule('trial-reminders', '10 9 * * *', $$ select public.queue_trial_reminders() $$);
select cron.schedule('visibility-drops', '20 9 * * *', $$ select public.queue_visibility_drops() $$);
-- Keep the outbox small: drop sent/skipped rows after 90 days.
select cron.schedule('email-outbox-prune', '30 3 * * *', $$
  delete from public.email_outbox where status in ('sent', 'skipped') and created_at < now() - interval '90 days'
$$);
