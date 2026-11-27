// NextRep — App Store / Google Play subscriptions via RevenueCat.
//
// Two callers, one source of truth:
//  1. RevenueCat webhook (every purchase / renewal / cancel / refund / expiry).
//     Auth: header "Authorization: Bearer <RC_WEBHOOK_AUTH>" (the value typed into RevenueCat's webhook settings).
//  2. The app right after a purchase or "restore" ({action:"sync"}), with the user's JWT, so access opens
//     immediately instead of waiting for the webhook.
// Either way we never trust the payload: we ask RevenueCat's API for the subscriber's current state and store it.
//
// Keep the free days: when someone buys during their free premium days (paid or paid-intro period),
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

async function rcSub(uid: string) {
  const r = await fetch(`${RC}/subscribers/${encodeURIComponent(uid)}`, { headers: rcHeaders() });
  if (!r.ok) throw new Error(`revenuecat ${r.status}`);
  return (await r.json())?.subscriber || {};
}

async function syncUser(sb: ReturnType<typeof createClient>, uid: string, kept = false): Promise<Record<string, unknown>> {
  const sub = await rcSub(uid);
  const ent = sub.entitlements?.[ENTITLEMENT];
  const prod = ent?.product_identifier || null;
  const s = prod ? sub.subscriptions?.[prod] || sub.non_subscriptions?.[prod]?.[0] || {} : {};
  // lifetime purchases have no expiry → far future
  const expires = ent ? (ent.expires_date ? new Date(ent.expires_date) : new Date("2999-12-31T00:00:00Z")) : null;
  const refunded = !!s.refunded_at;
  const premium = !!expires && !refunded && expires > new Date();
  // bought during the free premium days → those days move to the end of the paid period (once), then read the new date
  if (!kept && premium && prod) {
    let k = null;
    try { k = await keepFreeDays(sb, uid, prod, s); } catch (e) { console.error("keep_days", e); }
    if (k?.kept) return { ...(await syncUser(sb, uid, true)), kept: k.kept };
  }
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
  // a paid store subscription (not a free trial) rewards whoever invited this user (free month or 30 days, once)
  if (premium && row.period_type !== "trial") {
    const { error: e2 } = await sb.rpc("ref_paid", { p_uid: uid, p_payment_id: null });
    if (e2) console.error("ref_paid", e2.message);
  }
  return { premium, until: row.expires_at, will_renew: row.will_renew };
}

// Bought early → the free days left move to the end of the paid period. Once per user, never for a store free-trial period.
// Works from the subscriber record (not the webhook event), so a purchase made before sign-in (moved to the account
// by RevenueCat) is covered too, whichever call sees it first: the webhook or the app's sync.
async function keepFreeDays(sb: ReturnType<typeof createClient>, uid: string, prod: string, s: Record<string, any>) {
  if (String(s.period_type || "").toLowerCase() === "trial" || s.refunded_at) return null;
  const { data: cfg } = await sb.from("app_config").select("value").eq("key", "billing").maybeSingle();
  if (!cfg?.value?.offer?.keep_days) return null;
  const { data: ua } = await sb.from("user_access").select("trial_until").eq("user_id", uid).maybeSingle();
  const bought = Date.parse(s.original_purchase_date || s.purchase_date || "") || Date.now();
  const end = ua?.trial_until ? Date.parse(ua.trial_until) : 0;
  if (!end || end <= bought || end <= Date.now() - 864e5) return null; // only a purchase made inside the free days
  const days = Math.min(30, Math.ceil((end - bought) / 864e5));
  const { data: done } = await sb.from("nudges").select("id").eq("user_id", uid).in("kind", ["keep_days", "keep_days_fail"]).limit(1);
  if (done?.length) return null;
  // claim first, so the webhook and the app's sync arriving together can't both extend
  const { error: ce } = await sb.from("nudges").insert({ user_id: uid, kind: "keep_days" });
  if (ce) return null;
  const store = String(s.store || "").toUpperCase();
  let url = "", body: Record<string, unknown> = {};
  if (store === "APP_STORE") {
    const tx = s.store_transaction_id || s.original_transaction_id;
    if (!tx) { await failKeep(sb, uid, "no transaction id"); return null; }
    url = `${RC}/subscribers/${encodeURIComponent(uid)}/subscriptions/${encodeURIComponent(tx)}/extend`;
    body = { extend_by_days: days, extend_reason_code: 1 }; // 1 = customer satisfaction
  } else if (store === "PLAY_STORE") {
    url = `${RC}/subscribers/${encodeURIComponent(uid)}/subscriptions/${encodeURIComponent(prod.split(":")[0])}/defer`;
    body = { extend_by_days: days };
  } else { await failKeep(sb, uid, store); return null; }
  const r = await fetch(url, { method: "POST", headers: rcHeaders(), body: JSON.stringify(body) });
  if (!r.ok) { await failKeep(sb, uid, `${store} ${r.status} ${(await r.text()).slice(0, 300)}`); return { kept: 0 }; }
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
async function failKeep(sb: ReturnType<typeof createClient>, uid: string, why: string) {
  console.error("keep_days", uid, why);
  await sb.from("nudges").update({ kind: "keep_days_fail" }).eq("user_id", uid).eq("kind", "keep_days");
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
    const ids = [ev.app_user_id, ...(ev.transferred_to || []), ev.original_app_user_id, ...(ev.aliases || [])].filter((x: string) => UUID.test(x || ""));
    if (!ids.length) return json({ ok: true, skipped: "anonymous user" });
    try {
      return json({ ok: true, ...(await syncUser(sb, ids[0])) });
    } catch (e) { console.error("webhook", e); return json({ error: String(e) }, 500); } // 500 → RevenueCat retries
  }

  // 2. The app, right after a purchase / restore
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u?.user) return json({ error: "auth" }, 401);
  try { return json({ ok: true, ...(await syncUser(sb, u.user.id)) }); }
  catch (e) { console.error("sync", e); return json({ error: "sync_failed" }, 502); }
});
