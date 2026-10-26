/* Acid/base arithmetic with clinician-entered targets; no automatic diagnosis or prescription. */
(function(g){
 'use strict';
 const sources={ag:'https://eclinpath.com/chemistry/acid-base/chemistry-tests/anion-gap/',bicarb:'https://www.dvm360.com/view/acid-base-assessment-and-treatment-severe-abnormalities-proceedings',product:'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=0ab55004-bb63-436d-ad77-cd3796905370&type=display'};
 const field=(name,label,extra='')=>`<label>${label}<input name="${name}" inputmode="decimal" autocomplete="off" required ${extra}></label>`;
 const output='<button class="pt-primary">계산</button><output aria-live="polite" tabindex="-1"></output><div data-result-actions hidden></div>';
 function mount(main,o){
  const c=g.PracticeCalculators,panel=document.createElement('section');panel.dataset.kindPanel='acid';panel.hidden=true;
  panel.innerHTML=`<div class="pt-section-intro"><h3>산·염기</h3><p class="pt-help">검사값을 확인한 뒤 필요한 계산만 선택하세요. 개·고양이 모두 환자 상태에 맞춰 목표를 직접 정합니다.</p></div><nav class="pt-bar" aria-label="산·염기 계산"><button type="button" data-acid-view="ag" aria-pressed="true">음이온차 · AG</button><button type="button" data-acid-view="bicarbonate" aria-pressed="false">중탄산 보정</button></nav>
  <form class="pt-card" data-calc="ag"><h3>음이온차(Anion gap)</h3><p class="pt-help">같은 채혈 시점·검사법의 값으로 계산하고, 선택한 계산식에 맞는 검사실 참고범위와 비교하세요.</p><div class="pt-grid"><label class="pt-span">검사실의 AG 계산식<select name="method"><option value="withK">K 포함 · (Na + K) − (Cl + HCO₃)</option><option value="withoutK">K 제외 · Na − (Cl + HCO₃)</option></select></label>${field('na','Na · mEq/L')}${field('k','K · mEq/L')}${field('cl','Cl · mEq/L')}${field('hco3','HCO₃ · mEq/L')}</div>${output}<p class="pt-help"><a href="${sources.ag}" target="_blank" rel="noopener noreferrer">Cornell eClinpath · AG 계산 근거</a> · 확인 2026-10-22</p></form>
  <form class="pt-card" data-calc="bicarbonate" hidden><h3>중탄산나트륨 · 보정 계획 환산</h3><p class="pt-notice">대사성 산증에서 수의사가 중탄산 보충을 결정한 경우에 사용합니다. 산증의 원인·관류·환기부터 평가하세요. 알칼리증이나 호흡성 문제의 치료량을 계산하는 도구가 아닙니다.</p>
  <fieldset><legend>1. 검사값과 목표</legend><div class="pt-grid"><label>검체 종류<select name="sample" required><option value="">선택해주세요</option><option>정맥혈</option><option>동맥혈</option></select></label><label>채혈 일시 · 병원 현지 시간<input name="sampleAt" type="datetime-local" required></label><label class="pt-span">보정 기준 · 하나만 선택<select name="method"><option value="hco3">HCO₃ · 측정값에서 목표값까지</option><option value="be">BE · 음수 부호를 포함해 입력</option></select></label><label><span data-measured-label>측정 HCO₃ · mEq/L</span><input name="measured" inputmode="decimal" autocomplete="off" required></label><label><span data-target-label>수의사가 정한 목표 HCO₃ · mEq/L</span><input name="target" inputmode="decimal" autocomplete="off" required></label></div><p class="pt-help" data-method-help>정상값을 자동 적용하지 않습니다. HCO₃와 BE를 더해서 계산하지 않습니다.</p></fieldset>
  <fieldset><legend>2. 이번 보정 계획</legend><div class="pt-grid">${field('factor','분포계수 · L/kg','value="0.3"')}${field('fraction','이번 보정 비율 · %','value="25"')}</div><p class="pt-help">산식: 체중 × 분포계수 × (목표 − 측정값) × 보정 비율/100. 분포계수 0.3 L/kg · 이번 25%(1/4)를 수정 가능한 시작값으로 적용합니다. 환자별 목표는 직접 정하고, 투여 후 재검으로 다음 보정량을 결정합니다.</p></fieldset>
  <fieldset><legend>3. 실제 제품과 주입 계획</legend><div class="pt-grid"><label>제품 표시 농도<select name="stock" required><option value="">실제 제품을 확인해 선택</option><option value="1">8.4% · 84 mg/mL = 1 mEq/mL</option><option value="0.5">4.2% · 42 mg/mL = 0.5 mEq/mL</option></select></label>${field('volume','원액을 포함한 희석 후 최종 부피 · mL')}${field('minutes','수의사가 정한 주입 시간 · 분')}<label>적합성을 확인한 희석액<input name="diluent" maxlength="100" required placeholder="실제 사용할 희석액"></label></div><p class="pt-help">칼슘 함유 수액과 혼합하지 마세요. 동일 라인 약물·희석액 적합성, Na 부하·삼투압 및 주입 경로를 별도로 확인합니다.</p></fieldset>
  <label>재검·모니터링 계획<textarea name="plan" rows="2" maxlength="500" required placeholder="재검 시점과 확인 항목: 혈액가스, Na·K·이온화 Ca, 환기·체액 상태 등"></textarea></label><label class="pt-choice"><input name="confirmed" type="checkbox" required>pH·PCO₂·전해질·환기 상태를 검토하고, 적응증·목표·이번 투여 비율·제품·희석액·주입 시간·재검 계획을 확인했습니다.</label>${output}<p class="pt-help"><a href="${sources.bicarb}" target="_blank" rel="noopener noreferrer">Haskins · 수의 산·염기 보정 산식</a> · <a href="${sources.product}" target="_blank" rel="noopener noreferrer">DailyMed · 제품 농도·배합 주의</a> · 확인 2026-10-22</p></form>
  <details class="pt-card"><summary class="pt-summary">해석·교정 시 확인할 점</summary><p>AG만으로 산증의 원인이나 중탄산 투여 필요성을 판단하지 않습니다. 알부민·젖산·케톤·검체 상태를 함께 확인하세요.</p><p>알칼리증은 염소·칼륨·체액 상태와 구토·이뇨제 등 원인을 평가합니다. 호흡성 이상은 환기를 평가합니다. 사람의 보상 공식을 개·고양이에 일괄 적용하거나 산성 약물 투여량을 자동 산출하지 않습니다.</p><p>중탄산은 CO₂·Na 부하, K·이온화 Ca 저하와 과교정 위험이 있습니다. 계산된 양의 전량 투여나 반복 투여를 자동 결정하지 말고 치료 후 재평가하세요.</p></details>`;
  main.append(panel);const ag=panel.querySelector('[data-calc=ag]'),bc=panel.querySelector('[data-calc=bicarbonate]');
  function layout(){const withK=ag.elements.method.value==='withK';ag.elements.k.closest('label').hidden=!withK;ag.elements.k.required=withK;ag.elements.k.disabled=!withK;const be=bc.elements.method.value==='be';bc.elements.measured.inputMode=bc.elements.target.inputMode=be?'text':'decimal';bc.querySelector('[data-measured-label]').textContent=be?'측정 BE · mEq/L · 음수 포함':'측정 HCO₃ · mEq/L';bc.querySelector('[data-target-label]').textContent=be?'수의사가 정한 목표 BE · mEq/L':'수의사가 정한 목표 HCO₃ · mEq/L';bc.querySelector('[data-method-help]').textContent=be?'BE −12 → 목표 −5라면 차이는 7입니다. 양수로 표시된 base deficit을 그대로 입력하지 마세요.':'정상값을 자동 적용하지 않습니다. HCO₃와 BE를 더해서 계산하지 않습니다.';}
  panel.querySelectorAll('[data-acid-view]').forEach(btn=>btn.onclick=()=>{panel.querySelectorAll('[data-acid-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));ag.hidden=btn.dataset.acidView!=='ag';bc.hidden=btn.dataset.acidView!=='bicarbonate';});
  for(const f of [ag,bc]){
   f.addEventListener('input',e=>{if(e.target.closest('[data-result-actions]'))return;o.clear();if(e.target.name!=='confirmed')bc.elements.confirmed.checked=false;});
   f.addEventListener('change',e=>{if(e.target.closest('[data-result-actions]'))return;o.clear();if(e.target.name!=='confirmed')bc.elements.confirmed.checked=false;if(e.target.name==='method'){if(f===bc){f.elements.measured.value='';f.elements.target.value=f.elements.method.value==='be'?'0':'';}else f.elements.k.value='';}layout();});
   f.onsubmit=e=>{e.preventDefault();if(!o.guard())return;const out=f.querySelector('output');try{
    if(!['dog','cat'].includes(o.species.value))throw Error('상단에서 개 또는 고양이를 선택해주세요.');
    const v={...Object.fromEntries(new FormData(f)),weight:o.weight.value};let text;
    if(f===ag){const r=c.anionGap(v);text=`음이온차 AG ${c.display(r.gap)} mEq/L\n${r.withK?'(Na + K) − (Cl + HCO₃)':'Na − (Cl + HCO₃)'}\nNa ${v.na}${r.withK?' · K '+v.k:''} · Cl ${v.cl} · HCO₃ ${v.hco3} mEq/L\n선택한 계산식과 일치하는 검사실 참고범위를 사용하세요. 정상·이상 또는 치료 필요성을 자동 판정하지 않습니다.\n출처 ${sources.ag}`;}
    else {if(!bc.elements.confirmed.checked)throw Error('교정 계획과 환자 상태를 먼저 확인해주세요.');if(!v.doseOnly&&!v.diluent?.trim())throw Error('사용할 희석액을 입력해주세요.');const r=c.bicarbonate(v),fmt=c.display;text=`중탄산 보정 계획 · 체중 ${v.weight} kg\n${v.sample||'검체 종류 미기록'}${v.sampleAt?' · 채혈 '+v.sampleAt.replace('T',' ')+' (병원 현지 시간)':''}\n${v.method==='be'?'BE':'HCO₃'} ${v.measured} → 목표 ${v.target} mEq/L · 차이 ${fmt(r.deficit)} mEq/L\n분포계수 ${v.factor} L/kg · 목표까지 추정량 ${fmt(r.estimated)} mEq\n이번 보정량 ${fmt(r.amount)} mEq (추정량의 ${fmt(Number(v.fraction))}%)\n중탄산 원액 ${fmt(r.stockML)} mL · ${v.stock} mEq/mL\n${r.doseOnly?'원액 필요량만 계산했습니다. 직접 주입량·속도가 아닙니다. 희석·주입 계획은 별도로 확인하세요.':`${v.diluent} ${fmt(r.diluentML)} mL + 원액 → 최종 ${v.volume} mL\n최종 농도 ${fmt(r.concentration)} mEq/mL\n계획한 ${c.duration(Number(v.minutes)/60)} 동안 · 펌프 속도 ${fmt(r.rate)} mL/hr`}\n이번 Na 부하 ${fmt(r.amount)} mEq · 중탄산 ${fmt(r.perKg)} mEq/kg\n${r.doseOnly?'':`체중당 주입 속도 ${fmt(r.hourlyPerKg)} mEq/kg/hr (안전 속도 판정 아님)`}\n재검·모니터링: ${v.plan||'별도 진료계획에서 확인'}\n계산량을 반복 투여하지 마세요. 혈액가스·전해질·환기·체액 상태를 재평가하세요.\n산식: 체중 × 분포계수 × (목표 − 측정값) × 보정 비율/100\n출처 ${sources.bicarb}\n출처 https://todaysveterinarypractice.com/internal-medicine/the-practitioners-acid-base-primer-differential-diagnoses-treatment/\n제품 농도 ${sources.product}`;}
    text=(o.species.value==='dog'?'개':'고양이')+'\n'+text+'\n근거 확인 2026-10-26';out.className='pt-output pt-pre';out.replaceChildren();for(const line of text.split('\n').filter(x=>!(/^(출처|제품 농도) https:/.test(x)))){const span=document.createElement('span');span.textContent=line+'\n';if(/^(음이온차 AG|이번 보정량|중탄산 원액|계획한)/.test(line))span.className='pt-calc-highlight';out.append(span);}o.resultActions(f,text);out.focus({preventScroll:true});out.scrollIntoView({block:'nearest',behavior:'smooth'});
   }catch(err){out.className='pt-error';out.textContent=err.message;f.querySelector('[data-result-actions]').hidden=true;out.focus({preventScroll:true});}}
  }
  layout();return {reset(){ag.reset();bc.reset();layout();o.clear();}};
 }

 function simplify(b,o){
  const f=b.querySelector('[data-calc=bicarbonate]');if(!f)return;
  const advanced=f.querySelector('[data-settings=bicarbonate]');
  const host=document.createElement('section');host.className='pt-bc-quick';
  host.innerHTML='<label class="pt-choice"><input type="checkbox" name="doseOnly" checked>원액 필요량만 계산 · 희석·속도 입력 생략</label><p class="pt-help" data-bc-mode-note></p><div class="pt-grid" data-bc-main></div><p class="pt-notice" data-bc-defaults></p>';
  f.querySelector('.pt-notice').after(host);
  const main=host.querySelector('[data-bc-main]');
  for(const name of ['method','measured','target','stock'])main.append(f.elements[name].closest('label'));
  advanced.querySelector('summary').textContent='분포계수·보정 비율 변경';
  const infusion=document.createElement('section');infusion.className='pt-bc-infusion';infusion.innerHTML='<h4>희석·주입 계획</h4><div class="pt-grid"></div><p class="pt-help">최종 부피와 시간은 환자의 수액 허용량·정맥 경로에 맞춰 선택합니다. 빠른 선택은 처방 권장값이 아닙니다.</p>';
  advanced.after(infusion);
  for(const name of ['volume','minutes','diluent'])infusion.querySelector('.pt-grid').append(f.elements[name].closest('label'));
  function buttons(input,values,labels){
   const row=document.createElement('div');row.className='pt-input-shortcuts';input.after(row);
   values.forEach((value,i)=>{const button=document.createElement('button');button.type='button';button.textContent=labels[i];button.dataset.bcQuick=input.name+':'+value;button.onclick=()=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};row.append(button);});
  }
  buttons(f.elements.fraction,[25,100/3],['1/4 · 25%','1/3 · 약 33.33%']);
  buttons(f.elements.volume,[20,50,100],['20 mL','50 mL','100 mL']);
  buttons(f.elements.minutes,[60,120,180,240],['1시간','2시간','3시간','4시간']);
  buttons(f.elements.diluent,['0.9% N/S','D5W'],['N/S · 적합성 확인 후','D5W · 적합성 확인 후']);
  const source=document.createElement('p');source.className='pt-help';source.innerHTML='<a href="https://todaysveterinarypractice.com/internal-medicine/the-practitioners-acid-base-primer-differential-diagnoses-treatment/" target="_blank" rel="noopener noreferrer">Waddell · 분포계수 0.3 및 부분 보정 1/4–1/3 근거</a> · 확인 2026-10-26. 기본값은 보충을 결정한 경우의 계산 시작값이며, 모든 산증의 공통 치료법이 아닙니다.';
  advanced.append(source);
  function layout(){
   const only=f.elements.doseOnly.checked;infusion.hidden=only;
   for(const name of ['volume','minutes','diluent'])f.elements[name].disabled=only;
   const value=Number(f.elements.fraction.value),ratio=Math.abs(value-100/3)<1e-8?'약 33.33% (1/3)':f.elements.fraction.value+'%';
   host.querySelector('[data-bc-defaults]').textContent='적용 설정: 분포계수 '+f.elements.factor.value+' L/kg · 이번 '+ratio+' 보정. 아래에서 변경할 수 있습니다.';
   host.querySelector('[data-bc-mode-note]').textContent=only?'측정값·목표값·실제 제품 농도를 확인하면 원액량을 계산합니다. 희석·펌프 속도도 필요하면 체크를 해제하세요.':'희석 후 최종 부피와 주입 시간을 입력하면 펌프 속도를 함께 계산합니다.';
   f.elements.confirmed.closest('label').lastChild.textContent=only?'pH·PCO₂·전해질·환기, 적응증·목표·이번 보정 비율·제품을 확인했습니다. 실제 투여 전 희석·주입·재검 계획을 별도로 확인합니다.':'pH·PCO₂·전해질·환기, 적응증·목표·보정 비율·제품·희석·주입·재검 계획을 확인했습니다.';
   // Keep the method explanation with the active laboratory inputs.
   const help=f.querySelector('[data-method-help]');
   if(help){host.append(help);if(f.elements.method.value==='be')help.textContent='BE는 음수로 입력합니다. 목표 0은 결핍 추정 기준이며 전량 교정을 뜻하지 않습니다. 목표값과 이번 보정 비율을 변경할 수 있습니다.';}
  }
  for(const name of ['volume','minutes','diluent'])f.elements[name].required=true;
  f.addEventListener('change',layout);f.addEventListener('input',layout);f.addEventListener('reset',()=>queueMicrotask(layout));
  b.addEventListener('practice-protocol-applied',e=>{if(e.detail.calculator==='bicarbonate'){f.elements.doseOnly.checked=false;layout();}});
  for(const group of f.querySelectorAll('fieldset'))if(!group.querySelector('input,select,textarea')){for(const p of [...group.querySelectorAll('p')])advanced.append(p);group.remove();}
  layout();advanced.open=false;
 }
 g.PracticeAcidBase={mount,simplify};
})(window);
