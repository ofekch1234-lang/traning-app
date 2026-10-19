// NextRep — payment webhook (called by Make after a successful payment).
// Auth: secret key (app_config.webhook_key) in header x-nr-key or ?key=. verify_jwt=false.
// Body (JSON or form): user_id|nr_uid, email, plan (4m/6m/12m) or months, amount, txn_id.
import { createClient } from "npm:@supabase/supabase-js@2";

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim(); }
  return null;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "use POST" }, { status: 405 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: kc } = await sb.from("app_config").select("value").eq("key", "webhook_key").single();
  const url = new URL(req.url);
  const key = req.headers.get("x-nr-key") || url.searchParams.get("key");
  if (!kc || key !== kc.value) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("json")) body = await req.json();
    else { const f = await req.formData(); f.forEach((v, k) => (body[k] = v)); }
  } catch (_) { return Response.json({ ok: false, error: "bad_body" }, { status: 400 }); }

  const uidRaw = pick(body, "user_id", "nr_uid", "uid", "cField1");
  const uid = uidRaw && /^[0-9a-f-]{36}$/i.test(uidRaw) ? uidRaw : null;
  const email = pick(body, "email", "customer_email", "payer_email", "Email");
  const plan = pick(body, "plan", "product", "plan_id");
  const monthsRaw = pick(body, "months");
  const amountRaw = pick(body, "amount", "sum", "price", "total");
  const txn = pick(body, "txn_id", "transaction_id", "transactionId", "id");

  const { data, error } = await sb.rpc("apply_payment", {
    p_txn: txn, p_uid: uid, p_email: email, p_plan: plan,
    p_months: monthsRaw ? parseInt(monthsRaw) : null,
    p_amount: amountRaw ? parseFloat(amountRaw.replace(/[^0-9.]/g, "")) : null,
    p_raw: body,
  });
  console.log(JSON.stringify({ ev: "payment", ok: data?.ok, err: data?.error || error?.message, months: data?.months, txn }));
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json(data, { status: data?.ok ? 200 : 422 });
});
