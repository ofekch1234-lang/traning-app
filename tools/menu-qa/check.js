/* NextRep menu QA — generates many menus with the real app code and checks them against professional rules.
   usage: (serve the repo root on PORT) node tools/menu-qa/check.js [PORT] [--samples]
   env SBJS = path to a local supabase UMD build (the CDN is blocked in tests). Exit code 1 when a hard rule fails. */
const { chromium } = require('playwright');
const PORT=process.argv[2]&&/^\d+$/.test(process.argv[2])?process.argv[2]:'8765', SAMPLES=process.argv.includes('--samples');
const SBJS=process.env.SBJS||'/tmp/claude-0/-home-claude/c63db132-56fe-55ce-ab3d-ff4522493900/scratchpad/sbjs/package/dist/umd/supabase.js';
(async()=>{ const b=await chromium.launch(); const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
 await p.route(/supabase\.co/,r=>r.fulfill({status:200,body:'[]',contentType:'application/json'}));
 await p.route(/fonts\.|jsdelivr/,r=>r.fulfill({path:SBJS,contentType:'application/javascript'}));
 await p.goto(`http://127.0.0.1:${PORT}/index.html`); await p.waitForTimeout(1200);
 const R=await p.evaluate((SAMPLES)=>{
  const strip=s=>String(s).replace(/<[^>]+>/g,'').replace(/[⁦⁩]/g,'');
  const out={runs:0,hard:{},soft:{},ex:{},samples:[]}, H=(k,msg)=>{ out.hard[k]=(out.hard[k]||0)+1; (out.ex[k]=out.ex[k]||[]).length<4&&out.ex[k].push(msg); }, W=(k,msg)=>{ out.soft[k]=(out.soft[k]||0)+1; (out.ex[k]=out.ex[k]||[]).length<4&&out.ex[k].push(msg); };
  const kc=(i)=>{ const f=MFI(i.id); return f?f.k*i.g/100:0; }, pr=(i)=>{ const f=MFI(i.id); return f?f.p*i.g/100:0; };
  const styles=['any','kosher','pesc','veg','vegan'], avoids=[[],['l'],['g'],['e','f']];
  for(const kT of [1200,1400,1600,1800,2000,2200,2500,2800,3200,3600])for(const n of [3,4,5])for(const st of styles)for(const av of avoids)for(let rep=0;rep<2;rep++){
   if(av.length&&rep)continue;
   S.settings.kcalT=kT; S.settings.protT=Math.round(kT*(st==='vegan'?.06:st==='veg'?.065:.075)); const p={style:st,avoid:av,meals:n,likes:[]};
   let ms; try{ ms=mqGen(p,7000+kT+n*31+rep*97+av.length*13); }catch(e){ H('crash',String(e)); continue; }
   out.runs++; const tag=`${kT}/${n}m/${st}/${av.join('')||'-'}`;
   const K=ms.reduce((a,m)=>a+mqK(m),0), P=ms.reduce((a,m)=>a+mqPr(m),0);
   // D. day level
   if(Math.abs(K-kT)>kT*.07)H('day_kcal_off_7pct',`${tag} ${Math.round(K)} vs ${kT}`); else if(Math.abs(K-kT)>kT*.04)W('day_kcal_off_4pct',`${tag} ${Math.round(K)}`);
   if(!['veg','vegan'].includes(st)&&P<S.settings.protT*.85)H('protein_under_85pct',`${tag} ${Math.round(P)}/${S.settings.protT}`);
   const veg=ms.flatMap(m=>m.items).filter(i=>i.r==='V').reduce((a,i)=>a+i.g,0); if(veg<300)W('veg_under_300g',`${tag} ${veg}g`);
   const fruit=ms.flatMap(m=>m.items).filter(i=>i.r==='X').length; if(fruit>3)W('fruit_over_3',`${tag} ${fruit}`);
   const mainsP=ms.filter(m=>m.k==='l'||m.k==='d').map(m=>m.items.find(i=>i.r==='P')?.id).filter(Boolean); if(mainsP.length>1&&new Set(mainsP).size<mainsP.length)W('same_protein_lunch_dinner',`${tag} ${mainsP}`);
   const lunch=ms.find(m=>m.k==='l'); for(const s of ms.filter(m=>m.k==='s'))if(lunch&&mqK(s)>mqK(lunch))H('snack_bigger_than_lunch',tag);
   const bf=ms.find(m=>m.k==='b'); if(bf&&(mqK(bf)<kT*.15||mqK(bf)>kT*.35))W('breakfast_share',`${tag} ${Math.round(mqK(bf))}`);
   for(const m of ms){ const mk=mqK(m), roles=m.items.map(i=>i.r);
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
       const txt=strip(mqHH(f,i.g)); if(/\d+[¼¾]/.test(txt)&&f.u&&f.us>=1)W('quarter_of_countable',`${f.id} ${txt}`);
       if(f.r==='P'&&(f.t==='m'||f.t==='f')&&txt&&!/פחי|קופס|פרוס/.test(txt))H('meat_in_vague_unit',`${f.id} ${txt}`);
       if(f.r==='F'&&kc(i)>200)W('big_fat_portion',`${tag} ${f.id} ${Math.round(kc(i))}kcal`);
       if((m.k==='b'||m.k==='s')&&['tun','tuo','srd'].includes(f.id)&&i.g>f.ug+.01)H('two_cans_light_meal',`${tag} ${f.id} ${i.g}`);
       if(f.gp==='egg'&&f.ug&&i.g/f.ug>3.01)H('more_than_3_eggs',`${tag} ${i.g}`); } }
   if(SAMPLES&&rep===0&&!av.length&&n===4&&[1600,2200,2800].includes(kT)&&['any','veg','kosher'].includes(st))
     out.samples.push(`== ${tag}: ${Math.round(K)} kcal, P ${Math.round(P)}/${S.settings.protT}\n`+ms.map(m=>`  ${MQ_K[m.k]} ${Math.round(mqK(m))} kcal ${mqName(m)?'· '+mqName(m):''}\n`+m.items.map(i=>{ const f=MFI(i.id); return `     - ${mfName(f)}: ${strip(mqHH(f,i.g))||''} ${Math.round(i.g)}g ${Math.round(kc(i))}kcal`; }).join('\n')).join('\n'));
  }
  // B. one-square display for every food (picker "100 קק״ל = …")
  for(const f of MF()){ const t=strip(mqOne(f)); if(f.r==='P'&&(f.t==='m'||f.t==='f')&&!/גר׳|פחי|קופס|פרוס/.test(t))H('picker_meat_unit',`${f.id} ${t}`); }
  return out; },SAMPLES);
 console.log(`runs: ${R.runs}  page errors: ${errs.length}`);
 const pr=(o,lab)=>{ for(const k of Object.keys(o).sort((a,b)=>o[b]-o[a]))console.log(`${lab} ${k}: ${o[k]}\n    e.g. ${R.ex[k].join(' | ')}`); };
 pr(R.hard,'HARD'); pr(R.soft,'soft');
 if(SAMPLES)console.log('\n'+R.samples.join('\n\n'));
 if(errs.length)console.log(errs.slice(0,5));
 await b.close(); process.exit(Object.keys(R.hard).length||errs.length?1:0); })();
