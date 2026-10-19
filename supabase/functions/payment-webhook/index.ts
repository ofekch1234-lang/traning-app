// NextRep — payment webhook. Two sources:
//  1. Grow server-to-server callback (notifyUrl from grow-pay, ?src=grow): form data like data[cField1], data[sum], data[statusCode]…
//  2. Make / any automation: JSON or form with user_id|email, plan|months|amount, txn_id.
// Auth: secret key (app_config.webhook_key) in header x-nr-key or ?key=. verify_jwt=false.
import { createClient } from "npm:@supabase/supabase-js@2";

// "data[customFields][cField1]=x" → {data:{customFields:{cField1:"x"}}}
function nest(flat: Record<string, unknown>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.replace(/\]/g, "").split("[");
    let o = out;
    parts.forEach((p, i) => { if (i === parts.length - 1) o[p] = v; else o = (o[p] = typeof o[p] === "object" && o[p] ? o[p] : {}); });
  }
  return out;
}
// fallback: scan every value in the payload (Grow fixed pages may use different field names)
function scan(o: unknown, re: RegExp): string | null {
  if (o === null || o === undefined) return null;
  if (typeof o === "object") { for (const v of Object.values(o as Record<string, unknown>)) { const r = scan(v, re); if (r) return r; } return null; }
  const m = String(o).match(re); return m ? m[0] : null;
}
const pick = (o: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim(); }
  return null;
};

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await sb.from("app_config").select("key,value").in("key", ["webhook_key", "grow"]);
  const cfg = Object.fromEntries((rows || []).map((r: any) => [r.key, r.value]));
  const url = new URL(req.url);
  const key = req.headers.get("x-nr-key") || url.searchParams.get("key");
  if (!cfg.webhook_key || key !== cfg.webhook_key) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  let flat: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (req.method === "GET") url.searchParams.forEach((v, k) => { if (k !== "key" && k !== "src") flat[k] = v; });
    else if (ct.includes("json")) flat = await req.json();
    else { const f = await req.formData(); f.forEach((v, k) => (flat[k] = v)); }
  } catch (_) { return Response.json({ ok: false, error: "bad_body" }, { status: 400 }); }
  const body = nest(flat);
  const d: Record<string, any> = typeof body.data === "object" && body.data ? body.data : body; // Grow wraps fields in data[...]
  const cf: Record<string, any> = { ...(d.customFields || {}), ...d };

  // Grow: only completed payments (statusCode 2 = paid). Make/other: no status field → treat as paid.
  const status = pick(d, "statusCode");
  if (status && status !== "2") { try { await sb.from("payment_events").insert({ src: url.searchParams.get("src") || "page", raw: flat, result: { ok: false, error: "status_" + status } }); } catch (_) { /**/ } console.log(JSON.stringify({ ev: "payment-skip", status })); return Response.json({ ok: true, skipped: status }); }

  const uidRaw = pick(cf, "cField1", "user_id", "nr_uid", "uid");
  const uid = (uidRaw && /^[0-9a-f-]{36}$/i.test(uidRaw) ? uidRaw : null) || scan(body, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const email = pick(d, "payerEmail", "email", "customer_email", "payer_email", "Email", "customerEmail", "clientEmail") || scan(body, /[^\s@"']+@[^\s@"']+\.[a-z]{2,}/i);
  const plan = pick(cf, "cField2", "plan", "product", "plan_id");
  const monthsRaw = pick(d, "months");
  const amountRaw = pick(d, "sum", "amount", "price", "total", "paymentSum", "transactionSum");
  const txn = pick(d, "transactionId", "txn_id", "transaction_id", "transactionCode", "asmachta", "id");

  const { data, error } = await sb.rpc("apply_payment", {
    p_txn: txn, p_uid: uid, p_email: email, p_plan: plan,
    p_months: monthsRaw ? parseInt(monthsRaw) : null,
    p_amount: amountRaw ? parseFloat(amountRaw.replace(/[^0-9.]/g, "")) : null,
    p_raw: body,
  });
  try { await sb.from("payment_events").insert({ src: url.searchParams.get("src") || "page", raw: flat, result: { ...(data || {}), error: data?.error || error?.message || null, email, amount: amountRaw, uid } }); } catch (_) { /* log only */ }
  console.log(JSON.stringify({ ev: "payment", src: url.searchParams.get("src") || "other", ok: data?.ok, err: data?.error || error?.message, months: data?.months, txn }));

  // Grow asks the merchant to acknowledge the callback (the charge goes through either way)
  if (url.searchParams.get("src") === "grow" && cfg.grow?.pageCode && data?.ok) {
    try {
      const f = new FormData();
      f.append("pageCode", cfg.grow.pageCode);
      for (const [k, v] of Object.entries(d)) if (typeof v !== "object" && v !== null && v !== undefined) f.append(k, String(v));
      const base = (cfg.grow.base || "https://sandbox.meshulam.co.il/api/light/server/1.0/").replace(/\/?$/, "/");
      const r = await fetch(base + "approveTransaction", { method: "POST", body: f, signal: AbortSignal.timeout(8000) });
      console.log(JSON.stringify({ ev: "grow-approve", http: r.status }));
    } catch (e) { console.log(JSON.stringify({ ev: "grow-approve-fail", err: String(e).slice(0, 120) })); }
  }
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json(data, { status: data?.ok ? 200 : 422 });
});
