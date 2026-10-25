// Copies the web app (repo root) into app/www for the native build.
// The web app stays the single source of truth; this only packages it and swaps CDN scripts for local copies.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.resolve(__dirname, '../www');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const keep = f => /^(index\.html|menu-foods\.js|manifest(-f)?\.json|badge-96\.png|icon(-f)?-\d+\.png|(privacy|terms|accessibility)(-en|-ar)?\.html)$/.test(f);
for (const f of fs.readdirSync(ROOT)) if (keep(f)) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
// notification sound: iOS and Android look it up at the web root (public/)
fs.copyFileSync(path.resolve(__dirname, '../sounds/nextrep_chime.wav'), path.join(OUT, 'nextrep_chime.wav'));
for (const d of ['i18n', 'img']) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
fs.mkdirSync(path.join(OUT, 'vendor'));
fs.copyFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'), path.join(OUT, 'vendor/supabase.js'));
let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const cdn = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
if (!html.includes(cdn)) throw new Error('supabase CDN tag not found in index.html');
html = html.replace(cdn, 'vendor/supabase.js');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('www ready:', fs.readdirSync(OUT).length, 'entries');
