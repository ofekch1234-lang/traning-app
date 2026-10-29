// NextRep — nutrition analysis via Claude (verify_jwt: true — רק משתמשים מחוברים)
import { createClient } from "npm:@supabase/supabase-js@2";

// רק Haiku 5.5 — בלי גיבוי למודל יקר יותר. אם הוא לא זמין, הניתוח נכשל והמשתמש מופנה לחיפוש במאגר.
const MODELS = ["claude-haiku-5-5"];
// Anchor portions for common Israeli foods (edible, ready-to-eat weight). The Hebrew names match the app's food
// database, so items named like this get the database values and household units on the client.
const REF = `Anchors (name weight kcal):
eggs: ביצה קשה 50g 75 · חביתה/ביצת עין from 1 egg ~100 incl. 3g oil, 2 eggs ~190, 3 eggs oily ~300
dairy: גבינה בולגרית is dense: 3cm cube 25-30g, small piece 30-40g, large 60-80g; 5% 110/100g, 16% 200/100g · גבינה לבנה 5% tbsp 20g 18 · לבנה tbsp 25g 40 · קוטג' 5% tbsp 25g 24, tub 250g 245 · גבינה צהובה slice 20g 70 · יוגורט 3% cup 200g 120
bread: לחם מלא/לחם לבן slice 30g 75 · light slice 22g 45 · פיתה 90g 240 · לאפה 120g 330 · לחמנייה 70g 190 · חלה slice 40g 110 · טורטייה 60g 180
spreads: טחינה (prepared, as served on plates) tbsp 20g 60; טחינה גולמית tbsp 15g 90 · חומוס tbsp 30g 70, restaurant plate 250g 570 · מיונז tbsp 15g 100 · קטשופ tbsp 17g 20 · ממרח שוקולד tbsp 20g 110 · שמן זית tsp 5g 45, tbsp 13g 120 · חמאה tsp 5g 36 · דבש tsp 7g 21 · סוכר tsp 5g 20
produce: אבוקדו quarter 40g 65 · עגבנייה 120g 22 · מלפפון 100g 15 · סלט ירקות bowl 150g 30 without oil · בננה peeled 100g 90-105 · תפוח עץ 150g 80 · תמר מג'הול 20g 65
cooked starch (cup 160g, tbsp 20g): אורז לבן מבושל 130/100g · פתיתים מבושלים 150 · קוסקוס מבושל 112 · פסטה מבושלת 158 · בורגול מבושל 83 · קינואה מבושלת 120 · תפוח אדמה 150g 130 · צ'יפס serving 120g 375
protein: חזה עוף בגריל palm-size 120g 200 · פרגית בגריל 100g 210 · שניצל עוף 130g 340 · קציצה 50g 110 · סטייק 200g 450 · סלמון אפוי 150g 310 · שווארמה עוף 150g 320 · פלאפל ball 17g 57 · טונה במים can 112g 130
street/bakery: פלאפל בפיתה ~650 · שווארמה בפיתה ~650, בלאפה ~800 · סביח בפיתה ~650 · בורקס גבינה 90g 340 · מלוואח 1 ~420 · ג'חנון 150g 450 · pizza slice 110g 330 · קרואסון חמאה 65g 290 · רוגלך 30g 125 · cookie 12g 55
drinks: הפוך/latte 250ml with 3% milk 120 (large 350ml 170) · black coffee/tea 2, sugar tsp +20 · מיץ תפוזים 240ml 110 · cola 250ml 105, zero/diet 1 · חלב 3% 240ml 145 · cereal cup 35g 130`;

