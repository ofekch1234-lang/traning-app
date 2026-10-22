// NextRep — App Store / Google Play subscriptions via RevenueCat.
// NOT DEPLOYED YET: deploy at store launch, after the secrets below are set.
//
// Two callers, one source of truth:
//  1. RevenueCat webhook (every purchase / renewal / cancel / refund / expiry).
//     Auth: header "Authorization: Bearer <RC_WEBHOOK_AUTH>" (the value typed into RevenueCat's webhook settings).
//  2. The app right after a purchase or "restore" ({action:"sync"}), with the user's JWT, so access opens
//     immediately instead of waiting for the webhook.
// Either way we never trust the payload: we ask RevenueCat's API for the subscriber's current state and store it.
//
// Secrets (supabase secrets set …): RC_SECRET_KEY (RevenueCat secret API key, sk_…), RC_WEBHOOK_AUTH.
// verify_jwt=false (the webhook has no Supabase JWT); the app path checks the JWT itself.
import { createClient } from "npm:@supabase/supabase-js@2";

const ENTITLEMENT = "premium";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function syncUser(sb: ReturnType<typeof createClient>, uid: string) {
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("RC_SECRET_KEY")}` },
  });
  if (!r.ok) throw new Error(`revenuecat ${r.status}`);
  const sub = (await r.json())?.subscriber || {};
  const ent = sub.entitlements?.[ENTITLEMENT];
  const prod = ent?.product_identifier || null;
  const s = prod ? sub.subscriptions?.[prod] || sub.non_subscriptions?.[prod]?.[0] || {} : {};
  // lifetime purchases have no expiry → far future
  const expires = ent ? (ent.expires_date ? new Date(ent.expires_date) : new Date("2999-12-31T00:00:00Z")) : null;
  const refunded = !!s.refunded_at;
  const row = {
    user_id: uid,
    product: prod,
    store: s.store || null,
    expires_at: refunded ? new Date().toISOString() : expires?.toISOString() || null,
    will_renew: !!ent && !s.unsubscribe_detected_at && !refunded,
    billing_issue: !!s.billing_issues_detected_at,
    period_type: s.period_type || null, // normal | trial | intro
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("store_subs").upsert(row);
  if (error) throw error;
  return { premium: !!expires && !refunded && expires > new Date(), until: row.expires_at, will_renew: row.will_renew };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("authorization") || "";
  const body = await req.json().catch(() => ({}));

  // 1. RevenueCat webhook
  const hook = Deno.env.get("RC_WEBHOOK_AUTH");
  if (hook && auth === `Bearer ${hook}`) {
    const ev = body?.event || {};
    const ids = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases || [])].filter((x: string) => UUID.test(x || ""));
    if (!ids.length) return json({ ok: true, skipped: "anonymous user" });
    try { return json({ ok: true, ...(await syncUser(sb, ids[0])) }); }
    catch (e) { console.error("webhook", e); return json({ error: String(e) }, 500); } // 500 → RevenueCat retries
  }

  // 2. The app, right after a purchase / restore
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u?.user) return json({ error: "auth" }, 401);
  try { return json({ ok: true, ...(await syncUser(sb, u.user.id)) }); }
  catch (e) { console.error("sync", e); return json({ error: "sync_failed" }, 502); }
});
