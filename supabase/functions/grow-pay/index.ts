// NextRep — creates a Grow (Meshulam) payment process for the signed-in user and returns the payment page URL.
// The user id travels in cField1 and the plan in cField2, so Grow's server callback (notifyUrl → payment-webhook)
// knows exactly whom to unlock — no email matching, no Make. verify_jwt: true.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: cors });
    const { plan, origin } = await req.json();

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await sb.from("app_config").select("key,value").in("key", ["billing", "grow", "webhook_key"]);
    const cfg = Object.fromEntries((rows || []).map((r: any) => [r.key, r.value]));
    const g = cfg.grow || {};
    if (!g.pageCode || !g.userId) return Response.json({ error: "grow_not_configured" }, { status: 400, headers: cors });
    const p = (cfg.billing?.plans || []).find((x: any) => x.id === plan);
    if (!p) return Response.json({ error: "bad_plan" }, { status: 400, headers: cors });

    const site = /^https:\/\/[a-z0-9.-]+$/i.test(origin || "") ? origin : "https://traning-app-silk.vercel.app";
    const notify = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?key=${cfg.webhook_key}&src=grow`;
    const f = new FormData();
    f.append("pageCode", g.pageCode);
    f.append("userId", g.userId);
    if (g.apiKey) f.append("apiKey", g.apiKey);
    f.append("sum", String(p.price));
    f.append("paymentNum", "1");
    f.append("description", `NextRep — ${p.months} חודשים`);
    f.append("successUrl", `${site}/thanks.html`);
    f.append("cancelUrl", `${site}/`);
    f.append("notifyUrl", notify);
    f.append("cField1", user.id);
    f.append("cField2", p.id);
    const name = (user.user_metadata?.full_name || "").trim();
    if (name.includes(" ")) f.append("pageField[fullName]", name);
    if (user.email) f.append("pageField[email]", user.email);

    const base = (g.base || "https://sandbox.meshulam.co.il/api/light/server/1.0/").replace(/\/?$/, "/");
    const r = await fetch(base + "createPaymentProcess", { method: "POST", body: f });
    const j = await r.json().catch(() => ({}));
    console.log(JSON.stringify({ ev: "grow-create", status: j?.status, err: j?.err, plan: p.id, user: user.id.slice(0, 8) }));
    if (j?.status != 1 || !j?.data?.url) return Response.json({ error: "grow_failed", detail: j?.err || null }, { status: 502, headers: cors });
    return Response.json({ url: j.data.url }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "server_error" }, { status: 500, headers: cors });
  }
});
