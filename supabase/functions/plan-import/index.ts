// NextRep — import a workout plan from a coach (photos, a PDF or pasted text).
// The model reads the plan and maps every exercise to the app's exercise library; the user reviews before saving.
// Limit per rolling 30 days: 3 imports free, 10 premium. Re-sending the same input (same photos/PDF/text) is not
// counted again, up to 3 tries per input.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5-5";
const FREE_PER_MONTH = 3, PREMIUM_PER_MONTH = 10, TRIES_PER_INPUT = 3, WINDOW_MS = 30 * 864e5;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const LANG_NAME: Record<string, string> = { he: "Hebrew", ar: "Arabic", en: "English" };

const system = (lang: string) => `You read workout plans written by personal trainers (photos of paper or a whiteboard, screenshots of WhatsApp, PDFs, spreadsheets or pasted text, often in Hebrew, sometimes handwritten) and turn them into structured data for the NextRep app.
RULES:
- Split the plan into its training days exactly as the coach wrote them (A/B/C, day 1/2/3, push/pull/legs...). Keep the coach's order of exercises.
- For every exercise, find the SAME movement in the LIBRARY (lines "name|muscle group") and return that exact library name in "lib". Same movement means same equipment and angle (dumbbell vs barbell vs machine vs cable matters). If there is no real match, leave "lib" empty.
- "as": the exercise as the coach wrote it, translated to ${LANG_NAME[lang] || "Hebrew"} if needed, short.
- "m": the muscle group, one of the groups used in the LIBRARY.
- "s": number of working sets (integer). "reps": the reps as written, e.g. "8-12", "10", "12/10/8", "30 sec", "max". "rest": rest in seconds if written, else 0.
- "note": anything else the coach wrote for that exercise (tempo, superset with the next one, drop set, RIR, weight, grip), short, in ${LANG_NAME[lang] || "Hebrew"}. Never repeat the sets, reps or rest there. Empty if nothing.
- Cardio (treadmill, bike, elliptical, walking): "cardio": minutes, and "s":0.
- Ignore warm-up notes that are not exercises, nutrition advice and anything that is not part of the training days.
- Day "name": short, in ${LANG_NAME[lang] || "Hebrew"}, like the coach named it, e.g. "אימון A: חזה וכתפיים".
- If the input is not a workout plan at all, return {"ok":false}.
- Output ONE JSON object and nothing else:
{"ok":true,"name":"plan name or empty","days":[{"name":"...","ex":[{"lib":"...","as":"...","m":"...","s":3,"reps":"8-12","rest":90,"note":"","cardio":0}]}]}`;

const parseJSON = (t: string) => { const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return J({ error: "unauthorized" }, 401);
  const lang = ["he", "ar", "en"].includes(body.lang) ? body.lang : "he";

  const imgs = (Array.isArray(body.images) ? body.images : []).slice(0, 4).filter((im: unknown) => typeof im === "string" && im.length < 4_000_000);
  const pdf = typeof body.pdf === "string" && body.pdf.length < 8_000_000 ? body.pdf : "";
  const text = String(body.text || "").trim().slice(0, 6000);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode([...imgs, pdf, text].join("\u0000")))))
    .slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: plan } = await userClient.rpc("my_plan");
  if (!plan?.admin) {
    const limit = plan?.premium ? PREMIUM_PER_MONTH : FREE_PER_MONTH;
    const { data: rows } = await admin.from("ai_usage").select("input_hash,created_at").eq("user_id", user.id).eq("kind", "plan_import")
      .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString()).order("created_at", { ascending: true });
    const seen = new Map<string, number>(); let first = "";
    for (const r of rows || []) { const k = r.input_hash || `row:${r.created_at}`; if (!seen.has(k) && !first) first = r.created_at; seen.set(k, (seen.get(k) || 0) + 1); }
    const tries = seen.get(hash) || 0;
    const blocked = tries ? tries >= TRIES_PER_INPUT : seen.size >= limit;
    if (blocked) {
      const next = first ? new Date(new Date(first).getTime() + WINDOW_MS).toISOString() : null;
      return J({ error: "quota", limit, premium: !!plan?.premium, next, retry: tries > 0 }, 429);
    }
  }

  const lib = String(body.lib || "").slice(0, 30000);
  const libNames = new Set(lib.split("\n").map((l) => l.split("|")[0].trim()).filter(Boolean));
  const groups = new Set(lib.split("\n").map((l) => (l.split("|")[1] || "").trim()).filter(Boolean));
  if (!libNames.size) return J({ error: "bad_request" }, 400);

  const content: any[] = [];
  for (const im of imgs) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: im } });
  if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  if (!content.length && !text) return J({ error: "bad_request" }, 400);
  content.push({ type: "text", text: `${text ? `PLAN (pasted text):\n${text}\n\n` : "The plan is in the attached files.\n\n"}Return the JSON.` });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 6000,
        system: [{ type: "text", text: system(lang) }, { type: "text", text: `LIBRARY:\n${lib}`, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { effort: "low" },
      }),
    });
    if (!r.ok) { console.error("ai", r.status, (await r.text()).slice(0, 300)); return J({ error: "ai_failed" }, 502); }
    const out = await r.json();
    const t = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
    const u = out.usage || {}, it = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1, ot = u.output_tokens || 0;
    const usd = (it * 3 + ot * 15) / 1e6;
    await admin.from("ai_usage").insert({ user_id: user.id, kind: "plan_import", model: out.model || MODEL, input_tokens: Math.round(it), output_tokens: ot, cost_usd: usd, input_hash: hash });
    const j = parseJSON(t);
    console.log(JSON.stringify({ ev: "plan-import", user: user.id.slice(0, 8), imgs: imgs.length, pdf: !!body.pdf, txt: text.length, in: Math.round(it), out: ot, usd, ok: !!j?.ok }));
    if (!j) return J({ error: "ai_failed" }, 502);
    if (!j.ok) return J({ error: "not_plan" }, 422);
    const S = (v: any, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
    const days = (Array.isArray(j.days) ? j.days : []).slice(0, 10).map((d: any, di: number) => ({
      name: S(d?.name, 60) || `${di + 1}`,
      ex: (Array.isArray(d?.ex) ? d.ex : []).slice(0, 25).map((e: any) => {
        const lib = libNames.has(S(e?.lib, 80)) ? S(e?.lib, 80) : "";
        const cardio = Math.max(0, Math.min(180, Math.round(Number(e?.cardio) || 0)));
        return { lib, as: S(e?.as, 60), m: groups.has(S(e?.m, 30)) ? S(e?.m, 30) : "", s: cardio ? 0 : Math.max(1, Math.min(10, Math.round(Number(e?.s) || 3))), reps: S(e?.reps, 20), rest: Math.max(0, Math.min(600, Math.round(Number(e?.rest) || 0))), note: S(e?.note, 120), cardio };
      }).filter((e: any) => e.lib || e.as),
    })).filter((d: any) => d.ex.length);
    if (!days.length) return J({ error: "not_plan" }, 422);
    return J({ name: S(j.name, 60), days });
  } catch (e) {
    console.error(e);
    return J({ error: "ai_failed" }, 502);
  }
});
