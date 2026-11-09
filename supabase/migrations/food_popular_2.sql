-- Popular foods, round 2 (applied 2026-11-09, approved by the owner). Popular wordings taken from the site's
-- Google Search Console queries and common Israeli foods; each checked against search_foods first.
-- 'קולה' is a drink, not a brand: removed from food_brands and the brand flag recomputed for those rows.
delete from public.food_brands where name = 'קולה';
update public.foods set brand = public.food_brand_of(name, src) where name like '%קולה%';

update public.foods set alias = v.a from (values
 (2552,'פריכית אורז|פריכיות אורז'),(2556,'פריכית אורז מלא|פריכיות אורז מלא'),
 (9202,'עוגיית שוקולד צ׳יפס|עוגייה שוקולד צ׳יפס|עוגיות שוקולד צ׳יפס'),
 (1096,'נקניקיה|נקניקייה|נקניקיות|נקניקיית עוף'),
 (1122,'פסטרמה|פסטרמה הודו'),
 (9549,'חלב שקדים|משקה שקדים'),(1758,'חלב סויה|משקה סויה'),(10148,'חלב שיבולת שועל|חלב שועל|משקה שיבולת שועל|אוטמילק'),
 (130,'לבנה|לאבנה'),(8689,'לבנה 5%|לאבנה 5%'),
 (94,'לבן|לבן 3%'),
 (900008,'אורז בסמטי|אורז יסמין|אורז'),
 (900010,'מקרוני|פנה|ספגטי מבושל|פסטה'),
 (3079,'רול סושי|סושי|אונגירי'),
 (1572,'ביצה מקושקשת|ביצים מקושקשות|חביתה בשמן'),
 (3859,'קולסלו|סלט קולסלו|סלט כרוב'),
 (900038,'תפוח ירוק|תפוח אדום|תפוח'),
 (9816,'פיסטוק|פיסטוקים'),(8249,'פיסטוק קלוי בלי קליפה|פיסטוק קלוף'),
 (4843,'קולה|קוקה קולה|פפסי'),(4844,'קולה זירו|קוקה קולה זירו|דיאט קולה|קולה דיאט|פפסי מקס'),
 (9641,'רד בול|רדבול|רד בול זירו'),(8546,'רד בול רגיל|משקה אנרגיה'),
 (4908,'גטורייד|פאוורייד|משקה ספורט'),
 (1992,'צנים|צנימים'),
 (618,'אסאדו|שפונדרה|צלעות בקר'),
 (900020,'פרגיות|פרגיות על האש|פרגית על האש'),
 (900023,'סטייק סלמון|פילה סלמון|סלמון בתנור'),
 (1932,'לחמניית בגט|בגט|באגט'),
 (4387,'חמאה'),
 (900046,'שייק חלבון|וואי|חלבון')
) v(code,a) where foods.code = v.code;

insert into public.foods (code,name,name_en,name_ar,kcal,protein,carbs,fat,picks,generic,src) values
(900216,'יוגורט יווני 0%','Greek yogurt, plain, nonfat','زبادي يوناني خالي الدسم',59,10.2,3.6,0.39,0,true,'USDA SR Legacy FDC 170894 Yogurt, Greek, plain, nonfat'),
(900217,'יוגורט יווני 5%','Greek yogurt, plain, whole milk','زبادي يوناني كامل الدسم',97,9.0,3.98,5.0,0,true,'USDA SR Legacy FDC 171304 Yogurt, Greek, plain, whole milk'),
(900218,'קפה הפוך (חלב 3%)','Cafe hafuch (latte), 3% milk','قهوة بالحليب 3%',53.3,2.8,4.3,2.63,0,true,'composite: espresso 900103 30 g + milk 3% 900029 200 g'),
(900219,'קפה הפוך (חלב 1%)','Cafe hafuch (latte), 1% milk','قهوة بالحليب 1%',38.6,2.89,4.65,0.89,0,true,'composite: espresso 900103 30 g + milk 1% 9864 200 g'),
(900220,'עוף צלוי עם עור','Roast chicken, meat and skin','دجاج مشوي مع الجلد',239,27.3,0,13.6,0,true,'USDA SR Legacy 05009 Chicken, broilers or fryers, meat and skin, cooked, roasted'),
(900221,'לחם מחמצת','Sourdough bread','خبز العجين المخمر',272,10.75,51.88,2.42,0,true,'USDA SR Legacy 18029 Bread, french or vienna (includes sourdough)')
on conflict (code) do nothing;
update public.foods set alias='יוגורט יווני|יוגורט יווני 0%|יוגורט חלבון' where code=900216;
update public.foods set alias='יוגורט יווני מלא' where code=900217;
update public.foods set alias='קפה הפוך|הפוך|קפוצינו|לאטה|קפה עם חלב' where code=900218;
update public.foods set alias='הפוך דל|הפוך 1%|קפה הפוך דל' where code=900219;
update public.foods set alias='עוף בתנור|עוף צלוי|רבע עוף|עוף שלם' where code=900220;
update public.foods set alias='מחמצת|לחם שאור' where code=900221;

insert into public.food_units (code,unit,grams,is_default) values
(900216,600,150,true),(900216,300,30,false),(900216,700,1,false),
(900217,600,150,true),(900217,300,30,false),(900217,700,1,false),
(900218,200,230,true),(900218,104,330,false),(900218,700,1,false),
(900219,200,230,true),(900219,104,330,false),(900219,700,1,false),
(900220,800,200,true),(900220,801,120,false),(900220,700,1,false),
(900221,500,35,true),(900221,503,50,false),(900221,700,1,false)
on conflict (code,unit) do nothing;
