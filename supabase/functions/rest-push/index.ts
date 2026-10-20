// NextRep — push dispatcher: rest timers that are due + notifications queue (social / billing / admin).
// Auth: x-cron-key header (value in app_config 'cron_key'; called by pg_cron), hence verify_jwt=false.
// VAPID private key: Edge Function secret VAPID_PRIVATE_KEY (never in code).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = "BEZW8tXMc6pOHrP87-KW8pfmZvr1ueA7S7BqBzUQu-Hp2DC_Yi2B-K_yO7JxWeRClXUDK6K1AsMETaQpvY-hkXw";

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
  let sent = 0;
  for (const m of msgs) {
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
  return Response.json({ sent, rest: due?.length || 0, social: social.size, direct });
});
