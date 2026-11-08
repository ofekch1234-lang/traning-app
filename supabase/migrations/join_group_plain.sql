-- join_group_plain (2026-11-08): join a group by its code without the referral gift.
-- The iOS app uses this one: App Store guideline 3.1.1 forbids unlocking premium with codes outside
-- In-App Purchase, so a group code there is only a group invite. Same checks as join_group.
create or replace function public.join_group_plain(p_code text)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare gid uuid; uid uuid := auth.uid();
begin
  if not public.is_approved() then raise exception 'forbidden' using errcode='42501'; end if;
  select id into gid from public.groups where invite_code = upper(btrim(p_code));
  if gid is null then raise exception 'not_found'; end if;
  if exists(select 1 from public.group_members where group_id = gid and user_id = uid) then return gid; end if;
  if (select count(*) from public.group_members where group_id = gid) >= 30 then raise exception 'group_full'; end if;
  insert into public.group_members(group_id, user_id) values (gid, uid);
  insert into public.group_messages(group_id, user_id, kind) values (gid, uid, 'join');
  return gid;
end $$;
revoke all on function public.join_group_plain(text) from public, anon;
grant execute on function public.join_group_plain(text) to authenticated;
