// NextRep — AI menu (Haiku 5.5). The model only CHOOSES foods from the app's catalog and explains;
// the app computes every gram against the user's targets, so values always come from the food database.
//  mode "week": 7 different dinners for this week, built around the user's questionnaire (2 per week)
//  mode "req":  a free-text request ("dinner with friends on Thursday at an Italian place") → changes for one day (5 per day)
// Premium only; a free user gets one taste of each.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-5-5";
const LIM = { menu: { n: 2, days: 7 }, menu_req: { n: 5, days: 1 } };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const LANG_NAME: Record<string, string> = { he: "Hebrew", ar: "Arabic (simple Modern Standard Arabic)", en: "English" };

function system(lang: string, mode: string, g: string) {
  return `You are Repi, the dietitian inside the NextRep fitness app. Israeli home cooking, realistic everyday meals.
Write all text (names, why, reply) in ${LANG_NAME[lang] || "Hebrew"}. ${lang !== "en" ? `Address the user in the ${g === "f" ? "feminine" : "masculine"} singular.` : ""} Plain text, no markdown.
HARD RULES:
- Use ONLY food ids from the CATALOG. Never invent foods, grams or nutrition numbers: the app computes the amounts.
- Respect the user's "avoid", dislikes and diet style (kosher = never meat with dairy in one meal; vegetarian/vegan as stated).
- A meal is 2–5 foods: one protein ("P"), usually a carb ("C"), a vegetable ("V") and optionally a fat ("F"). Snacks may be 1–3 foods.
- Prefer foods the user said they love; keep it simple enough for the cooking time they gave.
- Output ONE JSON object and nothing else.
${mode === "week"
    ? `TASK: plan 7 DIFFERENT dinners for Sunday..Saturday (dow 0..6). Vary the main protein through the week, never the same main two days in a row, and fit each day's type (after a workout: protein + carbs; rest day: lighter on carbs; Friday out: dinner can be lighter). If they cook for a partner/family, make dinners that suit everyone.
JSON: {"dinners":[{"dow":0,"name":"short dish name","items":["id","id"],"why":"one short sentence why this dinner, personal"}],"note":"one short sentence about the week"}`
    : `TASK: the user asks to change something. Decide which day (dow 0..6, today is given) and which meals change. You may: replace a meal's foods ("items"), or mark a meal as eaten OUT with the calories to keep for it ("out_kcal"), or both on different meals. Keep the rest of the day as is unless needed to stay on the daily target. If the request is impossible or unsafe, explain and return no changes.
JSON: {"dow":4,"changes":[{"meal":1,"items":["id","id"],"name":"short name"},{"meal":3,"out_kcal":750}],"reply":"2–3 short sentences: what you changed and one practical tip for the situation (e.g. what to order)"}`}`;
}

