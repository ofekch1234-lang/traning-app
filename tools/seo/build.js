// NextRep SEO pages — static food pages in he/ar/en built from tools/seo/foods.json (Ministry of Health table + our units).
// Run: node tools/seo/build.js  → writes dist/ (site copy + /food pages + sitemaps). Vercel runs this on deploy (vercel.json).
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'dist'),SITE='https://www.nextrep.co.il';
// Hebrew + Arabic only for now (English nutrition searches are dominated by global sites); skip survey aggregates (FFQ), zero-calorie items and baby formula
const LANGS=['he','ar'];
const foods=JSON.parse(fs.readFileSync(path.join(__dirname,'foods.json'),'utf8')).filter(f=>!/^\s*ffq/i.test(f.n)&&+f.k>0&&!/^(תמ"ל|תמ"י|תחליף חלב)/.test(f.n));
const UPDATED={he:'אוקטובר 2026',en:'October 2026',ar:'أكتوبر 2026'};

// ---------- categories (keyword rules on the Hebrew name) ----------
const CATS=[
 ['bread',['לחם','פיתה','לחמני','חלה','בייגל','קרקר','טורטי','לאפה','פריכי','צנים','בגט','מצה'],{he:'לחמים ומאפים',en:'Breads & bakery',ar:'خبز ومخبوزات'}],
 ['dairy',['גבינ','יוגורט','חלב','קוטג','לאבנה','שמנת','חמאה','מעדן','קפיר','מילקי','גבינת'],{he:'מוצרי חלב',en:'Dairy',ar:'منتجات الألبان'}],
 ['meat',['בשר','סטייק','עוף','הודו','קציצ','שניצל','נקניק','המבורגר','כבד','קבב','כנפי','שוק','חזה','צלי','פסטרמה','סלמי','טלה','אווז','ברווז'],{he:'בשר ועוף',en:'Meat & poultry',ar:'لحوم ودواجن'}],
 ['fish',['דג','טונה','סלמון','סרדין','הרינג','בקלה','אמנון','מושט','פורל','שרימפ','קלמרי'],{he:'דגים',en:'Fish & seafood',ar:'أسماك'}],
 ['eggs',['ביצה','ביצים','חביתה','שקשוקה'],{he:'ביצים',en:'Eggs',ar:'بيض'}],
 ['veg',['סלט','ירקות','כרוב','בצל','עגבני','פלפל','קישוא','חציל','גזר','פטרי','כרובית','תירס','עלי','מלפפון','חסה','תרד','ברוקולי','סלק','שום','אספרגוס','ארטישוק','במיה','שעועית ירוקה','דלעת','בטטה','תפוחי אדמה','תפוח אדמה','צנון','סלרי','קולרבי','שומר','פטרוזיליה','כוסברה','נבט'],{he:'ירקות',en:'Vegetables',ar:'خضروات'}],
 ['fruit',['תפוח','אגס','בננה','ענבים','תפוז','אבטיח','מלון','תות','אפרסק','שזיף','רימון','תמר','פירות','קלמנטינ','מנגו','אננס','קיווי','אבוקדו','משמש','דובדבן','פטל','אוכמני','לימון','אשכולית','תאנ','צימוק','פרי'],{he:'פירות',en:'Fruit',ar:'فواكه'}],
 ['legumes',['שעועית','אפונה','חומוס','עדשים','פול','סויה','טופו','גרגרי','טחינה','פלאפל','מג׳דרה','מג\'דרה'],{he:'קטניות',en:'Legumes',ar:'بقوليات'}],
 ['grains',['אורז','פתיתים','אטריות','פסטה','בורגול','קוסקוס','קינואה','דייס','דגני','שיבולת','קמח','בצק','ספגטי','נודלס','כוסמת','גריסים','סולת','פריכיות','גרנולה','קורנפלקס','מוזלי'],{he:'דגנים ופחמימות',en:'Grains & carbs',ar:'حبوب ونشويات'}],
 ['sweets',['עוגי','עוגת','עוגה','שוקולד','סוכרי','גלידה','שלגון','ופל','פאי','סירופ','ריבה','דבש','קרמבו','חלבה','בקלאווה','מאפין','דונאט','סופגני','קינוח','פודינג','ממתק','טופי','מרשמלו','בראוניז','טירמיסו'],{he:'מתוקים וקינוחים',en:'Sweets & desserts',ar:'حلويات'}],
 ['snacks',['חטיף','ביסלי','במבה','צ\'יפס','פופקורן','אפרופו','דוריטוס','תפוצ','בייגלה','פיצוחים'],{he:'חטיפים',en:'Snacks',ar:'وجبات خفيفة'}],
 ['drinks',['משקה','מיץ','נקטר','קפה','תה','קולה','בירה','יין','סודה','לימונדה','שייק','אנרגיה','וודקה','ויסקי','ערק','מים'],{he:'משקאות',en:'Drinks',ar:'مشروبات'}],
 ['nuts',['אגוז','שקדים','גרעיני','בוטנים','זרעי','חמאת בוטנים','פיסטוק','קשיו','פקאן','צנובר','שומשום','ציה','פשתן'],{he:'אגוזים וזרעים',en:'Nuts & seeds',ar:'مكسرات وبذور'}],
 ['fats',['שמן','מרגרינה','מיונז','רוטב','קטשופ','חרדל','ממרח','פסטו'],{he:'שמנים ורטבים',en:'Oils & sauces',ar:'زيوت وصلصات'}],
 ['soups',['מרק','חמין','צ\'ולנט'],{he:'מרקים ותבשילים',en:'Soups & stews',ar:'شوربات ويخنات'}],
 ['prepared',['פיצה','בורקס','פשטיד','לביב','קובה','כיסוני','סושי','שווארמה','סביח','מלאווח','ג\'חנון','ג׳חנון','טוסט','כריך','סנדוויץ','המבורגר','נאגטס','פנקייק','בלינצ','סמבוסק','ממולא','פאד','שקשוקה'],{he:'מנות מוכנות',en:'Prepared dishes',ar:'أطباق جاهزة'}],
 ['baby',['תמ"ל','תמ"י','תחליף חלב','דייסה לתינוק'],{he:'מזון תינוקות',en:'Baby food',ar:'طعام الأطفال'}],
];
const CAT_OTHER={he:'מאכלים נוספים',en:'Other foods',ar:'أطعمة أخرى'};
function catOf(name){ for(const [id,kw] of CATS){ for(const k of kw) if(name.includes(k)) return id; } return 'other'; }
const catName=(id,l)=>(CATS.find(c=>c[0]===id)||[0,0,CAT_OTHER])[2][l];

