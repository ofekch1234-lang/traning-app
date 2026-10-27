// NextRep — weekly pull of Google Search Console data into public.seo_gsc (read-only access).
// Auth: x-cron-key header (value in app_config 'cron_key'; called by pg_cron), hence verify_jwt=false.
// Service-account key: Edge Function secret GSC_SA_JSON (never in code). Site: GSC_SITE secret, or auto-detected.
import { createClient } from "npm:@supabase/supabase-js@2";

const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function token(sa: { client_email: string; private_key: string }) {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json(); if (!j.access_token) throw new Error("token: " + JSON.stringify(j).slice(0, 200));
  return j.access_token as string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ck } = await sb.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
  if (typeof ck?.value !== "string" || req.headers.get("x-cron-key") !== ck.value) return new Response("forbidden", { status: 403 });
  const raw = Deno.env.get("GSC_SA_JSON"); if (!raw) return Response.json({ ok: false, err: "no GSC_SA_JSON" }, { status: 500 });
  let sa; try { sa = JSON.parse(raw); } catch { return Response.json({ ok: false, err: "bad GSC_SA_JSON" }, { status: 500 }); }
  try {
    const tok = await token(sa), H = { authorization: `Bearer ${tok}`, "content-type": "application/json" };
    // the site: secret, or whichever property the account can see
    let site = Deno.env.get("GSC_SITE") || "";
    if (!site) {
      const l = await (await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: H })).json();
      const all = (l.siteEntry || []).map((x: { siteUrl: string }) => x.siteUrl);
      site = all.find((u: string) => /nextrep\.co\.il/.test(u)) || "";
      if (!site) return Response.json({ ok: false, err: "no site visible to the service account", sites: all });
    }
    // Search Console data lags by ~2-3 days: the last full 7 days ending 3 days ago
    const end = new Date(Date.now() - 3 * 864e5), start = new Date(end.getTime() - 6 * 864e5), week = ymd(start);
    const q = async (dims: string[], limit = 250) => {
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
        { method: "POST", headers: H, body: JSON.stringify({ startDate: ymd(start), endDate: ymd(end), dimensions: dims, rowLimit: limit }) });
      const j = await r.json(); if (j.error) throw new Error(dims.join(",") + ": " + JSON.stringify(j.error).slice(0, 200));
      return (j.rows || []) as { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
    };
    const rows: Record<string, unknown>[] = [];
    const push = (kind: string, key: string, country: string, x: { clicks: number; impressions: number; ctr: number; position: number }) =>
      rows.push({ week, kind, key: key.slice(0, 500), country, clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), ctr: Math.round(x.ctr * 10000) / 10000, position: Math.round(x.position * 10) / 10 });
    for (const x of await q(["query", "country"], 500)) push("query", x.keys[0], x.keys[1], x);
    for (const x of await q(["page"])) push("page", x.keys[0], "", x);
    for (const x of await q(["country"])) push("country", x.keys[0], "", x);
    for (const x of await q(["device"])) push("device", x.keys[0], "", x);
    if (rows.length) { const { error } = await sb.from("seo_gsc").upsert(rows, { onConflict: "week,kind,key,country" }); if (error) throw error; }
    return Response.json({ ok: true, site, week, rows: rows.length });
  } catch (e) {
    return Response.json({ ok: false, err: String(e).slice(0, 300) }, { status: 500 });
  }
});
