// node rcpcheck.js [recipe files...] — validates recipes without a browser
const fs=require('fs'), vm=require('vm'); const ROOT='/home/claude/traning-app';
const ctx={console}; ctx.window=ctx; vm.createContext(ctx);
const run=(code,f)=>vm.runInContext(code,ctx,{filename:f});
run(fs.readFileSync(ROOT+'/menu-foods.js','utf8'),'menu-foods.js');
run("var MF=()=>window.MENU_FOODS; var tt=s=>s; var esc=s=>String(s); var FOOD_IMG=new Set(); var fdImg=()=>''; var niTile=()=>'';\nconst heStem=w=>{ let x=String(w||'').replace(/[\u05f3'\"\u05f4\u2066\u2069]/g,'').replace(/[\u05dd\u05df\u05e5\u05e3\u05da]$/,c=>({'\u05dd':'\u05de','\u05df':'\u05e0','\u05e5':'\u05e6','\u05e3':'\u05e4','\u05da':'\u05db'}[c])), y; do{ y=x; if(x.length>3)x=x.replace(/(\u05d9\u05d5\u05ea|\u05d9\u05ea|\u05d9\u05de|\u05d9\u05dd|\u05d5\u05ea|\u05d4|\u05d9)$/,''); }while(x!==y); return x; };\nfunction fracQ(q){ const w=Math.floor(q+1e-9), r=Math.round((q-w)*4)/4; if(r>=1)return String(w+1); const fr=r===.25?'\u00bc':r===.5?'\u00bd':r===.75?'\u00be':''; const t=(w?String(w):'')+fr||'0'; return fr?'\\u2066'+t+'\\u2069':t; }\nfunction amtName(h,name,id){ const m=String(h||'').match(/^(\\S+)\\s+(.+)$/); if(!m)return {b:h,rest:name};\n  if(id==='oml'||id==='shk')return {b:`${m[1]} ${tt('\u05d1\u05d9\u05e6\u05d9\u05dd')}`,rest:name,pre:1}; // \"\u05d7\u05d1\u05d9\u05ea\u05d4 \u05de-2 \u05d1\u05d9\u05e6\u05d9\u05dd\", not \"2 \u05d1\u05d9\u05e6\u05d9\u05dd \u05d7\u05d1\u05d9\u05ea\u05d4\"\n  const U=m[2].split(/\\s+/), N=String(name||'').split(/\\s+/);\n  if(U.length<=N.length&&U.every((w,i)=>heStem(w)&&heStem(w)===heStem(N[i]))){ const rest=N.slice(U.length).join(' ');\n    // \"2 \u05e4\u05d9\u05ea\u05d5\u05ea\" + \"\u05de\u05dc\u05d0\u05d4\" doesn't agree in Hebrew: a plural with a description reads \"2 \u00d7 \u05e4\u05d9\u05ea\u05d4 \u05de\u05dc\u05d0\u05d4\"\n    return rest&&U.join(' ')!==N.slice(0,U.length).join(' ')?{b:m[1]+' \u00d7',rest:name}:{b:h,rest}; }\n  return {b:h,rest:name}; }\n",'stubs');
run(fs.readFileSync(ROOT+'/recipes.js','utf8'),'recipes.js');
const files=process.argv.slice(2); for(const f of files)run(fs.readFileSync(f,'utf8'),f);
run(fs.readFileSync(__dirname+'/rcp-engine-node.js','utf8'),'engine');
const R=vm.runInContext('window.RECIPES',ctx), E=k=>vm.runInContext(k,ctx);
const rcpFit=E('rcpFit'), rcpAmt=E('rcpAmt'), rcpLine=E('rcpLine'), rcpFood=E('rcpFood'), RAW=E('RCP_RAW'), rcpDiet=E('rcpDiet');
const only=process.env.ONLY?new Set(process.env.ONLY.split(',')):null;
const ids={}; let bad=0;
for(const r of R){ ids[r.id]=(ids[r.id]||0)+1; }
for(const r of R){ if(only&&!only.has(r.id))continue; const fl=[]; if(ids[r.id]>1)fl.push('DUP ID');
  if(!/^(b|w|m|s|bm|bw|ms|bms)$/.test(r.s||''))fl.push('bad s');
  r.st.forEach(s=>{ for(const m of s.matchAll(/\{(\d+)\}/g))if(+m[1]>=r.it.length)fl.push('bad ref '+m[0]); });
  r.it.forEach((it,i)=>{ if(it.id&&!rcpFood(it))fl.push('missing food '+it.id); if(!it.id&&!it.x)fl.push('item without id/x #'+i); if(it.r&&!r.st.some(s=>s.includes('{'+i+'}')))fl.push('scaled item not in steps: '+(it.id||it.x)); });
  const roles=r.it.map(i=>i.r).filter(Boolean); if(!roles.includes('P'))fl.push('no P'); if(!roles.includes('C')&&!r.noC)fl.push('no C');
  const T=r.s==='s'?[[200,15],[260,20],[330,25]]:/^[bw]+$/.test(r.s)?[[400,30],[500,38],[650,48]]:[[480,36],[600,45],[780,54]];
  const res=T.map(([K,PT])=>{ let f; try{ f=rcpFit(r,K,PT); }catch(e){ fl.push('fit error '+e.message); return null; } const {G,t}=f;
    r.it.forEach((it,i)=>{ const fd=rcpFood(it), g=G[i], W=fd&&RAW[fd.id];
      if(W&&W[2]==='m'&&g*W[0]>320)fl.push(`${K}: raw meat ${Math.round(g*W[0])}g`);
      if(!fd&&it.r==='P'&&g>300)fl.push(`${K}: ${it.x} ${g}g`);
      if(W&&W[2]==='g'&&g*W[0]>150)fl.push(`${K}: dry grain ${Math.round(g*W[0])}g`);
      if(fd&&fd.id==='egg'&&g/58>4.01)fl.push(`${K}: eggs ${g/58}`); if(fd&&fd.id==='brd'&&g/30>4)fl.push(`${K}: bread ${g/30}`); if(fd&&fd.id==='pit'&&g/90>2)fl.push(`${K}: pita ${g/90}`);
      if(fd&&fd.id==='oil'&&g>15)fl.push(`${K}: oil ${g}`); });
    return {K,k:Math.round(t.k),p:Math.round(t.p),dk:Math.round((t.k-K)/K*100)}; }).filter(Boolean);
  const midFit=res[1]&&Math.abs(res[1].dk)<=10; if(!midFit)fl.push('MID TARGET MISS');
  const lo=Math.round(rcpFit(r,100,5).t.k), hi=Math.round(rcpFit(r,3000,250).t.k);
  const line=`${r.id.padEnd(6)} ${r.s.padEnd(3)} ${rcpDiet(r).padEnd(7)} ${String(lo).padStart(4)}-${String(hi).padEnd(5)} ${res.map(x=>`${x.k}(${x.dk>0?'+':''}${x.dk}%) ${x.p}p`).join(' | ')}`;
  if(fl.length)bad++; if(fl.length||process.env.ALL)console.log(line+(fl.length?'  !! '+[...new Set(fl)].join('; '):''));
  if(process.env.TEXT){ const G=rcpFit(r,T[1][0],T[1][1]).G; console.log('   '+r.n+' :: '+r.it.map((it,i)=>{const A=rcpAmt(it,G[i]);return (A.a&&A.a!=='לפי הטעם'?A.a+' ':'')+A.n+(A.sub?' ['+A.sub+']':'');}).join(' | ').replace(/[⁦⁩]/g,'')); r.st.forEach((s,j)=>console.log('     '+(j+1)+'. '+s.replace(/\{(\d+)\}/g,(_,n)=>'«'+rcpLine(r.it[+n],G[+n]).replace(/[⁦⁩]/g,'')+'»'))); }
}
console.log(`
${R.length} recipes total · ${only?only.size:R.length} checked · ${bad} with issues`);
