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
 const extra={paracetamol:'acetaminophen',타이레놀:'acetaminophen',아세트아미노펜:'acetaminophen',엔로플록사신:'enrofloxacin',baytril:'enrofloxacin',enroquin:'enrofloxacin',바이트릴:'enrofloxacin',갈리프란트:'grapiprant',galliprant:'grapiprant',그라피프란트:'grapiprant',클린다마이신:'clindamycin',antirobe:'clindamycin',안티로브:'clindamycin'};
 const norm=v=>{const n=C.norm(v);return extra[n]||n;};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const PRED='https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3404a338-db7f-4550-9d4c-33aa0782d01a';
 const CLINDA='https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a2224602-6f04-4b83-968a-8c193230998f';
 // These are drug reference conditions, never assertions about this patient.
 function drugReference(name){
  const notes=[],add=(label,text,source)=>notes.push({label,text,source});let scope='';
  if(NSAID.has(name)){
   scope='NSAID 계열 참고 · 제품별 종·경로·기간은 별도 확인';
   add('신장·탈수','신장질환, 탈수·쇼크 등 신장 관류가 감소하는 상태에서는 신손상 위험에 주의합니다.',FDA);
   add('간·위장관','기존 간질환에서 주의하며, 위장관 궤양·출혈 및 간 이상반응 가능성을 고려합니다.',FDA);
   add('병용 주의','다른 NSAID 또는 스테로이드와의 병용은 위장관 부작용 위험을 높이므로 피하도록 안내됩니다.',FDA);
  }
  if(STEROID.has(name)&&name!=='prednisolone'){
   scope='스테로이드 계열의 일부 병용 주의 · 개별 약물 금기는 미등록';
   add('병용 주의','NSAID와의 병용은 위장관 부작용 위험을 높이므로 피하도록 안내됩니다.',FDA);
  }
  if(name==='prednisolone'){
   scope='PREDNISTAB 미국 수의용 경구 정제 문서 참고';
   add('문서상 금기','바이러스 감염, 소화성 궤양·각막 궤양 및 쿠싱양 증후군에서 사용하지 않도록 기재되어 있습니다.',PRED);
   add('신장·대사질환','신부전, 당뇨병, 고혈압·울혈성 심부전 등에서는 신중한 사용과 모니터링이 필요합니다.',PRED);
   add('감염·임신','감염 징후를 가리거나 감염을 악화시킬 수 있습니다. 임신 중 코르티코스테로이드 사용에는 조산·태아 이상 위험이 보고되어 있습니다.',PRED);
   add('병용 주의','NSAID와의 병용은 위장관 부작용 위험을 높이므로 피하도록 안내됩니다.',FDA);
  }
  if(name==='grapiprant'){
   scope='GALLIPRANT 개 경구 정제 미국 허가문서 참고';
   add('금기·안전성 미확립','Grapiprant 과민반응은 금기입니다. 9개월 미만·3.6 kg 미만, 번식·임신·수유견에서 안전성이 평가되지 않았습니다.',GALL);
  }
  if(name==='enrofloxacin'){
   scope='ENROQUIN 개·고양이 경구 정제 미국 허가문서 참고';
   add('문서상 금기·성장기','퀴놀론 과민반응은 금기입니다. 소·중형견의 빠른 성장기(2–8개월)에 금기이며, 대·초대형견 성장기 안전성은 확립되지 않았습니다.',ENRO);
   add('고양이·신경계','고양이에서는 망막 독성에 주의하며 경구 일일량 5 mg/kg을 넘기지 않도록 기재되어 있습니다. 중추신경계 질환·발작 소인이 있는 경우 주의합니다.',ENRO);
   add('병용 주의','알루미늄·칼슘·철·마그네슘 함유 제제는 퀴놀론 경구 흡수를 낮출 수 있습니다. 간에서 대사되는 병용약의 제거율 변화도 검토합니다.',ENRO);
   add('번식·임신','번식·임신 중인 고양이에서 안전성이 확립되지 않았습니다.',ENRO);
  }
  if(name==='acetaminophen'){
   scope='FDA 개·고양이 약물 안전성 안내';
   add('종별 금기','고양이에는 투여하지 않습니다. 심각한 독성 위험이 있습니다.',FDA);
   add('간·혈액','간 손상과 적혈구 손상 위험이 있습니다. 개에서도 처방 용량과 제품 성분을 확인해야 합니다.',FDA);
  }
  if(name==='clindamycin'){
   scope='ANTIROBE 경구제 미국 허가문서 참고 · 제형별 적용 동물 확인';
   add('문서상 금기','클린다마이신 또는 린코마이신 제제 과민반응 병력이 있는 동물에 금기입니다.',CLINDA);
   add('신장·간','심한 대사 이상을 동반한 매우 중증의 신장·간질환에서 신중히 투여하며, 고용량 치료 시 혈중 농도 모니터링이 안내됩니다.',CLINDA);
   add('병용 주의','신경근 차단제의 작용을 강화할 수 있어 병용에 주의합니다.',CLINDA);
   add('임신·번식','임신한 개·고양이 및 번식용 수컷에서 안전성이 확립되지 않았습니다.',CLINDA);
  }
  return {scope,notes};
 }
 function references(rows,names){
  const groups=new Map();rows.forEach((r,i)=>{const key=names[i]||String(r.drug||'미확인 약물');if(!groups.has(key))groups.set(key,{ingredient:key,drug:r.drug||'미확인 약물',...drugReference(key)});});return [...groups.values()];
 }
 function dailyMgKg(r,weight){
  let dose=P.doseNumber(r.dose);if(r.doseUnit==='mcg')dose/=1000;else if(r.doseUnit==='T'){if(!['tablet','capsule'].includes(r.form)||!(Number(r.strength)>0)||!['mg','mcg'].includes(r.strengthUnit))return null;dose*=Number(r.strength)*(r.strengthUnit==='mcg'?.001:1);}else if(r.doseUnit!=='mg')return null;
  if(r.doseBasis==='fixed'){if(!(Number(weight)>0))return null;dose/=Number(weight);}else if(r.doseBasis!=='kg'||r.doseUnit==='T')return null;
  const times=Number(r.times);return Number.isInteger(times)&&times>0&&Number.isFinite(dose*times)?dose*times:null;
 }
 function evaluate(input={}){
  const rows=input.rows||[],names=rows.map(r=>norm(r.ingredient||r.calculationIngredient||r.drug));
  const base=C.reviewPrescription({...input,checks:null,rows:rows.map((r,i)=>({...r,ingredient:names[i]}))});
  const findings=base.findings.filter(f=>!f.code.startsWith('patient-')&&!['outside-prescription','nsaid-renal'].includes(f.code));
  const add=(severity,code,text,indices=[],source='')=>findings.push({severity,code,text,indices,source});
  rows.forEach((r,i)=>{
   const name=names[i];try{P.calculate(r,input.weight,input.species);}catch(e){add('missing','calculation',r.drug+' · '+e.message,[i]);}
   if(input.errors?.[i])add('missing','product-check',r.drug+' · '+input.errors[i],[i]);
   if(!r.presetId)add('missing','manual-strength',r.drug+' · 직접 입력 함량은 제품 표시와 대조해야 합니다.',[i]);
   if(input.species==='cat'&&name==='acetaminophen')add('warning','cat-acetaminophen','아세트아미노펜 · 고양이 투여 금기. 처방을 재검토하세요.',[i],FDA);
   if(input.species==='cat'&&NSAID.has(name))add('review','cat-nsaid',r.drug+' · 고양이의 NSAID 민감성과 해당 제품의 종·경로·기간을 확인하세요. 미국 허가정보는 국내 허가와 다를 수 있습니다.',[i],name==='grapiprant'?GALL:FDA);
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
  return {findings,unknown:[...new Set(rows.filter((r,i)=>!supported.has(names[i])).map(r=>r.drug||'미확인 약물'))],references:references(rows,names),count:rows.length};
 }
 function mount(b,o){
  const f=b.querySelector('[data-calc=batch]');if(!f||!o.batch)return null;
  if(!C||!P){const failure=document.createElement('p');failure.className='pt-error';failure.textContent='처방 안전성 검토를 불러오지 못했습니다. 계산 결과만으로 안전성을 판단하지 마세요. 화면을 새로고침해주세요.';(f.querySelector('[data-result-actions]')||f.querySelector('.pt-rx-output')).after(failure);return {dispose(){failure.remove();}};}
  const box=document.createElement('section');box.className='pt-rx-safety';box.setAttribute('aria-label','처방 안전성 검토');
  box.innerHTML='<h4>처방 안전성 검토</h4><p data-safety-status role="status" aria-live="polite"></p><div data-safety-findings aria-label="이번 처방의 주의사항"></div><p data-safety-coverage class="pt-help"></p><details class="pt-drug-references" aria-label="약물별 금기·주의사항"><summary>약물별 참고사항 · 공개 근거</summary><p class="pt-help">처방 약물의 참고 정보입니다. 해당 질환이나 상태가 이 환자에게 있다는 뜻은 아닙니다.</p><div data-safety-references></div></details><details><summary>검사 범위 보기</summary><p>동일 성분 및 NSAID·스테로이드 계열 중복, 일부 병용 주의, 고양이 아세트아미노펜 금기·NSAID 주의, 고양이 경구 enrofloxacin 일일 상한을 대조합니다. 계산 입력·단위·경로 오류도 표시합니다.</p><p>전체 약물 상호작용·종별 금기·적정 용량·휴약기간·장기 기능별 용량 조정은 판정하지 않습니다. 환자 병력·검사 결과와 처방 외 복용약은 자동 대조하지 않습니다. 경구 처방만 계산하며, 제품 함량의 정확성은 별도 확인이 필요합니다.</p><p data-safety-unknown></p><p>근거: FDA·제품별 미국 허가문서 · 확인일 2026-10-26. 참고 제품의 종·제형·경로를 확인하세요. 국내 제품의 허가사항과 다를 수 있으며, 안내는 전체 약전 내용을 포함하지 않습니다.</p></details>';
  (f.querySelector('[data-result-actions]')||f.querySelector('.pt-rx-output')).after(box);let timer,disposed=false;
  const privateReferences=g.PracticePrescriptionLibrary?.mount(box,{request:o.request,guard:o.guard});
  if(o.request&&!privateReferences){const failure=document.createElement('p');failure.className='pt-error';failure.textContent='병원 등록 약물 자료 연결을 불러오지 못했습니다. 화면을 새로고침해주세요.';box.querySelector('.pt-drug-references').before(failure);}
  function refresh(){if(disposed)return;const snap=o.batch.safetySnapshot(),r=evaluate(snap);box.querySelector('[data-safety-status]').textContent=r.count?`처방 항목 ${r.count}개${snap.state==='complete'?'':' · 계산 미완료'} · 주의 ${r.findings.filter(x=>x.severity==='warning').length} · 추가 확인 ${r.findings.filter(x=>x.severity!=='warning').length} · 제한된 규칙의 참고 검토입니다.`:'처방을 입력하면 검토 결과가 여기에 표시됩니다.';box.querySelector('[data-safety-findings]').innerHTML=r.findings.map(v=>'<article data-safety-code="'+v.code+'" class="pt-safety-'+v.severity+'"><b>'+({warning:'주의',review:'검토',missing:'미확인'})[v.severity]+'</b> '+esc(v.text)+(v.source?' <a href="'+v.source+'" target="_blank" rel="noopener">근거 보기</a>':'')+'</article>').join('');box.querySelector('[data-safety-references]').innerHTML=r.references.map(v=>'<article class="pt-drug-reference" data-reference-ingredient="'+esc(v.ingredient)+'"><h5>'+esc(v.drug)+'</h5>'+(v.notes.length?'<p class="pt-help">'+esc(v.scope)+'</p><dl>'+v.notes.map(n=>'<div><dt>'+esc(n.label)+'</dt><dd>'+esc(n.text)+' <a href="'+n.source+'" target="_blank" rel="noopener">근거</a></dd></div>').join('')+'</dl>':'<p>등록된 공개 근거 참고자료가 없습니다. 병원 등록 자료의 연결 결과는 위에서 확인하세요. 주의사항이 없다는 의미는 아닙니다.</p>')+'</article>').join('');box.querySelector('[data-safety-unknown]').textContent='처방 조건 자동 대조 규칙 미등록 성분: '+(r.unknown.join(', ')||'없음')+' · 규칙 등록 성분도 전체 검사를 뜻하지 않습니다.';box.querySelector('[data-safety-coverage]').textContent=r.unknown.length?'자동 대조 미지원: '+r.unknown.join(', '):'';box.hidden=!r.count;privateReferences?.update(snap.rows);}
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,30);};
  b.addEventListener('practice-rx-changed',schedule);b.addEventListener('practice-rx-reset',schedule);b.addEventListener('input',schedule);b.addEventListener('change',schedule);
  const observer=new MutationObserver(schedule);observer.observe(f,{attributes:true,attributeFilter:['data-calculation-state']});refresh();
  return {reset:schedule,dispose(){disposed=true;privateReferences?.dispose();clearTimeout(timer);observer.disconnect();b.removeEventListener('practice-rx-changed',schedule);b.removeEventListener('practice-rx-reset',schedule);b.removeEventListener('input',schedule);b.removeEventListener('change',schedule);box.remove();}};
 }
 const api={evaluate,dailyMgKg,norm,mount};if(node)module.exports=api;else g.PracticePrescriptionSafety=api;
})(typeof window==='undefined'?globalThis:window);
