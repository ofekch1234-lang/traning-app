-- NextRep — App Store / Google Play subscriptions (RevenueCat). Not applied yet: run in the Supabase SQL editor before TestFlight purchase testing.
-- Written by the `revenuecat` edge function only (service role). Users can read their own row.

create table if not exists public.store_subs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  product      text,
  store        text,            -- app_store | play_store
  expires_at   timestamptz,
  will_renew   boolean not null default false,
  billing_issue boolean not null default false,
  period_type  text,            -- normal | trial | intro
  updated_at   timestamptz not null default now()
);
alter table public.store_subs enable row level security;
drop policy if exists "own store sub" on public.store_subs;
create policy "own store sub" on public.store_subs for select using (user_id = auth.uid());

-- my_plan: premium also counts an active store subscription.
-- Same function as today, with `store_until` folded into `untl` and a few store fields returned.
create or replace function public.my_plan()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare ua record; cfg jsonb := public.billing_cfg(); adm boolean; st text; untl timestamptz; en boolean; g jsonb; pm int; prem boolean; ss record;
begin
  adm := exists(select 1 from public.admins where user_id = auth.uid());
  select * into ua from public.user_access where user_id = auth.uid();
  select * into ss from public.store_subs where user_id = auth.uid();
  select value into g from public.app_config where key='grow';
  select p.months into pm from public.payments p where p.user_id = auth.uid() order by p.created_at desc limit 1;
  en := coalesce((cfg->>'enabled')::boolean,false)
        and exists(select 1 from jsonb_array_elements(cfg->'plans') x where coalesce(x->>'link','') <> '');
  untl := greatest(coalesce(ua.trial_until,'-infinity'), coalesce(ua.access_until,'-infinity'), coalesce(ss.expires_at,'-infinity'));
  st := case when adm then 'approved' when ua is null then 'pending' when ua.status<>'approved' then ua.status else 'approved' end;
  prem := adm or (st='approved' and untl > now());
  return jsonb_build_object('status', st, 'admin', adm, 'billing', en, 'premium', prem,
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
