// recipe scaling engine + sheet (prototype, injected into the app page)
window.rcpFood=it=>it.id?MF().find(f=>f.id===it.id):null;
// cooked-value foods: shown as bought (raw meat / dry grains). [raw g per cooked g, name, kind, g per cup dry, pack g]
window.RCP_RAW={chk:[1.33,'חזה עוף','m'],thg:[1.35,'פרגיות','m'],tky:[1.33,'חזה הודו טחון','m',0,500],bef:[1.3,'בשר בקר טחון','m',0,500],sal:[1.2,'פילה סלמון','m'],
  ric:[.34,'אורז לבן','g',185],brr:[.36,'אורז מלא','g',190],pas:[.42,'פסטה','g',0,500],cus:[.4,'קוסקוס','g',175]};
window.RCP_NM={swp:'בטטה',pot:'תפוח אדמה',brc:'ברוקולי',grb:'שעועית ירוקה',pep:'פלפל אדום',sld:'סלט ירקות'};
window.rcpGr=f=>f&&f.hm&&f.hm[1]==='מנה';
window.rcpStep=(f,base)=>{ if(!f)return 1; if(RCP_RAW[f.id])return 10/RCP_RAW[f.id][0]; if(f.u&&f.ug)return f.ug*(f.us||1); if(f.hm&&!rcpGr(f))return f.hm[0]*(f.hm[1]==='כוס'?.25:.5); return base<60?5:10; };
window.rcpVals=(it,g)=>{ const f=rcpFood(it)||it, m=(g??it.g)/100; return {k:f.k*m,p:f.p*m,cb:f.cb*m,ft:f.ft*m}; };
window.rcpTot=(R,G)=>R.it.reduce((a,it,i)=>{ const v=rcpVals(it,G[i]); a.k+=v.k;a.p+=v.p;a.cb+=v.cb;a.ft+=v.ft; return a; },{k:0,p:0,cb:0,ft:0});
window.rcpFit=(R,K,PT)=>{
  const G=R.it.map(it=>it.g), ix=r=>R.it.findIndex(it=>it.r===r);
  const st=i=>rcpStep(rcpFood(R.it[i]),R.it[i].g), rnd=(i,g)=>Math.max(st(i),Math.round(g/st(i))*st(i));
  const cap=i=>{ const it=R.it[i], f=rcpFood(it); return Math.max(it.g,it.mx||(f&&f.mx)||it.g*2); };
  const set=(i,g,lo)=>{ G[i]=rnd(i,Math.min(cap(i),Math.max(R.it[i].g*lo,g))); };
  const iP=ix('P'), iC=ix('C'), iF=ix('F'), others=(i,k)=>rcpTot(R,G)[k]-rcpVals(R.it[i],G[i])[k];
  if(iP>=0){ const f=rcpFood(R.it[iP]); set(iP,(PT-others(iP,'p'))/f.p*100,.6); }
  if(iC>=0){ const f=rcpFood(R.it[iC]); set(iC,(K-others(iC,'k'))/f.k*100,.35); }
  if(iP>=0&&rcpTot(R,G).k<K*.94){ const f=rcpFood(R.it[iP]); set(iP,(K-others(iP,'k'))/f.k*100,.6); }
  if(iP>=0&&rcpTot(R,G).k>K*1.06){ const f=rcpFood(R.it[iP]); set(iP,G[iP]-(rcpTot(R,G).k-K)/f.k*100,.6); }
  if(iF>=0){ const t=rcpTot(R,G).k; if(t>K*1.06)set(iF,R.it[iF].g*.5,.5); else if(t<K*.94){ const f=rcpFood(R.it[iF]); set(iF,G[iF]+(K-t)/f.k*100,1); } }
  const t=rcpTot(R,G); return {G,t,ok:Math.abs(t.k-K)<=K*.1};
};
window.rcpAmt=(it,g)=>{ const f=rcpFood(it); if(!f)return {a:it.h,n:it.x};
  const W=RCP_RAW[f.id];
  if(W){ const r=Math.round(g*W[0]/10)*10, pk=W[4]&&r/W[4]>=.2?` · בערך ${fracQ(Math.max(.25,Math.round(r/W[4]*4)/4))} ${W[2]==='m'?'מגש':'חבילה'} של ${W[4]} ג׳`:'';
    if(W[2]==='m')return {a:r+' '+tt('ג׳'),n:W[1],id:f.id,sub:`לפני בישול${pk} · אחרי בישול כ־${Math.round(g/10)*10} ג׳`,raw:1};
    const cq=f.hm?Math.round(g/f.hm[0]*4)/4:0, dq=W[3]?Math.round(r/W[3]*4)/4:0;
    return {a:r+' '+tt('ג׳'),n:W[1],id:f.id,sub:`יבש${dq?` · בערך ${fracQ(dq)} ${dq>1?'כוסות':'כוס'}`:''}${pk}${cq?` · יוצא כ־${fracQ(cq)} ${cq>1?'כוסות':'כוס'} מבושל`:''}`,raw:1}; }
  const nm=RCP_NM[f.id]||f.n[0];
  if(f.u&&f.ug){ const q=g/f.ug; return {a:fracQ(q)+' '+(q>1?(f.up||f.u)[0]:f.u[0]),n:nm,id:f.id}; }
  if(f.hm&&!rcpGr(f)){ const st=f.hm[1]==='כוס'?.25:.5, q=Math.round(g/f.hm[0]/st)*st; return {a:fracQ(q)+' '+(q>1?f.hm[2]:f.hm[1]),n:nm,id:f.id,sub:Math.round(g)+' '+tt('ג׳')}; }
  return {a:Math.round(g)+' '+tt('ג׳'),n:nm,id:f.id}; };
