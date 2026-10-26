/* Hospital product/equipment facts only. No patient, dose, target or infusion rate persistence. */
(function(g){
 'use strict';
 const prefix='CARESTEP_SETUP_V1:';
 const specs={potassium:{title:'칼륨 제품·수액',keys:['bag','kstock','baseK','mixMode'],required:['bag','kstock','baseK','mixMode']},transfusion:{title:'수혈 세트',keys:['factor'],required:['factor']},bicarbonate:{title:'중탄산 제품',keys:['stock'],required:['stock']},cri:{title:'CRI 제품·조제',keys:['stock','stockUnit','volume','diluent','pumpMin'],required:['stock','stockUnit']}};
 function isSaved(p){return String(p?.body?.note||'').startsWith(prefix);}
 function partition(r){return {...r,setupItems:r.setupItems||r.items?.filter(isSaved)||[],items:(r.items||[]).filter(p=>!isSaved(p))};}
 function checked(kind,key,values){
  const spec=specs[kind];if(!spec||!key||key.length>100)throw Error('저장할 계산 종류를 확인해주세요.');
  if(kind==='cri'&&!/^cri:[a-z0-9-]+:(prepare|pump|undiluted|intermittent)$/.test(key)||kind!=='cri'&&key!==kind)throw Error('약물·투여 방식을 확인해주세요.');
  const out={};for(const name of spec.keys){const value=String(values[name]??'').trim();if(!value){if(spec.required.includes(name))throw Error('저장할 제품·장비 설정을 먼저 입력해주세요.');continue;}
   if(name==='stockUnit'){if(!['mg','mcg','U'].includes(value))throw Error('원액 단위를 확인해주세요.');}
   else if(name==='mixMode'){if(!['add','final'].includes(value))throw Error('첨가 방식을 확인해주세요.');}
   else if(name==='diluent'){if(value.length>60)throw Error('희석액 이름은 60자 이내로 입력해주세요.');}
   else if(!/^(?:\d+\.?\d*|\.\d+)$/.test(value)||!Number.isFinite(+value)||+value>1e6||(name==='baseK'?+value<0:+value<=0))throw Error('제품·장비의 수치와 단위를 확인해주세요.');
   if(kind==='bicarbonate'&&name==='stock'&&!['1','0.5'].includes(value))throw Error('중탄산 제품 표시 농도를 확인해주세요.');
   if(kind==='transfusion'&&+value>200)throw Error('세트 점적계수를 확인해주세요.');out[name]=value;
  }
  return out;
 }
 function fact(p){if(!isSaved(p)||p.body.kind!=='liquid'||p.body.unit!=='mg'||Number(p.body.value)!==1)return null;try{const m=JSON.parse(p.body.note.slice(prefix.length));if(m.v!==1)return null;return {...m,values:checked(m.kind,m.key,m.values)};}catch{return null;}}
 function body(kind,key,values){const m={v:1,kind,key,values:checked(kind,key,values)},note=prefix+JSON.stringify(m);if(note.length>500)throw Error('저장 설정이 너무 깁니다. 희석액 이름을 줄여주세요.');return {title:specs[kind].title+' · 병원 기본 설정',kind:'liquid',unit:'mg',value:1,note,confirm:true};}
 function find(rows,key){const matches=rows.filter(p=>{try{return JSON.parse(p.body.note.slice(prefix.length)).key===key;}catch{return false;}});if(matches.length>1)throw Error('같은 기본 설정이 여러 개입니다. 관리자 확인이 필요합니다.');if(matches.length&&!fact(matches[0]))throw Error('저장된 설정 형식을 확인해주세요.');return matches[0]||null;}
 function mount(b,o){
  let rows=[],ready=false,canManage=false,failed=false,busy=false,internal=false,epoch=0;const states=[];
  const banner=document.createElement('section');banner.className='pt-settings-status';banner.setAttribute('role','status');banner.innerHTML='<span data-settings-message>병원 설정을 불러오는 중…</span><button type="button" data-settings-retry hidden>다시 불러오기</button>';b.querySelector('.pt-calc-common').append(banner);
  const message=banner.querySelector('span'),retry=banner.querySelector('button');retry.onclick=async()=>{retry.disabled=true;message.textContent='병원 설정을 다시 불러오는 중…';try{const r=await o.fresh();if(o.guard())o.changed(r);}catch{failure();}finally{retry.disabled=false;}};
  function key(s){return s.kind==='cri'?(s.f.criReferenceContext?.id?'cri:'+s.f.criReferenceContext.id+':'+s.f.elements.mode.value:''):s.kind;}
  function values(s){return Object.fromEntries(specs[s.kind].keys.map(n=>[n,s.f.elements[n]?.value||'']));}
  function status(s,text){s.state.textContent=text;s.save.disabled=busy||!ready||failed||!canManage||!key(s);s.reload.disabled=busy||!ready||failed||!key(s);const labels={bag:'수액량 · mL',kstock:'KCl 원액 · mEq/mL',baseK:'기본 수액 K · mEq/L',mixMode:'첨가 방식',factor:'점적계수 · 방울/mL',stock:s.kind==='bicarbonate'?'원액 · mEq/mL':'원액 농도',stockUnit:'농도 단위 /mL',volume:'최종 부피 · mL',diluent:'확인한 희석액',pumpMin:'펌프 최소 속도 · mL/hr'};s.preview.replaceChildren();for(const [k,v] of Object.entries(values(s))){const row=document.createElement('div');row.textContent=labels[k]+': '+(k==='mixMode'?v==='final'?'최종 부피 유지':'기존 수액에 첨가':v||'미설정');s.preview.append(row);}}
  function clear(s){s.f.elements.confirmed&&(s.f.elements.confirmed.checked=false);o.clear();}
  function apply(s,p){const m=fact(p);if(!m||m.key!==key(s))return;internal=true;try{
   for(const n of ['stockUnit','mixMode'])if(m.values[n]!==undefined){const x=s.f.elements[n];x.value=m.values[n];x.dispatchEvent(new Event('change',{bubbles:true}));}
   for(const [n,v] of Object.entries(m.values)){const x=s.f.elements[n];if(x.tagName==='SELECT'&&![...x.options].some(z=>z.value===v))x.add(new Option(v+' 방울/mL',v));x.value=v;}
   for(const n of Object.keys(m.values))s.f.elements[n].dispatchEvent(new Event('input',{bubbles:true}));
   if(s.kind==='potassium')s.f.querySelector('[data-k-fluid]').value='';
   if(s.kind==='cri'){const sel=s.f.querySelector('[data-cri-stock]');if(sel)sel.value='manual';const note=s.f.querySelector('[data-cri-stock-note]');if(note)note.textContent='병원 저장값 · 이 약물·주입 방식에 적용';const bag=s.f.querySelector('[data-cri-bag]');if(bag)bag.value=[...bag.options].some(x=>x.value===s.f.elements.volume.value)?s.f.elements.volume.value:'custom';}
   s.record=p;s.touched=false;clear(s);status(s,'병원 저장값 · '+(p.approver_name||'병원 의료진')+' · '+(p.updated_at||'저장 완료')+' · 개·고양이 공통');
  }finally{internal=false;}}
  function refresh(s){s.box.hidden=s.kind==='cri'&&!key(s);if(!ready){status(s,failed?'불러오기 실패 · 입력값 유지 · 상단에서 다시 불러오기':'병원 설정을 불러오는 중…');return;}if(s.touched){status(s,'직접 수정값 · 이번 계산만 변경 · 병원 기본값은 유지됩니다.');return;}try{const p=find(rows,key(s));if(p){if(s.record?.id===p.id&&s.record?.revision===p.revision&&Object.entries(fact(p).values).every(([n,v])=>s.f.elements[n]?.value===v))status(s,'병원 저장값 · '+(p.approver_name||'병원 의료진')+' · '+(p.updated_at||'저장 완료')+' · 개·고양이 공통');else apply(s,p);}else{s.record=null;status(s,'저장값 없음 · 현재 표시값을 확인 후 저장할 수 있습니다.');}}catch(e){status(s,e.message);s.save.disabled=true;}if(!canManage)s.state.textContent+=' · 저장은 원장·관리자·수의사 권한이 필요합니다.';}
  async function reload(s){const start=epoch;status(s,'최신 병원 설정 확인 중…');try{const r=await o.fresh();if(!o.guard()||start!==epoch)return;rows=partition(r).setupItems;ready=true;failed=false;canManage=!!r.canManage;s.touched=false;refresh(s);o.changed(r);}catch(e){status(s,e.message);}}
  async function save(s){if(!o.guard()||busy||!canManage||failed)return;if(!s.check.checked){status(s,'저장할 제품·장비 설정을 확인해주세요.');return;}let payload;const savedKey=key(s),before=JSON.stringify(values(s)),start=epoch,old=s.record;try{payload=body(s.kind,savedKey,values(s));}catch(e){status(s,e.message);return;}busy=true;for(const x of states)status(x,x.state.textContent);status(s,'병원 기본값 저장 중…');let sent=false;
   try{const fresh=await o.fresh();if(!o.guard()||start!==epoch||savedKey!==key(s)||before!==JSON.stringify(values(s)))throw Error('입력이 변경되어 저장하지 않았습니다.');if(!fresh.canManage)throw Error('병원 설정 저장 권한이 없습니다.');const latest=find(partition(fresh).setupItems,savedKey);if((latest?.id||'')!==(old?.id||'')||(latest?.revision||0)!==(old?.revision||0))throw Error('다른 화면에서 설정이 변경됐습니다. 저장값 불러오기 후 확인하세요.');sent=true;await o.request('/practice/presets'+(old?'/'+encodeURIComponent(old.id):''),{method:old?'PUT':'POST',body:JSON.stringify({...payload,...(old?{revision:old.revision}:{})})});const r=await o.fresh();if(!o.guard())return;const p=find(partition(r).setupItems,savedKey);if(!p||p.body.note!==payload.note)throw Error('저장 결과를 확인하지 못했습니다.');const changed=start!==epoch||before!==JSON.stringify(values(s));s.record=p;rows=partition(r).setupItems;if(!changed)apply(s,p);else{s.touched=true;status(s,'요청한 설정은 저장됨 · 이후 변경한 입력은 아직 저장되지 않았습니다.');}o.changed(r);s.check.checked=false;
   }catch(e){if(o.guard())status(s,(sent?'저장 상태 확인 필요 · 저장값 불러오기로 확인해주세요. ':'')+e.message);}finally{busy=false;if(o.guard())for(const x of states){x.save.disabled=!ready||failed||!canManage||!key(x);x.reload.disabled=!ready||failed||!key(x);}}
  }
  for(const [kind,spec] of Object.entries(specs)){const f=b.querySelector('[data-calc='+kind+']');if(!f)continue;const box=document.createElement('details');box.className='pt-hospital-setup';box.dataset.hospitalSetup=kind;box.innerHTML='<summary>'+spec.title+' · 병원 기본값 관리</summary><p class="pt-help">현재 입력 수정은 이번 계산에만 적용됩니다. 저장하면 다음 접속·다른 기기에 적용됩니다. 환자·체중·처방량·보정 목표·주입속도는 저장하지 않습니다.</p><div data-setup-values class="pt-help"></div><label class="pt-choice"><input type="checkbox" data-setup-confirm>제품·투여 방식·장비와 조제 조건을 확인했습니다.</label><div class="pt-bar"><button type="button" data-setup-save disabled>병원 기본값 저장</button><button type="button" data-setup-reload disabled>저장값 불러오기</button></div><p class="pt-help" data-setup-state role="status"></p>';
   f.querySelector('h3').after(box);const s={kind,f,box,save:box.querySelector('[data-setup-save]'),reload:box.querySelector('[data-setup-reload]'),check:box.querySelector('input'),state:box.querySelector('[data-setup-state]'),preview:box.querySelector('[data-setup-values]'),record:null,touched:false};states.push(s);s.save.onclick=()=>save(s);s.reload.onclick=()=>reload(s);
   for(const event of ['input','change'])f.addEventListener(event,e=>{if(internal||box.contains(e.target))return;epoch++;if(spec.keys.includes(e.target.name)){s.touched=true;s.check.checked=false;status(s,'직접 수정값 · 이번 계산만 변경 · 병원 기본값은 유지됩니다.');}});
   const original=f.onsubmit;f.onsubmit=async e=>{e.preventDefault();if(!o.guard())return;const p=s.record,signature=JSON.stringify(values(s)),start=epoch;if(p&&!s.touched){try{const r=await o.fresh();if(!o.guard()||start!==epoch||signature!==JSON.stringify(values(s)))return;const latest=find(partition(r).setupItems,key(s));if(!latest||latest.revision!==p.revision||latest.body.note!==p.body.note)throw Error('병원 기본값이 변경·보관됐습니다. 저장값 불러오기 후 확인하세요.');}catch(err){clear(s);const out=f.querySelector('output');out.className='pt-error';out.textContent=err.message;return;}}return original?.call(f,e);};
   f.addEventListener('reset',()=>queueMicrotask(()=>{s.touched=false;s.record=null;refresh(s);}));refresh(s);
  }
  function criContextChanged(){epoch++;queueMicrotask(()=>{const s=states.find(x=>x.kind==='cri');if(s){s.touched=false;s.record=null;refresh(s);}});}
  b.addEventListener('practice-cri-selected',criContextChanged);
  const cri=states.find(x=>x.kind==='cri');if(cri){cri.f.addEventListener('change',e=>{if(!internal&&e.target.name==='mode')criContextChanged();});cri.f.addEventListener('input',e=>{if(!internal&&e.target.name==='drug')criContextChanged();});}
  b.querySelector('[data-ref-species]').addEventListener('change',criContextChanged);
  b.querySelector('[data-ref-species]').addEventListener('change',()=>{epoch++;for(const s of states){s.check.checked=false;}});
  b.querySelector('[data-common-weight]').addEventListener('input',()=>epoch++);
  function loaded(r){if(!o.guard())return;rows=partition(r).setupItems;ready=true;failed=false;canManage=!!r.canManage;message.textContent='제품·장비 기본값 연결됨';retry.hidden=true;for(const s of states)refresh(s);}
  function failure(){if(!o.guard())return;failed=true;ready=false;canManage=false;message.textContent='병원 설정 불러오기 실패 · 현재 입력은 유지됩니다.';retry.hidden=false;for(const s of states){s.save.disabled=true;s.reload.disabled=true;status(s,'불러오기 실패 · 저장 권한과 저장값을 아직 확인하지 못했습니다.');}}
  return {loaded,failed:failure};
 }
 const api={isSaved,partition,fact,body,find,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeCalculatorSettings=api;
})(typeof window==='undefined'?globalThis:window);
