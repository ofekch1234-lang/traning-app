-- ai_bias (applied 2026-11-08): what users' own corrections say about the meal-photo AI's amounts.
-- Each saved meal item keeps a0 = [AI grams, normalized AI name] (index.html, saveMealDraft). For each AI name with
-- 15+ corrections from 5+ users in the last 120 days, the median of saved grams / AI grams (clipped to 0.6-1.5).
-- The app scales the AI's grams for that food by it (factors within 8% of 1 are ignored). Only aggregates leave the
-- function; no user's meals are exposed.
create or replace function public.ai_bias()
returns table(k text, f numeric, n int)
language sql stable security definer set search_path to ''
as $$
  with it as (
    select m.user_id, i->'a0'->>1 as k, (i->'a0'->>0)::numeric as g0, (i->>'g')::numeric as g1
    from public.meals m, jsonb_array_elements(case when jsonb_typeof(m.items)='array' then m.items else '[]'::jsonb end) i
    where m.d > current_date - 120 and jsonb_typeof(i->'a0')='array'
      and (i->'a0'->>0) ~ '^[0-9]+(\.[0-9]+)?$' and (i->>'g') ~ '^[0-9]+(\.[0-9]+)?$')
  select k, round(least(1.5, greatest(0.6, percentile_cont(0.5) within group (order by g1/g0)))::numeric, 2), count(*)::int
  from it
  where g0 > 0 and g1 > 0 and g1/g0 between 0.2 and 5 and coalesce(k,'') <> ''
  group by k
  having count(*) >= 15 and count(distinct user_id) >= 5
$$;
revoke all on function public.ai_bias() from public, anon;
grant execute on function public.ai_bias() to authenticated;