window.rcpLine=(it,g)=>{ const A=rcpAmt(it,g); if(!A.id)return A.a==='לפי הטעם'?A.n:A.a.includes(A.n)?A.a:`${A.a} ${A.n}`; if(A.raw)return `${A.a} ${A.n}${RCP_RAW[A.id][2]==="g"?(A.id==="pas"?" יבשה":" יבש"):""}`; const m=amtName(A.a,A.n,A.id); return `${m.b} ${m.rest}`.trim(); };
window.openRecipe=(R,K,PT,lbl)=>{
  const {G,t}=rcpFit(R,K,PT);
  const rows=R.it.map((it,i)=>{ const A=rcpAmt(it,G[i]), f=rcpFood(it); const m={b:A.a,rest:A.n};
    return `<div class="rc-it">${f?fdImg(f,40,18):'<span class="rc-ph"></span>'}<div class="rc-in"><b>${esc(m.rest)}</b>${A.sub?`<small class="num">${A.sub}</small>`:''}</div><span class="rc-q num">${esc(m.b)}</span>${it.r==='P'||it.r==='C'?`<i class="rc-tag ${it.r}">${it.r==='P'?'מותאם לחלבון':'מותאם לקלוריות'}</i>`:''}</div>`; }).join('');
  const steps=R.st.map((s,i)=>`<li><span class="rc-n num">${i+1}</span><p>${esc(s).replace(/\{(\d+)\}/g,(_,n)=>`<b>${esc(rcpLine(R.it[+n],G[+n]))}</b>`)}</p></li>`).join('');
  const hero=R.it.filter(it=>it.id).sort((a,b)=>(b.r==='P')-(a.r==='P')||(b.r==='C')-(a.r==='C')).slice(0,3).map(it=>fdImg(it.id,84,30)).join('');
  openSheet(`<div class="rc">
    <div class="rc-hero">${hero}</div>
    <h3 class="rc-t">${esc(R.n)}</h3>
    <div class="rc-meta"><span>${R.min} ${tt('דק׳')}</span>${R.tags.map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="rc-fit"><div><b class="num">${Math.round(t.k)}</b><small>קק״ל</small></div><div><b class="num">${Math.round(t.p)}</b><small>${tt('ג׳ חלבון')}</small></div><div><b class="num">${Math.round(t.cb)}</b><small>${tt('ג׳ פחמימה')}</small></div><div><b class="num">${Math.round(t.ft)}</b><small>${tt('ג׳ שומן')}</small></div></div>
    <div class="rc-why">${lbl}</div>
    <h4 class="rc-h">רכיבים · מנה אחת</h4><div class="rc-l">${rows}</div>
    <h4 class="rc-h">הכנה</h4><ol class="rc-s">${steps}</ol>
    <button class="btn primary big" style="width:100%;margin-top:14px">אכלתי את זה ✓</button>
    <button class="btn" style="width:100%;margin-top:8px">הוסף לתפריט במקום הארוחה</button></div>`);
};
(()=>{ const st=document.createElement('style'); st.textContent=`
.rc-hero{display:flex;justify-content:center;gap:-10px;padding:18px 0 6px}.rc-hero .fd-img{border-radius:50%;border:3px solid var(--surface);margin:0 -8px;box-shadow:0 6px 18px #0006}
.rc-t{text-align:center;font-size:24px;margin:10px 0 6px}.rc-meta{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}.rc-meta span{font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:20px;background:var(--surface2);color:var(--muted)}
.rc-fit{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:16px 0 8px}.rc-fit div{display:flex;flex-direction:column;align-items:center;padding:10px 4px;border-radius:14px;background:var(--surface2)}.rc-fit b{font-size:20px}.rc-fit div:first-child b{color:var(--accent)}.rc-fit small{font-size:11.5px;color:var(--muted)}
.rc-why{font-size:13px;color:var(--muted);text-align:center;margin-bottom:6px}
.rc-h{font-size:15px;margin:18px 0 6px;color:var(--muted)}
.rc-it{display:grid;grid-template-columns:40px 1fr auto;grid-template-rows:auto auto;column-gap:12px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}.rc-it:first-child{border-top:0}.rc-it>:first-child{grid-row:span 2}
.rc-ph{width:40px;height:40px;border-radius:50%;background:var(--surface2);box-shadow:inset 0 0 0 1px var(--line)}.rc-q{text-align:end;white-space:nowrap}.rc-in{display:flex;flex-direction:column}.rc-in b{font-size:15px}.rc-in small{font-size:12px;color:var(--muted)}.rc-q{font-weight:800;font-size:15px}
.rc-tag{grid-column:2/4;font-style:normal;font-size:11px;font-weight:700;color:var(--accent);margin-top:2px}.rc-tag.C{color:#f5c542}
.rc-s{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}.rc-s li{display:flex;gap:12px;align-items:flex-start}.rc-n{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--surface2);font-weight:800;font-size:13px}.rc-s p{margin:2px 0 0;font-size:15px;line-height:1.55}.rc-s b{color:var(--accent);font-weight:700}`; document.head.appendChild(st); })();
