/* Editable transfusion planning defaults; no patient writes or automatic prescriptions. */
(function(g){
 'use strict';
 const sources={calcium:'https://www.merckvetmanual.com/metabolic-disorders/disorders-of-calcium-metabolism/eclampsia-in-dogs-and-cats?autoredirectid=51461',product:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b2470072-f443-4596-ae33-1b8b0d05bc9d',blood:'https://www.msdvetmanual.com/circulatory-system/blood-groups-and-blood-transfusions-in-dogs-and-cats/blood-transfusions-in-dogs-and-cats',handling:'https://eclinpath.com/hemostasis/transfusion-medicine/transfusion-therapy/'};
 const bloodDefaults={dog:80,cat:60};
 const timingSource='https://www.petbloodbankuk.org/vet-professionals/i-need-advice/administration/canine-blood-administration/administration-of-canine-red-cell-products/';
 const field=(name,label)=>`<label>${label}<input name="${name}" inputmode="decimal" autocomplete="off" required></label>`;
 const output='<button class="pt-primary">계산</button><output aria-live="polite" tabindex="-1"></output><div data-result-actions hidden></div>';
 const link=(key,title)=>`<a href="${sources[key]}" target="_blank" rel="noopener noreferrer">${title}</a>`;
 function mount(main,o){
  const c=g.PracticeCalculators,kPanel=main.querySelector('[data-kind-panel=potassium]'),kForm=kPanel.querySelector('form');
  kPanel.insertAdjacentHTML('afterbegin','<div class="pt-section-intro"><h3>전해질</h3><p class="pt-help">의료진이 정한 칼륨·칼슘 보충 계획을 환산합니다.</p></div><nav class="pt-bar" aria-label="전해질 계산"><button type="button" data-electrolyte="potassium" aria-pressed="true">칼륨 · K</button><button type="button" data-electrolyte="calcium" aria-pressed="false">칼슘 보충 · Ca</button></nav>');
  const ca=document.createElement('form');ca.className='pt-card';ca.dataset.calc='calcium';ca.hidden=true;
  ca.innerHTML=`<h3>칼슘 보충량·주입속도</h3><p class="pt-notice">모든 용량·함량은 <b>원소칼슘 mg</b> 기준입니다. 혈중 칼슘의 차이로 필요량을 추정하지 않습니다. 처방량과 주입 시간은 의료진이 정합니다.</p>
   <div class="pt-grid"><label>투여 방식<select name="mode"><option value="single">단회 완속 정주 · IV</option><option value="continuous">지속정주 · IV CRI</option></select></label><label>실제 제품명·칼슘 염 종류<input name="product" maxlength="120" autocomplete="off" placeholder="예: 글루콘산칼슘 · 제품명" required></label>${field('dose','처방 원소칼슘 · mg/kg/회')}${field('stock','제품 원소칼슘 함량 · mg/mL')}${field('minutes','계획한 완속 주입 시간 · 분')}${field('hours','지속정주 계획 시간 · 시간')}${field('volume','약물 포함 최종 총 부피 · mL')}<label>희석액·조제 조건<input name="diluent" maxlength="160" autocomplete="off" placeholder="제품 지침 확인 · 미희석이면 미희석 입력" required></label></div>
   <p class="pt-help">제품의 %나 칼슘 염 mg를 원소칼슘 mg/mL 칸에 입력하지 마세요. 예: 일부 10% 글루콘산칼슘은 염 100 mg/mL에 원소칼슘 9.3 mg/mL를 포함합니다. 실제 제품 표시를 우선 확인하세요.</p>
   <details><summary class="pt-summary">투여 전·중 확인사항</summary><ul><li>임상 증상·이온화칼슘과 심박수·심전도, 정맥 경로 및 혈관외 유출 여부를 확인합니다. 서맥·부정맥 등 변화 시 주입을 멈추고 즉시 재평가합니다.</li><li>칼슘 염에 따라 원소칼슘 함량·조제 조건·조직손상 위험이 다릅니다. 염화칼슘을 글루콘산칼슘과 같은 부피로 대체하지 않습니다.</li><li>중탄산·인산 함유 제제와 혼합하지 않으며, 혈액제제와 같은 라인으로 주입하지 않습니다. 다른 약물과의 적합성은 제품 지침으로 확인합니다.</li><li>주사기·펌프 정확도, 최종 부피, 조제 후 사용 가능 시간과 재검 계획을 확인합니다.</li></ul></details>
   <label class="pt-choice"><input name="confirmed" type="checkbox" required>원소칼슘 함량·처방량·정맥 경로·희석 적합성·모니터링 계획을 확인했습니다.</label>${output}
   <details><summary class="pt-summary">계산식·근거</summary><p>단회 총 원소칼슘 = kg × mg/kg/회. 지속정주 총량 = kg × mg/kg/hr × 시간. 원액 mL = 원소칼슘 mg ÷ 제품 원소칼슘 mg/mL. 펌프 mL/hr = 최종 총 mL ÷ 시간.</p><p>${link('calcium','MSD · 개·고양이 칼슘 투여·모니터링')} · ${link('product','DailyMed · 해당 제품의 원소칼슘 함량·혼합 적합성')}</p><p class="pt-help">DailyMed는 해당 제품의 함량·제제 정보 확인용이며 사람의 투여량·최대 속도를 동물에 적용하지 않습니다. 확인 2026-10-23</p></details>`;
  kPanel.append(ca);
  kPanel.querySelectorAll('[data-electrolyte]').forEach(btn=>btn.onclick=()=>{const calcium=btn.dataset.electrolyte==='calcium';ca.hidden=!calcium;kForm.hidden=calcium;kPanel.querySelectorAll('[data-electrolyte]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));});
  const panel=document.createElement('section');panel.dataset.kindPanel='transfusion';panel.hidden=true;
  panel.innerHTML=`<div class="pt-section-intro"><h3>수혈</h3><p class="pt-help">전혈·농축적혈구는 PCV로, 혈장·기타 제제는 처방량으로 계산합니다.</p></div><form class="pt-card" data-calc="transfusion"><h3>수혈량·단계별 주입속도</h3><p class="pt-notice" data-transfusion-notice>수혈할 제제를 선택하면 필요한 입력란이 표시됩니다.</p>
   <div class="pt-grid"><label>수혈 제제<select name="product" required><option value="">제제 선택</option><option value="packed">농축적혈구 · pRBC</option><option value="whole">전혈 · Whole blood</option><option value="plasma">혈장 · FFP/FP</option><option value="other">기타 제제 · 처방량 직접 입력</option></select></label></div><input type="hidden" name="mode"><div data-transfusion-prescription><label>처방량 입력 단위<select name="prescriptionMode"><option value="dose">체중당 처방량 · mL/kg</option><option value="volume">총 처방량 · mL</option></select></label></div>
   <fieldset data-transfusion-pcv><legend>PCV는 %로 입력 · 0.20 대신 20</legend><div class="pt-grid">${field('current','현재 환자 PCV · %')}${field('target','의료진이 정한 목표 PCV · %')}${field('unitPcv','실제 혈액제제 PCV · %')}</div><section class="pt-blood-estimate" aria-label="환자 추정 총혈액량" role="status"><span>환자 추정 총혈액량</span><strong data-blood-total></strong><p data-blood-formula></p><p class="pt-help" data-blood-volume-hint></p></section><details class="pt-blood-settings"><summary class="pt-summary">혈액량 계수 변경 · 필요한 경우</summary>${field('bloodVolume','체중당 혈액량 계수 · mL/kg')}<button type="button" data-blood-default>종별 기본값으로 복원</button><p class="pt-help">화면 기본값: 개 80 · 고양이 60 mL/kg. 문헌·환자 상태에 따라 조정할 수 있으며, 변경값은 현재 계산에만 적용합니다.</p></details><p class="pt-help">제제 PCV는 제품 표시·검사값을 사용합니다. 목표 PCV를 정상범위로 자동 설정하지 않습니다.</p></fieldset>
   <div data-transfusion-dose>${field('dose','의료진이 정한 제제 용량 · mL/kg')}</div><div data-transfusion-volume>${field('volume','의료진이 정한 총 수혈량 · mL')}</div>
   <section class="pt-transfusion-protocol"><h4>시간·초기 관찰 기본 설정</h4><label>완료 계획<select name="timing"><option value="4">총 4시간 · 기본 계획</option><option value="3">총 3시간</option><option value="2">총 2시간</option><option value="custom">시간·초기 속도 직접 설정</option></select></label><p class="pt-help">전혈·농축적혈구·혈장 선택 시 총 4시간, 초기 15분 0.5 mL/kg/hr를 입력합니다. 안정 환자의 계획 시작값이며 환자별 처방이 아닙니다. 초기 이상 반응이 없음을 확인한 뒤 이후 속도로 조정합니다. 심장·신장 질환, 과부하 위험·응급 출혈은 개별 계획을 사용하세요.</p><details><summary class="pt-summary">제제 개봉 후 경과시간 · 기본 0분</summary><label>개봉·분주 후 이미 경과한 시간 · 분<input name="elapsedMinutes" value="0" inputmode="decimal" autocomplete="off" required></label><p class="pt-help">0분은 개봉 직후 시작하는 가정입니다. 실제 경과시간을 입력하면 선택한 완료 계획에서 차감합니다. 이미 개봉·분주해 실온에 둔 시간도 포함해 제제 사용기한을 확인하세요.</p></details><p data-transfusion-timing-note role="status"></p><a href="${timingSource}" target="_blank" rel="noopener noreferrer">Pet Blood Bank · 초기 속도·개봉 후 4시간 기준</a> · <a href="https://doi.org/10.1177/1098612X211007071" target="_blank" rel="noopener noreferrer">ISFM · 고양이 수혈 지침</a></section>
   <div class="pt-grid">${field('hours','총 계획 시간 · 초기 관찰 포함 · 시간')}<label>계획 시작 시각 · 선택<input name="startAt" type="datetime-local"></label></div><label class="pt-choice"><input name="initial" type="checkbox">초기 관찰 구간을 나누어 계산</label><div class="pt-grid" data-transfusion-initial>${field('initialRate','초기 처방 속도 · mL/kg/hr')}${field('initialMinutes','초기 관찰 시간 · 분')}</div><p class="pt-help">총 시간에서 초기 시간을 빼고, 총량에서 초기 주입량을 뺀 뒤 나머지 속도를 계산합니다. 반응 확인 후 의료진이 속도 변경을 결정합니다.</p>
   <section class="pt-transfusion-gravity"><h4>중력 점적 환산</h4><label>실제 수혈 세트 점적계수<select name="factor"><option value="20">20 방울/mL</option><option value="10">10 방울/mL</option><option value="15">15 방울/mL</option><option value="60">60 방울/mL</option></select></label><p class="pt-help">기본 점적계수는 20 방울/mL입니다. 혈액용 필터가 포함된 수혈 세트 또는 적합한 인라인 혈액 필터를 사용하세요. 일반 수액세트만으로 수혈하는 안내가 아닙니다. 실제 세트 표시를 확인하고, 혈액 점도·백 높이·자세 변화에 따른 실제 주입량을 관찰합니다.</p></section><details><summary class="pt-summary">수혈 전·중·후 확인사항</summary><ul><li>혈액형·교차시험, 과거 수혈 이력, 제제 상태·유효시간과 환자 상태를 확인합니다. 심장·신장 질환과 순환 과부하 위험을 고려합니다.</li><li>전용 혈액 필터·주입 장비를 사용하고 칼슘 함유 수액·약물을 같은 라인에 혼합하지 않습니다.</li><li>시작 전 기준 활력징후를 기록하고 초기 관찰을 강화합니다. 발열·구토·호흡 변화·저혈압 등 의심 반응 시 즉시 중단하고 평가합니다.</li><li>종료 후 임상 반응·PCV 및 지연 반응을 확인합니다. 혈액제제는 일반적으로 4시간 이내 투여를 마치도록 관리하며 제품 지침·분할 계획을 확인합니다.</li></ul></details>
   <label class="pt-choice"><input name="confirmed" type="checkbox" required>혈액형·교차시험 등 적합성, 목표·제제·시간·혈액 필터·실제 세트 점적계수 및 모니터링 계획을 의료진이 확인했습니다.</label>${output}
   <details><summary class="pt-summary">계산식·근거</summary><p>적혈구·전혈 예상 mL = kg × 추정 혈액량(mL/kg) × (목표 PCV − 환자 PCV) ÷ 제제 PCV. 처방량 환산 mL = kg × mL/kg. 초기량 = kg × 초기 mL/kg/hr × 초기 분 ÷ 60. 이후 mL/hr = 남은 mL ÷ 남은 시간. 방울/분 = mL/hr × 방울/mL ÷ 60. 초/방울 = 3600 ÷ (mL/hr × 방울/mL). 20 방울/mL에서는 180 ÷ mL/hr입니다.</p><p>${link('blood','MSD · 수혈량 계산·환자 평가')} · ${link('handling','Cornell eClinpath · 수혈제제 취급·관찰')}</p><p class="pt-help">확인 2026-10-24 · 혈액량 계수는 MSD 참고 범위 내 화면 기본값(개 80·고양이 60 mL/kg)을 자동 적용하며, 필요한 경우 변경할 수 있습니다.</p></details></form>`;
  main.append(panel);const tf=panel.querySelector('form');let coefficientSpecies='',coefficientManual=false;
  function applyTiming(){
   if(tf.elements.timing.value==='custom'){timingNote();return;}
   const elapsed=Number(tf.elements.elapsedMinutes.value),hours=Number(tf.elements.timing.value)-elapsed/60;
   tf.elements.hours.value=Number.isFinite(hours)&&hours>0?String(hours):'';tf.elements.initial.checked=true;tf.elements.initialRate.value='0.5';tf.elements.initialMinutes.value='15';timingNote();
  }
  function timingNote(){const n=tf.querySelector('[data-transfusion-timing-note]'),h=Number(tf.elements.hours.value),elapsed=Number(tf.elements.elapsedMinutes.value);if(!tf.elements.product.value){n.textContent='';n.hidden=true;return;}n.hidden=false;if(!tf.elements.hours.value.trim()&&!(Number(tf.elements.elapsedMinutes.value)>=Number(tf.elements.timing.value)*60)){n.textContent='총 계획 시간을 입력해주세요.';return;}n.textContent=tf.elements.timing.value==='custom'?'직접 수정한 시간·속도입니다. 환자 상태와 제제 사용기한을 확인하세요.':h>0?'시작부터 '+c.duration(h)+' · 초기 15분 포함 · 개봉 후 경과 '+elapsed+'분 반영':'선택한 완료 시점이 지났습니다. 제제 사용기한·분할 계획을 확인하세요.';}
  function group(node,show){node.hidden=!show;node.querySelectorAll('input').forEach(x=>{x.disabled=!show;});}
  function caLayout(){const single=ca.elements.mode.value==='single';ca.elements.dose.closest('label').firstChild.textContent='처방 원소칼슘 · '+(single?'mg/kg/회':'mg/kg/hr');for(const [key,show] of [['minutes',single],['hours',!single]]){ca.elements[key].disabled=!show;ca.elements[key].closest('label').hidden=!show;}}
  function applyBloodDefault(force=false){const species=o.species.value;if(force||coefficientSpecies!==species){coefficientSpecies=species;coefficientManual=false;tf.elements.bloodVolume.value=bloodDefaults[species]||'';}bloodEstimate();}
  function bloodEstimate(){
   const species=o.species.value,coefficient=tf.elements.bloodVolume.value.trim(),weight=o.weight.value.trim(),valid=x=>/^(?:\d+\.?\d*|\.\d+)$/.test(x)&&Number.isFinite(Number(x)),total=tf.querySelector('[data-blood-total]'),formula=tf.querySelector('[data-blood-formula]');
   const kind=species==='dog'?'개':species==='cat'?'고양이':'';
   tf.querySelector('[data-blood-volume-hint]').textContent=kind?(coefficientManual?'직접 입력 계수':'종별 기본 계수 자동 적용')+' · '+kind+' '+coefficient+' mL/kg · MSD 참고 범위 '+(species==='dog'?'80~90':'40~60')+' mL/kg':'상단에서 동물 종류를 선택해주세요.';
   formula.textContent='';
   if(!kind){total.textContent='동물 종류 선택 후 표시';return;}
   if(!valid(coefficient)||Number(coefficient)<20||Number(coefficient)>150){total.textContent='혈액량 계수를 확인해주세요.';return;}
   if(!valid(weight)||Number(weight)<=0||Number(weight)>200){total.textContent=weight?'체중을 확인해주세요.':'체중 입력 후 표시';return;}
   total.textContent=c.display(Number(weight)*Number(coefficient))+' mL';formula.textContent='체중 '+weight+' kg × '+coefficient+' mL/kg';
  }
  function tfLayout(){
   const product=tf.elements.product.value,red=['packed','whole'].includes(product),prescribed=['plasma','other'].includes(product);
   tf.elements.mode.value=red?'pcv':prescribed?tf.elements.prescriptionMode.value:'';
   tf.querySelector('[data-transfusion-prescription]').hidden=!prescribed;tf.elements.prescriptionMode.disabled=!prescribed;
   for(const kind of ['pcv','dose','volume'])group(tf.querySelector('[data-transfusion-'+kind+']'),tf.elements.mode.value===kind);
   group(tf.querySelector('[data-transfusion-initial]'),tf.elements.initial.checked);
   tf.querySelector('[data-transfusion-notice]').textContent=red?'현재·목표·제제 PCV로 예상 수혈량을 계산합니다. 실제 반응은 지속 출혈·용혈·수액 희석에 따라 달라집니다.':prescribed?'의료진이 정한 처방량과 투여시간으로 총량·주입속도를 계산합니다.':'수혈할 제제를 선택하면 필요한 입력란이 표시됩니다.';
   applyBloodDefault();
  }
  tf.querySelector('[data-blood-default]').onclick=()=>{invalidate(tf);applyBloodDefault(true);};
  tf.addEventListener('invalid',e=>{for(let n=e.target.parentElement;n&&n!==tf;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;},true);
  o.weight.addEventListener('input',bloodEstimate);
  function invalidate(f){f.elements.confirmed.checked=false;o.clear();}
  function gravityText(r,initial,fmt){
   const line=(name,x)=>name+' 중력 점적: 약 '+fmt(x.secondsPerDrop).replace(/^≈ /,'')+'초마다 1방울 · 약 '+fmt(x.dropsPerMinute).replace(/^≈ /,'')+'방울/분';
   const parts=['세트 '+r.factor+' 방울/mL 기준 · 실제 표시·혈액 필터 확인'];
   if(initial&&r.initialGravity)parts.push(line('초기',r.initialGravity));
   parts.push(line(initial?'이후':'계획',r.gravity));
   if(r.gravity.secondsPerDrop<1||r.initialGravity?.secondsPerDrop<1)parts.push('1방울 간격이 1초 미만인 구간은 수동 조절이 어렵습니다. 혈액제제에 적합한 주입 장비를 검토하세요.');
   parts.push('점적 간격은 근삿값입니다. 실제 투여량·환자 반응을 계속 확인하고 계산값에 맞추기 위해 처방 속도를 임의로 바꾸지 마세요.');
   return parts.join('\n');
  }

  function tfNumber(n){const x=Number(n),value=x!==0&&Math.abs(x)<.01?Number(x.toPrecision(3)):Math.round(x*100)/100;return String(value);}
  function bloodResult(out,text,blocked){
   const {r,v}=tf._result,initial=tf.elements.initial.checked;
   out.className='pt-output pt-transfusion-result'+(blocked?' pt-error':'');
   const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
   const total=node('section','pt-tf-total');total.append(node('span','',v.mode==='pcv'?'예상 총 수혈량':'계획 총 수혈량'),node('strong','', '≈ '+tfNumber(r.volume)+' mL'),node('span','',tfNumber(r.perKg)+' mL/kg · 총 '+c.duration(v.hours)));
   out.append(total);
   const stages=node('div','pt-tf-stages');
   function stage(title,hours,rate,perKg,volume,gravity,note){
    const card=node('section','pt-tf-stage');card.append(node('h4','',title+' · '+c.duration(hours)));
    const pump=node('div','pt-tf-pump');pump.append(node('span','','펌프 주입속도'),node('strong','', '≈ '+tfNumber(rate)+' mL/hr'));card.append(pump);
    card.append(node('p','pt-tf-secondary',tfNumber(perKg)+' mL/kg/hr · 이 구간 '+tfNumber(volume)+' mL'));
    const drip=node('div','pt-tf-drip');drip.append(node('span','','중력 점적 · '+r.factor+' 방울/mL 세트'),node('b','', '약 '+tfNumber(gravity.secondsPerDrop)+'초마다 1방울'),node('small','', '약 '+tfNumber(gravity.dropsPerMinute)+'방울/분'));card.append(drip,node('p','pt-help',note));stages.append(card);
   }
   if(initial)stage('① 초기 관찰',Number(v.initialMinutes)/60,r.initialRate,Number(v.initialRate),r.initialVolume,r.initialGravity,'초기 반응을 관찰합니다.');
   stage(initial?'② 이후 주입':'주입 계획',initial?r.remainingHours:Number(v.hours),r.rate,r.ratePerKg,initial?r.remaining:r.volume,r.gravity,initial?'초기 이상 반응이 없음을 확인한 뒤 속도를 변경합니다.':'환자 반응에 따라 의료진이 속도를 조정합니다.');
   out.append(stages);
   const timeline=g.PracticePreparation?.timeline(v,initial);if(timeline)out.append(node('p','pt-tf-timeline',timeline));
   const notes=node('div','pt-result-notes');
   for(const line of text.split('\n'))if(/초과|계수.*범위 밖|1초 미만|점적 간격은|과부하/.test(line))notes.append(node('p','',line));
   if(notes.childNodes.length)out.append(notes);
   const details=node('details','pt-result-details');details.append(node('summary','','계산 과정·입력값 확인'),node('div','pt-pre',text.split('\n').filter(x=>! /^(근거|제제 취급) https:/.test(x)).join('\n')));out.append(details);
  }
  function render(f,text,blocked){const out=f.querySelector('output');out.className='pt-output pt-pre'+(blocked?' pt-error':'');out.replaceChildren();if(f===tf){bloodResult(out,text,blocked);if(blocked)f.querySelector('[data-result-actions]').hidden=true;else o.resultActions(f,text);return;}for(const line of text.split('\n')){if(/^(근거 https:|제품 함량 확인 https:|제제 취급 https:)/.test(line))continue;const span=document.createElement('span');span.textContent=line+'\n';if(/^(총 원소칼슘|조제 분량의|계산상 희석액|약물 포함 최종|필요 원액|펌프 설정 속도|예상 필요량|계획 수혈량|계획 일정|계획 속도|초기 \d|이후 \d|초기 중력|이후 중력|계획 중력)/.test(line))span.className='pt-calc-highlight';if(f===ca){span.classList.toggle('pt-calc-highlight',/^(필요 원액|계산상 희석액|펌프 설정 속도)/.test(line));if(line.startsWith('펌프 설정 속도'))span.classList.add('pt-ca-pump');}out.append(span);}if(blocked)f.querySelector('[data-result-actions]').hidden=true;else o.resultActions(f,text);}
  for(const f of [ca,tf]){
   f.addEventListener('input',e=>{if(e.target.closest('[data-result-actions]'))return;o.clear();if(e.target.name!=='confirmed')f.elements.confirmed.checked=false;if(f===tf&&['hours','initialRate','initialMinutes'].includes(e.target.name)){tf.elements.timing.value='custom';timingNote();}if(f===tf&&e.target.name==='elapsedMinutes'){applyTiming();}if(f===tf&&e.target.name==='bloodVolume'){coefficientManual=true;bloodEstimate();}});
   f.addEventListener('change',e=>{if(e.target.closest('[data-result-actions]'))return;if(e.target.name!=='confirmed')invalidate(f);
    if(f===ca){if(e.target.name==='mode'){ca.elements.dose.value='';ca.elements.minutes.value='';ca.elements.hours.value='';}if(e.target.name==='product')ca.elements.stock.value='';caLayout();}
    else{if(e.target.name==='product'){const priorRed=tf.elements.mode.value==='pcv',red=['packed','whole'].includes(tf.elements.product.value);for(const key of ['unitPcv','dose','volume','initialRate','initialMinutes'])tf.elements[key].value='';if(!priorRed||!red)for(const key of ['current','target'])tf.elements[key].value='';tf.elements.initial.checked=false;tf.elements.prescriptionMode.value='dose';tf.elements.elapsedMinutes.value='0';tf.elements.timing.value=['packed','whole','plasma'].includes(tf.elements.product.value)?'4':'custom';tf.elements.hours.value='';applyTiming();}if(e.target.name==='prescriptionMode')for(const key of ['dose','volume'])tf.elements[key].value='';if(e.target.name==='initial'){tf.elements.timing.value='custom';tf.elements.initialRate.value=tf.elements.initial.checked?'0.5':'';tf.elements.initialMinutes.value=tf.elements.initial.checked?'15':'';timingNote();}if(e.target.name==='timing'||e.target.name==='elapsedMinutes')applyTiming();tfLayout();}
   });
   f.onsubmit=e=>{e.preventDefault();if(!o.guard())return;const out=f.querySelector('output');try{
    if(!['dog','cat'].includes(o.species.value))throw Error('상단에서 개 또는 고양이를 선택해주세요.');
    if(!f.elements.confirmed.checked)throw Error('입력값과 적용·모니터링 계획을 먼저 확인해주세요.');
    if(f===tf)tfLayout();const v={...Object.fromEntries(new FormData(f)),weight:o.weight.value,species:o.species.value},fmt=f===tf?tfNumber:c.display;let text,blocked=false;
    if(f===ca){g.PracticeCalciumGuided?.validate(v);if(!v.product.trim()||!v.diluent.trim())throw Error('제품명과 희석액·조제 조건을 입력해주세요.');const r=c.calcium(v);text=`칼슘 ${v.mode==='single'?'단회 완속 정주':'지속정주'} · IV\n제품 ${v.product} · 원소칼슘 ${v.stock} mg/mL\n체중 ${v.weight} kg × 처방 ${v.dose} 원소칼슘 ${v.mode==='single'?'mg/kg/회':'mg/kg/hr'}\n${r.concentrationMode?'조제 분량의 계산상 소진 시간 '+g.PracticeCalculators.duration(r.hours)+' · 치료 종료·사용기한 아님':'계획 시간 '+(v.mode==='single'?v.minutes+'분':g.PracticeCalculators.duration(Number(v.hours)))}\n${r.concentrationMode?'조제 분량의 원소칼슘':'총 원소칼슘'} ${fmt(r.amount)} mg\n필요 원액 ${fmt(r.stockML)} mL\n계산상 희석액 ${fmt(r.diluentML)} mL · ${v.diluent}\n약물 포함 최종 ${v.volume} mL · 원소칼슘 ${fmt(r.concentration)} mg/mL\n펌프 설정 속도 ${fmt(r.rate)} mL/hr · ${fmt(r.rate/Number(v.weight))} mL/kg/hr\n원소칼슘 공급 ${fmt(r.hourly)} mg/hr · ${fmt(r.hourlyPerKg)} mg/kg/hr\n계산상 계획 분량이며 조제 후 사용 가능 시간을 뜻하지 않습니다. ECG·심박수·주사 부위 및 재검 계획을 확인하세요.\n근거 ${sources.calcium}\n제품 함량 확인 ${sources.product}`;}
    else{const r=c.transfusion({...v,initial:tf.elements.initial.checked}),product=tf.elements.product.selectedOptions[0].textContent;blocked=r.overFourHours;tf._result={r,v};let basis=v.mode==='pcv'?`현재 PCV ${v.current}% → 목표 ${v.target}% · 제제 ${v.unitPcv}%\n적용 혈액량 계수 ${v.bloodVolume} mL/kg (${coefficientManual?'직접 입력':'종별 기본값'})\n환자 추정 총혈액량 ${fmt(Number(v.weight)*Number(v.bloodVolume))} mL`:v.mode==='dose'?`처방 ${v.dose} mL/kg`:`의료진 지정 총량 ${v.volume} mL`;text=`${product} · 체중 ${v.weight} kg\n${basis}\n${v.mode==='pcv'?'예상 필요량':'계획 수혈량'} ${fmt(r.volume)} mL · ${fmt(r.perKg)} mL/kg\n총 계획 ${c.duration(v.hours)} (초기 관찰 포함) · 개봉 후 경과 ${v.elapsedMinutes}분\n${tf.elements.initial.checked?`초기 ${c.duration(Number(v.initialMinutes)/60)}: ${fmt(r.initialRate)} mL/hr (${v.initialRate} mL/kg/hr) · ${fmt(r.initialVolume)} mL\n이후 ${c.duration(r.remainingHours)}: ${fmt(r.rate)} mL/hr (${fmt(r.ratePerKg)} mL/kg/hr) · ${fmt(r.remaining)} mL`:`계획 속도 ${fmt(r.rate)} mL/hr (${fmt(r.ratePerKg)} mL/kg/hr)\n일정 속도로 환산한 값입니다. 시작 시 관찰과 실제 속도 변경은 의료진이 결정합니다.`}\n${g.PracticePreparation?.timeline(v,tf.elements.initial.checked)||''}\n${gravityText(r,tf.elements.initial.checked,fmt)}\n${r.coefficientOutside?'선택한 혈액량 계수가 MSD 참고 범위 밖입니다. 사용할 문헌·환자별 근거를 다시 확인하세요.\n':''}${blocked?'개봉 후 경과시간을 포함해 4시간을 초과하는 계획입니다. 제제 사용기한·분할 계획을 재검토하세요. 자동으로 속도를 높이지 않으며 결과 복사·인쇄는 보류합니다.\n':''}${v.mode==='pcv'?'예상 PCV 상승과 실제 반응은 다를 수 있습니다. ':''}과부하·수혈 반응을 관찰하고 재검하세요.\n근거 ${sources.blood}\n제제 취급 ${sources.handling}`;}
    if(f===ca)text+='\n'+(g.PracticeCalciumGuided?.context(v)||'');render(f,(v.species==='dog'?'개':'고양이')+'\n'+text,blocked);
   }catch(err){out.className='pt-error';out.textContent=err.message;f.querySelector('[data-result-actions]').hidden=true;}};
  }
  caLayout();tfLayout();return {weightChanged:bloodEstimate,reset(){ca.reset();tf.reset();tf.querySelector('.pt-blood-settings').open=false;applyBloodDefault(true);caLayout();tfLayout();timingNote();o.clear();}};
 }
 g.PracticeCalciumTransfusion={mount};
})(window);
