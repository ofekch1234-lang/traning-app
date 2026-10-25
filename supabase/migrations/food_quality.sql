-- Food DB quality (applied 2026-10-25): separate coffee types, hide merged/duplicate rows, guard future imports.
-- Additive only: no existing food row or unit row is changed or deleted. Rows that should not appear are listed
-- in food_flags and every reader (search, swaps, similar foods, SEO export) skips them. Saved meals store their
-- own values and are not touched.
--
-- Sources (per 100 g; 1 ml of these drinks ~ 1 g)
--   Espresso  : USDA FoodData Central, SR Legacy FDC 171891 "Beverages, coffee, brewed, espresso, restaurant-prepared"
--               9 kcal, protein 0.12 g, fat 0.18 g, carbs 1.67 g, sugars 0 g
--   Decaf esp.: USDA FDC 171892 (espresso, restaurant-prepared, decaffeinated) - same composition
--   Filter    : USDA FDC SR Legacy 171890 "Beverages, coffee, brewed, prepared with tap water"
--               1 kcal, protein 0.12 g, fat 0.02 g, carbs 0 g
--   Americano : 2 espresso shots (60 ml, FDC 171891) + 180 ml water (0 kcal) = 240 ml
--               = espresso x 0.25: 2.25 kcal, protein 0.03 g, fat 0.05 g, carbs 0.42 g
--   Black/Turkish, unsweetened: USDA has no unsweetened Turkish coffee (FNDDS 92101600 "Coffee, Turkish"
--               contains sugar). Values follow the Israeli Ministry of Health table (Tzameret 4803), which gives
--               unsweetened Turkish/black coffee the espresso composition.

-- 1. columns used by future imports (the guard below) and provenance
alter table public.foods add column if not exists hidden boolean not null default false;
alter table public.foods add column if not exists hidden_reason text;
alter table public.foods add column if not exists src text;

-- 2. flags for existing rows
create table if not exists public.food_flags (
  code integer primary key references public.foods(code) on delete cascade,
  hidden boolean not null default true,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.food_flags enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'food_flags' and policyname = 'food_flags_read') then
    create policy food_flags_read on public.food_flags for select using (true);
  end if;
end $$;

-- 3. serving units
insert into public.units (id, name, name_en, name_ar) values
  (1310, 'שוט', 'shot', 'شوت'),
  (1311, 'שוט כפול', 'double shot', 'شوت مزدوج')
on conflict (id) do nothing;

-- 4. curated coffee items (generic = shown first when the name starts with the search)
insert into public.foods (code, name, name_en, name_ar, kcal, protein, carbs, fat, picks, generic, src) values
  (900103, 'קפה אספרסו', 'Espresso', 'إسبريسو', 9, 0.12, 1.67, 0.18, 0, true, 'USDA FDC 171891'),
  (900104, 'קפה אספרסו כפול', 'Double espresso', 'إسبريسو مزدوج', 9, 0.12, 1.67, 0.18, 0, true, 'USDA FDC 171891'),
  (900105, 'קפה שחור / טורקי, ללא סוכר', 'Black (Turkish) coffee, unsweetened', 'قهوة سوداء (تركية) بدون سكر', 9, 0.12, 1.67, 0.18, 0, true, 'Israel MoH Tzameret 4803 (espresso composition); USDA has no unsweetened Turkish coffee'),
  (900106, 'קפה פילטר', 'Filter coffee', 'قهوة مفلترة', 1, 0.12, 0, 0.02, 0, true, 'USDA FDC 171890'),
  (900107, 'קפה אמריקנו', 'Americano', 'أمريكانو', 2.25, 0.03, 0.42, 0.05, 0, true, 'USDA FDC 171891 x 2 shots (60 ml) in 240 ml'),
  (900108, 'קפה אספרסו נטול קפאין', 'Decaf espresso', 'إسبريسو منزوع الكافيين', 9, 0.12, 1.67, 0.18, 0, true, 'USDA FDC 171892 (espresso, restaurant-prepared, decaffeinated) = same composition as 171891')
on conflict (code) do nothing;
insert into public.food_units (code, unit, grams, is_default) values
  (900103, 1310, 30, true),  (900103, 1311, 60, false), (900103, 700, 1, false),
  (900104, 1311, 60, true),  (900104, 700, 1, false),
  (900105, 200, 150, true),  (900105, 700, 1, false),
  (900106, 200, 240, true),  (900106, 202, 300, false), (900106, 700, 1, false),
  (900107, 200, 240, true),  (900107, 202, 350, false), (900107, 700, 1, false),
  (900108, 1310, 30, true),  (900108, 1311, 60, false), (900108, 700, 1, false)
on conflict (code, unit) do nothing;

-- 5. what gets hidden
insert into public.food_flags (code, reason) values
  (4803, 'merged: espresso + Turkish/black in one row with a 240 ml cup serving; replaced by 900103/900104/900105'),
  (4804, 'decaf espresso with 240/250 ml cup servings; replaced by 900108 (shot / double shot)')
