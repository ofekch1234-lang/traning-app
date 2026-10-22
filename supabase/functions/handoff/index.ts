// NextRep — העברת התחברות מהדפדפן לאפליקציה שבמסך הבית (באייפון הן לא חולקות אחסון).
// create: משתמש מחובר מקבל קוד בן 6 ספרות (תקף 15 דקות, חד-פעמי).
// redeem: האפליקציה שבמסך הבית שולחת את הקוד ומקבלת token_hash של קישור כניסה, שאותו היא מאמתת מול Supabase.
// verify_jwt כבוי: create בודק את המשתמש בעצמו, redeem מוגן בתוקף קצר, שימוש יחיד ומגבלת ניסיונות לכל IP.
import { createClient } from "npm:@supabase/supabase-js@2";

const TTL_MIN = 15, MAX_FAILS = 8;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const since = new Date(Date.now() - TTL_MIN * 60000).toISOString();

    if (body.action === "create") {
      const auth = req.headers.get("Authorization") || "";
      const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: { user } } = await sb.auth.getUser();
      if (!user?.email) return json({ error: "unauthorized" }, 401);
      const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
      const th = (link as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
      if (error || !th) { console.error("generateLink", error); return json({ error: "link_failed" }, 500); }
      await admin.from("login_handoff").delete().eq("user_id", user.id);
      let code = "";
      for (let i = 0; i < 6; i++) {
        const c = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        const { error: e } = await admin.from("login_handoff").insert({ code: c, user_id: user.id, token_hash: th });
        if (!e) { code = c; break; }
      }
      if (!code) return json({ error: "busy" }, 500);
      return json({ code, ttl: TTL_MIN * 60 });
    }

    if (body.action === "redeem") {
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
      const { count } = await admin.from("login_handoff_fail").select("ip", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since);
      if ((count ?? 0) >= MAX_FAILS) return json({ error: "too_many" }, 429);
      const code = String(body.code || "").replace(/\D/g, "");
      const { data: row } = code.length === 6
        ? await admin.from("login_handoff").select("code,user_id,token_hash").eq("code", code).is("used_at", null).gte("created_at", since).maybeSingle()
        : { data: null };
      if (!row) { await admin.from("login_handoff_fail").insert({ ip }); return json({ error: "invalid" }, 404); }
      await admin.from("login_handoff").update({ used_at: new Date().toISOString() }).eq("code", row.code);
      return json({ token_hash: row.token_hash });
    }
    return json({ error: "bad_request" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
