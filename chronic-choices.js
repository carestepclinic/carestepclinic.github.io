/* Optional structured entry over the existing human-readable record fields.
 * Unknown/legacy lines are retained verbatim. No prior result or normal is inferred.
 */
(function(g){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,label=v)=>'<option value="'+esc(v)+'">'+esc(label)+'</option>';
const field=(label,values,multi=false)=>({label,values,multi});
const testStatus=['미실시','시행 예정','결과 대기','결과 확인','평가 불가'];
const noteSpecs={
 imaging:[field('영상검사 상태',testStatus)],
 fecalTesting:[field('분변검사 상태',testStatus)],
 histopathology:[field('조직검사 상태',testStatus)],
 urinalysis:[field('요침사 소견',['적혈구','백혈구','세균','결정','원주','특이 소견 없음','평가 불가'],true)],
 ecg:[field('심전도 소견',['동성리듬','빈맥','서맥','조기수축','심방세동','전도 이상','기타','평가 불가'],true)],
 urineCulture:[field('요배양 결과',['미검사','결과 대기','균 성장 없음','균 성장 있음','판정 불가'])],
 stoolDiet:[field('대변 형태',['정상변','연변','수양성 변','배변 없음','평가 불가']),field('대변 동반 소견',['혈변','흑색변','점액'],true)],
 adverseEffects:[field('부작용 평가',['없음','있음','평가 불가']),field('부작용 의심 증상',['구토','설사','식욕 저하','활력 저하','다음·다뇨','감염 의심','기타'],true)]
};
// IRIS CKD (iris-kidney.com/iris-staging-system); ACVIM MMVD 2019
// (PMC6524084) and feline cardiomyopathy 2020 (PMC7255676).
// Other diseases use visit-course labels, not invented stages.
const course=['평가 중','치료 중','안정','악화 의심','관해','재발 의심'];
const diseaseLabels={ckd:'CKD',cardiac:'심장질환',diabetes:'당뇨병',cushing:'쿠싱증후군',addison:'애디슨증후군',hypothyroid:'갑상선기능저하증',hyperthyroid:'갑상선기능항진증',imha:'IMHA',ple:'PLE',other:'기타'};
function stages(conditions,species){return conditions.flatMap(c=>c==='ckd'?[field('CKD 병기',['미확정','IRIS 1기','IRIS 2기','IRIS 3기','IRIS 4기'])]:c==='cardiac'?[field('심장질환 분류',species==='dog'?['미확정','MMVD A','MMVD B1','MMVD B2','MMVD C','MMVD D','기타 · 메모 참조']:['미확정','심근병증 A','심근병증 B1','심근병증 B2','심근병증 C','심근병증 D','기타 · 메모 참조'])]:[field((diseaseLabels[c]||c)+' 경과',course)]);}
function parse(value,specs){
 const values={},rest=[];
 for(const line of String(value||'').split('\n')){const s=specs.find(s=>line.startsWith(s.label+': '));const v=s?line.slice(s.label.length+2):'';
  if(s&&!Object.hasOwn(values,s.label)&&v&&v.split(s.multi?' · ':'\0').every(x=>s.values.includes(x)))values[s.label]=s.multi?v.split(' · '):v;else rest.push(line);
 }
 return {values,memo:rest.join('\n')};
}
function serialize(values,memo,specs){return [...specs.map(s=>{const v=values[s.label];return v?.length?s.label+': '+(Array.isArray(v)?v.join(' · '):v):'';}).filter(Boolean),memo].filter(Boolean).join('\n');}
function write(input,value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
function structured(input,specs,o,memoLabel){
 if(input.dataset.choicesBound)return;input.dataset.choicesBound='1';
 const parent=input.closest('label'),host=document.createElement('div');host.className='chr-choice-panel';host.dataset.choiceFor=input.dataset.field;parent.before(host);parent.hidden=true;
 const limit=input.dataset.field==='stage'?300:2000;let updating=false;
 host.innerHTML='<div class="chr-choice-grid">'+specs.map((s,i)=>s.multi?'<fieldset><legend>'+esc(s.label)+'</legend><div class="chr-choice-checks">'+s.values.map(v=>'<label><input type="checkbox" data-chronic-choice data-choice-index="'+i+'" value="'+esc(v)+'">'+esc(v)+'</label>').join('')+'</div></fieldset>':'<label>'+esc(s.label)+'<select data-chronic-choice data-choice-index="'+i+'">'+option('','미평가 / 선택')+s.values.map(v=>option(v)).join('')+'</select></label>').join('')+'</div><label>'+esc(memoLabel)+'<textarea rows="2" data-chronic-choice data-choice-memo maxlength="'+limit+'"></textarea></label><small data-choice-error role="status"></small>';
 const memo=host.querySelector('[data-choice-memo]'),error=host.querySelector('[data-choice-error]');
 function fill(){const p=parse(input.value,specs);host.querySelectorAll('[data-choice-index]').forEach(el=>{const v=p.values[specs[+el.dataset.choiceIndex].label];if(el.type==='checkbox')el.checked=Array.isArray(v)&&v.includes(el.value);else el.value=v||'';});memo.value=p.memo;}
 function commit(){if(!o.allowed())return;const values={};specs.forEach((s,i)=>{const es=[...host.querySelectorAll('[data-choice-index="'+i+'"]')];values[s.label]=s.multi?es.filter(e=>e.checked).map(e=>e.value):es[0].value;});
  // Negative sediment findings cannot coexist with positive selections.
  if(specs[0]?.label==='요침사 소견'){const selected=values['요침사 소견'];if(selected.includes('특이 소견 없음')||selected.includes('평가 불가')){const last=host._lastChanged;values['요침사 소견']=last?.checked&&['특이 소견 없음','평가 불가'].includes(last.value)?[last.value]:selected.filter(v=>!['특이 소견 없음','평가 불가'].includes(v));host.querySelectorAll('[type=checkbox]').forEach(e=>e.checked=values['요침사 소견'].includes(e.value));}}
  // Selecting no adverse effects must not retain earlier positive selections.
  if(specs[0]?.label==='부작용 평가'&&values['부작용 평가']!=='있음'){values['부작용 의심 증상']=[];host.querySelectorAll('[type=checkbox]').forEach(e=>e.checked=false);}
  const value=serialize(values,memo.value,specs);if(value.length>limit){error.textContent='선택값과 메모를 합쳐 '+limit+'자 이내로 입력해주세요. 이번 변경은 반영되지 않았습니다.';fill();return;}
  error.textContent='';updating=true;write(input,value);updating=false;sync();
 }
 function sync(){const adverse=host.querySelector('select')?.value;host.querySelectorAll('[type=checkbox]').forEach(e=>{e.dataset.choiceUnavailable=String(specs[0]?.label==='부작용 평가'&&adverse!=='있음');e.disabled=!o.allowed()||e.dataset.choiceUnavailable==='true';});}
 host.querySelectorAll('select,input').forEach(el=>el.onchange=()=>{host._lastChanged=el;commit();});memo.oninput=commit;
 input.addEventListener('input',()=>{if(!updating){fill();sync();}});fill();sync();return host;
}
function setup(container,o){
 container.querySelectorAll('[data-field]').forEach(input=>{
  const key=input.dataset.field;
  if(key.startsWith('examNotes.')&&noteSpecs[key.slice(10)])structured(input,noteSpecs[key.slice(10)],o,({urineCulture:'균명·감수성·메모',stoolDiet:'횟수·식이·반응 메모',adverseEffects:'상세 증상·감염 모니터링',imaging:'검사 종류·부위·주요 소견',fecalTesting:'검사 종류·검출 결과·메모',histopathology:'검체 부위·진단·상세 결과',urinalysis:'세포 수·단위·결정 종류·상세 소견',ecg:'리듬·심박수·상세 소견'})[key.slice(10)]||'상세 메모');
  if(key==='stage'){const host=structured(input,stages(o.conditions(),o.species()),o,'분류 근거·기타 메모');if(host){const note=document.createElement('small');note.textContent='병기는 수의사 평가 후 선택합니다. 심장 분류는 개 MMVD·고양이 심근병증에 적용하며, 다른 심장질환은 메모에 기록합니다. 경과는 정식 병기가 아닙니다.';host.append(note);}}
  if(/^testContexts\.[^.]+\.medication$/.test(key)&&!input.dataset.choicesBound){input.dataset.choicesBound='1';medication(input,o);}
  if(key==='diet'&&!input.dataset.choicesBound){input.dataset.choicesBound='1';food(input,o);}
 });
}
function medication(input,o){
 const host=document.createElement('div');host.className='chr-choice-panel';input.closest('label').before(host);
 host.innerHTML='<label>현재 약물·병원 약품에서 선택<select data-chronic-choice data-medication-choice>'+option('','선택 / 아래 직접 입력')+'</select></label><small data-choice-status role="status"></small>';
 const select=host.querySelector('select'),status=host.querySelector('small');let loaded=false,loading=false;
 function menu(items=[]){const selected=select.value,values=[...new Set([...String(o.medications()||'').split(/[\n;]/).map(s=>s.trim()).filter(Boolean),...items.map(x=>x.body?.title).filter(Boolean)])];select.innerHTML=option('','선택 / 아래 직접 입력')+values.filter(x=>x.length<=200).map(v=>option(v)).join('');select.value=selected;}
 menu();select.onchange=()=>{if(o.allowed()&&select.value)write(input,select.value);};
 select.onfocus=async()=>{if(loading)return;menu(o.drugsCached()||[]);if(loaded)return;loading=true;status.textContent='병원 약품 조회 중…';try{const items=await o.drugs();if(!host.isConnected||!o.alive())return;loaded=true;menu(items);status.textContent='';}catch{if(host.isConnected)status.textContent='병원 목록 조회 실패 · 직접 입력하거나 다시 선택해주세요.';}finally{loading=false;}};
 input.maxLength=200;
}
let foodRequest;
function foods(){if(!foodRequest)foodRequest=fetch('practice-food-catalog.json?v=20261031-prunus').then(r=>{if(!r.ok)throw Error('목록 오류');return r.json();}).then(d=>{if(!Array.isArray(d.items))throw Error('목록 오류');return d.items;}).catch(e=>{foodRequest=null;throw e;});return foodRequest;}
const brands={royalcanin:'로얄캐닌',hills:'힐스',naturalbalance:'내츄럴발란스',purina:'퓨리나',prunus:'프루너스'};
function food(input,o){
 const host=document.createElement('details');host.className='chr-food-choice';input.closest('label').before(host);
 host.innerHTML='<summary>사료 선택·급여 계획 추가</summary><div class="chr-choice-grid"><label>사료 검색<input data-chronic-choice data-food-query placeholder="제품명·브랜드"></label><label>급여 제품<select data-chronic-choice data-food-choice>'+option('','직접 입력')+'</select></label><label>직접 입력·선택 제품<input data-chronic-choice data-food-name maxlength="160"></label><label>1회 급여량<input data-chronic-choice data-food-amount type="number" min="0" step="any" inputmode="decimal"></label><label>단위<select data-chronic-choice data-food-unit>'+['g','mL','캔','포'].map(v=>option(v)).join('')+'</select></label><label>급여 횟수<select data-chronic-choice data-food-frequency>'+option('','선택')+['하루 1회','하루 2회','하루 3회','하루 4회','자율 급여','직접 계획 입력'].map(v=>option(v)).join('')+'</select></label></div><button type="button" data-chronic-choice data-food-add>급여 계획에 추가</button><small data-food-status role="status"></small>';
 const el=k=>host.querySelector('[data-food-'+k+']');let items=[],loading=false,loaded=false;
 function menu(){const q=el('query').value.trim().toLowerCase();el('choice').innerHTML=option('','직접 입력')+items.filter(p=>(p.species||[]).includes(o.species())&&(p.purpose||'food')!=='reference'&&[p.name,brands[p.brand],...(p.aliases||[])].join(' ').toLowerCase().includes(q)).map(p=>option(p.id,(brands[p.brand]||'')+' '+p.name)).join('');}
 async function load(){if(!host.open||loaded||loading)return;loading=true;el('status').textContent='사료 목록 조회 중…';try{const rows=await foods();if(!host.isConnected||!o.alive())return;items=rows;loaded=true;menu();el('status').textContent='';}catch{if(host.isConnected)el('status').textContent='목록 조회 실패 · 직접 입력 가능 · 다시 펼치면 재시도';}finally{loading=false;}}
 host.ontoggle=load;el('query').oninput=menu;el('choice').onchange=()=>{const p=items.find(p=>p.id===el('choice').value);if(p)el('name').value=(brands[p.brand]||'')+' '+p.name;};
 el('add').onclick=()=>{if(!o.allowed())return;const name=el('name').value.trim(),amount=el('amount').value,freq=el('frequency').value;if(!name||!freq||(freq!=='자율 급여'&&freq!=='직접 계획 입력'&&!(Number(amount)>0))||(amount&&!(Number(amount)>0))){el('status').textContent='제품명·급여량·횟수를 확인해주세요.';return;}const line=[name,amount?Number(amount)+' '+el('unit').value+'/회':'',freq].filter(Boolean).join(' · ');if(input.value.split('\n').includes(line)){el('status').textContent='이미 같은 급여 계획이 있습니다.';return;}const next=[input.value,line].filter(Boolean).join('\n');if(next.length>6000){el('status').textContent='급여 계획은 6000자 이내로 입력해주세요.';return;}write(input,next);el('status').textContent='급여 계획에 추가했습니다.';};
}
g.ChronicChoices={setup,parse,serialize,stages};
})(typeof window==='undefined'?globalThis:window);
