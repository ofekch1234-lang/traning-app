const path=require('path');const ROOT=path.resolve(__dirname,'../..');process.chdir(__dirname);
const ts=require('typescript'),fs=require('fs');
const src=fs.readFileSync(''+ROOT+'/index.html','utf8');
const HEB=/[֐-׿]/;
const keys=new Map(), pats=new Map();
const ent=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&rlm;|&lrm;|‏|‎/g,'');
const norm=s=>ent(s).replace(/\s+/g,' ').trim();
function addRun(run,where){
  run=norm(run); if(!HEB.test(run))return;
  if(/\u0001\d+\u0001/.test(run)){
    // renumber placeholders 0..n
    let i=0; const p=run.replace(/\u0001\d+\u0001/g,()=>`{${i++}}`);
    if(HEB.test(p.replace(/\{\d+\}/g,''))) pats.set(p,(pats.get(p)||where));
    for(const part of run.split(/\u0001\d+\u0001/)){ const q=norm(part).replace(/^[\s·:,\-–—|/()]+|[\s·:,\-–—|/(]+$/g,''); if(HEB.test(q)&&!keys.has(q))keys.set(q,where); }
  } else if(!keys.has(run)) keys.set(run,where);
  // also strip leading emoji/symbols as separate key
}
function processHtmlish(str,where){
  // attributes with hebrew
  str.replace(/\b(placeholder|aria-label|title|alt|data-label|label)="([^"]*)"/g,(m,a,v)=>{addRun(v,where);return '';});
  const noTags=str.replace(/<[^>]*>/g,'\u0002');
  for(const run of noTags.split('\u0002')) addRun(run,where);
}
// script
const scripts=[...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const code of scripts){
  const sf=ts.createSourceFile('a.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const line=n=>sf.getLineAndCharacterOfPosition(n.getStart()).line;
  (function walk(n){
    if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){ if(HEB.test(n.text))processHtmlish(n.text,line(n)); }
    else if(ts.isTemplateExpression(n)){
      let s=n.head.text; n.templateSpans.forEach((sp,i)=>{ s+=`\u0001${i}\u0001`+sp.literal.text; });
      processHtmlish(s,line(n));
    }
    ts.forEachChild(n,walk);
  })(sf);
}
// static html outside scripts and style
const html=src.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<head>[\s\S]*?<\/head>/,'');
processHtmlish(html,'html');
fs.writeFileSync('keys.json',JSON.stringify([...keys.keys()],null,0));
fs.writeFileSync('pats.json',JSON.stringify([...pats.keys()],null,0));
const tot=[...keys.keys()].reduce((a,k)=>a+k.length,0)+[...pats.keys()].reduce((a,k)=>a+k.length,0);
console.log('keys',keys.size,'pats',pats.size,'chars',tot);
