// NextRep — nutrition analysis via Claude (verify_jwt: true — רק משתמשים מחוברים)
import { createClient } from "npm:@supabase/supabase-js@2";

// רק Haiku 5.5 — בלי גיבוי למודל יקר יותר. אם הוא לא זמין, הניתוח נכשל והמשתמש מופנה לחיפוש במאגר.
const MODELS = ["claude-haiku-5-5"];
const SYSTEM = `אתה תזונאי קליני ישראלי. המשתמש מתאר ארוחה בטקסט או בתמונה.
החזר אך ורק JSON תקין, בלי טקסט נוסף, במבנה:
{"name":"שם קצר לארוחה","items":[{"name":"פריט","grams":משקל משוער בגרם,"kcal":מספר,"protein":גרם,"carbs":גרם,"fat":גרם}]}
הערך כמויות סבירות למנה ישראלית ביתית כשלא צוין. עגל למספרים שלמים.
כל דבר שנאכל או נשתה הוא פריט תקין: גם משקאות (קפה, מיצים, שייקים, משקאות קלים) וגם אלכוהול (וודקה, וויסקי, יין, בירה, קוקטיילים). באלכוהול חשב קלוריות כולל האלכוהול עצמו (7 קק"ל לגרם אלכוהול) — חלבון ושומן לרוב 0. "כוס" או "צ'ייסר" של משקה חריף = שוט של כ-40 מ"ל אלא אם צוין אחרת; כוס יין ~150 מ"ל; בקבוק בירה ~330 מ"ל.
רק אם הטקסט בכלל לא מתאר אוכל או שתייה — החזר {"name":"","items":[]}.`;

const PHOTO = `
הנחיות לניתוח תמונה — דייק:
1. זהה כל מרכיב נפרד שנראה בצלחת (כל ירק, תוספת, רוטב, ממרח, לחם, משקה) — אל תאחד מרכיבים שונים לפריט אחד, ואל תדלג על פריטים קטנים.
2. לכל פריט: שם ספציפי עם אופן ההכנה (למשל "חזה עוף בגריל", "אורז לבן מבושל", "סלט ירקות עם שמן זית", "צ'יפס מטוגן").
3. הערך משקל בגרם לפי גודל הצלחת (צלחת רגילה ~26 ס"מ), סכו"ם, וגובה/נפח האוכל. היה ריאלי — לא מינימלי ולא מוגזם.
4. כלול שמן/רטבים/תיבול שמנוני שנראים או סבירים לפי אופן ההכנה (טיגון, צלייה בשמן, טחינה, מיונז) — הם מוסיפים הרבה קלוריות.
5. חשב קלוריות ומאקרו מהמשקל לפי ערכים תזונתיים סטנדרטיים.
6. אם המשתמש צירף תיאור, הוא גובר על הזיהוי מהתמונה.
7. אם על אריזה/בקבוק בתמונה כתובים ערכים (קלוריות, גרם חלבון, נפח) — השתמש בהם כפי שכתוב, לא בהערכה.
8. מוצר ארוז/חטיף/יחידה בודדת (וופל, חטיף שוקולד, ביסקוויט, יוגורט): זהה את המותג והמוצר אם אפשר, והשתמש במשקל יחידה אמיתי של המוצר — חטיפים קטנים שוקלים לרוב 8–15 גרם ליחידה, לא 20+. ספור כמה יחידות רואים, ואל תניח מנה גדולה מהנראה.`;

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
    const LIM = { photo: { month: 300, day: 40 }, text: { month: 1500, day: 150 } };
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
    const sys = (isLabel ? LABEL : SYSTEM + (body.image ? PHOTO : "")) + langNote + "\nהחזר JSON קומפקטי בשורה אחת.";
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
      const it = out.usage?.input_tokens || 0, ot = out.usage?.output_tokens || 0;
      const cost = (it * pi + ot * po) / 1e6;
      console.log(JSON.stringify({ ev: "nutrition", model: out.model || model, in: it, out: ot, usd: cost, kind: isLabel ? "label" : body.image ? "photo" : "text", lang: body.lang || "he", stop: out.stop_reason, ms: Date.now() - t0 }));
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
