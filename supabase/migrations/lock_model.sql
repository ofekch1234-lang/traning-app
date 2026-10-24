-- NextRep: web pricing + 7-day trial, then lock (view-only history) — same model as the store apps.
-- 1) prices 99 / 119 / 149, trial 7 days, lock on
update public.app_config set value = jsonb_set(jsonb_set(jsonb_set(value,
    '{plans}', (select jsonb_agg(case x->>'id'
        when '4m'  then (x - 'was') || '{"price":99}'::jsonb
        when '6m'  then (x - 'was') || '{"price":119}'::jsonb
        when '12m' then (x - 'was' - 'link_full') || jsonb_build_object('price',149,'link',coalesce(x->>'link_full',x->>'link'),'link_old',x->>'link')
        else x end) from jsonb_array_elements(value->'plans') x)),
    '{trial_days}', '7'::jsonb),
    '{lock}', 'true'::jsonb)
  where key = 'billing';

-- 2) my_plan: after the trial / paid period, status 'expired' (the app shows the paywall + view-only history)
create or replace function public.my_plan()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
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
  -- lock model: an approved user whose trial / subscription has ended (and who has started one) is locked
  if lck and st = 'approved' and not prem and untl <> '-infinity' then st := 'expired'; end if;
  return jsonb_build_object('status', st, 'admin', adm, 'billing', en, 'premium', prem, 'lock', lck,
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

-- 3) existing users who aren't premium right now: a full week from today, with a heads-up
with t as (
  update public.user_access ua set trial_until = now() + interval '7 days'
  where ua.status = 'approved' and ua.entered_at is not null
    and not exists(select 1 from public.admins a where a.user_id = ua.user_id)
    and greatest(coalesce(ua.trial_until,'-infinity'), coalesce(ua.access_until,'-infinity')) <= now()
  returning ua.user_id)
insert into public.push_queue(user_id,title,body,kind)
  select user_id,
    public.l3(user_id,'שבוע פרימיום מלא, עלינו 🎁','أسبوع بريميوم كامل علينا 🎁','A full Premium week, on us 🎁'),
    public.l3(user_id,'הכל פתוח לך ל-7 ימים, כולל ניתוח AI בכל ארוחה וקובי המאמן. אחרי השבוע ממשיכים עם מסלול.',
                      'كل شيء مفتوح لك لمدة 7 أيام، بما في ذلك تحليل الذكاء الاصطناعي لكل وجبة وكوبي المدرب. بعد الأسبوع تكمل باشتراك.',
                      'Everything is unlocked for 7 days, including AI analysis for every meal and Kobi the coach. After the week, continue with a plan.'),
    'billing'
  from t;
