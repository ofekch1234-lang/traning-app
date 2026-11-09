-- Food search v2 (applied 2026-11-09). Approved by the owner.
-- 1. aliases ("|"-separated phrases) so common Israeli wordings find existing rows
-- 2. new generic foods (USDA SR Legacy, or composites of Israeli MoH Tzameret rows already in the DB)
-- 3. search_foods(q,lim,lang): spelling-tolerant (י/יי, ו/וו, geresh), first-word match first, brands demoted
--    and capped at 2 when generic results exist, unless the query names a brand.
-- Depends on food_brand_flag_and_norm (nr_norm, food_brands, foods.brand).
alter table public.foods add column if not exists alias text;

update public.foods set alias = v.a from (values
 (900001,'פיתה לבנה|פיתה רגילה|פיתה קטנה'),
 (1951,'פיתה קטנה|מיני פיתה'),
 (3024,'מלוואח|מלווח|מלאוח'),(3025,'מלוואח|מלווח|מלאוח'),
 (9817,'סופגנייה ריקה|סופגנייה בלי מילוי|סופגנייה ללא מילוי'),
 (3537,'לביבה|לביבות'),(3538,'לביבה|לביבות'),(9296,'לביבה|לביבות'),
 (1877,'גרעינים שחורים|גרעינים'),(1879,'גרעינים שחורים ללא מלח'),
 (1970,'לחמניית המבורגר|לחמנייה להמבורגר'),
 (900030,'חומוס מסעדה|צלחת חומוס|חומוס צלחת')
) v(code,a) where foods.code = v.code;
update public.foods set alias = 'צולנט|צ׳ולנט' where name like 'חמין%' and alias is null;

insert into public.foods (code,name,name_en,name_ar,kcal,protein,carbs,fat,picks,generic,src) values
(900209,'סופגנייה עם ריבה','Jelly doughnut (sufganiya)','سفنج محشو بالمربى',340,5.9,39.0,18.7,0,true,'USDA SR Legacy 18256 Doughnuts, yeast-leavened, with jelly filling'),
(900210,'סופגנייה במילוי קרם או שוקולד','Cream or chocolate filled doughnut','سفنج محشو بالكريمة أو الشوكولاتة',361,6.4,30.0,24.5,0,true,'USDA SR Legacy 18254 Doughnuts, yeast-leavened, with creme filling'),
(900211,'קרואסון חמאה','Butter croissant','كرواسون بالزبدة',406,8.2,45.8,21.0,0,true,'USDA SR Legacy 18239 Croissants, butter'),
(900212,'פלאפל בפיתה (מנה)','Falafel in pita','فلافل في خبز',212,6.5,28.0,7.5,0,true,'composite of Tzameret rows: pita 900001 80 g + falafel balls 1650 82 g + tahini salad 1887 30 g + vegetable salad 900036 60 g'),
(900213,'שווארמה בפיתה (מנה)','Chicken shawarma in pita','شاورما دجاج في خبز',204,13.3,18.0,8.6,0,true,'composite: pita 900001 80 g + chicken shawarma 900071 130 g + tahini salad 1887 30 g + vegetable salad 900036 50 g'),
(900214,'סביח בפיתה (מנה)','Sabich in pita','صبيح في خبز',160,5.9,18.2,6.7,0,true,'composite: pita 900001 80 g + fried eggplant 4199 80 g + hard-boiled egg 900015 50 g + tahini salad 1887 30 g + vegetable salad 900036 50 g'),
(900215,'טוסט גבינה צהובה','Yellow cheese toast','توست بالجبنة الصفراء',299,15.4,29.4,13.1,0,true,'composite: white bread 900003 60 g + yellow cheese 900027 40 g')
on conflict (code) do nothing;
update public.foods set alias='סופגניה ריבה|סופגנייה ריבה' where code=900209;
update public.foods set alias='סופגנייה שוקולד|סופגנייה קרם|סופגניה שוקולד' where code=900210;
update public.foods set alias='קרואסון' where code=900211;
update public.foods set alias='פלאפל|מנת פלאפל|פלאפל פיתה' where code=900212;
update public.foods set alias='שווארמה|שווארמה פיתה|מנת שווארמה' where code=900213;
update public.foods set alias='סביח|סביח פיתה' where code=900214;
update public.foods set alias='טוסט|טוסט גבינה' where code=900215;

