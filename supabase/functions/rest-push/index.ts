// NextRep — push dispatcher: rest timers that are due + notifications queue (social / billing / admin).
// Auth: x-cron-key header (value in app_config 'cron_key'; called by pg_cron), hence verify_jwt=false.
// VAPID private key: Edge Function secret VAPID_PRIVATE_KEY (never in code).
// Installed iPhone app: Apple Push Notification service with the token key (.p8) in the Edge Function secret
// APNS_KEY_P8 (never in code); key id and team id below are not secret. Device tokens: table native_push.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = "BEZW8tXMc6pOHrP87-KW8pfmZvr1ueA7S7BqBzUQu-Hp2DC_Yi2B-K_yO7JxWeRClXUDK6K1AsMETaQpvY-hkXw";

const APNS_KEY_ID = "N4H9UH778U", APNS_TEAM_ID = "9KC26568TD", APNS_TOPIC = "il.co.nextrep.app";
// each kind has its own sound in the app (files bundled under public/)
const APNS_SOUND: Record<string, string> = { admin: "public/nr_success.wav", social: "public/nr_pop.wav", billing: "public/nr_marimba.wav",
  // the same sounds the app uses for its own notifications, so a server message of any kind sounds like it
  rest_alert: "public/nr_bell.wav", remind: "public/nr_watch.wav", nudge: "public/nr_watch.wav", meal: "public/nr_marimba.wav",
  weigh: "public/nr_marimba.wav", trial: "public/nr_marimba.wav", coach: "public/nr_pop.wav", pr: "public/nr_success.wav" };
let apnsJwt = ""; let apnsAt = 0; let apnsKey: CryptoKey | null = null;
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const u = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};
async function apnsToken(): Promise<string | null> {
  if (apnsJwt && Date.now() - apnsAt < 45 * 60000) return apnsJwt; // Apple: refresh between 20 and 60 minutes
  const pem = Deno.env.get("APNS_KEY_P8"); if (!pem) return null;
  if (!apnsKey) {
    const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
    apnsKey = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  const head = b64u(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const body = b64u(JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, apnsKey, new TextEncoder().encode(head + "." + body));
  apnsJwt = head + "." + body + "." + b64u(sig); apnsAt = Date.now();
  return apnsJwt;
}

type Msg = { user_id: string; title: string; body: string; kind: string; ttl: number; ref?: string };
let cronKey = ""; let cronAt = 0;

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!cronKey || Date.now() - cronAt > 600000) {
    const { data: ck } = await sb.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
    cronKey = typeof ck?.value === "string" ? ck.value : ""; cronAt = Date.now();
  }
  if (!cronKey || req.headers.get("x-cron-key") !== cronKey) return new Response("forbidden", { status: 403 });
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!priv) { console.log(JSON.stringify({ ev: "push-config", err: "no VAPID_PRIVATE_KEY" })); return new Response("no_key", { status: 500 }); }
  webpush.setVapidDetails("mailto:ofek4business@gmail.com", VAPID_PUBLIC, priv);

  const msgs: Msg[] = [];
  const { data: due } = await sb.from("rest_timers").delete().lte("fire_at", new Date().toISOString()).select("user_id,title,body,fire_at");
  for (const d of due || []) msgs.push({ user_id: d.user_id, title: d.title || "המנוחה נגמרה 💪", body: d.body || "הסט הבא מחכה לך", kind: "rest", ttl: 120, ref: d.fire_at });
  const { data: q } = await sb.from("push_queue").delete().gte("id", 0).select("user_id,title,body,kind");
  // social: one push per user per batch (the latest wins) so a busy chat doesn't spam.
  // admin (new signups) and billing are never collapsed: every one is delivered, and admin lives 24h.
  const social = new Map<string, Msg>();
  let direct = 0;
  for (const m of q || []) {
    const kind = m.kind || "social";
    if (kind === "admin" || kind === "billing") { msgs.push({ user_id: m.user_id, title: m.title, body: m.body || "", kind, ttl: kind === "admin" ? 86400 : 3600 }); direct++; }
    else social.set(m.user_id, { user_id: m.user_id, title: m.title, body: m.body || "", kind, ttl: 3600 });
  }
  msgs.push(...social.values());
  if (!msgs.length) return Response.json({ sent: 0 });

  const users = [...new Set(msgs.map((m) => m.user_id))];
  const { data: subs } = await sb.from("push_subs").select("endpoint,user_id,keys").in("user_id", users);
  const { data: devs } = await sb.from("native_push").select("token,user_id,platform,env").in("user_id", users);
  let sent = 0, nsent = 0, skipped = 0;
  // a message the installed app already received is not sent again to the old web app (no double notification,
  // and no old home-screen icon); web push stays for rest timers and for people without the app
  const gotNative = new Set<Msg>();
  // installed app (iPhone): server notifications only; its rest timer is scheduled on the device itself
  const jwt = devs?.length ? await apnsToken().catch((e) => { console.log(JSON.stringify({ ev: "apns-config", err: String(e).slice(0, 120) })); return null; }) : null;
  if (devs?.length && !jwt) console.log(JSON.stringify({ ev: "apns-config", err: "no APNS_KEY_P8" }));
  for (const m of msgs) {
    if (m.kind === "rest" || !jwt) continue;
    for (const d of (devs || []).filter((x: any) => x.user_id === m.user_id && x.platform === "ios")) {
      const host = (d as any).env === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
      try {
        const r = await fetch(`https://${host}/3/device/${(d as any).token}`, {
          method: "POST",
          headers: { authorization: `bearer ${jwt}`, "apns-topic": APNS_TOPIC, "apns-push-type": "alert",
            "apns-priority": m.kind === "admin" || m.kind === "billing" ? "10" : "5",
            "apns-expiration": String(Math.floor(Date.now() / 1000) + m.ttl), "content-type": "application/json" },
          body: JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: APNS_SOUND[m.kind] || "default" }, kind: m.kind }),
        });
        const txt = r.status === 200 ? "" : await r.text().catch(() => "");
        if (r.status === 200) { nsent++; gotNative.add(m); }
        console.log(JSON.stringify({ ev: r.status === 200 ? "apns" : "apns-fail", kind: m.kind, user: String(m.user_id).slice(0, 8), status: r.status, body: txt.slice(0, 160) }));
        if (r.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(txt)) await sb.from("native_push").delete().eq("token", (d as any).token);
      } catch (e) { console.log(JSON.stringify({ ev: "apns-fail", kind: m.kind, err: String(e).slice(0, 160) })); }
    }
  }
  for (const m of msgs) {
    if (gotNative.has(m)) { skipped++; continue; }
    for (const s of (subs || []).filter((x: any) => x.user_id === m.user_id)) {
      const payload = JSON.stringify({ title: m.title, body: m.body, kind: m.kind });
      try {
        const res = await webpush.sendNotification({ endpoint: (s as any).endpoint, keys: (s as any).keys }, payload, { TTL: m.ttl, urgency: m.kind === "rest" || m.kind === "admin" ? "high" : "normal" });
        sent++;
        console.log(JSON.stringify({ ev: "push", kind: m.kind, user: String(m.user_id).slice(0, 8), status: res.statusCode, lagMs: m.ref ? Date.now() - new Date(m.ref).getTime() : undefined }));
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        console.log(JSON.stringify({ ev: "push-fail", kind: m.kind, user: String(m.user_id).slice(0, 8), status: code, body: String((e as any)?.body || "").slice(0, 200) }));
        if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", (s as any).endpoint);
      }
    }
  }
  return Response.json({ sent, native: nsent, skipped, rest: due?.length || 0, social: social.size, direct });
});
