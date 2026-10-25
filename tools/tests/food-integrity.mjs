// Food DB integrity + portion math. Run: node tools/tests/food-integrity.mjs  (exit code 1 on any failure)
// Uses the public (publishable) key that index.html already ships; read-only RPCs only.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const URL_ = html.match(/const SUPABASE_URL='([^']+)'/)[1], KEY = html.match(/const SUPABASE_KEY='([^']+)'/)[1];
const rpc = async (fn, body = {}) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
};
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) { fails++; if (process.env.CI) console.log('::error::' + msg.replace(/\n/g, '%0A')); } };
const eq = (a, b) => Math.abs(+a - +b) < 1e-9;

// reference records (per 100 g, USDA FoodData Central SR Legacy)
const REF = {
  brewed:   { kcal: 1, protein: 0.12, carbs: 0,    fat: 0.02, rec: 'FDC 171890' },
  espresso: { kcal: 9, protein: 0.12, carbs: 1.67, fat: 0.18, rec: 'FDC 171891' },
};
let net = true; try { await rpc('food_integrity_check'); } catch (e) { if (process.env.CI) { console.log('::error::DB unreachable: ' + e.message); throw e; } net = false; console.log('skip DB checks (no network here): ' + e.message.slice(0, 80)); }
if (net) {
// 1. database-wide checks (same values under different sources, missing provenance, borrowed values, merged rows)
const issues = await rpc('food_integrity_check');
ok(issues.length === 0, `food_integrity_check: ${issues.length} issue(s)` + (issues.length ? '\n     ' + issues.slice(0, 20).map(i => `${i.code} ${i.name}: ${i.issue}`).join('\n     ') : ''));

// 2. each coffee type resolves to its own record
const cases = [
  ['קפה שחור', 900109, REF.brewed], ['קפה שחור חלוט', 900109, REF.brewed], ['קפה פילטר', 900106, REF.brewed],
  ['אספרסו', 900103, REF.espresso], ['קפה אספרסו', 900103, REF.espresso], ['אספרסו כפול', 900104, REF.espresso],
];
for (const [q, code, ref] of cases) {
  const res = await rpc('search_foods', { q, lim: 7 });
  const top = res[0] || {};
  ok(top.code === code, `"${q}" -> first result ${top.code} ${top.name || ''} (expected ${code})`);
  ok(['kcal', 'protein', 'carbs', 'fat'].every(k => eq(top[k], ref[k])), `"${q}" values match ${ref.rec}`);
  // nothing that says unsweetened black/Turkish may carry espresso values
  for (const f of res) if (/(שחור|טורקי)/.test(f.name) && !/ממותק/.test(f.name) && !/אבק/.test(f.name))
    ok(!(eq(f.kcal, 9) && eq(f.carbs, 1.67)), `"${q}" result ${f.code} ${f.name} does not carry espresso values`);
}
const tur = await rpc('search_foods', { q: 'קפה טורקי', lim: 10 });
ok(!tur.some(f => /ללא סוכר|לא ממותק/.test(f.name)), 'no unsweetened Turkish item is offered without a verified record');

}
// 3. portion math: the app's own portionCalc, taken from index.html
const src = html.match(/function portionCalc\(\)\{[\s\S]*?\n\}/)[0];
const calc = (f, unitG, qty) => { const _portion = { f, unit: unitG ? { g: unitG } : null, qty }; return new Function('_portion', src + '\nreturn portionCalc();')(_portion); };
const esp = { ...REF.espresso }, brw = { ...REF.brewed };
let c = calc(esp, 30, 1); ok(c.grams === 30 && c.kcal === 3 && c.carbs === 0.5 && c.fat === 0.1, `espresso 1 shot (30 ml): ${c.kcal} kcal, ${c.carbs} g carbs`);
c = calc(esp, 30, 2); ok(c.grams === 60 && c.kcal === 5 && c.carbs === 1 && c.protein === 0.1, `espresso 2 shots (60 ml): ${c.kcal} kcal, ${c.carbs} g carbs`);
c = calc(brw, 240, 1); ok(c.grams === 240 && c.kcal === 2 && c.carbs === 0 && c.protein === 0.3, `brewed cup (240 ml): ${c.kcal} kcal, ${c.protein} g protein`);
c = calc(brw, null, 150); ok(c.grams === 150 && c.kcal === 2 && c.carbs === 0, `brewed 150 ml: ${c.kcal} kcal, ${c.carbs} g carbs`);
c = calc(brw, 240, 0.5); ok(c.grams === 120 && c.kcal === 1, `brewed half cup (120 ml): ${c.kcal} kcal`);
const big = { kcal: 165, protein: 31, carbs: 0, fat: 3.6 };
for (const g of [50, 100, 150, 237]) { c = calc(big, null, g); ok(c.kcal === Math.round(165 * g / 100) && eq(c.protein, Math.round(31 * g / 10) / 10), `linear scaling at ${g} g`); }

console.log(fails ? `\n${fails} failure(s)` : '\nall checks passed');
process.exit(fails ? 1 : 0);
