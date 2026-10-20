// merge out*.json + extra*.json → /home/claude/traning-app/i18n/{ar,en}.js ; report keys from current extraction without translation
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'../..');process.chdir(__dirname+'/src');
const T={};
for(const f of [...fs.readdirSync('.').filter(f=>/^out\d+\.json$/.test(f)).sort(),...fs.readdirSync('.').filter(f=>/^extra.*\.json$/.test(f)).sort()]) Object.assign(T,JSON.parse(fs.readFileSync(f,'utf8')));
const keys=require('./keys.json'),pats=require('./pats.json');
const missing=[...keys,...pats].filter(k=>!T[k]);
fs.writeFileSync('missing.json',JSON.stringify(missing.map(he=>({he,pattern:pats.includes(he)||undefined})),null,1));
fs.mkdirSync(ROOT+'/i18n',{recursive:true});
for(const L of ['ar','en']){
  const k={},p=[];
  for(const [he,v] of Object.entries(T)){ if(!v||!v[L])continue; let val=v[L];
    if(L==='en'){ const sw={'←':'→','→':'←'}; val=val.replace(/[←→]/g,ch=>he.includes(ch)?sw[ch]:ch); } if(/\{\d+\}/.test(he))p.push([he,val]); else k[he]=val; }
  fs.writeFileSync(`${ROOT}/i18n/${L}.js`,'window.I18N_DATA='+JSON.stringify({k,p})+';\n');
  console.log(L,Object.keys(k).length,'keys',p.length,'patterns');
}
console.log('missing',missing.length);
{ const F=JSON.parse(fs.readFileSync('fem.json','utf8')); const k={},p=[]; for(const [m,f] of Object.entries(F)){ if(/\{\d+\}/.test(m))p.push([m,f]); else k[m]=f; }
  fs.writeFileSync(`${ROOT}/i18n/he-f.js`,'window.I18N_DATA='+JSON.stringify({k,p})+';\n'); console.log('he-f',Object.keys(k).length,'keys',p.length,'patterns'); }
// cache-busting: hash of both dictionaries → index.html loader
const crypto=require('crypto');
const h=crypto.createHash('md5').update(fs.readFileSync(ROOT+'/i18n/ar.js')).update(fs.readFileSync(ROOT+'/i18n/en.js')).update(fs.readFileSync(ROOT+'/i18n/he-f.js')).digest('hex').slice(0,8);
const ip=ROOT+'/index.html'; let html=fs.readFileSync(ip,'utf8');
html=html.replace(/(i18n\/(?:'\+L\+'|he-f)\.js\?v=)[^"'<\\]*/g,(m,a)=>a+h); fs.writeFileSync(ip,html); console.log('hash',h);
