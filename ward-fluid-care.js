(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=at=>new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 const recent=(body,type)=>(body.wardFeeding||[]).filter(x=>x.type===type).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
 let catalogPending; const drafts=new Map();
 function hasDraft(){return drafts.size>0;} function clear(){drafts.clear();}
 function catalog(){if(!catalogPending)catalogPending=fetch('practice-food-catalog.json?v=20261031-prunus').then(r=>{if(!r.ok)throw Error('목록 조회 실패');return r.json();}).then(d=>{if(!Array.isArray(d.items))throw Error('목록 확인 필요');return d.items;}).catch(e=>{catalogPending=null;throw e;});return catalogPending;}
 function feedingForm(type,o){
  const last=recent(o.body,type),food=type==='food',label=food?'식이':'음수';
  return '<section class="cl-card wf-feeding"><h4>'+label+'</h4>'+(o.canRecord?'<form data-wf-form="'+type+'">'+(food?'<label>사료·급여 제품<input name="productName" required maxlength="180" autocomplete="off" value="'+esc(last?.productName||'')+'" placeholder="제품 검색 또는 직접 입력"></label><button type="button" data-wf-browse aria-expanded="false">사료 목록에서 찾기</button><section class="wf-picker" data-wf-picker hidden aria-label="사료 검색 결과"><div class="wf-filters"><label>브랜드<select data-wf-brand><option value="">전체 브랜드</option></select></label><label>제형<select data-wf-format><option value="">전체 제형</option><option value="dry">건식</option><option value="semimoist">반습식</option><option value="wet">습식</option><option value="liquid">액상</option></select></label></div><div class="wf-results" data-wf-results></div><button type="button" data-wf-more hidden>더 보기</button><button type="button" data-wf-close>목록 닫기 · 직접 입력 유지</button></section><p class="wf-help" data-wf-catalog role="status"></p>':'')+'<div class="wf-amount"><label>'+label+' 제공량<input name="provided" type="number" min="0.001" max="100000" step="any" required inputmode="decimal"></label><label>단위<select name="unit">'+(food?'<option value="g">g</option>':'')+'<option value="mL" '+(last?.unit==='mL'?'selected':'')+'>mL</option></select></label></div><details class="wf-optional"><summary>실제 섭취량·시각·기록자</summary><label>실제 섭취량 · 모르면 비워두기<input name="consumed" type="number" min="0" max="100000" step="any" inputmode="decimal"></label><label>급여 시각 · 기본 현재 시각<input name="observedAt" type="datetime-local"></label><label>기록자<select name="recorderId" required>'+o.members.map(m=>'<option value="'+esc(m.id||m.user_id)+'" '+((m.id||m.user_id)===o.performerId?'selected':'')+'>'+esc(m.display_name||m.name)+'</option>').join('')+'</select></label></details><p class="wf-help">제공량은 실제 섭취량으로 합산하지 않습니다.</p><div class="cl-actions"><button type="submit" class="cl-primary">'+label+' 기록</button>'+(last?'<button type="button" data-wf-repeat>이전과 동일하게 급여</button>':'')+'</div><p data-wf-status role="status"></p></form>':'<p>기록 조회만 가능합니다.</p>')+(last?'<p class="wf-last">최근 '+time(last.observedAt)+' · '+esc(last.productName)+' · 제공 '+last.provided+' '+last.unit+(last.consumed!=null?' · 섭취 '+last.consumed+' '+last.unit:'')+'</p>':'')+'</section>';
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
    const catalogStatus=form.querySelector('[data-wf-catalog]'),panel=form.querySelector('[data-wf-picker]'),list=form.querySelector('[data-wf-results]'),browse=form.querySelector('[data-wf-browse]'),brand=form.querySelector('[data-wf-brand]'),format=form.querySelector('[data-wf-format]'),more=form.querySelector('[data-wf-more]');
    const brands={hills:'힐스',royalcanin:'로얄캐닌',naturalbalance:'내츄럴발란스',purina:'퓨리나',prunus:'프루너스'},forms={dry:'건식',semimoist:'반습식',wet:'습식',liquid:'액상'};
    const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
    let limit=20,loading=false;
    const close=()=>{panel.hidden=true;browse.setAttribute('aria-expanded','false');};
    const eligible=x=>(x.purpose||'food')==='food'&&x.species?.includes(o.species);
    const choose=x=>{product.value=x.name;form.elements.unit.value=x.form==='liquid'?'mL':'g';remember();close();catalogStatus.textContent=(brands[x.brand]||x.brand||'')+' · '+(forms[x.form]||'사료')+' 선택됨';form.elements.provided.focus();};
    const menu=()=>{if(!items)return;const words=product.value.trim().split(/\s+/).map(norm).filter(Boolean),rows=items.filter(x=>eligible(x)&&(!brand.value||x.brand===brand.value)&&(!format.value||x.form===format.value)&&words.every(q=>norm([x.name,x.brand,brands[x.brand],forms[x.form],...(x.aliases||[])].join(' ')).includes(q)));list.innerHTML=rows.slice(0,limit).map((x,i)=>'<button type="button" class="wf-product" data-wf-pick="'+i+'"><strong>'+esc(x.name)+'</strong><small>'+esc([brands[x.brand]||x.brand,forms[x.form],x.energy?.value?x.energy.value+' '+x.energy.unit:''].filter(Boolean).join(' · '))+'</small></button>').join('');list.querySelectorAll('[data-wf-pick]').forEach((el,i)=>el.onclick=()=>choose(rows[i]));more.hidden=rows.length<=limit;catalogStatus.textContent=rows.length?'검색 결과 '+rows.length+'개 · '+Math.min(limit,rows.length)+'개 표시':'검색 결과가 없습니다. 검색어·필터를 바꾸거나 제품명을 직접 입력하세요.';};
    const open=async()=>{panel.hidden=false;browse.setAttribute('aria-expanded','true');if(items){menu();return;}if(loading)return;loading=true;catalogStatus.textContent='제품 목록 불러오는 중…';try{items=await catalog();if(!form.isConnected)return;const keys=[...new Set(items.filter(eligible).map(x=>x.brand).filter(Boolean))];brand.innerHTML='<option value="">전체 브랜드</option>'+keys.map(k=>'<option value="'+esc(k)+'">'+esc(brands[k]||k)+'</option>').join('');menu();}catch{catalogStatus.textContent='목록을 불러오지 못했습니다. 사료 목록에서 찾기를 눌러 재시도하거나 직접 입력하세요.';}finally{loading=false;}};
    browse.onclick=()=>{limit=20;open();product.focus();product.select();};
    product.addEventListener('focus',open);product.addEventListener('input',()=>{limit=20;open();});
    product.addEventListener('keydown',e=>{if(e.key==='Escape'){close();}if(e.key==='ArrowDown'&&!panel.hidden){e.preventDefault();list.querySelector('button')?.focus();}if(e.key==='Enter'&&!panel.hidden){e.preventDefault();list.querySelector('button')?.focus();}});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){product.focus();close();}});
    for(const filter of [brand,format])filter.onchange=()=>{limit=20;menu();};
    more.onclick=()=>{limit+=20;menu();};form.querySelector('[data-wf-close]').onclick=()=>{product.focus();close();};
    product.addEventListener('change',()=>{const selected=items?.find(x=>eligible(x)&&x.name===product.value);if(selected){form.elements.unit.value=selected.form==='liquid'?'mL':'g';remember();}});

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
