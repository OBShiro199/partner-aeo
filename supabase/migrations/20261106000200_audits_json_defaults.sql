-- Bulk inserts send null for any column a row leaves out; keep the JSON columns as {} instead.
create function public.audits_json_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.business := coalesce(new.business, '{}'::jsonb);
  new.tech := coalesce(new.tech, '{}'::jsonb);
  new.report := coalesce(new.report, '{}'::jsonb);
  new.hub := coalesce(new.hub, '{}'::jsonb);
  new.assets := coalesce(new.assets, '{}'::jsonb);
  return new;
end $$;
create trigger audits_json_defaults before insert on public.audits for each row execute function public.audits_json_defaults();
revoke execute on function public.audits_json_defaults() from public, anon, authenticated;