const SYSTEM = `You are an Israeli clinical dietitian. The user describes a meal in text or a photo. Reply with valid JSON only:
{"name":"short meal name","items":[{"name":"item","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}]}
Optional item fields:
- count, unit: only for whole countable units (eggs, slices, pitas, patties, schnitzels, fruits, dates, snack units). count = number of units, unit = plural unit name in the user's language ("ביצים", "פרוסות"); grams and kcal cover all units together. Add "sure":false only when the count is uncertain (an omelette of 1 or 2 eggs). Omit for rice, salad, sauce, a cheese chunk.
- alt, altk: only when a common look-alike variant differs in calories: טונה במים/בשמן, לחם לבן/מלא, גבינה לבנה 5%/9%, קוטג' 5%/3%, משקה רגיל/זירו, יוגורט 3%/0%, חלב 3%/1%, טחינה/טחינה גולמית when the kind is unclear. name = the likelier variant, alt = the other variant's name, altk = its kcal for the same amount. Omit when the variant is certain (package, or the user said).
Names: plain generic Israeli names with the preparation, like the anchors ("חזה עוף בגריל", "אורז לבן מבושל", "סלט ירקות", "טחינה"); a brand only if visible; no amounts or brackets in names.
Amounts: an amount the user gave (grams, units, spoons) is exact. Otherwise one average adult portion, not a heaped one. Whole numbers. kcal ≈ 4×protein + 4×carbs + 9×fat (+7 per g alcohol).
Hidden calories count: frying oil, dressings, sauces, butter. Restaurant and takeaway portions are larger and oilier than home ones.
Drinks and alcohol are items (skip plain water). Alcohol: add 7 kcal per g alcohol, protein and fat usually 0; a "כוס"/shot of spirits = 40ml, wine glass 150ml, beer bottle 330ml.
Only when the text is not food or drink at all: {"name":"","items":[]}.
${REF}`;

const PHOTO = `
PHOTO, be precise:
1. One item per separate component on the plate (each vegetable, side, sauce, spread, bread, drink); don't merge different components and don't skip small ones. A dish whose parts can't be seen apart (שקשוקה, מג'דרה, a closed sandwich or stuffed pita) is one item.
2. Count units first (eggs, slices, cubes, balls), then size each item against known objects: dinner plate 26cm (restaurant 28-30), side plate 20cm, fork 19cm, tablespoon bowl 4cm, pita 16cm, tuna can 8.5cm, a hand. Usually one person's portion: with several plates, analyze the main plate in front unless the user says otherwise. Estimate what is visible. Between two reasonable estimates take the lower; never round up.
3. Fats: include oil, sauces and fatty dressings that are visible or implied by cooking (fried, roasted in oil, mayo, tahini). A glossy sheen, drops or a yellowish pool on cheese, salad, vegetables or the plate rim = olive oil: add it as its own item "שמן זית" (small drizzle tsp 5g 45, generous tbsp 13g 120) so the user can remove it. Omelette, fried egg, shakshuka, stir-fry: a little pan oil inside the item (~3g per egg, ~5g for 2-3 eggs); more only if oil is plentiful or deep-fried.
4. Omelette eggs: 1 egg = thin (~0.5cm), 14-16cm, about half a dinner plate; 2 eggs = most of the plate or ~1cm thick (visible when folded); 3 = thick and wider than the plate. Fried eggs and shakshuka: count the yolks (certain). If 1 vs 2 is unclear, give the likelier count with sure:false.
5. Israeli products: salty white cheese in cubes or crumbles at an Israeli breakfast = "גבינה בולגרית" (16% unless known; dense, a small-looking piece is 30-40g, not 80-100), not feta unless a feta package is visible. Soft spreadable white cheese = "גבינה לבנה"; sliced yellow = "גבינה צהובה". Tahini on a plate = prepared tahini.
6. Tuna: in oil is darker and softer, flakes glossy and oily, sometimes yellowish oily liquid; in water is pale, dry and matte with separate flakes. Choose by these signs (don't default to water) and always give alt.
7. Values printed on a package or bottle in the photo (kcal, protein, volume) are used as printed. A packaged snack or single unit (wafer, chocolate bar, biscuit, yogurt): name the brand and product if possible and use its real unit weight; small snacks usually weigh 8-15g, not 20+.
8. Drinks by vessel: glass 250ml, tall glass 330, mug 300, espresso cup 40, wine pour 150, beer 330/500.
9. The user's description overrides what you see.`;


