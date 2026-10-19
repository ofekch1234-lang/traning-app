# Translation guide — NextRep (Hebrew fitness PWA → Arabic + English)

NextRep is a mobile gym app for Israelis: workout logging (sets/reps/weights, rest timer, PRs), training plans and a plan-builder wizard, nutrition logging (AI meal analysis, barcode, food database, calorie/protein goals), body tracking (weight, progress photos), social groups (chat, challenges, leaderboards), subscription/trial/payment screens, admin dashboard, onboarding tour, settings.

Each input item: {"he": "...", "pattern": true?}. Output a JSON object mapping the EXACT Hebrew string (unchanged, as key) to {"ar": "...", "en": "..."}.

Rules
- Keep placeholders {0} {1} … exactly; reorder them if grammar needs. Keep emojis, numbers, symbols (· × – → ✓ ›), leading/trailing punctuation and spacing style.
- Short UI language. Buttons short. Match the tone (friendly, motivating, direct).
- English: US spelling, sentence case for UI, address user as "you".
- Arabic: simple Modern Standard Arabic (فصحى مبسطة) as used in popular apps. Address the user in masculine singular unless the Hebrew string is explicitly feminine (e.g. "לאישה", "את") — then feminine. Western digits (0-9), never Arabic-Indic.
- Hebrew strings that mix both genders ("נרשם/ה", "את/ה") → English neutral; Arabic use "/ة" style or neutral phrasing.
- Fragments (single words, pieces split around {n}) must still translate sensibly in isolation, keep them short.
- If a string is not user-facing (a code identifier, regex text, SQL, log message, CSS) still translate it literally — harmless.
- Exercise names: English = standard gym names (e.g. "Barbell Bench Press", "Lat Pulldown", "Romanian Deadlift", "Hip Thrust", "Bulgarian Split Squat", "Face Pull"). Arabic = names commonly used by Arabic-speaking gym-goers (e.g. "ضغط الصدر بالبار", "سحب أمامي", "ديدلفت روماني", "هيب ثرست", "سكوات بلغاري"). Muscle groups: חזה Chest/الصدر, גב Back/الظهر, רגליים Legs/الأرجل, כתפיים Shoulders/الأكتاف, יד קדמית Biceps/البايسبس, יד אחורית Triceps/الترايسبس, בטן וליבה Abs & core/البطن والجذع, אירובי Cardio/الكارديو, ישבן Glutes/المؤخرة (الأرداف).

Glossary (use consistently)
| Hebrew | English | Arabic |
|---|---|---|
| אימון | workout | تدريب (حصة تدريب) |
| תרגיל | exercise | تمرين |
| סט / סטים | set / sets | مجموعة / مجموعات |
| חזרות | reps | تكرارات |
| מנוחה | rest | راحة |
| שיא / שיא אישי | PR / personal record | رقم قياسي |
| תוכנית / תוכניות (אימון) | plan / plans | برنامج / برامج |
| בנה לי תוכנית | Build my plan | ابنِ لي برنامجًا |
| תבנית | template | قالب |
| נפח | volume | الحجم |
| ק״ג | kg | كغ |
| גר׳ / גרם | g | غ |
| קק״ל | kcal | سعرة |
| חלבון / פחמימה / שומן | protein / carbs / fat | بروتين / كربوهيدرات / دهون |
| תזונה | Nutrition | التغذية |
| מעקב | Progress | المتابعة |
| בית | Home | الرئيسية |
| קבוצה / קבוצות | group / groups | مجموعة / مجموعات (in social context use "فريق/فرق" to avoid clash with sets) |
| אתגר | challenge | تحدٍّ |
| שקילה | weigh-in | وزن |
| תמונת התקדמות | progress photo | صورة التقدم |
| ניתוח AI | AI analysis | تحليل بالذكاء الاصطناعي |
| מנוי / מסלול | subscription / plan (billing) | اشتراك / باقة |
| תקופת ניסיון | free trial | فترة تجريبية |
| ניהול / לוח הניהול | admin / admin dashboard | الإدارة / لوحة الإدارة |
| הגדרות | Settings | الإعدادات |
| התראות | notifications | الإشعارات |
| מסך הבית (של הטלפון) | home screen | الشاشة الرئيسية |
| סנכרון | sync | مزامنة |
| ק״מ | km | كم |
| דק׳ | min | د |
| שנ׳ | sec | ث |
| שע׳ | h | س |
