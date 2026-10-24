/* Authenticated official product facts; explicit selection fills strength only. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 function candidates(items,drug,species,route='oral'){const k=key(drug);return !k?[]:items.filter(p=>{const f=p.body?.formulary;return !p.formularyIssue&&f?.version===1&&f.route===route&&f.species.includes(species)&&[p.body.title,...f.aliases].some(a=>key(a)===k);});}
 function savedProduct(p){const f=p.body.formulary;return {id:f.productId,presetId:p.id,name:p.body.title,manualEntry:f.verification==='label',manualReasons:f.warnings||[],permitStatus:f.permitStatus,sourceUrl:f.sourceUrl,checkedAt:f.checkedAt,formularyMeta:f,selection:{option:{value:p.body.value,unit:p.body.unit,form:p.body.kind,route:f.route}}};}
 const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 function mount(b,o){
  const request=(path,options)=>o.request('/practice/products'+path,options),med=b.querySelector('[data-calc=dose]'),species=b.querySelector('[data-ref-species]');let active=null,generation=0;
  const bar=document.createElement('div');bar.className='pt-product-entry';bar.innerHTML='<button type="button" data-domestic-open>국내 제품·함량 찾기</button><p data-domestic-applied class="pt-help" role="status"></p>';med.querySelector('h3').after(bar);
  const note=bar.querySelector('[data-domestic-applied]');
  function reset(){generation++;active=null;note.textContent='';}
  function clearActive(e){if(['form','strengthUnit','concentration'].includes(e.target.name)){active=null;note.textContent='제품 함량을 직접 수정했습니다. 제품 표시와 대조해주세요.';}}
  med.addEventListener('input',clearActive);med.addEventListener('change',clearActive);med.addEventListener('reset',reset);species.addEventListener('change',reset);
  b.addEventListener('click',e=>{if(e.target.closest('[data-ref-apply],[data-ref-manual],[data-private-release]'))reset();});
  b.addEventListener('change',e=>{if(e.target.matches('[data-preset],[data-protocol],[data-ref-drug],[data-ref-profile]'))reset();});
  function open(seed,apply,guard,oralOnly=false){
   if(!o.guard()||!guard())return;
   const initialSpecies=species.value,epoch=generation,d=o.modal('국내 제품·함량 찾기','<p>제품을 선택하고 성분·함량을 확인하면 계산기에 입력합니다. 처방 용량·횟수·기간은 유지됩니다.</p><div class="pt-bar"><label class="pt-product-query">약물·제품·성분명<input data-product-query maxlength="100" placeholder="예: UDCA, 텔미사르탄, 제품명"></label><button type="button" data-product-search>검색</button><button type="button" data-product-import hidden>제품 DB 등록</button></div><p data-product-status role="status" aria-live="polite"></p><section data-product-saved aria-label="우리 병원 사용 약품"></section><div class="pt-product-layout"><section data-product-list aria-label="제품 검색 결과"></section><section data-product-detail aria-live="polite"></section></div><button type="button" data-product-more hidden>다음 제품 보기</button>');
   const el=k=>d.querySelector('[data-product-'+k+']');let seq=0,offset=0,last='',catId='',chosen=null;
   const alive=()=>o.alive()&&d.isConnected&&generation===epoch&&initialSpecies===species.value;
   el('query').value=seed||'';
   async function applyProduct(p,status){
    if(!alive()||!o.guard()||!guard())return;
    if(!oralOnly&&med.elements.doseUnit.value==='U'){status.textContent='현재 처방 단위에는 이 함량을 적용할 수 없습니다. 처방 단위를 확인해주세요.';return;}
    const save=el('save');
    if(save?.checked&&!p.presetId){
     const aliases=el('aliases').value.split(',').map(x=>x.trim()).filter(Boolean),sv=el('save-species').value;
     if(!aliases.length||aliases.length>12||aliases.some(x=>x.length>120)||!sv){status.textContent='자동 연결할 약물명·약칭과 적용 동물 종류를 확인해주세요.';return;}
     const x=p.selection.option;status.textContent='우리 병원 약품으로 저장 중…';
     try{const result=await o.request('/practice/formulary',{method:'POST',body:JSON.stringify({productId:p.id,sourceHash:p.sourceHash,value:x.value,unit:x.unit,kind:x.form,route:x.route,verification:p.manualEntry?'label':'source',aliases,species:sv==='both'?['dog','cat']:[sv],confirm:true,reactivate:!!el('reactivate')?.checked})});p.presetId=result.id;await o.reloadPresets?.();}
     catch(e){if(alive()){status.textContent='병원 약품 저장 실패 · '+e.message;if(e.message.includes('보관 처리')&&!el('reactivate')){const label=document.createElement('label');label.className='pt-choice';label.innerHTML='<input type="checkbox" data-product-reactivate>보관된 제품을 이번 확인 내용으로 다시 등록합니다.';el('detail').append(label);}}return;}
    }
    if(!alive()||!o.guard()||!guard())return;
    if(apply(p)!==false)o.close();else status.textContent='현재 처방 단위에는 이 함량을 적용할 수 없습니다. 처방 단위를 확인해주세요.';
   }
   function saveControls(p){
    if(!o.presets?.().canManage)return;
    const host=document.createElement('section');host.className='pt-notice';host.innerHTML='<label class="pt-choice"><input type="checkbox" data-product-save checked>우리 병원 사용 약품에 저장 · 다음 처방에서 재사용</label><label>자동 연결할 약물명·약칭 · 쉼표로 구분<input data-product-aliases maxlength="1500"></label><label>적용 동물 종류<select data-product-save-species><option value="">선택</option><option value="dog">개</option><option value="cat">고양이</option><option value="both">개·고양이</option></select></label><p class="pt-help">확인한 제품 함량만 병원 공용으로 저장합니다. 환자별 용량·횟수·기간은 저장하지 않습니다.</p>';
    el('detail').append(host);el('aliases').value=seed||p.ingredientEnglish[0]||p.name;el('save-species').value=['dog','cat'].includes(initialSpecies)?initialSpecies:'';
    for(const input of host.querySelectorAll('input:not([type=checkbox]),select'))input.addEventListener('input',()=>{for(const check of [el('confirm'),el('manual-confirm')])if(check)check.checked=false;for(const button of [el('apply'),el('manual-apply')])if(button)button.disabled=true;});
   }
   function savedList(){
    const q=key(el('query').value),items=(o.presets?.().items||[]).filter(p=>{const f=p.body?.formulary;return !p.formularyIssue&&f&&f.species.includes(initialSpecies)&&(!oralOnly||f.route==='oral')&&(!q||[p.body.title,...f.aliases].some(a=>key(a).includes(q)));});
    el('saved').replaceChildren();if(!items.length)return;const title=document.createElement('h3');title.textContent='우리 병원 사용 약품';el('saved').append(title);
    for(const p of items){const btn=document.createElement('button');btn.type='button';btn.className='pt-product-card';btn.dataset.savedProduct=p.id;btn.innerHTML='<b>'+esc(p.body.title)+'</b><span>'+esc(p.body.value)+' '+esc(p.body.unit)+(p.body.kind==='tablet'?'/정':'/mL')+' · '+(p.body.formulary.route==='oral'?'경구':'주사')+'</span><small>병원 확인값 · '+esc(p.body.formulary.aliases.join(', '))+'</small>';btn.onclick=()=>{if(!alive())return;el('detail').replaceChildren();void applyProduct(savedProduct(p),el('status'));};el('saved').append(btn);}
   }
   function details(p){
    chosen=p;const opt=p.selection?.option,blocked=[...new Set((p.selection?.reasons||[]).map(x=>x==='허가 상태 확인'?'허가 상태 확인 필요':x))];
    const injection=opt?.route==='injection'||/주사|injection/i.test(p.name+' '+(p.englishName||'')+' '+(p.chart||''));
    if(oralOnly&&injection)blocked.push('처방 일괄 계산에는 경구제만 적용할 수 있습니다.');
    if(p.source==='QIA'&&p.speciesMentioned?.length&&['dog','cat'].includes(initialSpecies)&&!p.speciesMentioned.includes(initialSpecies==='dog'?'개':'고양이'))blocked.push('현재 동물 종류와 허가 대상동물이 다릅니다. 원문을 확인해주세요.');
    el('detail').innerHTML=`<h3>${esc(p.name)}</h3><p>${esc(p.manufacturer)} · ${p.source==='MFDS'?'인체용':'동물용'}</p><p>성분: ${esc(p.ingredientEnglish.join(' · '))}</p><p>허가 ${esc(p.permitStatus)} · 현재 공급 여부 미확인</p><p>출처 확인일 ${esc(p.checkedAt)} · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">공식 제품 정보 열기</a></p><ul>${p.components.map(c=>`<li>${esc(c.ingredient)} · ${esc(c.amountRaw)} ${esc(c.unitRaw)}<br>기준: ${esc(c.basisRaw||'미확인')}${c.equivalenceRaw?'<br>환산 기준: '+esc(c.equivalenceRaw):''}</li>`).join('')}</ul>${p.issues.length?'<p class="pt-help">'+p.issues.map(esc).join(' · ')+'</p>':''}${blocked.length||!opt?'<div class="pt-notice"><b>자동 입력 보류</b><p>'+blocked.map(esc).join(' · ')+'</p><p>제품 원문을 확인한 뒤 계산기에 직접 입력해주세요.</p></div>':`<p class="pt-product-strength">입력할 함량: <b>${esc(opt.value)} mg/${opt.form==='tablet'?'정':'mL'}</b> · ${opt.route==='injection'?'주사제':'경구제'}</p><label class="pt-choice"><input type="checkbox" data-product-confirm>원처방의 약물과 제품 성분·함량·투여경로를 대조했습니다.</label><button type="button" data-product-apply disabled class="pt-primary">확인한 함량 입력</button>`}`;
    const button=el('apply');if(button){el('confirm').onchange=e=>button.disabled=!e.target.checked;button.onclick=async()=>{if(chosen!==p||!el('confirm').checked)return;button.disabled=true;await applyProduct(p,el('status'));if(alive())button.disabled=!el('confirm')?.checked;};saveControls(p);}
    // Administrative source flags do not remove the existing manual calculator.
    // Keep them visible, leave the value empty, and distinguish typed facts from source autofill.
    const c=p.components?.[0],administrative=new Set(['허가 상태 확인 필요','수출용 표시','제품명 함량과 성분표 환산값이 달라 제품 표시 확인 필요']);
    if(!opt&&blocked.length&&blocked.every(x=>administrative.has(x))&&p.ingredientEnglish.length===1&&p.components.length===1&&c.normalization==='structured'&&['tablet','mL'].includes(c.per)&&!(c.issues||[]).length){
     const manual=document.createElement('details');manual.innerHTML=`<summary class="pt-summary">제품 표시를 확인해 함량 직접 입력</summary><p>등록 정보의 ${esc(p.permitStatus)}${blocked.includes('수출용 표시')?'·수출용':''} 표시는 유지됩니다. 실제 보유 제품의 성분·함량·사용 가능 여부를 확인한 경우에만 입력하세요.</p><label>제품 표시의 ${c.per==='tablet'?'1정':'1mL'}당 함량 · mg<input data-product-manual-value inputmode="decimal" autocomplete="off" placeholder="제품 포장에 표시된 함량" maxlength="20"></label><label class="pt-choice"><input type="checkbox" data-product-manual-confirm>실제 보유 제품의 성분·함량·제형·사용 가능 여부를 직접 확인했습니다.</label><button type="button" data-product-manual-apply disabled>직접 확인한 함량 입력</button><p data-product-manual-status role="status"></p>`;
     el('detail').append(manual);const field=el('manual-value'),check=el('manual-confirm'),submit=el('manual-apply');
     const value=()=>/^\d+(?:\.\d+)?$/.test(field.value.trim())?Number(field.value.trim()):NaN;
     const valid=()=>Number.isFinite(value())&&value()>0&&value()<=1e6;
     field.oninput=()=>{check.checked=false;submit.disabled=true;el('manual-status').textContent=field.value&&!valid()?'0보다 크고 1,000,000 이하인 함량을 숫자로 입력해주세요.':'';};
     check.onchange=()=>{submit.disabled=!check.checked||!valid();};
     submit.onclick=async()=>{if(!alive()||!o.guard()||!guard()||chosen!==p||!check.checked||!valid())return;const entered={...p,manualEntry:true,manualReasons:blocked.slice(),selection:{reasons:blocked.slice(),option:{value:value(),unit:'mg',form:c.per==='tablet'?'tablet':'liquid',route:injection?'injection':'oral',ingredient:c.strengthBasis}}};submit.disabled=true;await applyProduct(entered,el('manual-status'));if(alive())submit.disabled=!el('manual-confirm')?.checked;};saveControls(p);
    }
   }
   async function search(next=false){
    savedList();const q=el('query').value.trim(),token=++seq;offset=next?offset+30:0;chosen=null;el('detail').replaceChildren();el('list').replaceChildren();el('more').hidden=true;el('status').textContent='제품 정보를 불러오는 중…';
    try{const r=await request('?q='+encodeURIComponent(q)+'&offset='+offset);if(!alive()||seq!==token)return;if(next&&catId!==r.catalog?.id){offset=0;return search(false);}catId=r.catalog?.id||'';last=q;el('import').hidden=!r.canManage;
     if(!r.catalog){el('status').textContent='우리 병원에 등록된 국내 제품 DB가 없습니다. 제품 함량을 직접 입력할 수 있습니다.';return;}
     el('status').textContent=q.length<2?'검색어를 두 글자 이상 입력해주세요.':!r.items.length?'일치하는 제품이 없습니다. 성분명 또는 제품명으로 다시 검색해주세요.':`검색 결과 ${offset+1}–${offset+r.items.length} · 자료 확인 ${r.catalog.checkedAt}`;
     for(const p of r.items){const btn=document.createElement('button');btn.type='button';btn.className='pt-product-card';btn.innerHTML=`<b>${esc(p.name)}</b><span>${esc(p.manufacturer)}</span><small>${p.selection?.option?'함량 확인 후 입력 가능':'원문 확인 필요'} · ${esc(p.permitStatus)}</small>`;btn.onclick=()=>details(p);el('list').append(btn);}el('more').hidden=!r.hasMore;
    }catch(e){if(alive()&&seq===token)el('status').textContent='제품 정보를 불러오지 못했습니다. 다시 검색하거나 함량을 직접 입력해주세요. '+e.message;}
   }
   el('query').addEventListener('input',()=>{seq++;savedList();chosen=null;el('detail').replaceChildren();el('list').replaceChildren();el('more').hidden=true;el('status').textContent='검색을 눌러 제품을 확인해주세요.';});
   el('query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void search();}};el('search').onclick=()=>search();el('more').onclick=()=>{if(last===el('query').value.trim())return search(true);return search();};el('import').onclick=()=>importDialog();void (async()=>{if(o.reloadPresets)await o.reloadPresets();if(alive())void search();})();
  }
  function importDialog(){
   const d=o.modal('병원 내부 제품 DB 등록','<p>공식 제품·함량으로 준비된 파일을 우리 병원에 등록합니다. 전체 검증이 끝나면 검색에 반영됩니다.</p><label>제품 DB 파일<input type="file" data-products-file accept=".json"></label><p data-products-info></p><button type="button" data-products-run disabled>확인 후 병원 내부 DB 등록</button><p data-products-state role="status"></p>'),input=d.querySelector('input'),button=d.querySelector('[data-products-run]'),status=d.querySelector('[data-products-state]');let doc=null,serial=0;
   input.onchange=async()=>{const token=++serial;doc=null;button.disabled=true;try{const file=input.files[0];if(!file)return;if(file.size>70000000)throw Error('70 MB 이하의 제품 파일을 선택해주세요.');const x=JSON.parse(await file.text());if(!d.isConnected||token!==serial)return;if(x.format!=='carestep-clinic-products/v1'||!Array.isArray(x.items)||!x.items.length||x.items.length>25000||x.index?.length!==x.items.length)throw Error('CARESTEP 제품 DB 파일을 선택해주세요.');doc=x;d.querySelector('[data-products-info]').textContent=x.title+' · '+x.items.length+'개 · '+x.checkedAt;button.disabled=false;}catch(e){status.textContent=e.message;}};
   button.onclick=async()=>{if(!doc||!o.guard())return;button.disabled=input.disabled=true;try{
    status.textContent='파일 무결성 확인 중…';const index=[];for(const raw of doc.items){index.push({id:JSON.parse(raw).id,hash:await hash(raw)});}if(JSON.stringify(index)!==JSON.stringify(doc.index))throw Error('파일 내용이 목차와 일치하지 않습니다.');
    const r=await request('/import',{method:'POST',body:JSON.stringify({...doc,items:undefined,confirmInternalUse:true})}),stored=new Set(r.stored),pending=doc.items.filter(raw=>!stored.has(JSON.parse(raw).id));
    for(let i=0;i<pending.length;i+=100){if(!o.alive())throw Error('병원 연결이 변경되었습니다. 같은 파일로 이어서 등록해주세요.');status.textContent=`제품 등록 ${stored.size+i} / ${doc.items.length} · 화면을 닫지 마세요.`;await request('/'+r.id+'/items',{method:'POST',body:JSON.stringify({items:pending.slice(i,i+100)})});}
    await request('/'+r.id+'/complete',{method:'POST',body:'{}'});status.textContent=doc.items.length+'개 제품 DB 등록 완료 · 제품 검색에 반영했습니다.';
   }catch(e){status.textContent='등록 중단: '+e.message+' 같은 파일로 이어서 등록할 수 있습니다.';}finally{button.disabled=input.disabled=false;}};
  }
  bar.querySelector('button').onclick=()=>open('',p=>{if(med.elements.doseUnit.value==='U'){note.textContent='활성단위 U 처방에는 mg 함량을 적용할 수 없습니다.';return false;}o.clear();const x=p.selection.option;med.elements.form.value=x.form;med.elements.form.dispatchEvent(new Event('change',{bubbles:true}));med.elements.strengthUnit.value=x.unit;med.elements.strengthUnit.dispatchEvent(new Event('change',{bubbles:true}));med.elements.concentration.value=x.value;med.elements.concentration.dispatchEvent(new Event('input',{bubbles:true}));active=p;note.textContent=(p.presetId?'우리 병원 약품 · ':'')+p.name+' · '+x.value+' mg/'+(x.form==='tablet'?'정':'mL')+(p.manualEntry?' · 제품 표시 직접 확인 · 허가 '+p.permitStatus+(p.manualReasons.includes('수출용 표시')?' · 수출용 표시':''):' · 출처 확인 '+p.checkedAt);o.refresh();},()=>true);
  return {open,reset,report(f,text){return f===med&&active&&Number(med.elements.concentration.value)===active.selection.option.value&&med.elements.form.value===active.selection.option.form&&med.elements.strengthUnit.value==='mg'?`국내 제품: ${active.name}\n${active.manualEntry?'함량: 사용자 직접 입력·제품 표시 확인 · 허가 '+active.permitStatus+' · '+active.manualReasons.join(' · '):'함량 출처: '+active.sourceUrl+' · '+active.checkedAt}\n${text}`:text;}};
 }
 g.PracticeProducts={mount,candidates,savedProduct};
})(window);
