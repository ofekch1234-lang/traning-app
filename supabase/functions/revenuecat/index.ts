// NextRep — App Store / Google Play subscriptions via RevenueCat.
//
// Two callers, one source of truth:
//  1. RevenueCat webhook (every purchase / renewal / cancel / refund / expiry).
//     Auth: header "Authorization: Bearer <RC_WEBHOOK_AUTH>" (the value typed into RevenueCat's webhook settings).
//  2. The app right after a purchase or "restore" ({action:"sync"}), with the user's JWT, so access opens
//     immediately instead of waiting for the webhook.
// Either way we never trust the payload: we ask RevenueCat's API for the subscriber's current state and store it.
//
// Keep the free days: when someone buys during their free premium days (INITIAL_PURCHASE, paid period),
// the days left are added to the subscription (Apple: renewal date extension, Google: defer), once per user.
// Switch: billing.offer.keep_days.
//
// Secrets (supabase secrets set …): RC_SECRET_KEY (RevenueCat secret API key, sk_…), RC_WEBHOOK_AUTH.
// verify_jwt=false (the webhook has no Supabase JWT); the app path checks the JWT itself.
import { createClient } from "npm:@supabase/supabase-js@2";

const ENTITLEMENT = "premium";
const RC = "https://api.revenuecat.com/v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rcHeaders = () => ({ Authorization: `Bearer ${Deno.env.get("RC_SECRET_KEY")}`, "Content-Type": "application/json" });

async function syncUser(sb: ReturnType<typeof createClient>, uid: string) {
  const r = await fetch(`${RC}/subscribers/${encodeURIComponent(uid)}`, { headers: rcHeaders() });
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
  const premium = !!expires && !refunded && expires > new Date();
  // a paid store subscription (not a free trial) rewards whoever invited this user (free month or 30 days, once)
  if (premium && row.period_type !== "trial") {
    const { error: e2 } = await sb.rpc("ref_paid", { p_uid: uid, p_payment_id: null });
    if (e2) console.error("ref_paid", e2.message);
  }
  return { premium, until: row.expires_at, will_renew: row.will_renew };
}

// Bought early → the free days left move to the end of the paid period. Once per user, never for a free-trial period.
async function keepFreeDays(sb: ReturnType<typeof createClient>, uid: string, ev: Record<string, any>) {
  if (ev.type !== "INITIAL_PURCHASE" || String(ev.period_type || "").toUpperCase() === "TRIAL") return null;
  const { data: cfg } = await sb.from("app_config").select("value").eq("key", "billing").maybeSingle();
  if (!cfg?.value?.offer?.keep_days) return null;
  const { data: ua } = await sb.from("user_access").select("trial_until").eq("user_id", uid).maybeSingle();
  const bought = Number(ev.purchased_at_ms) || Date.now();
  const end = ua?.trial_until ? Date.parse(ua.trial_until) : 0;
  if (!end || end <= bought) return null;
  const days = Math.min(30, Math.ceil((end - bought) / 864e5));
  // claim once (unique per user+kind is enforced by the check + insert; a retry finds the row)
  const { data: done } = await sb.from("nudges").select("id").eq("user_id", uid).in("kind", ["keep_days", "keep_days_fail"]).limit(1);
  if (done?.length) return null;
  const store = String(ev.store || "").toUpperCase();
  let url = "", body: Record<string, unknown> = {};
  if (store === "APP_STORE") {
    const tx = ev.transaction_id || ev.original_transaction_id;
    url = `${RC}/subscribers/${encodeURIComponent(uid)}/subscriptions/${encodeURIComponent(tx)}/extend`;
    body = { extend_by_days: days, extend_reason_code: 1 }; // 1 = customer satisfaction
  } else if (store === "PLAY_STORE") {
    const pid = String(ev.product_id || "").split(":")[0];
    url = `${RC}/subscribers/${encodeURIComponent(uid)}/subscriptions/${encodeURIComponent(pid)}/defer`;
    body = { extend_by_days: days };
  } else return null;
  const r = await fetch(url, { method: "POST", headers: rcHeaders(), body: JSON.stringify(body) });
  const ok = r.ok;
  const txt = ok ? "" : (await r.text()).slice(0, 300);
  await sb.from("nudges").insert({ user_id: uid, kind: ok ? "keep_days" : "keep_days_fail" });
  if (!ok) { console.error("keep_days", store, r.status, txt); return { kept: 0, error: r.status }; }
  // the app shows the new date after sync; a push says it in words
  const { data: t } = await sb.rpc("l3", { uid, he: "שמרנו לך את ימי המתנה", ar: "حفظنا لك أيام الهدية", en: "We kept your free days" });
  const { data: b } = await sb.rpc("l3", {
    uid,
    he: `${days} הימים שנשארו לך במתנה נוספו למנוי. החיוב הבא נדחה בהתאם.`,
    ar: `أضفنا ${days} أيام الهدية المتبقية إلى اشتراكك. تأجل الخصم القادم وفقًا لذلك.`,
    en: `Your ${days} remaining free days were added to your subscription. The next charge moved accordingly.`,
  });
  if (t && b) await sb.from("push_queue").insert({ user_id: uid, title: t, body: b, kind: "nudge" });
  return { kept: days };
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
    try {
      let kept = null;
      try { kept = await keepFreeDays(sb, ids[0], ev); } catch (e) { console.error("keep_days", e); }
      const s = await syncUser(sb, ids[0]);
      return json({ ok: true, ...s, kept });
    } catch (e) { console.error("webhook", e); return json({ error: String(e) }, 500); } // 500 → RevenueCat retries
  }

  // 2. The app, right after a purchase / restore
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u?.user) return json({ error: "auth" }, 401);
  try { return json({ ok: true, ...(await syncUser(sb, u.user.id)) }); }
  catch (e) { console.error("sync", e); return json({ error: "sync_failed" }, 502); }
});
