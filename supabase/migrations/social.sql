-- NextRep social: groups (a training partner = a group of 2), chat + workout feed, reactions, challenges, leaderboard
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '💪' check (char_length(emoji) <= 8),
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);
create table if not exists public.group_messages (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','workout','pr','join','challenge')),
  body text check (char_length(body) <= 1000),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_idx on public.group_messages(group_id, id desc);
create table if not exists public.message_reactions (
  message_id bigint not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('💪','🔥','👏')),
  primary key (message_id, user_id, emoji)
);
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  metric text not null check (metric in ('workouts','sets','volume')),
  target numeric not null check (target > 0),
  start_d date not null, end_d date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists challenges_group_idx on public.challenges(group_id);
create table if not exists public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text, kind text, created_at timestamptz not null default now()
);

-- helpers
create or replace function public.is_member(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;
create or replace function public.display_name(uid uuid) returns text language sql stable security definer set search_path='' as $$
  select coalesce(nullif(split_part(raw_user_meta_data->>'full_name',' ',1),''), split_part(email,'@',1)) from auth.users where id = uid;
$$;
revoke all on function public.display_name(uuid) from public, anon, authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.challenges enable row level security;
alter table public.push_queue enable row level security;

create policy groups_select on public.groups for select to authenticated using ((select public.is_member(id)));
create policy gm_select on public.group_members for select to authenticated using ((select public.is_member(group_id)));
create policy msg_select on public.group_messages for select to authenticated using ((select public.is_member(group_id)));
create policy msg_insert on public.group_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'text' and (select public.is_member(group_id)));
create policy react_select on public.message_reactions for select to authenticated
  using (exists(select 1 from public.group_messages m where m.id = message_id and public.is_member(m.group_id)));
create policy react_insert on public.message_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists(select 1 from public.group_messages m where m.id = message_id and public.is_member(m.group_id)));
create policy react_delete on public.message_reactions for delete to authenticated using (user_id = (select auth.uid()));
create policy ch_select on public.challenges for select to authenticated using ((select public.is_member(group_id)));
create policy ch_delete on public.challenges for delete to authenticated using (created_by = (select auth.uid()));
do $$ declare t text; begin
  foreach t in array array['groups','group_members','group_messages','message_reactions','challenges'] loop
    execute format('create policy "approved only" on public.%I as restrictive for all to authenticated using ((select public.is_approved())) with check ((select public.is_approved()))', t);
  end loop;
end $$;

-- RPCs
create or replace function public.create_group(p_name text, p_emoji text default '💪') returns jsonb
language plpgsql security definer set search_path='' as $$
declare gid uuid; code text; uid uuid := auth.uid();
begin
  if not public.is_approved() then raise exception 'forbidden' using errcode='42501'; end if;
  if (select count(*) from public.group_members where user_id = uid) >= 10 then raise exception 'too_many_groups'; end if;
  loop
    code := upper(translate(substr(md5(gen_random_uuid()::text), 1, 6), '01', 'XY'));
    exit when not exists(select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups(name, emoji, invite_code, created_by) values (btrim(p_name), coalesce(nullif(p_emoji,''),'💪'), code, uid) returning id into gid;
  insert into public.group_members(group_id, user_id, role) values (gid, uid, 'owner');
  return jsonb_build_object('id', gid, 'invite_code', code);
end $$;

create or replace function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
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

create or replace function public.leave_group(gid uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.group_members where group_id = gid and user_id = auth.uid();
  if not exists(select 1 from public.group_members where group_id = gid) then delete from public.groups where id = gid; end if;
end $$;

create or replace function public.my_groups() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(x order by x.last_at desc nulls last), '[]'::jsonb) from (
    select g.id, g.name, g.emoji, g.invite_code,
      (select count(*) from public.group_members m where m.group_id = g.id) members,
      lm.id last_id, lm.kind last_kind, lm.body last_body, lm.created_at last_at,
      public.display_name(lm.user_id) last_name, lm.user_id last_uid
    from public.group_members me join public.groups g on g.id = me.group_id
    left join lateral (select * from public.group_messages gm where gm.group_id = g.id order by gm.id desc limit 1) lm on true
    where me.user_id = auth.uid()
  ) x;
$$;

create or replace function public.group_info(gid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_member(gid) then raise exception 'forbidden' using errcode='42501'; end if;
  return (select jsonb_build_object(
    'id', g.id, 'name', g.name, 'emoji', g.emoji, 'invite_code', g.invite_code,
    'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', public.display_name(m.user_id), 'role', m.role, 'joined_at', m.joined_at) order by m.joined_at)
                from public.group_members m where m.group_id = g.id))
    from public.groups g where g.id = gid);
end $$;

-- stats per member in a time window (ms epoch, like workouts.start_ts)
create or replace function public.group_board(gid uuid, p_from bigint, p_to bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_member(gid) then raise exception 'forbidden' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(r order by r.workouts desc, r.volume desc), '[]'::jsonb) from (
    select m.user_id, public.display_name(m.user_id) name,
      (select count(*) from public.workouts w where w.user_id = m.user_id and w.start_ts >= p_from and w.start_ts < p_to) workouts,
      coalesce((select count(*) from public.workouts w, jsonb_array_elements(w.ex) e, jsonb_array_elements(e->'sets') s
        where w.user_id = m.user_id and w.start_ts >= p_from and w.start_ts < p_to and e->>'t' = 's'), 0) sets,
      coalesce((select round(sum(coalesce((s->>'w')::numeric,0) * coalesce((s->>'r')::numeric,0))) from public.workouts w, jsonb_array_elements(w.ex) e, jsonb_array_elements(e->'sets') s
        where w.user_id = m.user_id and w.start_ts >= p_from and w.start_ts < p_to and e->>'t' = 's'), 0) volume
    from public.group_members m where m.group_id = gid) r);
