// Public calculators (he/ar): daily calories (Mifflin-St Jeor, same formula as the app), BMI, protein. Used by build.js.
const C={
 he:{dir:'rtl',
  cal:{t:'מחשבון קלוריות יומי: כמה קלוריות לאכול ביום',h:'כמה קלוריות לאכול ביום?',d:'מחשבון קלוריות חינמי לפי נוסחת Mifflin-St Jeor: מין, גיל, גובה, משקל, רמת פעילות ומטרה. כולל יעד חלבון ופירוט מאקרו.',
   sex:'מין',m:'גבר',f:'אישה',age:'גיל',hh:'גובה (ס״מ)',w:'משקל (ק״ג)',act:'רמת פעילות',goal:'מטרה',cut:'ירידה במשקל',keep:'שמירה',bulk:'עלייה במסה',btn:'חשב',
   acts:[[1.2,'כמעט לא זז: עבודה מול מחשב, בלי אימונים'],[1.375,'פעילות קלה: 1–3 אימונים בשבוע'],[1.55,'פעיל: 3–5 אימונים בשבוע'],[1.725,'פעיל מאוד: 6–7 אימונים או עבודה פיזית'],[1.9,'ספורטאי: אימונים כבדים כל יום']],
   res:'היעד היומי שלך',kcal:'קלוריות ביום',prot:'גר׳ חלבון',carb:'גר׳ פחמימה',fat:'גר׳ שומן',tdee:n=>`הגוף שלך שורף בערך ${n} קק״ל ביום (TDEE). היעד למעלה כבר כולל את ההתאמה למטרה.`,
   wk:v=>v<0?`בקצב הזה: ירידה של כ-${Math.abs(v)} ק״ג בשבוע.`:v>0?`בקצב הזה: עלייה של כ-${v} ק״ג בשבוע.`:'שמירה על המשקל הנוכחי.',
   how:'איך המחשבון עובד',howT:'המחשבון מחשב קודם את חילוף החומרים הבסיסי (BMR) לפי נוסחת Mifflin-St Jeor, הנוסחה המדויקת ביותר למבוגרים בריאים. מכפילים ברמת הפעילות ומקבלים את ההוצאה היומית (TDEE). לירידה במשקל מורידים כ-20%, לעלייה במסה מוסיפים כ-12%. החלבון מחושב לפי משקל גוף רזה (1.7–2 גר׳ לק״ג) כדי לשמור על שריר, והשומן לא יורד מתחת ל-25% מהקלוריות. יש רצפה של 1,600 קק״ל לגברים ו-1,300 לנשים.',
   faq:[['כמה קלוריות צריך לאכול כדי לרדת במשקל?','בערך 20% פחות ממה שהגוף שורף ביום. לרוב האנשים זה 1,500–2,200 קק״ל, אבל זה תלוי במשקל, בגובה ובפעילות, ולכן המחשבון מחשב לך אישית.'],['האם 1,200 קלוריות ביום זה בסדר?','לרוב המבוגרים זה נמוך מדי: מאבדים שריר, הרעב גדל ובסוף מוותרים. ירידה של 0.5 ק״ג בשבוע מגרעון מתון מחזיקה הרבה יותר זמן.'],['כמה חלבון לאכול ביום?','1.6–2.2 גר׳ לכל ק״ג משקל גוף רזה למי שמתאמן. המחשבון מציג את המספר המותאם לך.'],['המספר מדויק?','זו הערכה טובה לנקודת התחלה. אחרי שבועיים משווים למשקל בפועל ומכוונים ב-100–200 קק״ל. בדיוק בשביל זה NextRep עוקבת אחרי שניהם.']],
   cta:'רוצה שנעקוב אחרי זה בשבילך?',ctaS:'NextRep שומרת לך את היעד, מצלמים את הצלחת ומקבלים קלוריות, ומראה כל שבוע אם המשקל זז לפי התוכנית.',ctaB:'להתחיל בחינם'},
  bmi:{t:'מחשבון BMI לנשים ולגברים: חישוב BMI ומשקל תקין לגובה',h:'מחשבון BMI',d:'חישוב BMI מדויק לפי גובה ומשקל, לנשים ולגברים. כולל טבלת BMI, טבלת משקל תקין לפי גובה, והסבר מה המספר אומר (ומה לא).',
   tblT:'טבלת BMI: מה המספר אומר',tblH:['BMI','סיווג'],tbl:[['מתחת ל-18.5','תת-משקל'],['18.5 עד 24.9','משקל תקין'],['25 עד 29.9','עודף משקל'],['30 עד 34.9','השמנה דרגה 1'],['35 עד 39.9','השמנה דרגה 2'],['40 ומעלה','השמנה דרגה 3']],
   hgtT:'טבלת משקל תקין לפי גובה',hgtS:'משקל שנותן BMI בין 18.5 ל-24.9. אותו טווח לנשים ולגברים.',hgtH:['גובה','משקל תקין'],cm:'ס״מ',kg:'ק״ג',to:'עד',
   sexT:'BMI לנשים ולגברים',sexP:'הנוסחה והטווחים זהים לנשים ולגברים מעל גיל 18. ההבדל הוא במה שה-BMI לא רואה: לנשים יש בממוצע יותר אחוז שומן באותו BMI, ולגברים יותר מסת שריר. לכן כדאי למדוד גם היקף מותניים: לפי ארגון הבריאות העולמי הסיכון עולה מ-80 ס״מ אצל נשים ומ-94 ס״מ אצל גברים, ועולה משמעותית מ-88 ומ-102 ס״מ.',
   kidT:'BMI לילדים ובני נוער',kidP:'עד גיל 18 לא משתמשים בטבלה של המבוגרים. ה-BMI משווה לילדים באותו גיל ומין (אחוזונים): מתחת לאחוזון 5 תת-משקל, 5 עד 85 תקין, 85 עד 95 עודף משקל, ומעל 95 השמנה. את זה כדאי לבדוק עם רופא הילדים.',
   exT:'איך מחשבים BMI: דוגמה',exP:'גובה 1.70 מטר ומשקל 70 ק״ג: 70 חלקי (1.70 × 1.70) = 70 חלקי 2.89 = 24.2. כלומר משקל תקין.',
   cats:[[18.5,'תת-משקל'],[25,'משקל תקין'],[30,'עודף משקל'],[99,'השמנה']],range:(a,b)=>`הטווח הבריא לגובה שלך: ${a} עד ${b} ק״ג`,
   howT:'BMI הוא המשקל בק״ג חלקי הגובה במטרים בריבוע. הוא כלי סינון סטטיסטי טוב לאוכלוסייה, אבל הוא לא מבדיל בין שריר לשומן: מתאמן שרירי יכול להיות "עודף משקל" לפי BMI ובריא לחלוטין. לכן כדאי להסתכל גם על היקף מותניים, על תמונות התקדמות ועל איך הבגדים יושבים.',
   faq:[['מה BMI תקין?','18.5 עד 24.9. מתחת לזה תת-משקל, 25–29.9 עודף משקל, ומעל 30 השמנה.'],['איך מחשבים BMI?','מחלקים את המשקל בק״ג בגובה במטרים בריבוע. לדוגמה, 70 ק״ג בגובה 1.70 מטר: 70 חלקי 2.89 = 24.2.'],['האם BMI שונה לנשים ולגברים?','לא. מעל גיל 18 הנוסחה והטווחים זהים. אצל ילדים ובני נוער משתמשים באחוזונים לפי גיל ומין.'],['מה המשקל התקין לגובה שלי?','משקל שנותן BMI בין 18.5 ל-24.9. למשל בגובה 1.65 מטר זה 50.5 עד 68 ק״ג, ובגובה 1.80 מטר 60 עד 80.5 ק״ג. הטבלה למעלה מראה כל גובה.'],['BMI מתאים למי שמתאמן עם משקולות?','פחות. שריר שוקל יותר משומן, ולכן BMI עלול להגזים. הרכב גוף ותמונות מראים תמונה מדויקת יותר.'],['איך יורדים ב-BMI?','גירעון קלורי מתון עם הרבה חלבון ואימוני כוח. ככה יורד שומן ולא שריר. המחשבון היומי שלנו נותן את המספרים.']],
   cta:'רוצה לראות את המגמה, לא רק מספר?',ctaS:'ב-NextRep שוקלים בבוקר, מצלמים פעם בשבוע ורואים גרף. המראה משקרת, הגרף לא.',ctaB:'להתחיל בחינם'},
  prot:{t:'מחשבון חלבון: כמה חלבון לאכול ביום לבניית שריר',h:'כמה חלבון לאכול ביום?',d:'מחשבון חלבון יומי לפי משקל, מטרה ורמת אימון, עם דוגמאות למקורות חלבון ישראליים וכמה חלבון יש בכל אחד.',
   goals:[['cut','ירידה במשקל (לשמור שריר)',2.0],['keep','שמירה והתחזקות',1.7],['bulk','בניית שריר',1.8],['none','לא מתאמן',1.0]],res:n=>`היעד שלך: כ-${n} גר׳ חלבון ביום`,per:'חלקו ל-3–4 ארוחות של 25–45 גר׳. הגוף מנצל חלבון טוב יותר כשהוא מפוזר לאורך היום.',
   src:'איפה משיגים את זה?',foods:[['חזה עוף בגריל (150 גר׳)',46],['טונה בשימורים (קופסה)',26],['קוטג׳ 5% (גביע 250)',28],['2 ביצים',13],['יוגורט יווני (גביע)',15],['עדשים מבושלות (כוס)',18],['טופו (150 גר׳)',18],['סקופ אבקת חלבון',24]],
   howT:'ההמלצה המקובלת למי שמתאמן עם משקולות היא 1.6–2.2 גר׳ חלבון לכל ק״ג משקל גוף. בירידה במשקל הולכים לחלק הגבוה, כי חלבון שומר על השריר ומשביע. למי שלא מתאמן מספיק כ-1 גר׳ לק״ג. במשקל גבוה מאוד מחשבים לפי משקל גוף רזה, לא לפי המשקל הכולל.',
   faq:[['אפשר לאכול יותר מדי חלבון?','לאדם בריא, עד 2.5 גר׳ לק״ג זה בטוח. מעבר לזה אין תועלת נוספת לשריר.'],['חלבון מהצומח מספיק?','כן, אם משלבים מקורות (קטניות עם דגנים, טופו, סייטן) ואוכלים קצת יותר, כי הספיגה נמוכה יותר.'],['צריך אבקת חלבון?','לא חובה. היא נוחה כשקשה להגיע ליעד מאוכל, אבל ביצים, עוף, קוטג׳ וטונה עושים את אותה עבודה.']],
   cta:'קשה לדעת אם הגעת ליעד?',ctaS:'מצלמים את הצלחת וNextRep סופרת את החלבון לבד, ומראה בסוף היום כמה חסר.',ctaB:'להתחיל בחינם'}},
 ar:{dir:'rtl',
  cal:{t:'حاسبة السعرات اليومية: كم سعرة تحتاج يوميًا',h:'كم سعرة حرارية تأكل يوميًا؟',d:'حاسبة سعرات مجانية وفق معادلة Mifflin-St Jeor: الجنس، العمر، الطول، الوزن، مستوى النشاط والهدف. مع هدف البروتين وتفصيل الماكرو.',
   sex:'الجنس',m:'رجل',f:'امرأة',age:'العمر',hh:'الطول (سم)',w:'الوزن (كغ)',act:'مستوى النشاط',goal:'الهدف',cut:'خسارة الوزن',keep:'الحفاظ',bulk:'زيادة الكتلة',btn:'احسب',
   acts:[[1.2,'قليل الحركة: عمل مكتبي بلا تمارين'],[1.375,'نشاط خفيف: 1–3 تمارين أسبوعيًا'],[1.55,'نشيط: 3–5 تمارين أسبوعيًا'],[1.725,'نشيط جدًا: 6–7 تمارين أو عمل بدني'],[1.9,'رياضي: تمارين شاقة يوميًا']],
   res:'هدفك اليومي',kcal:'سعرة يوميًا',prot:'غ بروتين',carb:'غ كربوهيدرات',fat:'غ دهون',tdee:n=>`جسمك يحرق نحو ${n} سعرة يوميًا (TDEE). الهدف أعلاه يشمل التعديل حسب هدفك.`,
   wk:v=>v<0?`بهذه الوتيرة: نزول نحو ${Math.abs(v)} كغ أسبوعيًا.`:v>0?`بهذه الوتيرة: زيادة نحو ${v} كغ أسبوعيًا.`:'الحفاظ على الوزن الحالي.',
   how:'كيف تعمل الحاسبة',howT:'تحسب الحاسبة أولًا معدل الأيض الأساسي (BMR) وفق معادلة Mifflin-St Jeor، الأدق للبالغين الأصحاء. ثم تضربه في مستوى النشاط للحصول على الإنفاق اليومي (TDEE). لخسارة الوزن نخفض نحو 20%، ولزيادة الكتلة نضيف نحو 12%. البروتين يُحسب حسب الكتلة الخالية من الدهون (1.7–2 غ/كغ) للحفاظ على العضل، والدهون لا تقل عن 25% من السعرات. الحد الأدنى 1,600 سعرة للرجال و1,300 للنساء.',
   faq:[['كم سعرة يجب أن آكل لأخسر الوزن؟','نحو 20% أقل مما يحرقه جسمك يوميًا. لمعظم الناس هذا 1,500–2,200 سعرة، لكنه يعتمد على الوزن والطول والنشاط، لذلك تحسب لك الحاسبة شخصيًا.'],['هل 1,200 سعرة يوميًا مناسبة؟','لمعظم البالغين هي قليلة جدًا: تخسر العضل ويزداد الجوع وتستسلم في النهاية. نزول 0.5 كغ أسبوعيًا من عجز معتدل يدوم أطول بكثير.'],['كم بروتين يوميًا؟','1.6–2.2 غ لكل كغ من الكتلة الخالية من الدهون لمن يتدرب. تعرض الحاسبة رقمك الخاص.'],['هل الرقم دقيق؟','تقدير جيد كنقطة بداية. بعد أسبوعين قارن بالوزن الفعلي وعدّل 100–200 سعرة. لهذا بالضبط يتابع NextRep الاثنين.']],
   cta:'أتريد أن نتابع ذلك عنك؟',ctaS:'يحفظ NextRep هدفك، تصوّر طبقك فتحصل على السعرات، ويريك كل أسبوع إن كان الوزن يتحرك وفق الخطة.',ctaB:'ابدأ مجانًا'},
  bmi:{t:'حاسبة BMI للنساء والرجال: مؤشر كتلة الجسم والوزن المثالي للطول',h:'حاسبة BMI',d:'حساب BMI دقيق حسب الطول والوزن للنساء والرجال، مع جدول BMI وجدول الوزن الطبيعي حسب الطول وشرح ما يعنيه الرقم (وما لا يعنيه).',
   tblT:'جدول BMI: ماذا يعني الرقم',tblH:['BMI','التصنيف'],tbl:[['أقل من 18.5','نقص الوزن'],['18.5 إلى 24.9','وزن طبيعي'],['25 إلى 29.9','زيادة الوزن'],['30 إلى 34.9','سمنة درجة 1'],['35 إلى 39.9','سمنة درجة 2'],['40 فأكثر','سمنة درجة 3']],
   hgtT:'جدول الوزن الطبيعي حسب الطول',hgtS:'الوزن الذي يعطي BMI بين 18.5 و24.9. النطاق نفسه للنساء والرجال.',hgtH:['الطول','الوزن الطبيعي'],cm:'سم',kg:'كغ',to:'إلى',
   sexT:'BMI للنساء والرجال',sexP:'المعادلة والنطاقات نفسها للنساء والرجال فوق 18 عامًا. الفرق فيما لا يراه BMI: لدى النساء في المتوسط نسبة دهون أعلى عند نفس BMI، ولدى الرجال كتلة عضلية أكبر. لذلك قِس محيط الخصر أيضًا: حسب منظمة الصحة العالمية يرتفع الخطر من 80 سم للنساء و94 سم للرجال، ويرتفع كثيرًا من 88 و102 سم.',
   kidT:'BMI للأطفال والمراهقين',kidP:'حتى سن 18 لا يُستخدم جدول البالغين. يُقارن BMI بأطفال من نفس العمر والجنس (المئينات): أقل من المئين 5 نقص وزن، من 5 إلى 85 طبيعي، من 85 إلى 95 زيادة وزن، وفوق 95 سمنة. يُفضّل فحص ذلك مع طبيب الأطفال.',
   exT:'كيف يُحسب BMI: مثال',exP:'طول 1.70 م ووزن 70 كغ: 70 مقسومًا على (1.70 × 1.70) = 70 ÷ 2.89 = 24.2. أي وزن طبيعي.',
   cats:[[18.5,'نقص الوزن'],[25,'وزن طبيعي'],[30,'زيادة الوزن'],[99,'سمنة']],range:(a,b)=>`النطاق الصحي لطولك: ${a} إلى ${b} كغ`,
   howT:'BMI هو الوزن بالكغ مقسومًا على مربع الطول بالمتر. أداة فرز إحصائية جيدة للسكان، لكنها لا تميّز بين العضل والدهون: متدرب عضلي قد يُصنّف "زائد الوزن" وهو سليم تمامًا. لذلك انظر أيضًا إلى محيط الخصر وصور التقدم وكيف تناسبك الملابس.',
   faq:[['ما هو BMI الطبيعي؟','18.5 إلى 24.9. أقل من ذلك نقص وزن، 25–29.9 زيادة وزن، وفوق 30 سمنة.'],['كيف يُحسب BMI؟','نقسم الوزن بالكغ على مربع الطول بالمتر. مثلًا 70 كغ بطول 1.70 م: 70 ÷ 2.89 = 24.2.'],['هل يختلف BMI بين النساء والرجال؟','لا. فوق 18 عامًا المعادلة والنطاقات نفسها. للأطفال والمراهقين تُستخدم المئينات حسب العمر والجنس.'],['ما الوزن المثالي لطولي؟','الوزن الذي يعطي BMI بين 18.5 و24.9. مثلًا بطول 1.65 م من 50.5 إلى 68 كغ، وبطول 1.80 م من 60 إلى 80.5 كغ. الجدول أعلاه يعرض كل طول.'],['هل يناسب BMI من يتدرب بالأوزان؟','أقل. العضل أثقل من الدهون فقد يبالغ BMI. تركيب الجسم والصور تعطي صورة أدق.'],['كيف أخفض BMI؟','عجز سعرات معتدل مع بروتين كثير وتمارين قوة. هكذا تنزل الدهون لا العضل. حاسبتنا اليومية تعطيك الأرقام.']],
   cta:'أتريد رؤية الاتجاه لا رقمًا فقط؟',ctaS:'في NextRep تزن صباحًا وتصوّر أسبوعيًا وترى رسمًا بيانيًا. المرآة تكذب، الرسم لا.',ctaB:'ابدأ مجانًا'},
  prot:{t:'حاسبة البروتين: كم بروتين يوميًا لبناء العضل',h:'كم بروتين تأكل يوميًا؟',d:'حاسبة بروتين يومية حسب الوزن والهدف ومستوى التدريب، مع أمثلة لمصادر بروتين محلية وكمية البروتين في كل منها.',
   goals:[['cut','خسارة الوزن (مع الحفاظ على العضل)',2.0],['keep','الحفاظ والتقوية',1.7],['bulk','بناء العضل',1.8],['none','لا أتدرب',1.0]],res:n=>`هدفك: نحو ${n} غ بروتين يوميًا`,per:'قسّمها على 3–4 وجبات من 25–45 غ. يستفيد الجسم من البروتين أكثر عند توزيعه على اليوم.',
   src:'من أين تحصل عليه؟',foods:[['صدر دجاج مشوي (150 غ)',46],['تونة معلبة (علبة)',26],['جبنة قريش 5% (علبة 250)',28],['بيضتان',13],['زبادي يوناني (علبة)',15],['عدس مطبوخ (كوب)',18],['توفو (150 غ)',18],['مغرفة بروتين',24]],
   howT:'التوصية الشائعة لمن يتدرب بالأوزان هي 1.6–2.2 غ بروتين لكل كغ من وزن الجسم. عند خسارة الوزن نتجه إلى الحد الأعلى لأن البروتين يحفظ العضل ويشبع. لمن لا يتدرب يكفي نحو 1 غ/كغ. عند الوزن المرتفع جدًا نحسب حسب الكتلة الخالية من الدهون لا الوزن الكلي.',
   faq:[['هل يمكن الإفراط في البروتين؟','للشخص السليم، حتى 2.5 غ/كغ آمن. بعد ذلك لا فائدة إضافية للعضل.'],['هل يكفي البروتين النباتي؟','نعم إذا جمعت المصادر (بقوليات مع حبوب، توفو، سيتان) وأكلت أكثر قليلًا لأن الامتصاص أقل.'],['هل أحتاج مسحوق البروتين؟','ليس ضروريًا. مريح عندما يصعب بلوغ الهدف من الطعام، لكن البيض والدجاج والجبن والتونة تؤدي العمل نفسه.']],
   cta:'يصعب معرفة إن بلغت هدفك؟',ctaS:'صوّر طبقك ويحسب NextRep البروتين تلقائيًا، ويريك في نهاية اليوم كم تبقى.',ctaB:'ابدأ مجانًا'}},
};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const APP=p=>`/?utm_source=seo&utm_medium=calc&utm_content=${p}`;
function page(HEAD,FOOT,l,kind,links){
  const t=C[l][kind], alts=['he','ar'].map(al=>[al,(al==='he'?'/calc/':'/ar/calc/')+(kind==='cal'?'':kind==='bmi'?'bmi':'protein')]);
  const canon=alts.find(a=>a[0]===l)[1];
  const faqLd={"@context":"https://schema.org","@type":"FAQPage","mainEntity":t.faq.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}}))};
  const cta=`<div class="cta"><img src="/img/kobi-happy.svg" alt=""><div style="flex:1"><b>${t.cta}</b><span>${t.ctaS}</span></div><a href="${APP(kind)}">${t.ctaB}</a></div>`;
  const faq=`<div class="card faq"><h2>FAQ</h2>${t.faq.map(([q,a],i)=>`<details${i?'':' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
  let how=`<div class="card"><h2>${l==='he'?'איך זה מחושב':'كيف يُحسب'}</h2><p style="font-size:14px;color:var(--mut)">${t.howT}</p></div>`;
  if(kind==='bmi'){ // the content people search for next to the calculator: the BMI table, healthy weight per height, women / men, children
    const hk=x=>(Math.round(x*2)/2).toString(), rows=[]; for(let cm=150;cm<=195;cm+=5){ const m=cm/100; rows.push([`${cm} ${t.cm}`,`${hk(18.5*m*m)} ${t.to} ${hk(24.9*m*m)} ${t.kg}`]); /* words, not a dash: a dash flips the numbers in right-to-left text */ }
    const tb=(h,r)=>`<table><tr>${h.map(x=>`<th style="text-align:start">${esc(x)}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(y=>`<td>${esc(y)}</td>`).join('')}</tr>`).join('')}</table>`;
    how=`<div class="card"><h2>${esc(t.tblT)}</h2>${tb(t.tblH,t.tbl)}</div>
<div class="card"><h2>${esc(t.hgtT)}</h2><p class="sub">${esc(t.hgtS)}</p>${tb(t.hgtH,rows)}</div>
<div class="card"><h2>${esc(t.exT)}</h2><p style="font-size:14px">${esc(t.exP)}</p></div>
<div class="card"><h2>${esc(t.sexT)}</h2><p style="font-size:14px;color:var(--mut)">${esc(t.sexP)}</p></div>
<div class="card"><h2>${esc(t.kidT)}</h2><p style="font-size:14px;color:var(--mut)">${esc(t.kidP)}</p></div>`+how; }
  let body='';
  if(kind==='cal'){ const c=C[l].cal;
    body=`<form class="card" id="f" onsubmit="return false">
<div class="grid2"><label>${c.sex}<select id="sex"><option value="m">${c.m}</option><option value="f">${c.f}</option></select></label><label>${c.age}<input id="age" type="number" min="14" max="90" value="30" inputmode="numeric"></label>
<label>${c.hh}<input id="h" type="number" min="130" max="220" value="${l==='he'?175:175}" inputmode="numeric"></label><label>${c.w}<input id="w" type="number" min="35" max="250" step="0.5" value="75" inputmode="decimal"></label></div>
<label>${c.act}<select id="act">${c.acts.map(([v,n],i)=>`<option value="${v}"${i===2?' selected':''}>${n}</option>`).join('')}</select></label>
<label>${c.goal}<select id="goal"><option value="cut">${c.cut}</option><option value="keep" selected>${c.keep}</option><option value="bulk">${c.bulk}</option></select></label>
<button class="btn" id="go">${c.btn}</button></form>
<div class="card res" id="res" hidden><h2>${c.res}</h2><div class="big"><b id="kc">0</b><span>${c.kcal}</span></div>
<div class="mac"><div><b id="pr">0</b><span>${c.prot}</span></div><div><b id="cb">0</b><span>${c.carb}</span></div><div><b id="ft">0</b><span>${c.fat}</span></div></div>
<p class="sub" id="td" style="margin-top:10px"></p><p id="wk" style="font-size:14px"></p></div>
<script>(function(){var $=function(i){return document.getElementById(i)};function calc(){var f=$('sex').value==='f',a=+$('age').value||30,h=+$('h').value||175,w=+$('w').value||75,act=+$('act').value||1.55,g=$('goal').value;
var bmr=10*w+6.25*h-5*a+(f?-161:5),tdee=bmr*act,adj=g==='cut'?-0.2:g==='bulk'?0.12:0;var kcal=Math.max(f?1300:1600,Math.round(tdee*(1+adj)/50)*50);
var lean=Math.min(w,27*Math.pow(h/100,2)),prot=Math.round(lean*(g==='cut'?2:g==='bulk'?1.8:1.7)/5)*5,fat=Math.round(Math.max(0.8*lean,kcal*0.25/9)),carb=Math.max(0,Math.round((kcal-prot*4-fat*9)/4)),wk=Math.round(tdee*adj*7/7700*10)/10;
$('kc').textContent=kcal.toLocaleString('en-US');$('pr').textContent=prot;$('cb').textContent=carb;$('ft').textContent=fat;$('td').textContent=${JSON.stringify(c.tdee('{n}'))}.replace('{n}',Math.round(tdee).toLocaleString('en-US'));
$('wk').textContent=wk<0?${JSON.stringify(c.wk(-1))}.replace('1',Math.abs(wk)):wk>0?${JSON.stringify(c.wk(1))}.replace('1',wk):${JSON.stringify(c.wk(0))};
$('res').hidden=false;$('res').scrollIntoView({behavior:'smooth',block:'nearest'});}
$('go').addEventListener('click',calc);['sex','age','h','w','act','goal'].forEach(function(i){$(i).addEventListener('change',function(){if(!$('res').hidden)calc();});});})();</script>`;
  } else if(kind==='bmi'){ const c=C[l].bmi;
    body=`<form class="card" onsubmit="return false"><div class="grid2"><label>${C[l].cal.hh}<input id="h" type="number" min="130" max="220" value="175" inputmode="numeric"></label><label>${C[l].cal.w}<input id="w" type="number" min="35" max="250" step="0.5" value="75" inputmode="decimal"></label></div><button class="btn" id="go">${C[l].cal.btn}</button></form>
<div class="card res" id="res" hidden><div class="big"><b id="v">0</b><span id="cat"></span></div><div class="bar"><i id="pin"></i></div><p class="sub" id="rng" style="margin-top:10px"></p></div>
<script>(function(){var $=function(i){return document.getElementById(i)};var CATS=${JSON.stringify(c.cats)};function calc(){var h=(+$('h').value||175)/100,w=+$('w').value||75,b=Math.round(w/(h*h)*10)/10;$('v').textContent=b;var cat='';for(var i=0;i<CATS.length;i++){if(b<CATS[i][0]){cat=CATS[i][1];break;}}$('cat').textContent=cat;
$('pin').style.insetInlineStart=Math.max(0,Math.min(100,(b-15)/(35-15)*100))+'%';var lo=Math.round(18.5*h*h*2)/2,hi=Math.round(24.9*h*h*2)/2;$('rng').textContent=${JSON.stringify(c.range('{a}','{b}'))}.replace('{a}',lo).replace('{b}',hi);$('res').hidden=false;}
$('go').addEventListener('click',calc);})();</script>`;
  } else { const c=C[l].prot;
    body=`<form class="card" onsubmit="return false"><div class="grid2"><label>${C[l].cal.w}<input id="w" type="number" min="35" max="250" step="0.5" value="75" inputmode="decimal"></label><label>${C[l].cal.goal}<select id="g">${c.goals.map(([v,n,k],i)=>`<option value="${k}"${i===1?' selected':''}>${n}</option>`).join('')}</select></label></div><button class="btn" id="go">${C[l].cal.btn}</button></form>
<div class="card res" id="res" hidden><h2 id="r"></h2><p class="sub">${c.per}</p></div>
<div class="card"><h2>${c.src}</h2><table>${c.foods.map(([n,g])=>`<tr><td>${esc(n)}</td><td></td><td>${g} ${l==='he'?'גר׳':'غ'}</td></tr>`).join('')}</table><p class="sub" style="margin-top:8px"><a href="${l==='he'?'/food/':'/ar/food/'}">${l==='he'?'לכל המאכלים במאגר ←':'كل الأطعمة في القاعدة ←'}</a></p></div>
<script>(function(){var $=function(i){return document.getElementById(i)};function calc(){var w=+$('w').value||75,k=+$('g').value;var lean=Math.min(w,w>110?0.8*w:w);var n=Math.round(lean*k/5)*5;$('r').textContent=${JSON.stringify(c.res('{n}'))}.replace('{n}',n);$('res').hidden=false;}
$('go').addEventListener('click',calc);})();</script>`;
  }
  const extra=`<script type="application/ld+json">${JSON.stringify(faqLd)}</script><style>.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:block;font-size:13px;color:var(--mut);margin-bottom:10px}input,select{display:block;width:100%;margin-top:4px;padding:11px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:var(--bg);color:var(--ink)}.btn{width:100%;padding:14px;border:0;border-radius:12px;background:var(--acc);color:#0A0B0A;font:inherit;font-size:17px;font-weight:700;cursor:pointer;margin-top:4px}.res{border-color:var(--acc)}.bar{position:relative;height:10px;border-radius:99px;margin-top:14px;background:linear-gradient(90deg,#60a5fa 0 17.5%,#22c55e 17.5% 50%,#f59e0b 50% 75%,#ef4444 75%)}.bar i{position:absolute;top:-5px;width:20px;height:20px;border-radius:50%;background:var(--ink);border:3px solid var(--sf);transform:translateX(-50%)}[dir=rtl] .bar{transform:scaleX(-1)}[dir=rtl] .bar i{transform:translateX(50%)}</style>`;
  return HEAD(l,t.t,t.d,canon,alts,extra)+`<div class="crumb"><a href="${l==='he'?'/food/':'/ar/food/'}">${l==='he'?'מאגר מזון':'قاعدة الأغذية'}</a> › ${esc(t.h)}</div><h1>${esc(t.h)}</h1><div class="sub">${esc(t.d)}</div>${body}${cta}${how}${faq}
<div class="links" style="margin-top:14px">${links(l)}</div>`+FOOT(l,alts);
}
module.exports={page,C};
