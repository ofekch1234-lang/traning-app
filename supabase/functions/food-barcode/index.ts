// NextRep — barcode products. verify_jwt: true.
//  GET  ?code=…  local cache (products) → Open Food Facts → cache.
//  POST {code, kcal, protein, carbs, fat, name?, brand?, serving_g?}  a user's correction from the package label
//       (typed in, or read from a label photo) → overwrites the shared product for everyone.
// Open Food Facts is crowd-sourced and often wrong for Israeli products (kcal typed as the wrong number, a missing
// macro), so every product goes through sanity(): kcal must agree with 4·protein + 4·carbs + 9·fat. When it doesn't,
// we repair the value that is clearly off and mark the product `check: true` so the app asks to verify against the label.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown, status = 200) => Response.json(o, { status, headers: cors });
const num = (v: unknown) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
const r1 = (v: number) => Math.round(v * 10) / 10;
const STALE_DAYS = 90; // re-check Open Food Facts for cached OFF products older than this (user-corrected rows are kept)

type P = { kcal: number; protein: number; carbs: number; fat: number; check?: boolean };
// kcal vs macros: fix the side that is clearly wrong
function sanity<T extends P>(p: T, kj?: number | null): T {
  const pr = +p.protein || 0, cb = +p.carbs || 0, ft = +p.fat || 0;
  let kc = +p.kcal || 0;
  const calc = 4 * pr + 4 * cb + 9 * ft;
  const off = (a: number, b: number) => Math.abs(a - b) > Math.max(12, 0.25 * Math.max(a, b));
  // the kJ field is often right when the kcal field is not: take whichever agrees with the macros
  if (kj && kj > 0 && calc > 0 && off(kc, calc) && !off(kj / 4.184, calc)) { kc = Math.round(kj / 4.184); p.check = true; }
  if (calc > 0 && off(kc, calc)) {
    // far too few kcal for the macros (e.g. 8 kcal with 7.9 g sugar → 32): the kcal field is wrong. A milder gap can be
    // real (sugar alcohols / fibre count less than 4 kcal/g), so then only flag it.
    if (kc < calc) { if (kc < calc * 0.6) kc = Math.round(calc); p.check = true; }
    else { // more kcal than the macros explain → a macro is missing (usually carbs typed as 0)
      const gap = kc - calc;
      if (cb === 0 && gap / 4 <= 100) { (p as P).carbs = r1(gap / 4); p.check = true; }
      else if (ft === 0 && gap / 9 <= 100) { (p as P).fat = r1(gap / 9); p.check = true; }
      else p.check = true; // can't tell which is wrong — just ask the user to verify
    }
  }
  p.kcal = kc;
  return p;
}

