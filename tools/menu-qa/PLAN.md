# NextRep menu — QA plan (the bar for "professional")

Run: serve the repo root (`python3 -m http.server 8765`) and `node tools/menu-qa/check.js 8765 --samples`.
HARD rules must be 0. Soft rules should be rare and each one explainable.

## A. Portions — every item, every meal
- Inside the food's normal range (catalog mn..mx) and the meal cap (`mqMx`): breakfast/snack 1 can of tuna/sardines, 2 eggs (3 only in a big breakfast), meat/fish at breakfast ≤ ~1.25 servings.
- Countable foods in whole units (eggs, bread slices, dates, fruit); pita/tuna in halves at most. No "3½ eggs", no "17 olives".
- Fat per meal ≤ 2 normal servings (2 tsp oil, 2 tbsp tahini, 30 g nuts). One fruit unit per meal; ≤ 3 fruits a day.
- No meal above ~950 kcal (add a meal instead). Snack 80–350 kcal and never bigger than lunch.

## B. Units shown to the user
- Meat and fish: grams only (a "steak"/"fillet"/"serving" unit varies too much). Cans/slices are fine.
- Household amount + grams + kcal on every row; the meal header kcal = sum of rows; squares = round(kcal/100).
- "100 kcal = …" in the picker must be a believable amount.

## C. Composition — a dietitian would serve it
- Lunch/dinner: protein + starch + vegetable (+ optional fat). One starch per meal unless the dish needs two.
- Breakfast salty or sweet, coherent (no tuna + peanut butter). Snacks: protein + fruit/starch, or a sensible single item.
- Lunch and dinner use different main proteins.

## D. Day
- kcal within ±4% of the target (hard limit 7%). Protein ≥ 90% of target for omnivores (vegetarian/vegan reported, not failed).
- ≥ 300 g vegetables. Breakfast 15–35% of the day.

## E. Diet style & allergies
- Kosher: never meat with dairy in one meal. Vegetarian/vegan/pescatarian and allergies never violated — in the engine, the picker, "another meal" and AI results.

## F. Repi (AI) text
- Applies diet rules silently (never lectures about kosher etc.), plain Hebrew/Arabic/English with no foreign words, short.
- Eating out: honest about the budget (a burger in a bun is usually more than one meal's squares) with 1–2 concrete ways to fit.

## G. UI
- Same checks in he/en/ar; no untranslated strings; nothing overflows at 390 px.
