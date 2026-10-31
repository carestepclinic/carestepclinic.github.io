(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=at=>new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 const recent=(body,type)=>(body.wardFeeding||[]).filter(x=>x.type===type).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
 let catalogPending; const drafts=new Map();
 function hasDraft(){return drafts.size>0;} function clear(){drafts.clear();}
 function catalog(){if(!catalogPending)catalogPending=fetch('practice-food-catalog.json?v=20261031-food2').then(r=>{if(!r.ok)throw Error('목록 조회 실패');return r.json();}).then(d=>{if(!Array.isArray(d.items))throw Error('목록 확인 필요');return d.items;}).catch(e=>{catalogPending=null;throw e;});return catalogPending;}
 function feedingForm(type,o){
  const last=recent(o.body,type),food=type==='food',label=food?'식이':'음수';
  return '<section class="cl-card wf-feeding"><h4>'+label+'</h4>'+(o.canRecord?'<form data-wf-form="'+type+'">'+(food?'<label>사료·급여 제품<input name="productName" required maxlength="180" autocomplete="off" list="wf-food-products" value="'+esc(last?.productName||'')+'" placeholder="제품 검색 또는 직접 입력"></label><datalist id="wf-food-products"></datalist><p class="wf-help" data-wf-catalog role="status"></p>':'')+'<div class="wf-amount"><label>'+label+' 제공량<input name="provided" type="number" min="0.001" max="100000" step="any" required inputmode="decimal"></label><label>단위<select name="unit">'+(food?'<option value="g">g</option>':'')+'<option value="mL" '+(last?.unit==='mL'?'selected':'')+'>mL</option></select></label></div><details class="wf-optional"><summary>실제 섭취량·시각·기록자</summary><label>실제 섭취량 · 모르면 비워두기<input name="consumed" type="number" min="0" max="100000" step="any" inputmode="decimal"></label><label>급여 시각 · 기본 현재 시각<input name="observedAt" type="datetime-local"></label><label>기록자<select name="recorderId" required>'+o.members.map(m=>'<option value="'+esc(m.id||m.user_id)+'" '+((m.id||m.user_id)===o.performerId?'selected':'')+'>'+esc(m.display_name||m.name)+'</option>').join('')+'</select></label></details><p class="wf-help">제공량은 실제 섭취량으로 합산하지 않습니다.</p><div class="cl-actions"><button type="submit" class="cl-primary">'+label+' 기록</button>'+(last?'<button type="button" data-wf-repeat>이전과 동일하게 급여</button>':'')+'</div><p data-wf-status role="status"></p></form>':'<p>기록 조회만 가능합니다.</p>')+(last?'<p class="wf-last">최근 '+time(last.observedAt)+' · '+esc(last.productName)+' · 제공 '+last.provided+' '+last.unit+(last.consumed!=null?' · 섭취 '+last.consumed+' '+last.unit:'')+'</p>':'')+'</section>';
 }
 function markup(o){
  const entries=[...(o.body.wardFeeding||[])].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)),day=new Date(Date.now()+32400000).toISOString().slice(0,10),today=entries.filter(x=>new Date(Date.parse(x.observedAt)+32400000).toISOString().slice(0,10)===day);
  const rows=items=>items.map(x=>'<li><time>'+time(x.observedAt)+'</time><span><b>'+esc(x.productName)+'</b> · 제공 '+x.provided+' '+x.unit+' · '+(x.consumed==null?'섭취량 미확인':'실제 섭취 '+x.consumed+' '+x.unit)+'</span><small>'+esc(x.recorder?.name||o.memberName(x.by))+'</small></li>').join('');
  return '<div data-wf-host>'+(o.body.wardPlan?.checks?.fasting==='present'?'<p class="cl-alert">금식 설정 있음 · 급여 지시를 확인하세요.</p>':'')+'<div class="wf-feeding-grid">'+feedingForm('food',o)+feedingForm('water',o)+'</div><section class="cl-card wf-today"><h4>오늘 급여 기록</h4>'+(today.length?'<ul>'+rows(today)+'</ul>':'<p>오늘 기록된 급여가 없습니다.</p>')+(entries.length>today.length?'<details><summary>이전 급여 기록</summary><ul>'+rows(entries.filter(x=>!today.includes(x)))+'</ul></details>':'')+'</section></div>';
 }
 function bind(root,o){
  for(const form of root.querySelectorAll('[data-wf-form]')){
   const type=form.dataset.wfForm,last=recent(o.body,type),status=form.querySelector('[data-wf-status]');const draftKey=o.key+':'+type;let saving=false,requestKey=crypto.randomUUID(),items=null,pending=null;const kept=drafts.get(draftKey);if(kept){form.querySelector('details').open=!!kept.consumed||!!kept.observedAt;for(const [k,v] of Object.entries(kept))if(form.elements[k])form.elements[k].value=v;form.dataset.wfDirty='true';status.textContent='입력 중 · 아직 저장되지 않았습니다.';}
 const remember=()=>{drafts.set(draftKey,Object.fromEntries(new FormData(form)));pending=null;form.dataset.wfDirty='true';requestKey=crypto.randomUUID();status.textContent='입력 중 · 아직 저장되지 않았습니다.';};
   form.addEventListener('input',remember);form.addEventListener('change',remember);
   form.querySelector('[data-wf-repeat]')?.addEventListener('click',()=>{if(type==='food')form.elements.productName.value=last.productName;form.elements.provided.value=last.provided;form.elements.unit.value=last.unit;form.elements.consumed.value='';form.elements.observedAt.value='';form.dispatchEvent(new Event('input',{bubbles:true}));form.elements.provided.focus();});
   const product=form.elements.productName;
   if(product){
    const catalogStatus=form.querySelector('[data-wf-catalog]'),list=form.querySelector('datalist');
    const menu=()=>{if(!items)return;const q=product.value.trim().toLowerCase(),rows=items.filter(x=>(x.purpose||'food')==='food'&&x.species?.includes(o.species)&&(!q||[x.name,...(x.aliases||[])].join(' ').toLowerCase().includes(q))).slice(0,25);list.replaceChildren(...rows.map(x=>new Option(x.name,x.name)));catalogStatus.textContent='제품 선택 또는 직접 입력';};
    product.addEventListener('focus',async()=>{if(items)return;catalogStatus.textContent='제품 목록 불러오는 중…';try{items=await catalog();if(form.isConnected)menu();}catch{if(form.isConnected)catalogStatus.textContent='목록을 불러오지 못했습니다. 직접 입력하거나 다시 선택해주세요.';}});
    product.addEventListener('input',menu);product.addEventListener('change',()=>{const selected=items?.find(x=>x.name===product.value&&x.species?.includes(o.species));if(selected)form.elements.unit.value=selected.form==='liquid'?'mL':'g';});
   }
   form.onsubmit=async e=>{
    e.preventDefault();if(saving||!form.reportValidity())return;
    const provided=Number(form.elements.provided.value),consumed=form.elements.consumed.value===''?null:Number(form.elements.consumed.value);
    if(consumed!=null&&consumed>provided){status.textContent='실제 섭취량은 제공량 이내로 입력해주세요.';form.querySelector('details').open=true;form.elements.consumed.focus();return;}
    const data=pending||(pending={type,productName:type==='food'?product.value.trim():'물',provided,consumed,unit:form.elements.unit.value,observedAt:form.elements.observedAt.value?new Date(form.elements.observedAt.value+':00+09:00').toISOString():new Date().toISOString()});
    saving=true;const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(e=>e.disabled=true);status.textContent='저장 중…';
    try{await o.save(data,form.elements.recorderId.value,requestKey);drafts.delete(draftKey);pending=null;requestKey=crypto.randomUUID();delete form.dataset.wfDirty;if(form.isConnected){form.elements.provided.value='';form.elements.consumed.value='';form.elements.observedAt.value='';status.textContent='저장 완료';}try{await o.reload();}catch{if(form.isConnected)status.textContent='저장 완료 · 목록 갱신은 새로고침해주세요.';}}catch(e){if(form.isConnected)status.textContent='저장 확인 실패 · 입력은 유지됩니다. '+e.message;}finally{saving=false;controls.forEach(e=>e.disabled=false);}
   };
  }
 }
 const api={markup,bind,recent,hasDraft,clear};g.WardFluidCare=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
