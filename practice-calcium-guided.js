/* Calcium assessment and reviewed quick choices; patient observations stay in this form only. */
(function(g){
 'use strict';
 const sources={acute:'https://www.merckvetmanual.com/metabolic-disorders/disorders-of-calcium-metabolism/eclampsia-in-dogs-and-cats',persistent:'https://www.veccademy.org/wp-content/uploads/2021/02/PP-for-ACVECC-Resident-Rounds.pdf#page=31',interpret:'https://eclinpath.com/chemistry/minerals/ionized-calcium/'};
 const positive=v=>/^(?:\d+\.?\d*|\.\d+)$/.test(String(v))&&Number(v)>0&&Number.isFinite(Number(v));
 const convert=(v,u)=>Number(v)*(u==='mg/dL'?0.2495:u==='mEq/L'?0.5:1);
 const fmt=n=>g.PracticeCalculators?.display(n)||String(Number(n.toFixed(4)));
 function assessment(v){
  if(!v.caValue)return '검사값 미입력 · 증상·원인·검사 결과를 함께 확인하세요. 수치가 용량을 자동 결정하지 않습니다.';
  if(!positive(v.caValue))return '칼슘 검사값을 확인해주세요.';
  if(v.caLabType==='total')return '총칼슘은 iCa를 대신하지 않습니다. 알부민 보정식으로 용량을 산출하지 않으며 iCa 직접 측정을 검토하세요.';
  const n=convert(v.caValue,v.caLabUnit);let text='이온화칼슘 '+fmt(n)+' mmol/L · ';
  if(v.caLow||v.caHigh){if(!positive(v.caLow)||!positive(v.caHigh)||Number(v.caLow)>=Number(v.caHigh))return text+'검사실 기준범위 하한·상한을 확인해주세요.';text+=n<Number(v.caLow)?'입력한 검사실 범위보다 낮음':n>Number(v.caHigh)?'입력한 검사실 범위보다 높음':'입력한 검사실 범위 안';}
  else text+='검사실 기준범위와 대조하세요';
  if(n<0.8)text+=' · 심한 저하 가능성: 증상·심전도와 즉시 재평가';
  return text+' · 이 값으로 보충량이나 증량 비율을 계산하지 않습니다.';
 }
 function validate(v){
  for(const key of ['caValue','caRecheck','caLow','caHigh'])if(v[key]&&!positive(v[key]))throw Error('칼슘 검사값·기준범위는 양수로 입력해주세요.');
  if(v.caLow||v.caHigh){if(!positive(v.caLow)||!positive(v.caHigh)||Number(v.caLow)>=Number(v.caHigh))throw Error('iCa 검사실 기준범위의 하한·상한을 모두 확인해주세요.');}
  if(v.caRecheck&&!v.caValue)throw Error('재검 비교 전에 최초 검사값을 입력해주세요.');
  if(v.caMeasuredAt&&v.caRecheckAt&&new Date(v.caRecheckAt)<new Date(v.caMeasuredAt))throw Error('재검 시각은 최초 검사 시각 이후여야 합니다.');
 }
 function context(v){
  const lines=[];
  if(v.caValue)lines.push('검사 참고 · '+(v.caLabType==='total'?'총칼슘':'iCa')+' '+v.caValue+' '+v.caLabUnit+(v.caMeasuredAt?' · '+v.caMeasuredAt.replace('T',' '):''),assessment(v));
  if(v.caSymptoms&&v.caSymptoms!=='unknown')lines.push('관찰 상태 · '+({none:'뚜렷한 증상 없음',signs:'떨림·경련 등 저칼슘 의심 증상',cardiac:'서맥·부정맥 등 이상 반응'}[v.caSymptoms]||''));
  if(v.caResponse&&v.caResponse!=='unknown')lines.push('관찰 반응 · '+({better:'호전',same:'유사·미호전',worse:'악화·새 이상 반응'}[v.caResponse]||''));
  if(v.caRecheck)lines.push('재검 · '+v.caRecheck+' '+v.caLabUnit+(v.caRecheckAt?' · '+v.caRecheckAt.replace('T',' '):'')+' · 증감만으로 속도를 변경하지 마세요.');
  if(v.caDoseSource)lines.push('선택 참고 용법 · '+({acute:'급성 저칼슘혈증 · MSD',persistent:'지속 저칼슘혈증 · ACVECC 교육자료',eclampsia:'산후 저칼슘혈증 안정화 후 · MSD'}[v.caDoseSource]||'직접 수정')+' · 현재 원소칼슘 용량 확인');
  if(v.caValue||v.caRecheck)lines.push('검사 입력은 현재 계산 화면에만 유지되며 환자 기록에 저장되지 않습니다.');
  return lines.join('\n');
 }
 function mount(b,o){
  const f=b.querySelector('[data-calc=calcium]');if(!f)return;
  const el=f.elements,weight=b.querySelector('[data-common-weight]'),species=b.querySelector('[data-ref-species]');let internal=false,profile='',ratio=null;
  f.classList.add('pt-calcium-guided');f.querySelector('h3').textContent='칼슘 보충 · 검사 확인과 주입 계산';
  f.querySelector('.pt-notice').textContent='원소칼슘 기준으로 계산합니다. 검사값은 치료 판단을 돕고, 용량은 용법을 선택한 뒤 확인합니다.';
  const lab=document.createElement('details');lab.className='pt-ca-assessment';lab.innerHTML=`<summary class="pt-summary" data-ca-lab-summary>검사·증상·재검 · 선택 입력</summary><div class="pt-grid"><label><span data-ca-value-label>현재 iCa · mmol/L</span><input name="caValue" inputmode="decimal" placeholder="검사값 · 선택"></label><label>관찰 상태<select name="caSymptoms"><option value="unknown">미입력</option><option value="none">뚜렷한 증상 없음</option><option value="signs">떨림·경련 등 의심 증상</option><option value="cardiac">서맥·부정맥 등 이상 반응</option></select></label></div><p data-ca-assessment role="status"></p><p data-ca-symptom-note role="status"></p><details><summary class="pt-summary">검사 종류·단위·시각·기준범위</summary><div class="pt-grid"><label>검사 종류<select name="caLabType"><option value="ionized">이온화칼슘 · iCa</option><option value="total">총칼슘 · tCa</option></select></label><label>검사 단위<select name="caLabUnit"><option>mmol/L</option><option>mg/dL</option><option>mEq/L</option></select></label><label>최초 측정 시각<input type="datetime-local" name="caMeasuredAt"></label><label>검사실 iCa 하한 · mmol/L<input name="caLow" inputmode="decimal" placeholder="검사실 범위 직접 확인"></label><label>검사실 iCa 상한 · mmol/L<input name="caHigh" inputmode="decimal"></label></div><p class="pt-help">총칼슘은 알부민·pH 등의 영향을 받습니다. 검사 종류·단위를 바꾸면 이전 검사값과 재검값을 지웁니다.</p><a href="${sources.interpret}" target="_blank" rel="noopener noreferrer">Cornell · iCa 해석</a></details><details data-ca-followup><summary class="pt-summary">재검 결과·반응 비교</summary><div class="pt-grid"><label>재검 칼슘 · 위와 같은 종류·단위<input name="caRecheck" inputmode="decimal"></label><label>재검 시각<input name="caRecheckAt" type="datetime-local"></label><label>투여 후 반응<select name="caResponse"><option value="unknown">미입력</option><option value="better">호전</option><option value="same">유사·미호전</option><option value="worse">악화·새 이상 반응</option></select></label></div><p data-ca-trend role="status"></p><p class="pt-help">재검 시점·목표는 원인과 환자 상태에 따라 정합니다. 심박·ECG·주사 부위를 관찰하고, 반응과 재검을 확인한 후 유지·감량·증량을 결정합니다. 원내 차트에 자동 저장하지 않습니다.</p></details>`;
  f.querySelector('.pt-notice').after(lab);
  const plan=document.createElement('section');plan.className='pt-ca-plan';plan.innerHTML='<h4>투여 계획</h4><div data-ca-mode></div><div class="pt-grid"><label>문헌 용법 · 적용 상황을 먼저 선택<select data-ca-profile><option value="">직접 정한 용량</option><option value="acute">급성 저칼슘혈증 · 단회</option><option value="persistent">지속 저칼슘혈증 · CRI</option><option value="eclampsia">산후 저칼슘혈증 안정화 후 · CRI</option></select></label></div><p data-ca-source class="pt-help"></p><div data-ca-doses class="pt-ca-choices" aria-label="문헌 범위에서 용량 선택"></div><input type="hidden" name="caDoseSource"><div class="pt-grid" data-ca-dose-fields></div>';
  lab.after(plan);plan.querySelector('[data-ca-mode]').append(el.mode.closest('label'));plan.querySelector('[data-ca-dose-fields]').append(el.dose.closest('label'),el.minutes.closest('label'));
  const times=document.createElement('div');times.className='pt-ca-choices';times.dataset.caTimes='';times.innerHTML=[10,20,30].map(v=>`<button type="button" data-ca-minutes="${v}">${v}분</button>`).join('');el.minutes.closest('label').append(times);
  const prep=document.createElement('details');prep.className='pt-ca-product';prep.open=true;prep.innerHTML='<summary class="pt-summary" data-ca-product-summary>제품·희석 설정</summary><div class="pt-grid" data-ca-product-fields></div><p class="pt-help">제품 설정은 한 번 확인한 뒤 저장·재사용할 수 있습니다. 모든 농도는 원소칼슘 기준입니다.</p><div class="pt-ca-choices"><button type="button" data-ca-diluent="0.9% N/S">N/S</button><button type="button" data-ca-diluent="D5W">D5W</button><button type="button" data-ca-diluent="미희석">미희석</button><button type="button" data-ca-fold>설정 접기</button></div>';
  plan.after(prep);const picker=f.querySelector('.pt-preparation-picker');if(picker)prep.querySelector('summary').after(picker);for(const p of [...f.children].filter(n=>n.matches('p.pt-help')))prep.append(p);prep.querySelector('[data-ca-product-fields]').append(el.product.closest('label'),el.stock.closest('label'),el.diluent.closest('label'));
  const mix=document.createElement('section');mix.className='pt-ca-mix';mix.innerHTML='<h4>조제 방식</h4><label data-ca-method>CRI 계산 방식<select name="caMethod"><option value="concentration">조제 농도 기준 · 시간 입력 없이</option><option value="duration">계획 시간 기준</option></select></label><div class="pt-grid" data-ca-mix-fields><label data-ca-concentration>조제 후 원소칼슘 농도 · mg/mL<input name="finalConcentration" inputmode="decimal" required></label></div><div class="pt-ca-choices" data-ca-volume-choices aria-label="최종 부피 빠른 선택">'+[20,50,100,250,500].map(v=>'<button type="button" data-ca-volume="'+v+'">최종 '+v+' mL</button>').join('')+'</div><div class="pt-ca-choices" data-ca-dilutions><button type="button" data-ca-ratio="10">10배 희석 · 원액 1 + 희석액 9</button><button type="button" data-ca-ratio="20">20배 희석 · 원액 1 + 희석액 19</button></div><p class="pt-help">부피·희석 배수는 조제 편의를 위한 선택지이며 표준 처방이 아닙니다. 제품 지침·정맥 경로·수액 허용량을 확인하세요. 농도 기준에서는 조제량과 펌프 속도로 계산상 소진 시간을 표시합니다.</p>';
  prep.after(mix);mix.querySelector('[data-ca-mix-fields]').append(el.hours.closest('label'),el.volume.closest('label'));
  function values(){return Object.fromEntries(new FormData(f));}
  function invalidate(){o.clear();el.confirmed.checked=false;}
  function layout(){const single=el.mode.value==='single',conc=!single&&el.caMethod.value==='concentration';mix.querySelector('[data-ca-method]').hidden=single;el.caMethod.disabled=single;const target=mix.querySelector('[data-ca-concentration]');target.hidden=!conc;el.finalConcentration.disabled=!conc;el.hours.disabled=single||conc;el.hours.closest('label').hidden=single||conc;mix.querySelector('[data-ca-dilutions]').hidden=!conc;times.hidden=!single;el.volume.closest('label').firstChild.textContent=conc?'조제할 최종 총 부피 · mL':'약물 포함 최종 총 부피 · mL';}
  function status(){const v=values();lab.querySelector('[data-ca-lab-summary]').textContent='검사·증상·재검 · '+(v.caValue?(v.caLabType==='total'?'총칼슘':'iCa')+' '+v.caValue+' '+v.caLabUnit:'선택 입력');lab.querySelector('[data-ca-value-label]').textContent='현재 '+(v.caLabType==='total'?'총칼슘':'iCa')+' · '+v.caLabUnit;lab.querySelector('[data-ca-assessment]').textContent=assessment(v);const warning=v.caSymptoms==='cardiac'||v.caResponse==='worse';lab.querySelector('[data-ca-symptom-note]').textContent=warning?'서맥·부정맥 또는 악화 시 주입을 중단하고 즉시 재평가하세요. 계산값만으로 지속·증량하지 마세요.':v.caSymptoms==='signs'?'떨림·경련 등 증상은 신속한 평가가 필요합니다. 혈당·다른 원인도 함께 확인하세요.':'';const trend=lab.querySelector('[data-ca-trend]');trend.textContent='';if(v.caRecheck){try{validate(v);const d=Number(v.caRecheck)-Number(v.caValue);trend.textContent='최초 '+v.caValue+' → 재검 '+v.caRecheck+' '+v.caLabUnit+' · '+(d>0?'상승':d<0?'하락':'변화 없음')+' · '+assessment({...v,caValue:v.caRecheck});}catch(e){trend.textContent=e.message;}}prep.querySelector('summary').textContent=el.product.value&&positive(el.stock.value)?el.product.value+(el.product.value.includes(el.stock.value+' mg/mL')?'':' · 원소칼슘 '+el.stock.value+' mg/mL')+' · '+(el.diluent.value||'희석액 확인')+' · 변경':'제품·희석 설정';}
  function profileUI(){const select=plan.querySelector('[data-ca-profile]');select.value=profile;plan.querySelector('[data-ca-mode]').hidden=!!profile;const texts={acute:'급성 증상 조절 참고: 원소칼슘 5–15 mg/kg/회, 완속 IV. 주입 시간 10–30분 범위에서 환자 상태에 맞춰 선택합니다.',persistent:'지속 저칼슘혈증(부갑상선기능저하 등) 참고: 60–90 mg/kg/일 = 2.5–3.75 mg/kg/hr. 급성 단회량과 구분합니다.',eclampsia:'산후 저칼슘혈증의 급성 증상 안정화 후 정맥 유지 참고: 5–15 mg/kg/hr. 다른 원인의 저칼슘혈증에 일괄 적용하지 않습니다.'};const src=plan.querySelector('[data-ca-source]');src.replaceChildren(document.createTextNode('성체 개·고양이 참고 · '+(texts[profile]||'용량을 직접 입력하거나 해당 상황의 문헌 범위에서 선택하세요.')));if(profile){const a=document.createElement('a');a.href=profile==='persistent'?sources.persistent:sources.acute;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 근거 · 확인 2026-10-26';src.append(a);}plan.querySelector('[data-ca-doses]').innerHTML=(profile==='persistent'?[2.5,3,3.75]:profile?[5,10,15]:[]).map(v=>'<button type="button" data-ca-dose="'+v+'">'+v+' mg/kg/'+(profile==='acute'?'회':'hr')+'</button>').join('');}
  plan.querySelector('[data-ca-profile]').onchange=e=>{const next=e.target.value;if(next){const mode=next==='acute'?'single':'continuous';if(el.mode.value!==mode){el.mode.value=mode;el.mode.dispatchEvent(new Event('change',{bubbles:true}));}}profile=next;el.caDoseSource.value='';el.dose.value='';profileUI();invalidate();layout();};
  f.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const d=btn.dataset;if(d.caDose){el.dose.value=d.caDose;el.caDoseSource.value=profile;if(profile==='acute'&&!el.minutes.value)el.minutes.value='10';internal=true;el.dose.dispatchEvent(new Event('input',{bubbles:true}));internal=false;}
   if(d.caMinutes){el.minutes.value=d.caMinutes;el.minutes.dispatchEvent(new Event('input',{bubbles:true}));}
   if(d.caVolume){el.volume.value=d.caVolume;el.volume.dispatchEvent(new Event('input',{bubbles:true}));}
   if(d.caDiluent){el.diluent.value=d.caDiluent;el.diluent.dispatchEvent(new Event('input',{bubbles:true}));if(el.product.value&&positive(el.stock.value))prep.open=false;}
   if(d.caRatio){if(!positive(el.stock.value)){prep.open=true;el.stock.focus();return;}ratio=Number(d.caRatio);el.finalConcentration.value=String(Number(el.stock.value)/ratio);el.finalConcentration.dispatchEvent(new Event('input',{bubbles:true}));ratio=Number(d.caRatio);}
   if('caFold' in d){prep.open=false;}
   status();
  });
  f.addEventListener('input',e=>{if(e.target.name==='dose'&&!internal)el.caDoseSource.value='';if(e.target.name==='stock'&&ratio){el.finalConcentration.value='';ratio=null;}if(e.target.name==='finalConcentration')ratio=null;status();});
  f.addEventListener('change',e=>{if(e.target.name==='mode'){profile='';el.caDoseSource.value='';profileUI();if(el.mode.value==='continuous'&&!el.volume.value)el.volume.value='50';}
   if(['caLabType','caLabUnit'].includes(e.target.name)){el.caValue.value='';el.caRecheck.value='';el.caMeasuredAt.value='';el.caRecheckAt.value='';if(e.target.name==='caLabType'){el.caLow.value='';el.caHigh.value='';el.caLabUnit.value=el.caLabType.value==='total'?'mg/dL':'mmol/L';}}
   if(e.target.name==='caMethod'){el.confirmed.checked=false;}
   layout();status();
  });
  // Browser validation must expose invalid inputs that are intentionally in folded settings.
  f.addEventListener('invalid',e=>{for(let n=e.target.parentElement;n&&n!==f;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;},true);
  f.addEventListener('reset',()=>queueMicrotask(()=>{profile='';ratio=null;lab.open=false;prep.open=true;profileUI();layout();status();}));
  for(const target of [weight,species])if(target)target.addEventListener('change',()=>{invalidate();status();});
  layout();profileUI();status();
 }
 const api={mount,assessment,validate,context,convert};g.PracticeCalciumGuided=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