end $$;

create or replace function public.create_challenge(gid uuid, p_title text, p_metric text, p_target numeric, p_days int) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; d0 date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if not public.is_member(gid) or not public.is_approved() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_days not between 1 and 90 then raise exception 'bad_days'; end if;
  insert into public.challenges(group_id, title, metric, target, start_d, end_d, created_by)
    values (gid, btrim(p_title), p_metric, p_target, d0, d0 + p_days - 1, auth.uid()) returning id into cid;
  insert into public.group_messages(group_id, user_id, kind, body, meta)
    values (gid, auth.uid(), 'challenge', btrim(p_title), jsonb_build_object('cid', cid, 'metric', p_metric, 'target', p_target, 'days', p_days));
  return cid;
end $$;

create or replace function public.group_challenges(gid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text := 'Asia/Jerusalem';
begin
  if not public.is_member(gid) then raise exception 'forbidden' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'title', c.title, 'metric', c.metric, 'target', c.target, 'start_d', c.start_d, 'end_d', c.end_d,
      'created_by', c.created_by,
      'board', public.group_board(gid,
          (extract(epoch from (c.start_d::timestamp at time zone tz)) * 1000)::bigint,
          (extract(epoch from ((c.end_d + 1)::timestamp at time zone tz)) * 1000)::bigint))
    order by (c.end_d < (now() at time zone tz)::date), c.end_d), '[]'::jsonb)
    from public.challenges c where c.group_id = gid and c.end_d >= (now() at time zone tz)::date - 14);
end $$;

-- post personal records to all my groups
create or replace function public.post_pr(p_text text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_approved() then return; end if;
  insert into public.group_messages(group_id, user_id, kind, body)
    select group_id, auth.uid(), 'pr', left(p_text, 300) from public.group_members where user_id = auth.uid();
end $$;

-- finished workout → card in every group of the user
create or replace function public.on_workout_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare n_sets int; vol numeric; dur int;
begin
  select count(*), coalesce(sum(coalesce((s->>'w')::numeric,0) * coalesce((s->>'r')::numeric,0)),0) into n_sets, vol
    from jsonb_array_elements(new.ex) e, jsonb_array_elements(coalesce(e->'sets','[]'::jsonb)) s where e->>'t' = 's';
  dur := greatest(0, round((coalesce(new.end_ts, new.start_ts) - new.start_ts) / 60000.0));
  insert into public.group_messages(group_id, user_id, kind, body, meta)
    select gm.group_id, new.user_id, 'workout', new.name,
      jsonb_build_object('wid', new.id, 'min', dur, 'sets', n_sets, 'vol', round(vol), 'ex', jsonb_array_length(new.ex))
    from public.group_members gm where gm.user_id = new.user_id;
  return new;
exception when others then return new;
end $$;
create trigger nextrep_workout_feed after insert on public.workouts for each row execute function public.on_workout_insert();

-- new message → push to the other members (respecting prefs.notif.social), throttled per user
create or replace function public.on_group_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare g record; who text; txt text;
begin
  select name, emoji into g from public.groups where id = new.group_id;
  who := coalesce(public.display_name(new.user_id), 'מישהו');
  txt := case new.kind
    when 'text' then who || ': ' || left(new.body, 120)
    when 'workout' then who || ' סיים אימון: ' || coalesce(new.body,'') || ' 💪'
    when 'pr' then who || ' שבר שיא! 🏅 ' || left(coalesce(new.body,''), 100)
    when 'join' then who || ' הצטרף לקבוצה 👋'
    when 'challenge' then who || ' פתח אתגר: ' || coalesce(new.body,'') || ' 🏆'
    else who end;
  insert into public.push_queue(user_id, title, body, kind)
    select m.user_id, g.emoji || ' ' || g.name, txt, 'social'
    from public.group_members m
    left join public.settings st on st.user_id = m.user_id
    where m.group_id = new.group_id and m.user_id is distinct from new.user_id
      and coalesce((st.prefs->'notif'->>'social')::boolean, true)
      and not exists(select 1 from public.push_queue q where q.user_id = m.user_id and q.kind = 'social' and q.created_at > now() - interval '20 seconds');
  return new;
exception when others then return new;
end $$;
create trigger nextrep_group_message_push after insert on public.group_messages for each row execute function public.on_group_message();

do $$ begin
  begin alter publication supabase_realtime add table public.group_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.message_reactions; exception when others then null; end;
end $$;

revoke all on function public.create_group(text,text), public.join_group(text), public.leave_group(uuid), public.my_groups(),
  public.group_info(uuid), public.group_board(uuid,bigint,bigint), public.create_challenge(uuid,text,text,numeric,int),
  public.group_challenges(uuid), public.post_pr(text), public.is_member(uuid) from public, anon;
grant execute on function public.create_group(text,text), public.join_group(text), public.leave_group(uuid), public.my_groups(),
  public.group_info(uuid), public.group_board(uuid,bigint,bigint), public.create_challenge(uuid,text,text,numeric,int),
  public.group_challenges(uuid), public.post_pr(text), public.is_member(uuid) to authenticated;
