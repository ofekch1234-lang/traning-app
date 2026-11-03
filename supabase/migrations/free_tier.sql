-- Free tier (applied 2026-11-03 as migration free_tier):
--  * billing.free_tier=true: after the trial the app stays open (training, manual food logging, barcode, groups);
--    the client gates the coach, Repi, AI analysis (free_ai_per_day=0, enforced in the nutrition function),
--    the menu and recipes, more than 4 saved plans and charts older than 90 days. my_plan returns free_tier.
--  * referrals: the invited friend gets the regular trial (ref_trial_days=0); the inviter gets nothing on the
--    first friend who starts training a Premium week once (ref_join_once.sql), and 30 days when a friend pays.

create or replace function public.my_plan()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare ua record; cfg jsonb := public.billing_cfg(); adm boolean; st text; untl timestamptz; en boolean; g jsonb; pm int; prem boolean; ss record; lck boolean;
begin
  adm := exists(select 1 from public.admins where user_id = auth.uid());
  select * into ua from public.user_access where user_id = auth.uid();
  select * into ss from public.store_subs where user_id = auth.uid();
  select value into g from public.app_config where key='grow';
  select p.months into pm from public.payments p where p.user_id = auth.uid() order by p.created_at desc limit 1;
  en := coalesce((cfg->>'enabled')::boolean,false)
        and exists(select 1 from jsonb_array_elements(cfg->'plans') x where coalesce(x->>'link','') <> '');
  lck := coalesce((cfg->>'lock')::boolean,false);
  untl := greatest(coalesce(ua.trial_until,'-infinity'), coalesce(ua.access_until,'-infinity'), coalesce(ss.expires_at,'-infinity'));
  st := case when adm then 'approved' when ua is null then 'pending' when ua.status<>'approved' then ua.status else 'approved' end;
  prem := adm or (st='approved' and untl > now());
  if lck and st = 'approved' and not prem and untl <> '-infinity' then st := 'expired'; end if;
  return jsonb_build_object('status', st, 'admin', adm, 'billing', en, 'premium', prem, 'lock', lck,
    'free_tier', coalesce((cfg->>'free_tier')::boolean,false),
    'free_ai_day', coalesce((cfg->>'free_ai_per_day')::int,1),
    'paid', coalesce(ua.access_until > now(), false) or coalesce(ss.expires_at > now(), false),
    'gift', coalesce(ua.access_until > now(), false) and not exists(select 1 from public.payments p where p.user_id = auth.uid()) and not coalesce(ss.expires_at > now(), false),
    'gift_days', (select coalesce(sum(days),0) from public.referral_rewards rr where rr.referrer = auth.uid()),
    'until', case when untl = '-infinity' then null else untl end,
    'trial_until', ua.trial_until, 'access_until', ua.access_until,
    'store_until', ss.expires_at, 'store_renews', coalesce(ss.will_renew,false), 'store', ss.store,
    'days_left', case when untl = '-infinity' or untl <= now() then null else greatest(0, ceil(extract(epoch from (untl - now()))/86400))::int end,
    'plan_months', pm,
    'grow', coalesce(g->>'pageCode','') <> '' and coalesce(g->>'userId','') <> '',
    'support', cfg->>'support',
    'plans', cfg->'plans');
end $function$;

create or replace function public.ref_join(p_uid uuid)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare r uuid; jdays int := coalesce((public.billing_cfg()->>'ref_join_days')::int, 7); nm text;
begin
  update public.user_access set ref_joined_at = now() where user_id = p_uid and ref is not null and ref_joined_at is null returning ref into r;
  if r is null then return; end if;
  nm := coalesce(public.display_name(p_uid), public.l3(r,'חבר','صديق','A friend'));
  if public.ref_is_paying(r) or jdays <= 0 then
    insert into public.push_queue(user_id,title,body,kind) values (r,
      public.l3(r, nm || ' התחיל להתאמן 💪', nm || ' بدأ التمرّن 💪', nm || ' started training 💪'),
      public.l3(r,'כשירכוש מנוי, תקבל חודש פרימיום חינם.','عندما يشترك، تحصل على شهر بريميوم مجاني.','When they subscribe, you get a free Premium month.'),'social');
  else
    update public.user_access set trial_until = greatest(coalesce(trial_until, now()), coalesce(access_until, now()), now()) + make_interval(days => jdays) where user_id = r;
    insert into public.push_queue(user_id,title,body,kind) values (r,
      public.l3(r,'קיבלת שבוע פרימיום 🎁','حصلت على أسبوع بريميوم 🎁','You got a Premium week 🎁'),
      public.l3(r, nm || ' התחיל להתאמן. וכשיצטרף למנוי, תקבל חודש חינם.', nm || ' بدأ التمرّن. وعندما يشترك ستحصل على شهر مجاني.', nm || ' started training. When they subscribe, you get a free month.'),'social');
  end if;
exception when others then null;
end $function$;

update public.app_config set value = value || '{"free_tier": true, "free_ai_per_day": 0, "ref_trial_days": 0, "ref_join_days": 7}'::jsonb where key = 'billing';
