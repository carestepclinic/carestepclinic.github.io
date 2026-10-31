/* Public manufacturer facts only. Missing/conflicting energy is never estimated. */
(function(g){
 'use strict';
 const brands={royalcanin:'로얄캐닌',hills:'힐스'},forms={dry:'건식',wet:'습식·캔·파우치',liquid:'액상'};
 const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s/·+&_-]+/g,'');
 function search(items,{species='',brand='',form='',query=''}={}){const q=normalize(query);return items.filter(p=>(!species||p.species.includes(species))&&(!brand||p.brand===brand)&&(!form||p.form===form)&&(!q||normalize([p.name,brands[p.brand],...(p.aliases||[])].join(' ')).includes(q)));}
 function valid(p){return p&&typeof p.id==='string'&&typeof p.name==='string'&&brands[p.brand]&&Array.isArray(p.species)&&p.species.length&&p.species.every(s=>['dog','cat'].includes(s))&&Array.isArray(p.sourceUrls)&&p.sourceUrls.every(s=>/^https:\/\/www\.(royalcanin\.com\/kr\/|hillspet\.co\.kr\/)/.test(s))&&(p.energy===null||p.status==='verified'&&Number.isFinite(p.energy.value)&&p.energy.value>0&&['kcal/kg','kcal/g','kcal/mL','kcal/can'].includes(p.energy.unit)&&(p.energy.unit!=='kcal/can'||p.energy.packageGrams>0));}
 let pending;
 function load(){if(!pending)pending=fetch('practice-food-catalog.json?v=20261031-food1').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(d.schemaVersion!==1||!Array.isArray(d.items)||!d.items.length||!d.items.every(valid))throw Error();return d;}).catch(e=>{pending=null;throw e;});return pending;}
 function mount(f,o){
  const host=document.createElement('section');host.className='pt-food-picker pt-span';host.setAttribute('aria-label','처방식 제품 찾기');
  host.innerHTML='<div class="pt-food-filters"><label>브랜드<select data-food-brand><option value="">전체 브랜드</option><option value="royalcanin">로얄캐닌</option><option value="hills">힐스</option></select></label><label>제품 형태<select data-food-form><option value="">전체 형태</option><option value="dry">건식</option><option value="wet">습식·캔·파우치</option><option value="liquid">액상</option></select></label></div><label>처방식 찾기<input type="search" data-food-search placeholder="제품명 · 예: i/d, 레날, 리커버리" autocomplete="off"></label><label>급여 제품<select data-food-product><option value="">제품 선택 / 열량 직접 입력</option></select></label><p class="pt-help" data-food-status role="status"></p><button type="button" data-food-retry hidden>제품 목록 다시 불러오기</button><div data-food-detail hidden><p><strong data-food-title></strong></p><p data-food-energy></p><p class="pt-help" data-food-note></p><details><summary>제품 정보·출처</summary><p class="pt-help" data-food-origin></p><a data-food-link target="_blank" rel="noopener noreferrer">제조사 공식 제품 정보</a><p class="pt-help">공식 사이트 등재 기준입니다. 국내 유통 포장의 제품·열량을 확인하세요.</p></details></div>';
  const density=f.elements.density,unit=f.elements.unit,brand=host.querySelector('[data-food-brand]'),form=host.querySelector('[data-food-form]'),query=host.querySelector('[data-food-search]'),select=host.querySelector('[data-food-product]'),status=host.querySelector('[data-food-status]'),detail=host.querySelector('[data-food-detail]'),retry=host.querySelector('[data-food-retry]');
  let data=null,busy=false,chosen=null,writing=false;
  function showDetail(){detail.hidden=!chosen;if(!chosen)return;const e=chosen.energy,same=e&&Number(density.value)===e.value&&unit.value===e.unit;
   host.querySelector('[data-food-title]').textContent=brands[chosen.brand]+' '+chosen.name;
   host.querySelector('[data-food-energy]').textContent=same?'공식 열량 '+e.evidence+(e.unit==='kcal/kg'?' · 계산 입력 '+e.value+' kcal/kg':''):density.value?'이번 계산에 입력한 열량 · '+density.value+' '+unit.value:chosen.status==='conflict'?'열량 확인 필요 · 공식 표기 차이':'열량 미확인 · 포장 표시값을 입력하세요.';
   host.querySelector('[data-food-note]').textContent=chosen.note||'';host.querySelector('[data-food-origin]').textContent=brands[chosen.brand]+' · '+(forms[chosen.form]||'형태 확인')+' · 확인 '+chosen.checkedAt;host.querySelector('[data-food-link]').href=chosen.sourceUrls[0];
  }
  function menu(){if(!data)return;const rows=search(data.items,{species:o.species.value,brand:brand.value,form:form.value,query:query.value});select.replaceChildren(new Option('제품 선택 / 열량 직접 입력',''));for(const p of rows)select.add(new Option(p.name+' · '+(forms[p.form]||'형태 확인')+(p.energy?.packageGrams?' · '+p.energy.packageGrams+' g 캔':'')+(p.energy?'':' · 열량 미확인'),p.id));
   if(chosen&&!rows.some(p=>p.id===chosen.id)){const group=document.createElement('optgroup');group.label='현재 선택';group.append(new Option(chosen.name,chosen.id));select.append(group);}select.value=chosen?.id||'';status.textContent=rows.length+'개 제품'+(o.species.value?' · '+(o.species.value==='cat'?'고양이':'개'):' · 개·고양이')+' · 열량 미확인 제품은 직접 입력';
  }
  async function ensure(){if(data||busy||!f.isConnected)return;busy=true;status.textContent='공식 제품 목록을 불러오는 중…';retry.hidden=true;try{const d=await load();if(!f.isConnected)return;data=d;menu();}catch{if(f.isConnected){status.textContent='제품 목록을 불러오지 못했습니다. 열량 직접 입력은 계속 사용할 수 있습니다.';retry.hidden=false;}}finally{busy=false;}}
  function changed(){writing=true;density.dispatchEvent(new Event('input',{bubbles:true}));unit.dispatchEvent(new Event('change',{bubbles:true}));writing=false;o.clear();showDetail();}
  select.onchange=()=>{chosen=data?.items.find(p=>p.id===select.value)||null;density.value=chosen?.energy?String(chosen.energy.value):'';unit.value=chosen?.energy?.unit||'';changed();};
  for(const el of [brand,form])el.onchange=menu;query.oninput=menu;
  // Search/filter controls do not change the calculation. Product selection emits named field events above.
  for(const event of ['input','change'])host.addEventListener(event,e=>e.stopPropagation());
  host.addEventListener('focusin',ensure);retry.onclick=ensure;
  for(const el of [density,unit])for(const event of ['input','change'])el.addEventListener(event,()=>{if(!writing)showDetail();});
  function reset(){chosen=null;brand.value='';form.value='';query.value='';select.value='';detail.hidden=true;menu();}
  f.addEventListener('reset',()=>queueMicrotask(reset));o.species.addEventListener('change',reset);
  f.closest('[data-body]')?.addEventListener('practice-protocol-applied',e=>{if(f.querySelector('[data-protocol]')?.value===e.detail.id)reset();});
  // Shared setup moves these fields during mounting; attach after that layout is complete.
  queueMicrotask(()=>{density.closest('label').parentElement.prepend(host);const panel=f.closest('[data-kind-panel]');const observer=new MutationObserver(()=>{if(!panel.hidden){void ensure();observer.disconnect();}});if(!panel.hidden)void ensure();else observer.observe(panel,{attributes:true,attributeFilter:['hidden']});});
  return {describe(){if(!chosen)return '';const e=chosen.energy,same=e&&Number(density.value)===e.value&&unit.value===e.unit;return '\n급여 제품: '+brands[chosen.brand]+' '+chosen.name+(same&&e.packageGrams?' · '+e.packageGrams+' g 캔':'')+'\n열량: '+(same?'공식 제품값':'직접 입력값 · 포장 확인')+'\n제품 출처 '+chosen.sourceUrls[0];}};
 }
 const api={search,valid,mount};g.PracticeNutritionFoods=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