on conflict (code) do nothing;
insert into public.food_flags (code, reason)          -- frequency-questionnaire rows: "all kinds of X" by design
select code, 'FFQ survey aggregate (several foods in one row)' from public.foods where name ~* '^\s*FFQ'
on conflict (code) do nothing;
insert into public.food_flags (code, reason)          -- exact duplicates: keep curated, then most picked, then lowest code
select code, 'duplicate of ' || keep from (
  select code, row_number() over w rn, first_value(code) over w keep
  from public.foods f where not exists (select 1 from public.food_flags x where x.code = f.code)
  window w as (partition by name, kcal, protein, carbs, fat order by generic desc, picks desc nulls last, code)) r
where rn > 1
on conflict (code) do nothing;

-- 6. readers skip hidden rows
--    search_foods(q, lim, lang): base CTE gets
--      where not f.hidden and not exists (select 1 from public.food_flags x where x.code = f.code and x.hidden)
--    (ranking unchanged). food_alts / food_alts2 / similar_foods / public_foods_export get the same filter:
do $$
declare d text; s text;
begin
  foreach d in array array[
    'public.food_alts(numeric,numeric,numeric,numeric,text,integer,integer,text,integer[],text)',
    'public.food_alts2(numeric,numeric,numeric,numeric,text,integer,integer,text,integer[],text,text)',
    'public.similar_foods(numeric,numeric,numeric,numeric,text,integer,integer,text,integer[])'] loop
    s := pg_get_functiondef(d::regprocedure);
    if position('food_flags' in s) = 0 then
      execute replace(s, 'where f.kcal >= 15', 'where not f.hidden and not exists (select 1 from public.food_flags x where x.code = f.code and x.hidden) and f.kcal >= 15');
    end if;
  end loop;
  s := pg_get_functiondef('public.public_foods_export(integer,integer)'::regprocedure);
  if position('food_flags' in s) = 0 then
    execute replace(s, 'from public.foods f order by', 'from public.foods f where not f.hidden and not exists (select 1 from public.food_flags x where x.code = f.code and x.hidden) order by');
  end if;
  s := pg_get_functiondef('public.search_foods(text,integer,text)'::regprocedure);
  if position('food_flags' in s) = 0 then
    execute replace(s, 'else f.name end as sname from public.foods f)',
      'else f.name end as sname from public.foods f where not f.hidden and not exists (select 1 from public.food_flags x where x.code = f.code and x.hidden))');
  end if;
end $$;

-- 7. import guard: FFQ rows and exact duplicates of a visible row arrive hidden
create or replace function public.foods_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.name ~* '^\s*FFQ' then
    new.hidden := true; new.hidden_reason := coalesce(new.hidden_reason, 'FFQ survey aggregate (several foods in one row)');
  elsif not new.hidden and exists (
    select 1 from public.foods o
    where o.code <> new.code and not o.hidden and not exists (select 1 from public.food_flags x where x.code = o.code and x.hidden)
      and o.name = new.name
      and o.kcal is not distinct from new.kcal and o.protein is not distinct from new.protein
      and o.carbs is not distinct from new.carbs and o.fat is not distinct from new.fat) then
    new.hidden := true; new.hidden_reason := 'duplicate (import guard)';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'foods_guard' and tgrelid = 'public.foods'::regclass) then
    create trigger foods_guard before insert on public.foods for each row execute function public.foods_guard();
  end if;
end $$;

-- 8. audit view for a human look (nothing is changed automatically)
create or replace view public.food_audit with (security_invoker = true) as
select f.code, f.name, f.kcal, f.protein, f.carbs, f.fat, x.issue
from public.foods f
cross join lateral (values
  (case when f.kcal >= 20 and abs(f.kcal - (4*coalesce(f.protein,0) + 4*coalesce(f.carbs,0) + 9*coalesce(f.fat,0))) > greatest(20, f.kcal*0.25)
          and f.name !~* '(אלכוהול|יין|בירה|ליקר|וודקה|ויסקי|alcohol|wine|beer|liqueur|סיבים|fiber|ממתיק|sweetener|סוכרלוז|מלטיטול)'
        then 'kcal does not match 4P+4C+9F' end),
  (case when f.name ~* '(אספרסו|espresso)' and exists (select 1 from public.food_units u where u.code=f.code and u.grams > 120 and u.unit not in (700,2000))
        then 'espresso with a serving above 120 ml' end),
  (case when f.name ~ '(כולל|/)' and f.name ~* '(מוכן|prepared)' and f.name ~* '(קפה|תה|coffee|tea)'
        then 'one row for several preparation methods' end)
) x(issue)
where x.issue is not null and not f.hidden and not exists (select 1 from public.food_flags ff where ff.code = f.code and ff.hidden);

-- Rollback (if ever needed): delete from public.food_flags;  -- every hidden row shows again
