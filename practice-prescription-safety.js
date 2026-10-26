/* Local deterministic screening. No patient registration, network request or automatic prescription changes. */
(function(g){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const C=node?require('./clinical-workspace.js'):g.ClinicalWorkspace;
 const P=node?require('./practice-prescription.js'):g.PracticePrescription;
 const FDA='https://www.fda.gov/animal-veterinary/animal-health-literacy/get-facts-about-pain-relievers-pets';
 const ENRO='https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5b17309c-5f00-4af3-97bc-d84805261439';
 const GALL='https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a38cc5c6-93e8-4c90-aabc-33bc8423beab';
 const NSAID=new Set('carprofen meloxicam firocoxib robenacoxib deracoxib ketoprofen piroxicam aspirin ibuprofen naproxen grapiprant'.split(' '));
 const STEROID=new Set('prednisolone prednisone dexamethasone methylprednisolone triamcinolone hydrocortisone'.split(' '));
 const extra={paracetamol:'acetaminophen',타이레놀:'acetaminophen',아세트아미노펜:'acetaminophen',엔로플록사신:'enrofloxacin',baytril:'enrofloxacin',enroquin:'enrofloxacin',바이트릴:'enrofloxacin',갈리프란트:'grapiprant',galliprant:'grapiprant',그라피프란트:'grapiprant'};
 const norm=v=>{const n=C.norm(v);return extra[n]||n;};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=[['renal','신장 기능 이상'],['hepatic','간 기능 이상'],['hydration','탈수'],['allergy','약물 알레르기'],['medications','처방 외 복용약'],['pregnancy','임신·수유']];
 function dailyMgKg(r,weight){
  let dose=P.doseNumber(r.dose);if(r.doseUnit==='mcg')dose/=1000;else if(r.doseUnit==='T'){if(!['tablet','capsule'].includes(r.form)||!(Number(r.strength)>0)||!['mg','mcg'].includes(r.strengthUnit))return null;dose*=Number(r.strength)*(r.strengthUnit==='mcg'?.001:1);}else if(r.doseUnit!=='mg')return null;
  if(r.doseBasis==='fixed'){if(!(Number(weight)>0))return null;dose/=Number(weight);}else if(r.doseBasis!=='kg'||r.doseUnit==='T')return null;
  const times=Number(r.times);return Number.isInteger(times)&&times>0&&Number.isFinite(dose*times)?dose*times:null;
 }
 function evaluate(input={}){
  const rows=input.rows||[],names=rows.map(r=>norm(r.ingredient||r.calculationIngredient||r.drug)),checks=input.checks||{};
  const base=C.reviewPrescription({...input,rows:rows.map((r,i)=>({...r,ingredient:names[i]}))});
  // Missing history is presented once, separate from detected clinical findings.
  const organSpecific=names.some(n=>NSAID.has(n));
  const findings=base.findings.filter(f=>(!f.code.startsWith('patient-')||checks[f.code.slice(8)]==='present')&&!(organSpecific&&['patient-renal','patient-hepatic','patient-hydration','nsaid-renal'].includes(f.code)));
  const add=(severity,code,text,indices=[],source='')=>findings.push({severity,code,text,indices,source});
  rows.forEach((r,i)=>{
   const name=names[i];try{P.calculate(r,input.weight,input.species);}catch(e){add('missing','calculation',r.drug+' · '+e.message,[i]);}
   if(input.errors?.[i])add('missing','product-check',r.drug+' · '+input.errors[i],[i]);
   if(!r.presetId)add('missing','manual-strength',r.drug+' · 직접 입력 함량은 제품 표시와 대조해야 합니다.',[i]);
   if(input.species==='cat'&&name==='acetaminophen')add('warning','cat-acetaminophen','아세트아미노펜 · 고양이 투여 금기. 처방을 재검토하세요.',[i],FDA);
   if(input.species==='cat'&&NSAID.has(name))add('review','cat-nsaid',r.drug+' · 고양이의 NSAID 민감성과 해당 제품의 종·경로·기간을 확인하세요. 미국 허가정보는 국내 허가와 다를 수 있습니다.',[i],name==='grapiprant'?GALL:FDA);
   if(NSAID.has(name)&&['renal','hepatic','hydration'].some(k=>checks[k]==='present'))add('warning','organ-nsaid',r.drug+' · 신장·간 기능 이상 또는 탈수 확인사항이 있습니다. NSAID 사용과 모니터링 계획을 재검토하세요.',[i],name==='grapiprant'?GALL:FDA);
  });
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
   if(!C.overlaps(rows[i],rows[j]))continue;const a=names[i],b=names[j];
   if(a!==b&&STEROID.has(a)&&STEROID.has(b))add('review','steroid-duplicate','스테로이드 계열 중복 · '+rows[i].drug+' / '+rows[j].drug+'의 병용 의도를 확인하세요.',[i,j]);
   if((a==='grapiprant'&&(NSAID.has(b)||STEROID.has(b)))||(b==='grapiprant'&&(NSAID.has(a)||STEROID.has(a))))add('warning','grapiprant-pair','Grapiprant와 다른 NSAID·스테로이드의 병용은 허가문서에서 피하도록 안내합니다.',[i,j],GALL);
   const cations=new Set(['calciumcarbonate','ferroussulfate','aluminumhydroxide','magnesiumhydroxide']);
   if((a==='enrofloxacin'&&cations.has(b))||(b==='enrofloxacin'&&cations.has(a)))add('review','enro-cation','Enrofloxacin과 금속 양이온 함유 약물 · 경구 흡수 저하 가능성이 있어 투여 시점을 검토하세요.',[i,j],ENRO);
  }
  if(input.species==='cat'){
   const totals=new Map(),indices=[];let incomplete=false;
   rows.forEach((r,i)=>{if(names[i]!=='enrofloxacin')return;indices.push(i);let amount=null;try{amount=dailyMgKg(r,input.weight);}catch{}const days=C.doseDays(r);if(amount===null||!days||r.route!=='PO'||r.issues?.length&&!r.reviewed){incomplete=true;return;}for(const day of days)totals.set(day,(totals.get(day)||0)+amount);});
   if(indices.length){const max=Math.max(0,...totals.values());if(max>5+1e-9)add('warning','cat-enro-dose','Enrofloxacin · 같은 투여일의 합산량이 최대 '+Number(max.toFixed(4))+' mg/kg/일입니다. 고양이 경구 허가문서의 5 mg/kg/일 상한을 초과합니다. 망막 독성 위험을 확인하세요.',indices,ENRO);if(incomplete)add('missing','cat-enro-incomplete','Enrofloxacin · 용량·단위·체중·일정·경로가 불명확하여 전체 일일량 비교를 완료하지 못했습니다.',indices,ENRO);}
  }
  const supported=new Set([...NSAID,...STEROID,'acetaminophen','enrofloxacin']);
  return {findings,unknown:[...new Set(rows.filter((r,i)=>!supported.has(names[i])).map(r=>r.drug||'미확인 약물'))],missingHistory:fields.filter(([k])=>!checks[k]||checks[k]==='unknown').map(([,v])=>v),count:rows.length};
 }
 function mount(b,o){
  const f=b.querySelector('[data-calc=batch]');if(!f||!o.batch)return null;
  if(!C||!P){const failure=document.createElement('p');failure.className='pt-error';failure.textContent='처방 안전성 검토를 불러오지 못했습니다. 계산 결과만으로 안전성을 판단하지 마세요. 화면을 새로고침해주세요.';f.querySelector('.pt-rx-output').before(failure);return {dispose(){failure.remove();}};}
  const box=document.createElement('section');box.className='pt-rx-safety';box.setAttribute('aria-label','처방 안전성 검토');
  box.innerHTML='<h4>처방 안전성 검토 <small>자동</small></h4><p class="pt-help">환자 등록 없이 입력한 처방과 동물종·체중으로 검토합니다. 처방 수정 시 함께 갱신됩니다.</p><p data-safety-status role="status" aria-live="polite"></p><div data-safety-findings></div><details><summary>신장·간 기능 등 확인사항 <span data-safety-missing></span></summary><p class="pt-help">선택 입력 · 미확인은 정상으로 간주하지 않습니다. 이 화면에서만 사용하며 환자 기록에 저장하지 않습니다. 처방 원문·동물종을 바꾸거나 입력을 초기화하면 다시 확인합니다.</p><div class="pt-safety-checks">'+fields.map(([key,label])=>'<label>'+label+'<select data-safety-check="'+key+'"><option value="unknown">미확인</option><option value="absent">확인사항 없음</option><option value="present">있음 · 검토 필요</option></select></label>').join('')+'</div><button type="button" data-safety-reset>확인사항 초기화</button></details><details><summary>검사 범위·판정하지 못한 항목</summary><p>동일 성분 및 NSAID·스테로이드 계열 중복, 일부 병용 주의, 고양이 아세트아미노펜 금기·NSAID 주의, 고양이 경구 enrofloxacin 일일 상한을 대조합니다. 신장·간 기능 확인사항과 NSAID 주의, 계산 입력·단위·경로 오류도 표시합니다.</p><p>전체 약물 상호작용·종별 금기·적정 용량·휴약기간·장기 기능별 용량 조정은 판정하지 않습니다. 경구 처방만 계산하며, 함량은 병원 제품 연결 또는 직접 입력값을 사용합니다. 제품 자체의 정확성은 별도 확인이 필요합니다.</p><p data-safety-unknown></p><p>근거: FDA·제품별 미국 허가문서 · 확인일 2026-10-26. 국내 제품·적응증과 차이가 있을 수 있습니다.</p></details>';
  f.querySelector('.pt-rx-output').before(box);let timer,disposed=false;
  function refresh(){if(disposed)return;const checks=Object.fromEntries([...box.querySelectorAll('[data-safety-check]')].map(e=>[e.dataset.safetyCheck,e.value]));const snap=o.batch.safetySnapshot(),r=evaluate({...snap,checks});box.querySelector('[data-safety-status]').textContent=r.count?`처방 ${r.count}단계${snap.state==='complete'?'':' · 계산 미완료'} · 주의 ${r.findings.filter(x=>x.severity==='warning').length} · 추가 확인 ${r.findings.filter(x=>x.severity!=='warning').length} · 전체 안전성을 보증하는 결과는 아닙니다.`:'처방을 입력하면 검토 결과가 여기에 표시됩니다.';box.querySelector('[data-safety-findings]').innerHTML=r.findings.map(v=>'<article data-safety-code="'+v.code+'" class="pt-safety-'+v.severity+'"><b>'+({warning:'주의',review:'검토',missing:'미확인'})[v.severity]+'</b> '+esc(v.text)+(v.source?' <a href="'+v.source+'" target="_blank" rel="noopener">근거 보기</a>':'')+'</article>').join('');box.querySelector('[data-safety-missing]').textContent='· 미확인 '+r.missingHistory.length+'개';box.querySelector('[data-safety-unknown]').textContent='개별 임상 규칙 미등록 성분: '+(r.unknown.join(', ')||'없음')+' · 규칙 등록 성분도 전체 검사를 뜻하지 않습니다.';box.hidden=!r.count;}
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,30);};
  const reset=()=>{box.querySelectorAll('[data-safety-check]').forEach(e=>e.value='unknown');schedule();};
  box.addEventListener('change',schedule);box.querySelector('[data-safety-reset]').onclick=reset;
  const input=e=>{if(e.target.matches('[data-rx-text]'))reset();else schedule();};
  b.addEventListener('practice-rx-changed',schedule);b.addEventListener('practice-rx-reset',reset);b.addEventListener('input',input);b.addEventListener('change',schedule);
  const observer=new MutationObserver(schedule);observer.observe(f,{attributes:true,attributeFilter:['data-calculation-state']});refresh();
  return {reset,dispose(){disposed=true;clearTimeout(timer);observer.disconnect();b.removeEventListener('practice-rx-changed',schedule);b.removeEventListener('practice-rx-reset',reset);b.removeEventListener('input',input);b.removeEventListener('change',schedule);box.remove();}};
 }
 const api={evaluate,dailyMgKg,norm,mount};if(node)module.exports=api;else g.PracticePrescriptionSafety=api;
})(typeof window==='undefined'?globalThis:window);