const LABEL = `אתה קורא טבלאות סימון תזונתי של מוצרים ישראליים. בתמונה יש טבלה תזונתית ו/או אריזה.
החזר אך ורק JSON תקין: {"name":"שם המוצר","brand":"יצרן או null","kcal":מספר,"protein":מספר,"carbs":מספר,"fat":מספר,"serving_g":מספר או null}
כל הערכים ל-100 גרם (או 100 מ"ל). אם הטבלה מציגה רק למנה — חשב ל-100 גרם. אם אין טבלה תזונתית קריאה — החזר {"error":"no_label"}.`;

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // אימות המשתמש מול Supabase (הגנה כפולה מעבר ל-verify_jwt)
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    // רק משתמשים שאושרו ע"י האדמין
    const { data: ok } = await sb.rpc("is_approved");
    if (ok !== true) return new Response(JSON.stringify({ error: "not_approved" }), { status: 403, headers: cors });

    const body = await req.json();
    // מכסה חודשית (חודש קלנדרי, שעון ישראל) + תקרה יומית נגד ניצול לרעה. אדמין — בלי הגבלה.
    const LIM = { photo: { month: 300, day: 40 }, text: { month: 600, day: 50 } };
    const isPhoto = !!body.image;
    const L = isPhoto ? LIM.photo : LIM.text, kinds = isPhoto ? ["photo", "label"] : ["text"];
    const { data: plan } = await sb.rpc("my_plan");
    const isAdmin = !!(plan as { admin?: boolean } | null)?.admin;
    const isPremium = isAdmin || !!(plan as { premium?: boolean } | null)?.premium;
    let usedMonth = 0;
    // חינם: ניתוח AI אחד ביום (צילום, טקסט או תווית יחד), לפי יום קלנדרי בשעון ישראל
    let freeLeft: number | null = null;
    if (!isPremium) {
      const FREE_DAY = Math.max(0, Number((plan as { free_ai_day?: number } | null)?.free_ai_day ?? 1));
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const dayStart = new Date(today + "T00:00:00+03:00").toISOString();
      const { count } = await sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("kind", ["photo", "label", "text"]).gte("created_at", dayStart);
      if ((count ?? 0) >= FREE_DAY) return new Response(JSON.stringify({ error: "quota", free: true, period: "day", limit: FREE_DAY }), { status: 429, headers: cors });
      freeLeft = FREE_DAY - (count ?? 0) - 1;
    }
    if (!isAdmin) {
      const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(new Date());
      const monthStart = new Date(ymd + "-01T00:00:00+03:00").toISOString();
      const [m, d] = await Promise.all([
        sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("kind", kinds).gte("created_at", monthStart),
        sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("kind", kinds).gte("created_at", new Date(Date.now() - 864e5).toISOString()),
      ]);
      usedMonth = m.count ?? 0;
      if (usedMonth >= L.month) return new Response(JSON.stringify({ error: "quota", kind: isPhoto ? "photo" : "text", period: "month", limit: L.month }), { status: 429, headers: cors });
      if ((d.count ?? 0) >= L.day) return new Response(JSON.stringify({ error: "quota", kind: isPhoto ? "photo" : "text", period: "day", limit: L.day }), { status: 429, headers: cors });
    }
    const leftAfter = isAdmin ? null : L.month - usedMonth - 1;
    const content: unknown[] = [];
    const isLabel = !!body.label;
    // שפת המשתמש: שמות המאכלים/המוצר חוזרים בשפה שלו (הוא יכול לכתוב בכל שפה)
    const LANG_NOTE: Record<string, string> = {
      ar: "\nחשוב: כתוב את כל השמות (name ושמות הפריטים) בערבית ספרותית פשוטה. המשתמש עשוי לכתוב בכל שפה.",
      en: "\nחשוב: כתוב את כל השמות (name ושמות הפריטים) באנגלית. המשתמש עשוי לכתוב בכל שפה.",
    };
    const langNote = LANG_NOTE[String(body.lang || "")] || "\nכתוב את כל השמות בעברית.";
    if (body.image) {
      content.push({ type: "image", source: { type: "base64", media_type: body.media || "image/jpeg", data: body.image } });
      content.push({ type: "text", text: isLabel ? "קרא את הסימון התזונתי." : "נתח את הארוחה שבתמונה." + (body.hint ? " תיאור מהמשתמש: " + String(body.hint).slice(0, 200) : "") });
    } else if (body.text && String(body.text).length <= 600) {
      content.push({ type: "text", text: "הארוחה / Meal: " + String(body.text) });
    } else {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: cors });
    }

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "no_api_key" }), { status: 500, headers: cors });

    let lastErr = "";
    // the edge runtime kills a request at 150s: never wait for the model longer than that.
    // photos: one try with medium reasoning (55s), then a fast low-effort retry (50s).
    // static blocks first, each a prompt-cache breakpoint (text and photo share the SYSTEM prefix; blocks under the
    // model's minimum cacheable length are simply not cached), then the per-language note, which is never cached
    const C = { type: "ephemeral" };
    const sys = [
      ...(isLabel ? [{ type: "text", text: LABEL }] : [{ type: "text", text: SYSTEM, cache_control: C }, ...(body.image ? [{ type: "text", text: PHOTO, cache_control: C }] : [])]),
      { type: "text", text: langNote.trim() + "\nהחזר JSON קומפקטי בשורה אחת." },
    ];
    const call = (model: string, effort: string, ms: number) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: effort === "medium" ? 4000 : 2500, system: sys, messages: [{ role: "user", content }], output_config: { effort } }),
      signal: AbortSignal.timeout(ms),
    });
    for (const model of MODELS) {
      const t0 = Date.now();
      let r!: Response;
      try { r = await call(model, body.image && !isLabel ? "medium" : "low", body.image ? 55000 : 40000); }
      catch (e) {
        console.log(JSON.stringify({ ev: "nutrition-timeout", ms: Date.now() - t0, err: String(e).slice(0, 80) }));
        try { r = await call(model, "low", 50000); }
        catch (e2) { lastErr = "timeout " + String(e2).slice(0, 80); break; }
      }
      if (r.status === 404) { lastErr = await r.text(); console.log(JSON.stringify({ ev: "model-fallback", from: model, err: lastErr.slice(0, 160) })); continue; } // מודל לא קיים — ננסה את הבא
      if (!r.ok) { lastErr = await r.text(); break; }
      const out = await r.json();
      // רישום שימוש: מודל, טוקנים ועלות — לניתוח עלויות אמיתי
      const PRICES: Record<string, [number, number]> = { "claude-haiku-5-5": [0.10, 0.50], "claude-haiku-4-5-20251001": [1, 5] };
      const [pi, po] = PRICES[model] || [1, 5];
      // input_tokens excludes cached tokens: cache writes cost 1.25x, cache reads 0.1x. ai_usage keeps the full prompt size.
      const u = out.usage || {}, cw = u.cache_creation_input_tokens || 0, cr = u.cache_read_input_tokens || 0;
      const it = (u.input_tokens || 0) + cw + cr, ot = u.output_tokens || 0;
      const cost = ((u.input_tokens || 0) * pi + cw * pi * 1.25 + cr * pi * 0.1 + ot * po) / 1e6;
      console.log(JSON.stringify({ ev: "nutrition", model: out.model || model, in: it, cw, cr, out: ot, usd: cost, kind: isLabel ? "label" : body.image ? "photo" : "text", lang: body.lang || "he", stop: out.stop_reason, ms: Date.now() - t0 }));
      const txt = (out.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
      const m = txt.match(/\{[\s\S]*\}/);
      let parsed: any = null;
      try { parsed = m ? JSON.parse(m[0]) : null; } catch (_) { parsed = null; }
      const empty = !parsed || (isLabel ? !!parsed.error : (!Array.isArray(parsed.items) || !parsed.items.length));
      // משתמש חינמי לא "מבזבז" את הניתוח היומי על תשובה ריקה או שגויה
      if (isPremium || !empty) { try { await sb.from("ai_usage").insert({ user_id: user.id, kind: isLabel ? "label" : body.image ? "photo" : "text", model: out.model || model, input_tokens: it, output_tokens: ot, cost_usd: cost }); } catch (_) { /* לא חוסם */ } }
      if (!parsed) { lastErr = "no_json stop=" + out.stop_reason + " text=" + txt.slice(0, 120); break; }
      if (!isLabel && empty) console.log(JSON.stringify({ ev: "nutrition-empty", kind: body.image ? "photo" : "text", q: String(body.text || body.hint || "").slice(0, 60) }));
      if (empty && freeLeft !== null) freeLeft += 1;
      if (leftAfter !== null && parsed && typeof parsed === "object") parsed._left = { kind: isPhoto ? "photo" : "text", n: Math.max(0, leftAfter) };
      if (freeLeft !== null && parsed && typeof parsed === "object") parsed._free = { left: Math.max(0, freeLeft) };
      return new Response(JSON.stringify(parsed), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    console.error("anthropic error:", lastErr.slice(0, 500));
    return new Response(JSON.stringify({ error: "ai_failed" }), { status: 502, headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: cors });
  }
});
