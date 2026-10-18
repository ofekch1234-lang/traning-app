// NextRep — nutrition analysis via Claude (verify_jwt: true — רק משתמשים מחוברים)
import { createClient } from "npm:@supabase/supabase-js@2";

const MODELS = ["claude-haiku-5-5", "claude-haiku-4-5-20251001"];
const SYSTEM = `אתה תזונאי קליני ישראלי. המשתמש מתאר ארוחה בטקסט או בתמונה.
החזר אך ורק JSON תקין, בלי טקסט נוסף, במבנה:
{"name":"שם קצר לארוחה בעברית","items":[{"name":"פריט","kcal":מספר,"protein":גרם,"carbs":גרם,"fat":גרם}]}
הערך כמויות סבירות למנה ישראלית ביתית כשלא צוין. עגל למספרים שלמים. אם זו לא ארוחה — החזר {"name":"","items":[]}.`;

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

    const body = await req.json();
    const content: unknown[] = [];
    if (body.image) {
      content.push({ type: "image", source: { type: "base64", media_type: body.media || "image/jpeg", data: body.image } });
      content.push({ type: "text", text: "נתח את הארוחה שבתמונה." });
    } else if (body.text && String(body.text).length <= 600) {
      content.push({ type: "text", text: "הארוחה: " + String(body.text) });
    } else {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: cors });
    }

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "no_api_key" }), { status: 500, headers: cors });

    let lastErr = "";
    for (const model of MODELS) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 700, system: SYSTEM, messages: [{ role: "user", content }] }),
      });
      if (r.status === 404) { lastErr = await r.text(); continue; } // מודל לא קיים — ננסה את הבא
      if (!r.ok) { lastErr = await r.text(); break; }
      const out = await r.json();
      const txt = (out.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) break;
      const parsed = JSON.parse(m[0]);
      return new Response(JSON.stringify(parsed), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    console.error("anthropic error:", lastErr.slice(0, 500));
    return new Response(JSON.stringify({ error: "ai_failed" }), { status: 502, headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: cors });
  }
});
