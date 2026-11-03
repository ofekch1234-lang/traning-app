-- free_ai_week (applied 2026-11-03): my_plan returns free_ai_week = billing.free_ai_per_week (2). When it is above 0,
-- free users get that many AI analyses per week (Sunday to Saturday) instead of free_ai_per_day per day (nutrition function).

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
    'free_ai_week', coalesce((cfg->>'free_ai_per_week')::int,0),
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
