-- Trigger functions: never callable over the API.
revoke execute on function public.enforce_client_limit() from public, anon, authenticated;
revoke execute on function public.enforce_seat_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_prompt_limit() from public, anon, authenticated;
revoke execute on function public.enforce_client_agency() from public, anon, authenticated;

-- RPCs and RLS helpers: signed-in users only.
revoke execute on function public.create_agency(text, text, text, text, text, text[], text[]) from public, anon;
revoke execute on function public.accept_invite(uuid) from public, anon;
revoke execute on function public.agency_usage(uuid, timestamptz) from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.member_role[]) from public, anon;
grant execute on function public.create_agency(text, text, text, text, text, text[], text[]) to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.agency_usage(uuid, timestamptz) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.member_role[]) to authenticated;
