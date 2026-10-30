(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(b,options){
  const ref=g.PracticeReference,med=b.querySelector('[data-calc=dose]'),fluid=b.querySelector('[data-calc=fluid]');
  let applied=null,fluidApplied=null;
  const card=document.createElement('section');card.className='pt-card pt-reference';
  card.innerHTML=`<h3>약물·수액 참고 기준</h3><p class="pt-help">미국 제품 허가문서·AAHA 기준 · 확인일 ${ref.checked}. 국내 사용 제품의 허가사항·함량과 대조하고 환자에게 적합한 용법을 선택하세요.</p><label>계산 대상 동물<select data-ref-species><option value="">종을 선택해주세요</option><option value="dog">개</option><option value="cat">고양이</option></select></label><p data-ref-patient class="pt-help"></p>`;
  b.querySelector('[data-kind-panel=med]').before(card);
  const species=card.querySelector('[data-ref-species]');
  const drugBox=document.createElement('section');drugBox.className='pt-card';
  drugBox.innerHTML='<h3>경구제·주사제 선택</h3><div class="pt-grid"><label>분류<select data-ref-category><option value="">전체</option><option value="oral">경구제</option><option value="injection">주사제</option></select></label><label>성분·제품 검색<input data-ref-search type="search" placeholder="예: 마로피탄트, amoxicillin"></label></div><label>약물·제형<select data-ref-drug></select></label><div data-ref-detail></div><p data-ref-status role="status"></p><button type="button" data-ref-manual>참고 선택 해제·직접 입력</button>';
  med.before(drugBox);
  const fluidBox=document.createElement('section');fluidBox.className='pt-card';
  fluidBox.innerHTML='<h3>수액 종류와 적용 목적</h3><label>사용 수액<select data-ref-fluid><option value="">종류 선택 · 직접 입력 가능</option>'+ref.fluids.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label><p data-fluid-description></p><label>참고 기준<select data-fluid-purpose><option value="">직접 정한 속도로 계산</option><option value="anesthesia">마취 중 · 심장·신장기능 정상</option><option value="maintenance">성견·성묘 유지 수분 요구량</option></select></label><div data-fluid-reference></div><p data-fluid-status role="status"></p>';
  fluid.before(fluidBox);
  const el=(key)=>drugBox.querySelector('[data-ref-'+key+']');
  const fe=(key)=>fluidBox.querySelector('[data-'+key+']');
  const clearMed=()=>{applied=null;for(const key of ['dose','concentration','times','days','totalDoses'])med.elements[key].value='';med.elements.doseBasis.value='kg';med.elements.doseUnit.value='mg';med.elements.strengthUnit.value='mg';med.elements.courseMode.value='single';med.elements.courseMode.dispatchEvent(new Event('change',{bubbles:true}));options.layout();options.clear();el('status').textContent='';};
  const clearFluid=()=>{fluidApplied=null;for(const key of ['rate','volume','hours'])fluid.elements[key].value='';options.clear();fe('fluid-status').textContent='';};
  const drug=()=>ref.drugs.find(x=>x.id===el('drug').value);
  function list(){el('drug').innerHTML='<option value="">약물을 선택해주세요</option>'+ref.drugs.filter(x=>(!el('category').value||x.category===el('category').value)&&(!el('search').value||[x.name,x.generic,x.product].join(' ').toLowerCase().includes(el('search').value.toLowerCase()))).map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.product)+'</option>').join('');el('detail').replaceChildren();}
  function details(){clearMed();const d=drug();if(!d){med.elements.times.value='1';med.elements.days.value='1';el('detail').replaceChildren();return;}const profiles=d.profiles.filter(x=>x.species===species.value),s=ref.sources[d.source];
   el('detail').innerHTML=`<p><b>${esc(d.product)}</b> · ${d.category==='injection'?'주사제':'경구제'}</p><p class="pt-notice">${esc(d.warning)}</p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>${!species.value?'<p>먼저 계산 대상 동물을 선택해주세요.</p>':!profiles.length?'<p class="pt-error">선택한 종에 적용할 참고 용법이 없습니다. 다른 종의 용량을 적용할 수 없습니다.</p>':`<label>적응증·투여 경로<select data-ref-profile><option value="">용법을 선택해주세요</option>${profiles.map(p=>`<option value="${p.id}">${esc(p.label)} · ${p.route}</option>`).join('')}</select></label><div data-ref-dose></div>`}`;
   el('profile')?.addEventListener('change',doseDetails);
  }
  function doseDetails(){clearMed();const d=drug(),p=d?.profiles.find(x=>x.id===el('profile').value&&x.species===species.value),host=el('dose');if(!p){host.replaceChildren();return;}const unit=p.basis==='fixed'?'mg/마리/회':'mg/kg/회';host.innerHTML=`<div class="pt-notice"><b>${p.min===p.max?p.min:p.min+'~'+p.max} ${unit} · ${p.single?'단회':24/p.times+'시간 간격'}</b><p>경로: ${{PO:'경구',SC:'피하',IV:'정맥'}[p.route]} (${p.route})${p.maxDays?' · 최대 '+p.maxDays+'일':''}</p><p>${esc(p.note||'환자 상태에 따라 기간과 투여 가능 여부를 수의사가 확인합니다.')}</p></div><div class="pt-grid"><label>적용할 1회 용량 · ${unit}<input data-ref-value inputmode="decimal" value="${p.min===p.max?p.min:''}" ${p.min===p.max?'readonly':''}></label><label>실제 제품 함량 · ${d.form==='tablet'?'mg/정':'mg/mL'}<select data-ref-strength><option value="">제품 표시와 대조 후 선택</option>${d.strengths.map(x=>'<option value="'+x+'">'+x+' '+(d.form==='tablet'?'mg/정':'mg/mL')+'</option>').join('')}</select></label></div><label class="pt-choice"><input data-ref-confirm type="checkbox">종·연령·적응증·투여 경로·금기와 실제 제품을 확인했습니다.</label><button type="button" class="pt-primary" data-ref-apply disabled>확인한 용법을 계산기에 적용</button>`;
   el('confirm').onchange=()=>{el('apply').disabled=!el('confirm').checked;};
   for(const name of ['value','strength'])el(name).addEventListener('input',()=>{el('confirm').checked=false;el('apply').disabled=true;clearMed();});
   el('apply').onclick=()=>{try{if(!el('confirm').checked)return;const selection=ref.selection(d.id,species.value,p.id,el('value').value,el('strength').value);clearMed();applied=selection;med.elements.dose.value=selection.dose;med.elements.doseBasis.value=selection.basis;med.elements.form.value=selection.form;med.elements.concentration.value=selection.strength;med.elements.courseMode.value=p.single?'total':'days';if(p.single)med.elements.totalDoses.value='1';else med.elements.times.value=p.times;options.layout();el('status').className='pt-notice';el('status').textContent='용법을 적용했습니다. 체중과 '+(p.single?'1회 투여량':'처방 일수')+'을 확인한 뒤 계산해주세요.';}catch(e){el('status').className='pt-error';el('status').textContent=e.message;}};
  }
  function fluidDetails(){clearFluid();const d=ref.fluids.find(x=>x.id===fe('ref-fluid').value),purpose=fe('fluid-purpose').value,host=fe('fluid-reference');fe('fluid-description').textContent=d?.note||'';
   if(!purpose){host.innerHTML='<p class="pt-help">제품과 환자 상태를 확인해 아래 계산기에 처방 속도를 직접 입력합니다.</p>';return;}
   if(!species.value||!d){host.innerHTML='<p>계산 대상 동물과 수액 종류를 먼저 선택해주세요.</p>';return;}
   if(purpose==='anesthesia'&&!d.balanced){host.innerHTML='<p class="pt-error">이 마취 기준은 균형 등장성 결정질액에 해당합니다. 선택한 수액에는 적용할 수 없습니다.</p>';return;}
   if(purpose==='maintenance'&&['d5w','half-saline'].includes(d.id)){host.innerHTML='<p class="pt-error">이 수액의 투여량은 전해질·자유수 요구에 따라 별도로 처방해주세요. 유지 요구량을 그대로 적용하지 않습니다.</p>';return;}
   const cat=species.value==='cat',s=ref.sources[purpose==='anesthesia'?'anesthesia':'fluid'];
   host.innerHTML=`<p class="pt-notice">${purpose==='anesthesia'?(cat?'고양이 3~5':'개 5')+' mL/kg/hr · 심장·신장기능이 정상인 환자의 마취 시작 기준입니다.':'성체 유지 수분 요구량 '+(cat?'40':'60')+' mL/kg/day. 경구 수분·유동식·약물 주입량 등을 뺀 값입니다. 탈수 결손·지속 손실은 포함하지 않습니다. 대체 수액의 장기 유지 사용 시 전해질 조정을 확인하세요.'} 심장·신장질환, 소아, 쇼크 환자는 개별 계획과 모니터링이 필요합니다.</p><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a>${purpose==='anesthesia'?`<label>수의사가 정한 시작 속도 · mL/kg/hr<input data-fluid-rate inputmode="decimal" value="${cat?'':'5'}"></label>`:'<label>다른 경로로 공급할 수분 · mL/day<input data-fluid-other inputmode="decimal" placeholder="없으면 0을 입력"></label>'}<label class="pt-choice"><input data-fluid-confirm type="checkbox">종·수액·적용 조건·현재 체중과 수분 공급 계획을 확인했습니다.</label><button type="button" data-fluid-apply class="pt-primary" disabled>확인한 수액 기준 적용</button>`;
   fe('fluid-confirm').onchange=()=>fe('fluid-apply').disabled=!fe('fluid-confirm').checked;
   host.querySelector('[inputmode]').oninput=()=>{fe('fluid-confirm').checked=false;fe('fluid-apply').disabled=true;clearFluid();};
   fe('fluid-apply').onclick=()=>{const out=fe('fluid-status');try{if(!fe('fluid-confirm').checked)return;const w=Number(fluid.elements.weight.value);if(!Number.isFinite(w)||w<=0||w>200)throw Error('상단 계산 대상에 현재 체중을 먼저 입력해주세요.');let rate;if(purpose==='anesthesia'){const raw=fe('fluid-rate').value;rate=Number(raw);if(!raw.trim()||!Number.isFinite(rate)||rate<(cat?3:5)||rate>5)throw Error('선택한 종의 참고 범위에서 속도를 입력해주세요.');fluid.elements.mode.value='weight';fluid.elements.rate.value=rate;}else{const raw=fe('fluid-other').value,other=Number(raw);if(!/^(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())||!Number.isFinite(other)||other<0)throw Error('다른 경로의 수분 공급량을 0 이상의 숫자로 입력해주세요.');rate=(w*(cat?40:60)-other)/24;if(rate<=0)throw Error('다른 경로의 공급량이 유지 요구량 이상입니다. 추가 주입 필요 여부를 평가해주세요.');fluid.elements.mode.value='rate';fluid.elements.rate.value=g.PracticeCalculators.format(rate);fluid.elements.hours.value='24';}
    options.layout();options.clear();fluidApplied={name:d.name,species:species.value,purpose,weight:String(w),rate:fluid.elements.rate.value,mode:fluid.elements.mode.value,source:s};out.className='pt-notice';out.textContent='기준을 적용했습니다. 주입량과 모니터링 계획을 확인한 뒤 계산해주세요.';
   }catch(e){out.className='pt-error';out.textContent=e.message;}};
  }
  species.onchange=()=>{details();fluidDetails();};el('category').onchange=()=>{clearMed();list();};el('search').oninput=()=>{clearMed();list();};el('drug').onchange=details;el('manual').onclick=()=>{clearMed();el('drug').value='';el('detail').replaceChildren();med.elements.times.value='1';med.elements.days.value='1';el('status').textContent='직접 입력 모드입니다. 수의사가 정한 제품·용량을 입력해주세요.';};
  fe('ref-fluid').onchange=fluidDetails;fe('fluid-purpose').onchange=fluidDetails;list();
  return {
   patient(p){species.value=ref.species(p?.species);species.disabled=!!species.value;b.querySelector('[data-ref-patient]').textContent=p?(species.value?'연결 환자의 종을 반영했습니다.':'연결 환자의 종을 직접 확인해 선택해주세요.'):'환자 미연결 · 계산할 동물을 선택해주세요.';details();fluidDetails();},
   resetPreset(){clearMed();el('drug').value='';el('detail').replaceChildren();fe('ref-fluid').value='';fe('fluid-purpose').value='';fluidDetails();},
   reportSource(f){if(f===med&&applied){const d=ref.drugs.find(x=>x.id===applied.id);return '\n'+d.warning+'\n출처 '+ref.sources[d.source].url+'\n출처 확인 '+ref.checked;}if(f===fluid&&fluidApplied)return '\n출처 '+fluidApplied.source.url+'\n출처 확인 '+ref.checked;return '';},
   context(f,v){
    if(f===med&&el('drug').value&&!applied)throw Error('선택한 약물의 용법을 확인하고 계산기에 적용해주세요.');
    if(f===med&&applied){const {drug:d,profile:p}=ref.validate(applied,v),s=ref.sources[d.source];return `${species.value==='dog'?'개':'고양이'} · ${d.name} · ${d.product}\n${p.label} · ${p.route} · ${p.single?'단회':24/p.times+'시간 간격'}\n참고: ${s.title}\n`;}
    if(f===fluid){const d=ref.fluids.find(x=>x.id===fe('ref-fluid').value);if(fe('fluid-purpose').value&&!fluidApplied)throw Error('수액 기준을 확인해 적용하거나 직접 정한 속도로 전환해주세요.');if(fluidApplied){if(v.mode!==fluidApplied.mode||v.rate!==fluidApplied.rate||String(Number(v.weight))!==fluidApplied.weight)throw Error('수액 기준 적용 후 체중·속도가 변경되었습니다. 기준을 다시 적용하거나 직접 입력으로 전환해주세요.');return `${fluidApplied.species==='dog'?'개':'고양이'} · ${fluidApplied.name}\n${fluidApplied.purpose==='anesthesia'?'정상 심장·신장기능의 마취 시작 기준':'성체 유지 요구량에서 다른 경로 공급량 차감'}\n참고: ${fluidApplied.source.title}\n`;}return d?`${species.value==='dog'?'개':species.value==='cat'?'고양이':'종 미선택'} · ${d.name} · 수의사 직접 입력\n${d.note}\n`:'';}
    return '';
   }
  };
 }
 g.PracticeReferenceUI={mount};
})(window);