// grams of one unit: the stated serving, else "1 bar (20 g)", else a multipack "6 x 20 g", else a small single pack
function servingOf(p: any): number | null {
  const g = (v: unknown) => { const n = num(v); return n && n > 0 && n <= 1000 ? n : null; };
  const grams = (t: unknown) => { const m = String(t || "").replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(g|gr|ml|גר|ג|מ"ל|מ״ל)\b/i); return m ? g(m[1]) : null; };
  const multi = String(p.quantity || "").replace(",", ".").match(/(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(g|ml)/i);
  const pack = g(p.product_quantity) ?? grams(p.quantity);
  return g(p.serving_quantity) ?? grams(p.serving_size) ?? (multi ? g(multi[2]) : null) ?? (pack && pack <= 150 ? pack : null);
}
async function fromOFF(code: string) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_he,generic_name,brands,nutriments,serving_quantity,serving_size,quantity,product_quantity`, {
    headers: { "User-Agent": "NextRep/1.0 (ofek4business@gmail.com)" }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const p = j.product || {};
  const n = p.nutriments || {};
  const name = (p.product_name_he || p.product_name || p.generic_name || "").trim();
  const kj = num(n["energy-kj_100g"] ?? (n["energy_unit"] === "kJ" || !n["energy-kcal_100g"] ? n["energy_100g"] : null));
  const kcal = num(n["energy-kcal_100g"] ?? (kj ? kj / 4.184 : null));
  if (j.status !== 1 || !name || kcal === null) return null;
  // stored as Open Food Facts has it; sanity() runs on every read, so the "verify" flag stays until a user corrects it
  const row = { barcode: code, name: name.slice(0, 80), brand: (p.brands || "").split(",")[0].trim().slice(0, 60) || null, kcal,
    protein: num(n.proteins_100g) ?? 0, fat: num(n.fat_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0,
    serving_g: servingOf(p), source: "off", picks: 1 };
  return { row, kj };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: ok } = await user.rpc("is_approved");
  if (ok !== true) return J({ error: "forbidden" }, 403);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ----- a user's correction from the label -----
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const { data: { user: u } } = await user.auth.getUser();
    // admin: review what users added, approve it (moves to "approved"; any later correction sends it back for review),
    // or remove a bad product (next scan refetches it from Open Food Facts)
    if (b.admin) {
      const { data: plan } = await user.rpc("my_plan");
      if (!plan?.admin) return J({ error: "forbidden" }, 403);
      const ac = String(b.code || "").replace(/\D/g, "");
      if (b.admin === "del") { await sb.from("products").delete().eq("barcode", ac); return J({ ok: true }); }
      if (b.admin === "ok" || b.admin === "unok") {
        const { error } = await sb.from("products").update(b.admin === "ok" ? { approved_at: new Date().toISOString(), approved_by: u?.id || null } : { approved_at: null, approved_by: null }).eq("barcode", ac);
        return error ? J({ error: "save_failed" }, 500) : J({ ok: true });
      }
      const { data: rows } = await sb.from("products").select("barcode,name,brand,kcal,protein,carbs,fat,serving_g,picks,created_at,added_by,approved_at").eq("source", "user").order("created_at", { ascending: false }).limit(200);
      const ids = [...new Set((rows || []).map((r: any) => r.added_by).filter(Boolean))];
      const names: Record<string, string> = {};
      for (const id of ids) { const { data } = await sb.auth.admin.getUserById(id as string); names[id as string] = data?.user?.user_metadata?.full_name || data?.user?.email || ""; }
      return J({ rows: (rows || []).map((r: any) => ({ ...r, by: names[r.added_by] || "" })) });
    }
    const code = String(b.code || "").replace(/\D/g, "");
    if (!/^[0-9]{6,14}$/.test(code)) return J({ error: "bad_code" }, 400);
    // "how much does one unit weigh?": only the serving size, for everyone
    if (b.serving_only) {
      const sg = num(b.serving_g); if (!sg || sg <= 0 || sg > 1000) return J({ error: "bad_values" }, 422);
      const { error } = await sb.from("products").update({ serving_g: sg, approved_at: null, approved_by: null }).eq("barcode", code); // changed → back to review
      if (error) return J({ error: "save_failed" }, 500);
      console.log(JSON.stringify({ ev: "product-serving", code, sg, by: u?.id?.slice(0, 8) }));
      return J({ ok: true, serving_g: sg });
    }
    // abuse guard: a person adds / corrects at most 20 products a day
    if (u?.id) {
      const { count } = await sb.from("products").select("barcode", { count: "exact", head: true }).eq("added_by", u.id).gte("created_at", new Date(Date.now() - 864e5).toISOString());
      if ((count ?? 0) >= 20) return J({ error: "limit" }, 429);
    }
    const v = { kcal: num(b.kcal), protein: num(b.protein) ?? 0, carbs: num(b.carbs) ?? 0, fat: num(b.fat) ?? 0 };
    if (v.kcal === null || v.kcal < 0 || v.kcal > 900 || [v.protein, v.carbs, v.fat].some((x) => x < 0 || x > 100) || v.protein + v.carbs + v.fat > 101)
      return J({ error: "bad_values" }, 422);
    const calc = 4 * v.protein + 4 * v.carbs + 9 * v.fat;
    if (calc > 0 && Math.abs(v.kcal - calc) > Math.max(40, 0.5 * Math.max(v.kcal, calc))) return J({ error: "mismatch", calc: Math.round(calc) }, 422);
    const { data: old } = await sb.from("products").select("name,brand,serving_g,picks").eq("barcode", code).maybeSingle();
    const name = String(b.name || old?.name || "").trim().slice(0, 80);
    if (!name) return J({ error: "bad_name" }, 422);
    const row = { barcode: code, name, brand: (b.brand ?? old?.brand ?? null) ? String(b.brand ?? old?.brand).slice(0, 60) : null, ...v,
      serving_g: num(b.serving_g) || old?.serving_g || null, source: "user", added_by: u?.id || null, picks: old?.picks || 1, created_at: new Date().toISOString(), approved_at: null, approved_by: null }; // a correction needs a new review
    const { error } = await sb.from("products").upsert(row);
    if (error) return J({ error: "save_failed" }, 500);
    console.log(JSON.stringify({ ev: "product-fix", code, by: u?.id?.slice(0, 8), had: !!old }));
    return J({ product: row });
  }

  // ----- lookup -----
  const code = (new URL(req.url).searchParams.get("code") || "").replace(/\D/g, "");
  if (!/^[0-9]{6,14}$/.test(code)) return J({ error: "bad_code" }, 400);
  const { data: hit } = await sb.from("products").select("*").eq("barcode", code).maybeSingle();
  const age = hit?.created_at ? Date.now() - new Date(hit.created_at).getTime() : Infinity;
  const stale = hit && hit.source === "off" && (age > STALE_DAYS * 864e5 || (!hit.serving_g && age > 6 * 3600e3));
  if (hit && !stale) {
    await sb.from("products").update({ picks: (hit.picks || 0) + 1 }).eq("barcode", code);
    const p = hit.source === "user" ? { ...hit } : sanity({ ...hit, kcal: +hit.kcal, protein: +hit.protein, carbs: +hit.carbs, fat: +hit.fat });
    return J({ product: p, cached: true });
  }
  try {
    const got = await fromOFF(code);
    if (got) {
      if (!got.row.serving_g && hit?.serving_g) got.row.serving_g = hit.serving_g; // keep a unit size a user already gave
      await sb.from("products").upsert({ ...got.row, picks: (hit?.picks || 0) + 1, created_at: new Date().toISOString() });
      return J({ product: sanity({ ...got.row }, got.kj), cached: false });
    }
  } catch (e) { console.log(JSON.stringify({ ev: "off-fail", code, err: String(e).slice(0, 120) })); }
  if (hit) return J({ product: sanity({ ...hit, kcal: +hit.kcal, protein: +hit.protein, carbs: +hit.carbs, fat: +hit.fat }), cached: true }); // OFF unreachable: the old copy is better than nothing
  return J({ error: "not_found" }, 404);
});
