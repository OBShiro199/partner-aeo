-- Owners and admins edit their agency's profile, but billing fields only change
-- server-side (Stripe webhooks, SQL editor). Without this, the update policy would
-- let anyone with the owner role give themselves a bigger plan from the browser.
create function public.agencies_guard() returns trigger
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
  end if;
  return new;
end $$;
create trigger agencies_guard before update on public.agencies for each row execute function public.agencies_guard();
revoke execute on function public.agencies_guard() from public, anon, authenticated;
