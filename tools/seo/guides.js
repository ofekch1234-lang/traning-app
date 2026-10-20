// Guides: markdown (tools/seo/guides/<lang>/*.md with front matter) → /guide/<slug> pages + index. Used by build.js.
const fs=require('fs'),path=require('path');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const L={he:{index:'מדריכים: אימונים, תזונה והתקדמות',indexD:'מדריכים קצרים ומעשיים על אימוני כוח, חלבון, קלוריות וירידה במשקל, בלי מיתוסים. מבוסס על מחקר, כתוב בעברית פשוטה.',crumb:'מדריכים',min:'דק׳ קריאה',more:'עוד מדריכים',cta:'7 ימים חינם',by:'צוות NextRep'},
         ar:{index:'أدلة: التمارين والتغذية والتقدم',indexD:'أدلة قصيرة وعملية عن تمارين القوة والبروتين والسعرات وخسارة الوزن، بلا خرافات.',crumb:'أدلة',min:'دقائق قراءة',more:'المزيد من الأدلة',cta:'7 أيام مجانًا',by:'فريق NextRep'}};
const base=l=>l==='he'?'/guide/':`/${l}/guide/`;
function parse(md){ const m=md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); const meta={}; for(const line of m[1].split('\n')){ const i=line.indexOf(':'); meta[line.slice(0,i).trim()]=line.slice(i+1).trim(); } return {meta,body:m[2]}; }
function inline(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2">$1</a>'); }
function render(md){
  const lines=md.split('\n'); let out='',list=null,para=[];
  const flush=()=>{ if(para.length){ out+=`<p>${inline(para.join(' '))}</p>`; para=[]; } };
  const closeList=()=>{ if(list){ out+=`</${list}>`; list=null; } };
  for(const raw of lines){ const l=raw.trimEnd();
    if(/^# /.test(l)){ flush(); closeList(); continue; } // h1 comes from meta
    if(/^## /.test(l)){ flush(); closeList(); out+=`<h2>${inline(l.slice(3))}</h2>`; continue; }
    if(/^### /.test(l)){ flush(); closeList(); out+=`<h3>${inline(l.slice(4))}</h3>`; continue; }
    const li=l.match(/^(?:- |\d+\. )(.*)$/);
    if(li){ flush(); const kind=/^\d/.test(l)?'ol':'ul'; if(list!==kind){ closeList(); list=kind; out+=`<${kind}>`; } out+=`<li>${inline(li[1])}</li>`; continue; }
    if(!l){ flush(); closeList(); continue; }
    para.push(l);
  }
  flush(); closeList(); return out;
}
function load(l){ const dir=path.join(__dirname,'guides',l); if(!fs.existsSync(dir))return []; return fs.readdirSync(dir).filter(f=>f.endsWith('.md')).map(f=>{ const {meta,body}=parse(fs.readFileSync(path.join(dir,f),'utf8')); const words=body.split(/\s+/).length; return {...meta,body,min:Math.max(2,Math.round(words/180)),path:base(l)+meta.slug}; }).sort((a,b)=>a.date<b.date?1:-1); }
function page(HEAD,FOOT,l,g,all){
  const t=L[l], alts=[[l,g.path]];
  const others=all.filter(x=>x!==g).slice(0,4);
  const ld={"@context":"https://schema.org","@type":"Article","headline":g.title,"description":g.desc,"datePublished":g.date,"dateModified":g.date,"inLanguage":l,"author":{"@type":"Organization","name":"NextRep"},"publisher":{"@type":"Organization","name":"NextRep","logo":{"@type":"ImageObject","url":"https://www.nextrep.co.il/icon-512.png"}},"mainEntityOfPage":"https://www.nextrep.co.il"+g.path};
  return HEAD(l,g.title,g.desc,g.path,alts,`<script type="application/ld+json">${JSON.stringify(ld)}</script><style>.art{font-size:17px;line-height:1.7}.art h2{font-size:22px;margin:26px 0 8px}.art h3{font-size:18px;margin:18px 0 6px}.art p{margin:0 0 14px}.art ul,.art ol{padding-inline-start:22px;margin:0 0 14px}.art li{margin-bottom:6px}.art a{color:var(--acc)}</style>`)+
  `<div class="crumb"><a href="${base(l)}">${t.crumb}</a></div><h1>${esc(g.title)}</h1><div class="sub">${t.by} · ${g.date.slice(0,7).replace('-','/')} · ${g.min} ${t.min}</div><div class="art">${render(g.body)}</div>
<div class="cta"><img src="/img/kobi-happy.svg" alt=""><div style="flex:1"><b>NextRep</b><span>${l==='he'?'זוכרת כל סט, מצלמים ארוחה ומקבלים קלוריות, ומאמן AI שמסתכל על המספרים שלך.':'يتذكر كل مجموعة، صوّر وجبتك واحصل على السعرات، ومدرب ذكاء اصطناعي ينظر إلى أرقامك.'}</span></div><a href="/?utm_source=seo&utm_medium=guide&utm_content=${g.slug}">${t.cta}</a></div>
<h2 style="font-size:15px;color:var(--mut)">${t.more}</h2><div class="card list">${others.map(x=>`<a href="${x.path}"><span>${esc(x.title)}</span><b>›</b></a>`).join('')}</div>`+FOOT(l,alts);
}
function index(HEAD,FOOT,l,all){
  const t=L[l], alts=[[l,base(l)]];
  return HEAD(l,t.index,t.indexD,base(l),alts)+`<h1>${t.index}</h1><div class="sub">${t.indexD}</div><div class="card list">${all.map(x=>`<a href="${x.path}" style="flex-direction:column;align-items:flex-start;gap:2px"><span style="font-weight:700">${esc(x.title)}</span><span style="font-size:13px;color:var(--mut)">${esc(x.desc)}</span></a>`).join('')}</div>`+FOOT(l,alts);
}
module.exports={load,page,index,base};