insert into public.food_units (code,unit,grams,is_default) values
(900209,100,85,true),(900209,102,50,false),(900209,700,1,false),
(900210,100,90,true),(900210,700,1,false),
(900211,100,60,true),(900211,700,1,false),
(900212,800,252,true),(900212,1301,126,false),(900212,700,1,false),
(900213,800,290,true),(900213,1301,145,false),(900213,700,1,false),
(900214,800,290,true),(900214,1301,145,false),(900214,700,1,false),
(900215,100,100,true),(900215,700,1,false),
(900001,102,40,false),
(900030,1002,250,false)
on conflict (code,unit) do nothing;

create or replace function public.search_foods(q text, lim integer, lang text)
 returns table(code integer, name text, kcal numeric, protein numeric, fat numeric, carbs numeric, units jsonb)
 language sql stable set search_path to 'public','extensions' as $function$
  with L as (select case when lang in ('ar','en') and q !~ '[א-ת]' then lang else 'he' end as l),
       nq as (select nr_norm(trim(q)) as v),
       words as (select nr_norm(w) w from regexp_split_to_table(trim(q), '\s+') w where length(w) > 0),
       bq as (select exists (select 1 from public.food_brands b where length(b.name) >= 3 and (select v from nq) like '%' || nr_norm(b.name) || '%') as v),
       base as (select f.*, case (select l from L) when 'en' then coalesce(f.name_en, f.name) when 'ar' then coalesce(f.name_ar, f.name) else f.name end as sname,
                  case when (select l from L) = 'he' then string_to_array(nr_norm(f.alias), '|') end as al
                from public.foods f
                where not f.hidden and not exists (select 1 from public.food_flags x where x.code = f.code and x.hidden)),
       m as (
         select b.*, nr_norm(b.sname) as ns, similarity(b.sname, q) as sim,
           (b.brand and not (select v from bq)) as dem,
           (case when b.name ~ '(מיובש|אבקה|לא מבושל|גולמי|תרנגול הודו|תינוקות)' and q !~ '(מיובש|אבקה|גולמי|הודו|תינוק|dried|powder|raw|turkey|infant|مجفف|بودرة|ني|ديك رومي|رضع)' then 1 else 0 end) as pen
         from base b
         where (select bool_and(nr_norm(b.sname) like '%' || w || '%') from words)
            or (b.al is not null and exists (select 1 from unnest(b.al) a where (select bool_and(a like '%' || w || '%') from words)))),
       s as (
         select m.*,
           (m.ns = (select v from nq) or (select v from nq) = any(coalesce(m.al, '{}'))) as exact,
           (m.ns like (select v from nq) || '%' or exists (select 1 from unnest(coalesce(m.al,'{}')) a where a like (select v from nq) || '%')) as prefix,
           (left(m.ns, length((select v from nq))) = (select v from nq) and substr(m.ns, length((select v from nq)) + 1, 1) in ('', ' ', ',')) as fw
         from m),
       r as (
         select s.*, (s.generic and s.prefix) as genp,
           row_number() over (partition by s.dem order by s.exact desc, (s.generic and s.prefix) desc, s.fw desc, s.prefix desc, s.pen, s.picks desc, s.sim desc, length(s.sname)) as brn,
           count(*) filter (where not s.dem) over () as nonb
         from s),
       hits as (
         select * from r where not dem or brn <= 2 or nonb < 3
         order by exact desc, genp desc, fw desc, prefix desc, dem, pen, picks desc, sim desc, length(sname)
         limit least(greatest(lim, 1), 30))
  select h.code,
    case when lang = 'ar' then coalesce(h.name_ar, h.name) when lang = 'en' then coalesce(h.name_en, h.name) else h.name end,
    h.kcal, h.protein, h.fat, h.carbs,
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('u', case when lang='ar' then coalesce(u.name_ar,u.name) when lang='en' then coalesce(u.name_en,u.name) else u.name end, 'g', round(fu.grams::numeric, 1), 'd', case when fu.is_default then true end)) order by fu.grams)
              from public.food_units fu join public.units u on u.id = fu.unit
              where fu.code = h.code and u.name not in ('גרם','גרמים','100 גרם','קילוגרם')), '[]'::jsonb) as units
  from hits h
  order by h.exact desc, h.genp desc, h.fw desc, h.prefix desc, h.dem, h.pen, h.picks desc, h.sim desc, length(h.sname);
$function$;
drop function if exists public.search_foods_v2(text,integer,text);
