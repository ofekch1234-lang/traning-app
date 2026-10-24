-- NextRep: where each user came from (admin only). Safe to re-run.
-- Reads the first 'src' event each user logged (utm / referrer / in-app browser / invite / app store),
-- written by the app through log_event right after sign-up.
create or replace function public.admin_sources()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not exists(select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(user_id, meta)
    from (select distinct on (user_id) user_id, meta
          from public.app_events where kind = 'src' and user_id is not null
          order by user_id, id) x), '{}'::jsonb);
end $$;
revoke all on function public.admin_sources() from public, anon;
grant execute on function public.admin_sources() to authenticated;
