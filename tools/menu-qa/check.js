/* NextRep menu QA — generates many menus with the real app code and checks them against professional rules.
   usage: (serve the repo root on PORT) node tools/menu-qa/check.js [PORT] [--samples] [--dump=REGEX on 'kcal/Nm/style/avoid/rep']
   env SBJS = path to a local supabase UMD build (the CDN is blocked in tests). Exit code 1 when a hard rule fails. */
const { chromium } = require('playwright');
const PORT=process.argv[2]&&/^\d+$/.test(process.argv[2])?process.argv[2]:'8765', SAMPLES=process.argv.includes('--samples'), DUMP=(process.argv.find(a=>a.startsWith('--dump='))||'').slice(7);
const SBJS=process.env.SBJS||'/tmp/claude-0/-home-claude/c63db132-56fe-55ce-ab3d-ff4522493900/scratchpad/sbjs/package/dist/umd/supabase.js';
(async()=>{ const b=await chromium.launch(); const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
 await p.route(/supabase\.co/,r=>r.fulfill({status:200,body:'[]',contentType:'application/json'}));
 await p.route(/fonts\.|jsdelivr/,r=>r.fulfill({path:SBJS,contentType:'application/javascript'}));
 await p.goto(`http://127.0.0.1:${PORT}/index.html`); await p.waitForTimeout(1200);
 const R=await p.evaluate(([SAMPLES,DUMP,EXN])=>{
  const strip=s=>String(s).replace(/<[^>]+>/g,'').replace(/[⁦⁩]/g,'');
  let softOff=false; const out={runs:0,hard:{},soft:{},ex:{},samples:[]}, H=(k,msg)=>{ out.hard[k]=(out.hard[k]||0)+1; (out.ex[k]=out.ex[k]||[]).length<EXN&&out.ex[k].push(msg); }, W=(k,msg)=>{ if(softOff)return; out.soft[k]=(out.soft[k]||0)+1; (out.ex[k]=out.ex[k]||[]).length<EXN&&out.ex[k].push(msg); };
  const kc=(i)=>{ const f=MFI(i.id); return f?f.k*i.g/100:0; }, pr=(i)=>{ const f=MFI(i.id); return f?f.p*i.g/100:0; };
  const kc0=0;
  const checkMeal=(m,tag,p,st,kT)=>{ const mk=mqK(m), roles=m.items.map(i=>i.r), fs=m.items.map(i=>MFI(i.id)).filter(Boolean), ids=fs.map(f=>f.id);
     // C. composition a dietitian would serve
     const sav=fs.filter(f=>['m','f','e'].includes(f.t)||['legume','spread','tofu'].includes(f.gp)||['oli','oil','thn'].includes(f.id)), cheese=fs.filter(f=>['cot','whc','bgc','ylc','tsf','lbn'].includes(f.id));
     const sweet=fs.filter(f=>['pnb','dat','grn','oat','crf','chm','mlk','soy','why'].includes(f.id)||['alm','wal','pst','csh','pmk'].includes(f.id)||f.r==='X');
     if(sav.length&&sweet.length)H('odd_combo',`${tag} ${m.k} ${sav.map(f=>f.id)}+${sweet.map(f=>f.id)}`);
     if(ids.includes('pnb')&&cheese.length)H('odd_combo',`${tag} ${m.k} pnb+${cheese.map(f=>f.id)}`);
     const t=m.tp&&MMI(m.tp); if(t&&mqName(m)===(t.n[MLI]||t.n[0])&&!t.c.every(c=>c[0]==='?'||c.split('|').some(id=>ids.includes(id))))H('name_mismatch',`${tag} ${t.id} ${ids}`);
     if(!mqName(m))W('meal_without_name',`${tag} ${m.k} ${ids}`);
     if(m.k==='s'&&m.items.length>3)W('snack_over_3_items',`${tag} ${ids}`);
     { const P0=m.items.find(i=>i.r==='P'&&['m','f'].includes(MFI(i.id)?.t)&&!['tun','tuo','srd'].includes(i.id)); if((m.k==='l'||m.k==='d')&&P0){ const f=MFI(P0.id), ck=m.items.filter(i=>i.r==='C').reduce((a,i)=>a+kc(i),0);
       if(P0.g<f.df*.66-.5)H('main_protein_too_small',`${tag} ${m.k} ${f.id} ${P0.g}g (normal ${f.df})`); if(ck>kc(P0)*2.2&&ck>350)W('starch_dominates',`${tag} ${m.k} ${f.id} ${P0.g}g, starch ${Math.round(ck)}kcal`); } }
     if((m.k==='l'||m.k==='d')&&roles.includes('X'))W('fruit_in_main',`${tag} ${m.k} ${ids}`);
     const leg=m.items.filter(i=>MFI(i.id)?.gp==='legume').reduce((a,i)=>a+i.g,0), stc=m.items.filter(i=>i.r==='C').reduce((a,i)=>a+i.g,0); if(leg&&leg+stc>(kT>=2800?650:520))W('legume_bowl_too_big',`${tag} ${ids} ${leg}+${stc}g`);
     if(m.k==='s'&&(mk<80||mk>Math.max(350,kT*.15)))W('snack_size',`${tag} ${Math.round(mk)}`);
     if(m.k!=='s'&&mk>950)H('meal_over_950',`${tag} ${m.k} ${Math.round(mk)}`);
     if((m.k==='l'||m.k==='d')&&!roles.includes('P'))H('main_without_protein',`${tag} ${m.k} ${m.items.map(i=>i.id)}`);
     if((m.k==='l'||m.k==='d')&&!roles.includes('V'))W('main_without_veg',`${tag} ${m.k}`);
     if(roles.filter(r=>r==='C').length>1)W('two_starches',`${tag} ${m.k} ${m.items.filter(i=>i.r==='C').map(i=>i.id)}`);
     const ts=m.items.map(i=>MFI(i.id)?.t); if(st==='kosher'&&ts.includes('m')&&ts.includes('d'))H('kosher_mix',`${tag} ${m.items.map(i=>i.id)}`);
     for(const i of m.items){ const f=MFI(i.id); if(!f){ H('unknown_food',i.id); continue; }
       if(!mqOK(f,p))H('style_or_allergy_violation',`${tag} ${f.id}`);
       if(i.g<f.mn-.01||i.g>f.mx+.01)H('outside_food_range',`${tag} ${f.id} ${i.g} [${f.mn},${f.mx}]`);
       if(i.g>mqMx(m,f)+.5)H('over_meal_cap',`${tag} ${m.k} ${f.id} ${i.g}>${mqMx(m,f)}`);
       if(f.u&&f.ug&&f.us>=1&&i.g<f.mx-.01){ const q=i.g/f.ug; if(Math.abs(q-Math.round(q))>.02&&!(f.us===.5&&Math.abs(q*2-Math.round(q*2))<.02))H('fractional_unit',`${tag} ${f.id} ${q.toFixed(2)} ${f.u[0]}`); }
       const txt=strip(mqHH(f,i.g)); if(/½ כפ|¼ חופן|¾ חופן/.test(txt))H('odd_household',`${f.id} ${txt}`);
       if(!txt&&f.r!=='V'&&!(f.r==='P'&&['m','f'].includes(f.t))&&f.gp!=='tofu')W('no_household',`${f.id} ${i.g}g`); if(/\d+[¼¾]/.test(txt)&&f.u&&f.us>=1)W('quarter_of_countable',`${f.id} ${txt}`);
       if(f.r==='P'&&(f.t==='m'||f.t==='f')&&txt&&!/פחי|קופס|פרוס/.test(txt))H('meat_in_vague_unit',`${f.id} ${txt}`);
       if(f.r==='F'&&kc(i)>200)W('big_fat_portion',`${tag} ${f.id} ${Math.round(kc(i))}kcal`);
       if((m.k==='b'||m.k==='s')&&['tun','tuo','srd'].includes(f.id)&&i.g>f.ug+.01)H('two_cans_light_meal',`${tag} ${f.id} ${i.g}`);
       if(f.gp==='egg'&&f.ug&&i.g/f.ug>3.01)H('more_than_3_eggs',`${tag} ${i.g}`); }};
  const styles=['any','kosher','pesc','veg','vegan'], avoids=[[],['l'],['g'],['e','f']];
  for(const kT of [1200,1400,1600,1800,2000,2200,2500,2800,3200,3600])for(const n of [3,4,5])for(const st of styles)for(const av of avoids)for(let rep=0;rep<2;rep++){
   if(av.length&&rep)continue;
   S.settings.kcalT=kT; // protein target like the app sets it (lean mass × 1.7–2.0 g): ~30% of kcal on a small target, levelling off near 200 g on a big one
   S.settings.protT=Math.round(Math.min(kT*(st==='vegan'?.06:st==='veg'?.065:.075),130+kT*.02)); const p={style:st,avoid:av,meals:n,likes:[]};
   let ms; try{ ms=mqGen(p,7000+kT+n*31+rep*97+av.length*13); }catch(e){ H('crash',String(e)); continue; }
   out.runs++; const tag=`${kT}/${n}m/${st}/${av.join('')||'-'}`;
   const K=ms.reduce((a,m)=>a+mqK(m),0), P=ms.reduce((a,m)=>a+mqPr(m),0);
   // D. day level
   if(Math.abs(K-kT)>kT*.07)H('day_kcal_off_7pct',`${tag} ${Math.round(K)} vs ${kT}`); else if(Math.abs(K-kT)>kT*.04)W('day_kcal_off_4pct',`${tag} ${Math.round(K)}`);
   if(!['veg','vegan'].includes(st)&&!(st==='pesc'&&av.includes('f'))&&P<S.settings.protT*.85)H('protein_under_85pct',`${tag} ${Math.round(P)}/${S.settings.protT}`);
   const veg=ms.flatMap(m=>m.items).filter(i=>i.r==='V').reduce((a,i)=>a+i.g,0); if(veg<300)W('veg_under_300g',`${tag} ${veg}g`);
   const fruit=ms.flatMap(m=>m.items).filter(i=>i.r==='X').length; if(fruit>3)W('fruit_over_3',`${tag} ${fruit}`);
   const mainsP=ms.filter(m=>m.k==='l'||m.k==='d').map(m=>m.items.find(i=>i.r==='P')?.id).filter(Boolean); if(mainsP.length>1&&new Set(mainsP).size<mainsP.length)W('same_protein_lunch_dinner',`${tag} ${mainsP}`);
   const lunch=ms.find(m=>m.k==='l'); for(const s of ms.filter(m=>m.k==='s'))if(lunch&&mqK(s)>mqK(lunch))H('snack_bigger_than_lunch',tag);
   const bf=ms.find(m=>m.k==='b'); if(bf&&(mqK(bf)<kT*.15||mqK(bf)>kT*.35))W('breakfast_share',`${tag} ${Math.round(mqK(bf))}`);
   { const cnt={}; for(const m of ms)for(const id of new Set(m.items.filter(i=>i.r!=='V'&&!['oil','thn'].includes(i.id)).map(i=>i.id)))cnt[id]=(cnt[id]||0)+1; const rep3=Object.keys(cnt).filter(id=>cnt[id]>=3); if(rep3.length)W('same_food_3_meals',`${tag} ${rep3}`); }
   const eggs3=ms.flatMap(m=>m.items).filter(i=>MFI(i.id)?.gp==='egg'&&MFI(i.id).ug&&i.g/MFI(i.id).ug>2.99); if(eggs3.length)W('three_eggs',tag);
   for(const m of ms)checkMeal(m,tag,p,st,kT);
   // "another meal": every meal re-rolled once must pass the same rules
   if(rep===0){ S.settings.mq={p,meals:JSON.parse(JSON.stringify(ms))}; const day=S.settings.mq.meals; for(const m of day){ try{ mqReroll(m,day); }catch(e){ H('crash',String(e)); continue; } checkMeal(m,'reroll '+tag,p,st,kT); } S.settings.mq=null; }
   if(DUMP?new RegExp(DUMP).test(tag+'/'+rep):(SAMPLES&&rep===0&&!av.length&&n===4&&[1600,2200,2800].includes(kT)&&['any','veg','kosher'].includes(st)))
     out.samples.push(`== ${tag}: ${Math.round(K)} kcal, P ${Math.round(P)}/${S.settings.protT}\n`+ms.map(m=>`  ${MQ_K[m.k]} ${Math.round(mqK(m))} kcal ${mqName(m)?'· '+mqName(m):''}\n`+m.items.map(i=>{ const f=MFI(i.id); return `     - ${mfName(f)}: ${strip(mqHH(f,i.g))||''} ${Math.round(i.g)}g ${Math.round(kc(i))}kcal`; }).join('\n')).join('\n'));
  }
  // AI meals ("Repi, build it" / "tell Repi"): whatever ids the model returns, the meal that lands passes the same rules
  { const AI=[['tun','tun','pnb','ban','brd'],['egg','egg','dat','brd','tom'],['cot','per','pnb'],['chk','ric','sld','thn'],['sal','pot','brc','apl'],['tof','ric','brc','alm'],['ygp','grn','str','wal'],['stk','pot','sld','cot']];
    for(const kT of [1400,2200,3200])for(const st of ['any','kosher','vegan'])for(const k of ['b','l','s','d'])for(const ids of AI){ S.settings.kcalT=kT; const p={style:st,avoid:[],meals:4,likes:[]};
      const m={k,tp:null,items:[{r:'P',id:k==='s'?'ygp':'chk',g:k==='s'?150:150},{r:'C',id:'ric',g:k==='s'?80:200}]}; softOff=true; if(mqAIMeal(m,{items:ids,name:'x'},p))checkMeal(m,`ai ${kT}/${st}/${k}/${ids}`,p,st,kT); softOff=false; } } // the model's own choices (a yogurt bowl for dinner) are allowed: hard rules only
  // B. one-square display for every food (picker "100 קק״ל = …")
  for(const kT of [1400,2200,3200]){ S.settings.kcalT=kT; for(const f of MF())for(const k of ['b','l','s','d'])for(let kcal=60;kcal<=700;kcal+=40){ const m={k,items:[]}, g=mqFitG(f,kcal,m), txt=strip(mqHH(f,g));
    if(g<f.mn-.01||g>f.mx+.01||g>mqMx(m,f)+.5)H('picker_amount',`${kT} ${k} ${f.id} ${kcal}kcal -> ${g}g`);
    if(/½ כפ|¼ חופן|¾ חופן/.test(txt)||(f.u&&f.us>=1&&/[¼¾]/.test(txt)))H('picker_household',`${f.id} ${txt}`);
    if(f.r==='P'&&(f.t==='m'||f.t==='f')&&txt&&!/פחי|קופס|פרוס/.test(txt))H('picker_meat_unit',`${f.id} ${txt}`); } }
  for(const f of MF()){ const t=strip(mqOne(f)); if(f.r==='P'&&(f.t==='m'||f.t==='f')&&!/גר׳|פחי|קופס|פרוס/.test(t))H('picker_meat_unit',`${f.id} ${t}`); }
  return out; },[SAMPLES,DUMP,+process.env.EXN||4]);
 console.log(`runs: ${R.runs}  page errors: ${errs.length}`);
 const pr=(o,lab)=>{ for(const k of Object.keys(o).sort((a,b)=>o[b]-o[a]))console.log(`${lab} ${k}: ${o[k]}\n    e.g. ${R.ex[k].join(' | ')}`); };
 pr(R.hard,'HARD'); pr(R.soft,'soft');
 if(SAMPLES||DUMP)console.log('\n'+R.samples.join('\n\n'));
 if(errs.length)console.log(errs.slice(0,5));
 await b.close(); process.exit(Object.keys(R.hard).length||errs.length?1:0); })();
