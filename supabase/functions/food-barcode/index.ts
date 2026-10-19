// NextRep — barcode lookup: local cache (products) → Open Food Facts → cache. verify_jwt: true.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const num = (v: unknown) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const code = (new URL(req.url).searchParams.get("code") || "").replace(/\D/g, "");
  if (!/^[0-9]{6,14}$/.test(code)) return Response.json({ error: "bad_code" }, { status: 400, headers: cors });
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: ok } = await user.rpc("is_approved");
  if (ok !== true) return Response.json({ error: "forbidden" }, { status: 403, headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: hit } = await sb.from("products").select("*").eq("barcode", code).maybeSingle();
  if (hit) { await sb.from("products").update({ picks: (hit.picks || 0) + 1 }).eq("barcode", code); return Response.json({ product: hit, cached: true }, { headers: cors }); }

  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_he,generic_name,brands,nutriments,serving_quantity`, {
      headers: { "User-Agent": "NextRep/1.0 (ofek4business@gmail.com)" }, signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const j = await r.json();
      const p = j.product || {};
      const n = p.nutriments || {};
      const name = (p.product_name_he || p.product_name || p.generic_name || "").trim();
      const kcal = num(n["energy-kcal_100g"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : null));
      if (j.status === 1 && name && kcal !== null) {
        const row = { barcode: code, name: name.slice(0, 80), brand: (p.brands || "").split(",")[0].trim().slice(0, 60) || null, kcal,
          protein: num(n.proteins_100g) ?? 0, fat: num(n.fat_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0,
          serving_g: num(p.serving_quantity), source: "off", picks: 1 };
        await sb.from("products").upsert(row);
        return Response.json({ product: row, cached: false }, { headers: cors });
      }
    }
  } catch (e) { console.log(JSON.stringify({ ev: "off-fail", code, err: String(e).slice(0, 120) })); }
  return Response.json({ error: "not_found" }, { status: 404, headers: cors });
});