async function claude(sys: string, user: string, maxTokens: number) {
  const call = async (mt: number) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: mt, system: sys, messages: [{ role: "user", content: user }], output_config: { effort: "low" } }),
    });
    if (!r.ok) throw new Error("ai_" + r.status + ":" + (await r.text()).slice(0, 160));
    const out = await r.json();
    const text = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
    return { text, it: out.usage?.input_tokens || 0, ot: out.usage?.output_tokens || 0, model: out.model || MODEL };
  };
  let r = await call(maxTokens);
  if (!r.text) { const r2 = await call(maxTokens * 2); r2.it += r.it; r2.ot += r.ot; r = r2; }
  return { ...r, usd: (r.it * 0.1 + r.ot * 0.5) / 1e6 };
}
const parseJSON = (t: string) => { const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return J({ error: "unauthorized" }, 401);
  const { data: plan } = await userClient.rpc("my_plan");
  if (!plan || plan.status !== "approved") return J({ error: "no_access" }, 403);
  const mode = body.mode === "week" ? "week" : body.mode === "req" ? "req" : null;
  if (!mode) return J({ error: "bad_mode" }, 400);
  const kind = mode === "week" ? "menu" : "menu_req", L = LIM[kind];
  const lang = ["he", "ar", "en"].includes(body.lang) ? body.lang : "he";

  // quota: premium → n per period; free → one taste ever
  if (!plan.admin) {
    if (!plan.premium) {
      const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", kind);
      if ((count ?? 0) >= 1) return J({ error: "premium" }, 402);
    } else {
      const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", kind).gte("created_at", new Date(Date.now() - L.days * 864e5).toISOString());
      if ((count ?? 0) >= L.n) return J({ error: "quota", limit: L.n, period: L.days === 1 ? "day" : "week" }, 429);
    }
  }

  const cat = Array.isArray(body.catalog) ? body.catalog.slice(0, 120) : [];
  if (!cat.length) return J({ error: "bad_request" }, 400);
  const ids = new Set(cat.map((c: any) => String(c.id)));
  const prof = JSON.stringify(body.profile || {}).slice(0, 2500);
  const catTxt = cat.map((c: any) => `${c.id}|${String(c.n).slice(0, 40)}|${c.r}|${c.s}|${c.t || ""}`).join("\n");
  let user_msg = `PROFILE: ${prof}\nCATALOG (id|name|role P/C/V/F/X/L|slots b=breakfast w=sweet breakfast m=main s=snack|type m=meat f=fish d=dairy e=egg v=plant):\n${catTxt}\n`;
  if (mode === "week") user_msg += `WEEK (dow: day type, dinner size):\n${JSON.stringify(body.week || []).slice(0, 1500)}`;
  else {
    const text = String(body.text || "").trim().slice(0, 400);
    if (!text) return J({ error: "bad_request" }, 400);
    user_msg += `TODAY dow=${Number(body.dow) || 0}. DAYS (dow → meals with index, slot, current foods, kcal):\n${JSON.stringify(body.days || []).slice(0, 4000)}\nREQUEST: ${text}`;
  }

  try {
    const ai = await claude(system(lang, mode, body.g === "f" ? "f" : "m"), user_msg, mode === "week" ? 3000 : 1800);
    const out = parseJSON(ai.text);
    await admin.from("ai_usage").insert({ user_id: user.id, kind, model: ai.model, input_tokens: ai.it, output_tokens: ai.ot, cost_usd: ai.usd });
    console.log(JSON.stringify({ ev: "menu-ai", mode, user: user.id.slice(0, 8), in: ai.it, out: ai.ot, usd: ai.usd, ok: !!out }));
    if (!out) return J({ error: "ai_failed" }, 502);
    // keep only known ids
    if (mode === "week") {
      const dinners = (out.dinners || []).filter((d: any) => d && Array.isArray(d.items)).map((d: any) => ({ dow: Math.max(0, Math.min(6, Number(d.dow) || 0)), name: String(d.name || "").slice(0, 60), why: String(d.why || "").slice(0, 200), items: d.items.map(String).filter((x: string) => ids.has(x)).slice(0, 6) })).filter((d: any) => d.items.length >= 2);
      return J({ dinners, note: String(out.note || "").slice(0, 240) });
    }
    const changes = (out.changes || []).map((c: any) => ({ meal: Number(c.meal), name: c.name ? String(c.name).slice(0, 60) : "", items: Array.isArray(c.items) ? c.items.map(String).filter((x: string) => ids.has(x)).slice(0, 6) : null, out_kcal: c.out_kcal != null ? Math.max(0, Math.min(2000, Number(c.out_kcal) || 0)) : null })).filter((c: any) => Number.isInteger(c.meal) && ((c.items && c.items.length) || c.out_kcal));
    return J({ dow: Math.max(0, Math.min(6, Number(out.dow) || 0)), changes, reply: String(out.reply || "").slice(0, 600) });
  } catch (e) {
    console.error(e);
    return J({ error: "ai_failed" }, 502);
  }
});