// ---------- i18n for the page chrome ----------
const T={
 he:{dir:'rtl',lang:'he',title:n=>`כמה קלוריות יש ב${n}? ערכים תזונתיים`,h1:n=>`כמה קלוריות יש ב${n}?`,sub:'ערכים תזונתיים לפי מאגר המזון הלאומי של משרד הבריאות ויחידות מדידה ביתיות. עודכן ',
   kcal:'קק״ל',in:(u,g)=>`קק״ל ב${u} (${g} גר׳)`,per100:'ל-100 גרם',prot:'גר׳ חלבון',carb:'גר׳ פחמימה',fat:'גר׳ שומן',byAmount:'לפי כמות',amount:'כמות',vs:n=>`${n} מול…`,
   ctaT:n=>`כמה ${n} מותר לך ביום?`,ctaS:'תלוי ביעד שלך. NextRep מחשבת לך יעד יומי של קלוריות וחלבון, ומצלמים את הצלחת במקום לחפש בטבלאות.',ctaB:'להתחיל בחינם',
   faq:'שאלות נפוצות',related:'מאכלים קרובים',home:'מאגר מזון',crumb:'מאגר מזון',calc:'מחשבון קלוריות יומי',calcBmi:'מחשבון BMI',calcProt:'מחשבון חלבון',
   indexT:'מאגר קלוריות וערכים תזונתיים למזון ישראלי',indexS:n=>`${n} מאכלים ומוצרים מהמאגר הלאומי של משרד הבריאות, עם יחידות אמיתיות: פיתה, כף, פרוסה, גביע. חפשו מאכל או בחרו קטגוריה.`,search:'חיפוש מאכל…',more:'עוד',
   footer:'הנתונים מבוססים על מאגר המזון הלאומי של משרד הבריאות ועל משקלי יחידות ממוצעים. הערכים משוערים ואינם תחליף לייעוץ תזונתי.',app:'NextRep: אפליקציית אימונים ותזונה. זוכרת כל סט, מצלמים ארוחה ומקבלים קלוריות, ומאמן AI אישי.',
   g:'גר׳',unitDefault:'מנה',staples:'מאכלים נפוצים'},
 en:{dir:'ltr',lang:'en',title:n=>`How many calories in ${n}? Nutrition facts`,h1:n=>`How many calories are in ${n}?`,sub:'Nutrition facts from the Israeli Ministry of Health food database, with real-life serving sizes. Updated ',
   kcal:'kcal',in:(u,g)=>`kcal per ${u} (${g} g)`,per100:'per 100 g',prot:'g protein',carb:'g carbs',fat:'g fat',byAmount:'By amount',amount:'Amount',vs:n=>`${n} vs…`,
   ctaT:n=>`How much ${n} fits your day?`,ctaS:'Depends on your goal. NextRep sets a daily calorie and protein target for you, and you snap a photo of your plate instead of searching tables.',ctaB:'Start free',
   faq:'FAQ',related:'Related foods',home:'Food database',crumb:'Food database',calc:'Daily calorie calculator',calcBmi:'BMI calculator',calcProt:'Protein calculator',
   indexT:'Calories & nutrition facts for Israeli foods',indexS:n=>`${n} foods and products from the Israeli national food database, with real serving sizes: a pita, a tablespoon, a slice, a cup. Search or pick a category.`,search:'Search a food…',more:'more',
   footer:'Data based on the Israeli Ministry of Health national food database and average serving weights. Values are estimates, not nutritional advice.',app:'NextRep: a workout & nutrition app. Remembers every set, counts calories from a photo of your meal, and includes a personal AI coach.',
   g:'g',unitDefault:'serving',staples:'Common foods'},
 ar:{dir:'rtl',lang:'ar',title:n=>`كم سعرة حرارية في ${n}؟ القيم الغذائية`,h1:n=>`كم سعرة حرارية في ${n}؟`,sub:'القيم الغذائية حسب قاعدة بيانات الأغذية لوزارة الصحة الإسرائيلية مع مقادير منزلية. تحديث ',
   kcal:'سعرة',in:(u,g)=>`سعرة في ${u} (${g} غ)`,per100:'لكل 100 غ',prot:'غ بروتين',carb:'غ كربوهيدرات',fat:'غ دهون',byAmount:'حسب الكمية',amount:'الكمية',vs:n=>`${n} مقابل…`,
   ctaT:n=>`كم ${n} يناسبك يوميًا؟`,ctaS:'يعتمد على هدفك. NextRep يحسب لك هدفًا يوميًا للسعرات والبروتين، وتصوّر طبقك بدل البحث في الجداول.',ctaB:'ابدأ مجانًا',
   faq:'أسئلة شائعة',related:'أطعمة مشابهة',home:'قاعدة الأغذية',crumb:'قاعدة الأغذية',calc:'حاسبة السعرات اليومية',calcBmi:'حاسبة BMI',calcProt:'حاسبة البروتين',
   indexT:'السعرات والقيم الغذائية للأطعمة المحلية',indexS:n=>`${n} طعامًا ومنتجًا من قاعدة بيانات وزارة الصحة، بمقادير حقيقية: خبزة، ملعقة، شريحة، كوب. ابحث أو اختر فئة.`,search:'ابحث عن طعام…',more:'المزيد',
   footer:'البيانات مبنية على قاعدة بيانات الأغذية الوطنية لوزارة الصحة وأوزان حصص متوسطة. القيم تقديرية وليست نصيحة غذائية.',app:'NextRep: تطبيق تمارين وتغذية. يتذكر كل مجموعة، يحسب السعرات من صورة وجبتك، ومعه مدرب ذكاء اصطناعي شخصي.',
   g:'غ',unitDefault:'حصة',staples:'أطعمة شائعة'},
};
const nameOf=(f,l)=>l==='he'?f.n:l==='en'?(f.e||f.n):(f.a||f.n);
const unitName=(u,l)=>l==='he'?u.u:l==='en'?(u.ue||u.u):(u.ua||u.u);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const r0=x=>Math.round(+x||0), r1=x=>Math.round((+x||0)*10)/10;
const nf=(x,l)=>r0(x).toLocaleString('en-US');
function slug(s){ return String(s).toLowerCase().replace(/["'״׳`]/g,'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,70); }
const pathOf=(f,l)=>l==='he'?`/food/${encodeURI(slug(f.n))}-${f.c}`:`/${l}/food/${encodeURI(slug(nameOf(f,l)))}-${f.c}`;
const catPath=(id,l)=>l==='he'?`/food/c/${id}`:`/${l}/food/c/${id}`;
const indexPath=l=>l==='he'?'/food/':`/${l}/food/`;

// ---------- derived data ----------
for(const f of foods){ f.cat=catOf(f.n); f.units=(f.un||[]).filter(u=>u.g>0&&u.g<=2000); f.def=f.units.find(u=>u.d)||null; }
const byCat={}; for(const f of foods)(byCat[f.cat]=byCat[f.cat]||[]).push(f);
function comparisons(f){
  const pool=(byCat[f.cat]||[]).filter(x=>x!==f);
  const score=x=>(x.g?-50:0)-(x.pk||0)*2+Math.abs(+x.k-+f.k)/10; // prefer staples + popular + close kcal
  const sorted=pool.slice().sort((a,b)=>score(a)-score(b));
  const lower=sorted.filter(x=>+x.k<+f.k).slice(0,3), higher=sorted.filter(x=>+x.k>=+f.k).slice(0,3);
  return [...lower,...higher].slice(0,6);
}
function profile(f){ const k=+f.k||1, p=(+f.p||0)*4/k, c=(+f.cb||0)*4/k, ft=(+f.ft||0)*9/k;
  return {hiP:p>=0.35,hiC:c>=0.55,hiF:ft>=0.5,low:+f.k<60,dense:+f.k>=400}; }

// ---------- auto copy per language (varies by macro profile so pages are not clones) ----------
const COPY={
 he:{
  intro:(n,f,u)=>{ const pr=profile(f); const base=u?`ב${unitName(u,'he')} אחת של ${n} (${u.g} גר׳) יש ${r0(f.k*u.g/100)} קלוריות`:`ב-100 גרם ${n} יש ${r0(f.k)} קלוריות`;
    const tail=pr.hiP?`. זה מקור חלבון טוב: ${r1(f.p)} גר׳ חלבון ל-100 גרם, כלומר רוב הקלוריות מגיעות מחלבון.`:pr.hiC?`, ורובן מפחמימות (${r1(f.cb)} גר׳ ל-100 גרם). מתאים לפני או אחרי אימון.`:pr.hiF?`, ורובן משומן (${r1(f.ft)} גר׳ ל-100 גרם), אז הכמות קובעת.`:pr.low?`. זה מאכל דל קלוריות, אפשר להרבות בו בלי לפגוע ביעד היומי.`:'.';
    return base+tail; },
  faq:(n,f,u)=>{ const pr=profile(f); const k100=r0(f.k), pct=Math.round((u?f.k*u.g/100:f.k)/2000*100);
    return [
     [`${n} משמין?`, `אף מאכל לא משמין בפני עצמו, מה שקובע הוא סך הקלוריות ביום. ${u?`${unitName(u,'he')} אחת`:'100 גרם'} של ${n} הם כ-${pct}% מתפריט של 2,000 קק״ל.${pr.dense?' זה מאכל צפוף בקלוריות, אז שימו לב לכמות.':pr.low?' זה מאכל דל קלוריות, שקשה להשמין ממנו.':''}`],
     [`כמה חלבון יש ב${n}?`, `${r1(f.p)} גר׳ חלבון ל-100 גרם${u?`, ו-${r1(f.p*u.g/100)} גר׳ ב${unitName(u,'he')} אחת`:''}. ${pr.hiP?'זה מקור חלבון משמעותי לבניית שריר.':'זה לא מקור חלבון משמעותי, כדאי לשלב עם עוף, ביצים, גבינה או קטניות.'}`],
     [`מה הערך התזונתי של ${n} ל-100 גרם?`, `${k100} קק״ל, ${r1(f.p)} גר׳ חלבון, ${r1(f.cb)} גר׳ פחמימות ו-${r1(f.ft)} גר׳ שומן. הערכים לפי מאגר המזון הלאומי של משרד הבריאות.`],
    ]; },
 },
 en:{
  intro:(n,f,u)=>{ const pr=profile(f); const base=u?`One ${unitName(u,'en')} of ${n} (${u.g} g) has ${r0(f.k*u.g/100)} calories`:`100 g of ${n} has ${r0(f.k)} calories`;
    const tail=pr.hiP?`. It's a good protein source: ${r1(f.p)} g protein per 100 g, so most of the calories come from protein.`:pr.hiC?`, mostly from carbs (${r1(f.cb)} g per 100 g). Good before or after a workout.`:pr.hiF?`, mostly from fat (${r1(f.ft)} g per 100 g), so portion size matters.`:pr.low?`. It's a low-calorie food you can eat freely without hurting your daily target.`:'.';
    return base+tail; },
  faq:(n,f,u)=>{ const pr=profile(f); const pct=Math.round((u?f.k*u.g/100:f.k)/2000*100);
    return [
     [`Is ${n} fattening?`, `No single food is fattening on its own; total daily calories are what count. ${u?`One ${unitName(u,'en')}`:'100 g'} of ${n} is about ${pct}% of a 2,000 kcal day.${pr.dense?' It is calorie-dense, so watch the amount.':pr.low?' It is low in calories and hard to overeat.':''}`],
     [`How much protein is in ${n}?`, `${r1(f.p)} g of protein per 100 g${u?`, and ${r1(f.p*u.g/100)} g per ${unitName(u,'en')}`:''}. ${pr.hiP?'A meaningful protein source for building muscle.':'Not a major protein source; pair it with chicken, eggs, cheese or legumes.'}`],
     [`What are the nutrition facts of ${n} per 100 g?`, `${r0(f.k)} kcal, ${r1(f.p)} g protein, ${r1(f.cb)} g carbs and ${r1(f.ft)} g fat, per the Israeli Ministry of Health food database.`],
    ]; },
 },
 ar:{
  intro:(n,f,u)=>{ const pr=profile(f); const base=u?`في ${unitName(u,'ar')} واحدة من ${n} (${u.g} غ) ${r0(f.k*u.g/100)} سعرة حرارية`:`في 100 غ من ${n} ${r0(f.k)} سعرة حرارية`;
    const tail=pr.hiP?`. وهو مصدر جيد للبروتين: ${r1(f.p)} غ بروتين لكل 100 غ، أي أن معظم السعرات من البروتين.`:pr.hiC?`، ومعظمها من الكربوهيدرات (${r1(f.cb)} غ لكل 100 غ). مناسب قبل التمرين أو بعده.`:pr.hiF?`، ومعظمها من الدهون (${r1(f.ft)} غ لكل 100 غ)، لذا الكمية هي الأساس.`:pr.low?`. طعام منخفض السعرات يمكنك الإكثار منه دون الإضرار بهدفك اليومي.`:'.';
    return base+tail; },
  faq:(n,f,u)=>{ const pr=profile(f); const pct=Math.round((u?f.k*u.g/100:f.k)/2000*100);
    return [
     [`هل ${n} يسبب السمنة؟`, `لا يسبب طعام بمفرده السمنة؛ المهم هو إجمالي السعرات اليومية. ${u?`${unitName(u,'ar')} واحدة`:'100 غ'} من ${n} تعادل نحو ${pct}% من نظام 2,000 سعرة.${pr.dense?' طعام كثيف السعرات، فانتبه للكمية.':pr.low?' طعام منخفض السعرات يصعب الإفراط فيه.':''}`],
     [`كم بروتين في ${n}؟`, `${r1(f.p)} غ بروتين لكل 100 غ${u?`، و${r1(f.p*u.g/100)} غ في ${unitName(u,'ar')} واحدة`:''}. ${pr.hiP?'مصدر بروتين مهم لبناء العضل.':'ليس مصدر بروتين رئيسيًا؛ اجمعه مع الدجاج أو البيض أو الجبن أو البقوليات.'}`],
     [`ما القيم الغذائية لـ${n} لكل 100 غ؟`, `${r0(f.k)} سعرة، ${r1(f.p)} غ بروتين، ${r1(f.cb)} غ كربوهيدرات و${r1(f.ft)} غ دهون، وفق قاعدة بيانات وزارة الصحة.`],
    ]; },
 },
};

// ---------- HTML ----------
const CSS=`:root{--bg:#F3F5F2;--sf:#fff;--sf2:#EAEEE9;--ink:#1A201C;--mut:#5D675F;--line:#DFE4DE;--acc:#16A34A;--soft:#DCFCE7}
@media(prefers-color-scheme:dark){:root{--bg:#131619;--sf:#1B2024;--sf2:#242A2E;--ink:#EDF1EE;--mut:#9AA5A0;--line:#2B3237;--acc:#22C55E;--soft:#17351F}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:Rubik,system-ui,sans-serif;color:var(--ink);line-height:1.5}a{color:inherit}
.top{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:var(--sf);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
.brand{font-family:'Inter Tight',sans-serif;font-weight:800;letter-spacing:-.045em;font-size:24px;direction:ltr;text-decoration:none;line-height:1}.brand b{color:var(--acc);font-weight:inherit}
.top .cta-s{background:var(--acc);color:#fff;border-radius:10px;padding:8px 14px;font-size:14px;font-weight:700;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:16px 16px 40px}.crumb{font-size:12.5px;color:var(--mut);margin-bottom:8px}.crumb a{text-decoration:none}
h1{font-family:Karantina,sans-serif;font-size:clamp(38px,9vw,56px);line-height:1;margin:0 0 6px}.sub{color:var(--mut);font-size:14px;margin-bottom:14px}
.card{background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:12px}
.big{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.big b{font-family:Karantina,sans-serif;font-size:64px;line-height:1;color:var(--acc)}.big span{color:var(--mut)}
.mac{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;text-align:center}.mac div{background:var(--sf2);border-radius:12px;padding:10px}.mac b{display:block;font-size:20px}.mac span{font-size:12px;color:var(--mut)}
h2{font-size:18px;margin:0 0 10px}p{margin:0 0 10px}
table{width:100%;border-collapse:collapse;font-size:15px}td,th{padding:9px 4px;border-top:1px solid var(--line);text-align:start}th{color:var(--mut);font-weight:500;font-size:13px;border-top:0}td:last-child{text-align:end;font-weight:700;white-space:nowrap}td:nth-child(2){color:var(--mut);font-size:13px}
.cmp a{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:14px;text-decoration:none}.cmp i{flex:1;height:8px;background:var(--sf2);border-radius:99px;overflow:hidden;display:block}.cmp i::after{content:"";display:block;height:100%;background:var(--acc);width:var(--w)}.cmp span:first-child{width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cmp b{width:56px;text-align:end}.cmp a.me{font-weight:700}
.cta{background:linear-gradient(135deg,#14532d,#16A34A);color:#fff;border-radius:16px;padding:18px;display:flex;gap:12px;align-items:center;margin-bottom:12px}.cta img{width:52px;height:52px;flex-shrink:0}.cta b{display:block;font-size:17px}.cta span{font-size:13.5px;opacity:.9}.cta a{background:#fff;color:#14532d;border-radius:10px;padding:10px 14px;font-weight:700;text-decoration:none;white-space:nowrap}
@media(max-width:480px){.cta{flex-wrap:wrap}.cta a{width:100%;text-align:center}}
.faq details{border-top:1px solid var(--line);padding:8px 0}.faq summary{font-weight:700;cursor:pointer}.faq p{margin:6px 0 0;font-size:14px;color:var(--mut)}
.links{display:flex;flex-wrap:wrap;gap:6px}.links a{background:var(--sf);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:13px;text-decoration:none}
.foot{color:var(--mut);font-size:12.5px;margin-top:24px;border-top:1px solid var(--line);padding-top:14px}.langs{display:flex;gap:10px;justify-content:center;margin-top:10px;font-size:13px}
.search{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;font-size:16px;background:var(--sf);color:inherit;margin:10px 0}
.list a{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line);text-decoration:none;font-size:15px}.list a b{color:var(--acc);white-space:nowrap}
.cats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media(min-width:600px){.cats{grid-template-columns:repeat(3,1fr)}}.cats a{background:var(--sf);border:1px solid var(--line);border-radius:12px;padding:12px;text-decoration:none}.cats small{display:block;color:var(--mut)}`;
const HEAD=(l,title,desc,canon,alts,extra='')=>`<!doctype html><html lang="${l}" dir="${T[l].dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${canon}">
${alts.map(([al,p])=>`<link rel="alternate" hreflang="${al}" href="${SITE}${p}">`).join('')}<link rel="alternate" hreflang="x-default" href="${SITE}${alts[0][1]}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${SITE}/icon-512.png"><meta name="theme-color" content="#16A34A"><meta name="google-site-verification" content="DSzgalUkvNBmbAsodxTRFc0sHzMPQaTsiP2vO3B87LI">
<link rel="icon" href="/icon-192.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Karantina:wght@700&family=Inter+Tight:wght@800&family=Rubik:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/food/food.css?v=1">${extra}</head><body>
<div class="top"><a class="brand" href="/">Next<b>Rep</b></a><a class="cta-s" href="/?utm_source=seo&utm_medium=food">${T[l].ctaB}</a></div><div class="wrap">`;
const FOOT=(l,alts)=>`<div class="foot">${T[l].footer}<br><br>${T[l].app}
<div class="langs">${alts.map(([al,p])=>`<a href="${p}" hreflang="${al}">${{he:'עברית',en:'English',ar:'العربية'}[al]}</a>`).join('')}</div></div></div></body></html>`;

const calcBase=l=>l==='he'?'/calc/':`/${l}/calc/`;
const calcLinks=l=>`<a href="${l==='he'?'/guide/':'/'+l+'/guide/'}">${l==='he'?'מדריכים':'أدلة'}</a><a href="${calcBase(l)}">${T[l].calc}</a><a href="${calcBase(l)}bmi">${T[l].calcBmi}</a><a href="${calcBase(l)}protein">${T[l].calcProt}</a>`;
function foodPage(f,l){
  const t=T[l], n=nameOf(f,l), u=f.def, alts=LANGS.map(al=>[al,pathOf(f,al)]), canon=pathOf(f,l);
  const kU=u?r0(f.k*u.g/100):r0(f.k), pU=u?r1(f.p*u.g/100):r1(f.p), cU=u?r1(f.cb*u.g/100):r1(f.cb), fU=u?r1(f.ft*u.g/100):r1(f.ft);
  const intro=COPY[l].intro(n,f,u), faq=COPY[l].faq(n,f,u), cmp=comparisons(f);
  const rows=[...f.units.map(x=>[unitName(x,l),x.g,r0(f.k*x.g/100)]),[t.per100,100,r0(f.k)]]; if(u)rows.push([`2 × ${unitName(u,l)}`,u.g*2,r0(f.k*u.g*2/100)]);
  const maxK=Math.max(+f.k,...cmp.map(x=>+x.k))||1;
  const title=t.title(n), desc=u?`${t.in(unitName(u,l),u.g)}: ${kU} ${t.kcal}. ${r1(f.p)} ${t.prot}, ${r1(f.cb)} ${t.carb}, ${r1(f.ft)} ${t.fat} ${t.per100}.`:`${r0(f.k)} ${t.kcal} ${t.per100}. ${r1(f.p)} ${t.prot}, ${r1(f.cb)} ${t.carb}, ${r1(f.ft)} ${t.fat}.`;
  const ld=[{"@context":"https://schema.org","@type":"NutritionInformation","name":n,"calories":`${kU} calories`,"servingSize":u?`${unitName(u,l)} (${u.g} g)`:"100 g","proteinContent":`${pU} g`,"carbohydrateContent":`${cU} g`,"fatContent":`${fU} g`},
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":faq.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}}))},
    {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":t.crumb,"item":SITE+indexPath(l)},{"@type":"ListItem","position":2,"name":catName(f.cat,l),"item":SITE+catPath(f.cat,l)},{"@type":"ListItem","position":3,"name":n}]}];
  return HEAD(l,title,desc,canon,alts,`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)+`
<div class="crumb"><a href="${indexPath(l)}">${t.crumb}</a> › <a href="${catPath(f.cat,l)}">${catName(f.cat,l)}</a> › ${esc(n)}</div>
<h1>${esc(t.h1(n))}</h1><div class="sub">${t.sub}${UPDATED[l]}.</div>
<div class="card"><div class="big"><b>${nf(kU)}</b><span>${u?t.in(esc(unitName(u,l)),u.g):`${t.kcal} ${t.per100}`}</span></div>
<div class="mac"><div><b>${pU}</b><span>${t.prot}</span></div><div><b>${cU}</b><span>${t.carb}</span></div><div><b>${fU}</b><span>${t.fat}</span></div></div>
${u?`<div style="font-size:13px;color:var(--mut);margin-top:10px">${t.per100}: ${r0(f.k)} ${t.kcal} · ${r1(f.p)} ${t.prot} · ${r1(f.cb)} ${t.carb} · ${r1(f.ft)} ${t.fat}</div>`:''}</div>
<p>${esc(intro)}</p>
${rows.length>1?`<div class="card"><h2>${t.byAmount}</h2><table><tr><th>${t.amount}</th><th></th><th></th></tr>${rows.map(([a,g,k])=>`<tr><td>${esc(a)}</td><td>${g} ${t.g}</td><td>${nf(k)} ${t.kcal}</td></tr>`).join('')}</table></div>`:''}
${cmp.length?`<div class="card cmp"><h2>${esc(t.vs(n))}</h2><div class="sub" style="margin-bottom:4px">${t.per100}</div>${[f,...cmp].sort((a,b)=>+a.k-+b.k).map(x=>`<a href="${pathOf(x,l)}" class="${x===f?'me':''}"><span>${esc(nameOf(x,l))}</span><i style="--w:${Math.round(+x.k/maxK*100)}%"></i><b>${nf(x.k)}</b></a>`).join('')}</div>`:''}
<div class="cta"><img src="/img/kobi-happy.svg" alt=""><div style="flex:1"><b>${esc(t.ctaT(n))}</b><span>${t.ctaS}</span></div><a href="/?utm_source=seo&utm_medium=food&utm_content=${f.c}">${t.ctaB}</a></div>
<div class="card faq"><h2>${t.faq}</h2>${faq.map(([q,a],i)=>`<details${i?'':' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
${cmp.length?`<h2 style="font-size:15px;color:var(--mut)">${t.related}</h2><div class="links">${cmp.map(x=>`<a href="${pathOf(x,l)}">${esc(nameOf(x,l))}</a>`).join('')}<a href="${catPath(f.cat,l)}">${esc(catName(f.cat,l))} ›</a></div>`:''}
<div class="links" style="margin-top:14px">${calcLinks(l)}</div>`+FOOT(l,alts);
}
function catPage(id,l){
  const t=T[l], list=(byCat[id]||[]).slice().sort((a,b)=>(b.g?1:0)-(a.g?1:0)||(b.pk||0)-(a.pk||0)||a.n.localeCompare(b.n)), alts=LANGS.map(al=>[al,catPath(id,al)]);
  const title=`${catName(id,l)} · ${t.indexT}`;
  return HEAD(l,title,t.indexS(list.length),catPath(id,l),alts)+`<div class="crumb"><a href="${indexPath(l)}">${t.crumb}</a> › ${esc(catName(id,l))}</div><h1>${esc(catName(id,l))}</h1><div class="sub">${list.length} · ${t.per100}</div>
<div class="card list">${list.map(f=>`<a href="${pathOf(f,l)}"><span>${esc(nameOf(f,l))}</span><b>${nf(f.k)} ${t.kcal}</b></a>`).join('')}</div>`+FOOT(l,alts);
}
function indexPage(l){
  const t=T[l], alts=LANGS.map(al=>[al,indexPath(al)]);
  const top=foods.filter(f=>f.g).slice().sort((a,b)=>a.n.localeCompare(b.n));
  return HEAD(l,t.indexT,t.indexS(foods.length),indexPath(l),alts)+`<h1>${t.indexT}</h1><div class="sub">${t.indexS(foods.length)}</div>
<input class="search" id="q" type="search" placeholder="${t.search}" autocomplete="off"><div class="card list" id="res" hidden></div>
<div class="cats">${[...CATS.map(c=>c[0]),'other'].filter(id=>byCat[id]?.length).map(id=>`<a href="${catPath(id,l)}">${esc(catName(id,l))}<small>${byCat[id].length}</small></a>`).join('')}</div>
<h2 style="margin-top:18px">${t.staples}</h2><div class="card list">${top.map(f=>`<a href="${pathOf(f,l)}"><span>${esc(nameOf(f,l))}</span><b>${nf(f.k)} ${t.kcal}</b></a>`).join('')}</div>
<script>(function(){var q=document.getElementById('q'),res=document.getElementById('res'),D=null;function go(){var v=q.value.trim().toLowerCase();if(!v){res.hidden=true;return;}if(!D){fetch('${indexPath(l)}index.json').then(function(r){return r.json()}).then(function(d){D=d;go();});return;}
var out=[];for(var i=0;i<D.length&&out.length<30;i++){if(D[i][0].toLowerCase().indexOf(v)>=0)out.push(D[i]);}res.innerHTML=out.map(function(x){return '<a href="'+x[2]+'"><span>'+x[0]+'</span><b>'+x[1]+' ${t.kcal}</b></a>'}).join('')||'<span style="color:var(--mut)">—</span>';res.hidden=false;}
q.addEventListener('input',go);})();</script>`+FOOT(l,alts);
}

// ---------- write ----------
function rmrf(p){ fs.rmSync(p,{recursive:true,force:true}); }
function cp(src,dst){ const st=fs.statSync(src); if(st.isDirectory()){ fs.mkdirSync(dst,{recursive:true}); for(const f of fs.readdirSync(src))cp(path.join(src,f),path.join(dst,f)); } else { fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.copyFileSync(src,dst); } }
function w(p,content){ const fp=path.join(OUT,decodeURI(p).replace(/\/$/,'/index.html')); const full=fp.endsWith('.html')||fp.endsWith('.xml')||fp.endsWith('.json')||fp.endsWith('.txt')?fp:fp+'.html'; fs.mkdirSync(path.dirname(full),{recursive:true}); fs.writeFileSync(full,content); }

rmrf(OUT); fs.mkdirSync(OUT,{recursive:true});
// site copy (everything except tooling/sources)
const SKIP=new Set(['dist','node_modules','.git','tools','supabase','.vercel','README.md','package.json','package-lock.json','vercel.json']);
for(const f of fs.readdirSync(ROOT)){ if(SKIP.has(f))continue; cp(path.join(ROOT,f),path.join(OUT,f)); }
let n=0; const urls={he:[],en:[],ar:[]};
for(const l of LANGS){
  for(const f of foods){ w(pathOf(f,l),foodPage(f,l)); urls[l].push(pathOf(f,l)); n++; }
  for(const id of [...CATS.map(c=>c[0]),'other']){ if(!byCat[id]?.length)continue; w(catPath(id,l),catPage(id,l)); urls[l].push(catPath(id,l)); }
  w(indexPath(l),indexPage(l)); urls[l].push(indexPath(l));
  w(indexPath(l)+'index.json',JSON.stringify(foods.map(f=>[nameOf(f,l),r0(f.k),pathOf(f,l)])));
}
// calculators
const calc=require('./calc.js'); const calcUrls=[];
for(const l of LANGS){ for(const [kind,p] of [['cal',''],['bmi','bmi'],['prot','protein']]){ const u=calcBase(l)+p; w(u||'/calc/',calc.page(HEAD,FOOT,l,kind,calcLinks)); calcUrls.push(u); } }
// guides
const guides=require('./guides.js'); const guideUrls=[];
for(const l of LANGS){ const all=guides.load(l); if(!all.length)continue; for(const g of all){ w(g.path,guides.page(HEAD,FOOT,l,g,all)); guideUrls.push(g.path); } w(guides.base(l),guides.index(HEAD,FOOT,l,all)); guideUrls.push(guides.base(l)); }
// sitemaps
const sm=list=>`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${list.map(u=>`<url><loc>${SITE}${u}</loc></url>`).join('')}</urlset>`;
for(const l of LANGS)w(`/sitemap-food-${l}.xml`,sm(urls[l]));
w('/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${LANGS.map(l=>`<sitemap><loc>${SITE}/sitemap-food-${l}.xml</loc></sitemap>`).join('')}<sitemap><loc>${SITE}/sitemap-pages.xml</loc></sitemap></sitemapindex>`);
w('/sitemap-pages.xml',sm(['/','/terms.html','/privacy.html','/accessibility.html',...calcUrls,...guideUrls]));
fs.writeFileSync(path.join(OUT,'food','food.css'),CSS);
w('/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('food pages:',n,'→',OUT);
