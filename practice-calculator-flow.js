/* Presentation only: reuse existing controls, validations and calculation handlers. */
(function(g){
 'use strict';
 function mount(b){
  if(!b||b.classList.contains('pt-streamlined'))return null;
  b.classList.add('pt-streamlined');
  const q=s=>b.querySelector(s),all=s=>[...b.querySelectorAll(s)];
  const details=(title,cls)=>{const d=document.createElement('details');d.className=cls;const s=document.createElement('summary');s.textContent=title;d.append(s);return d;};
  const text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const hide=(el,value)=>{if(el&&el.hidden!==value)el.hidden=value;};
  const reveal=el=>{for(let p=el?.parentElement;p&&p!==b;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el?.focus();el?.scrollIntoView({block:'center',behavior:'smooth'});};
  const species=q('[data-ref-species]'),weight=q('[data-common-weight]');
  const notice=document.createElement('div');notice.className='pt-flow-context';notice.hidden=true;notice.setAttribute('role','status');notice.innerHTML='<span></span><button type="button">입력하러 가기</button>';
  q('.pt-calc-common')?.after(notice);
  let missing=null;notice.querySelector('button').onclick=()=>reveal(missing);

  // Keep one visible medication query; the optional regimen chooser uses the same query.
  const med=q('[data-calc=dose]'),quick=q('.pt-quick-products'),regimen=q('.pt-medication-flow');
  if(med&&quick){
   med.querySelector('h3').after(quick);
   const label=quick.querySelector('label');if(label?.firstChild)label.firstChild.textContent='약물·성분 찾기';
   quick.querySelector('input').placeholder='성분명·제품명·약칭';
  }
  let mirror=null,primary=q('[data-quick-product-search]');
  if(regimen){
   const d=details('처방 용법 선택 · 선택사항','pt-flow-regimen');regimen.before(d);d.append(regimen);
   const query=regimen.querySelector('[data-regimen-query]');
   if(query&&primary){query.closest('label').hidden=true;mirror=()=>{query.value=primary.value;query.dispatchEvent(new Event('input',{bubbles:true}));};primary.addEventListener('input',mirror);}
   hide(regimen.querySelector('h4'),true);
  }
  const drugSettings=q('.pt-drug-management');if(drugSettings){drugSettings.classList.add('pt-drug-settings');text(drugSettings.querySelector('summary'),'약품·계산 설정');q('.pt-calc-view-tools')?.after(drugSettings);for(const button of all('[data-strength-open]'))if(!drugSettings.contains(button))button.remove();}
  const productDetails=q('.pt-medication-products');
  if(productDetails){productDetails.open=false;text(productDetails.querySelector('summary'),'함량 직접 입력·약품 관리');}

  // Loading and saving are separate phases. Keep the original review gate and handlers.
  const rx=q('[data-calc=batch]'),reuse=q('.pt-rx-reuse');let rxSave=null,rxStatus=null,rxLoad=null;const moveRxStatus=e=>{if(!rxStatus)return;if(e.target.closest('[data-rx-save-set],[data-rx-save-draft]'))rxSave.append(rxStatus);else if(e.target.closest('[data-rx-sets],[data-rx-history],[data-rx-stages]'))rxLoad.after(rxStatus);};
  if(rx&&reuse){
   const load=details('저장한 처방 불러오기·단계별 작성','pt-flow-rx-load');rxLoad=load;
   const bar=rx.querySelector('.pt-image-tabs');(bar||rx.querySelector('h3')).after(load);
   const saveButton=reuse.querySelector('[data-rx-save-set]');
   if(saveButton){rxSave=document.createElement('section');rxSave.className='pt-flow-rx-save';rxSave.hidden=true;rxSave.innerHTML='<strong>검토한 처방 저장</strong><p class="pt-help">결과 확인 후 저장합니다. 환자 초안과 병원 공통 세트를 구분해주세요.</p>';rxSave.append(saveButton.parentElement);rx.querySelector('[data-result-actions]').after(rxSave);}
   hide(reuse.querySelector('h4'),true);load.append(reuse);
   // Status must remain visible when the entry section is closed or a save fails.
   const status=reuse.querySelector('[data-rx-reuse-status]');rxStatus=status;if(status)load.after(status);rx.addEventListener('click',moveRxStatus,true);
  }

  // Input and result share a form so native form elements and submit guards keep working.
  for(const f of all('form[data-calc]')){
   if(f.dataset.calc==='batch')continue;
   const output=f.querySelector('output'),submit=[...f.querySelectorAll('button.pt-primary')].find(x=>x.type==='submit');
   if(!output||!submit)continue;
   const entry=document.createElement('div'),result=document.createElement('section');entry.className='pt-flow-entry';result.className='pt-flow-result';
   const title=f.querySelector('h3'),actions=f.querySelector('[data-result-actions]');
   for(const child of [...f.childNodes])if(child!==title)entry.append(child);
   f.append(entry,result);f.classList.add('pt-flow-form');
   const head=document.createElement('h4');head.textContent='계산 결과';result.append(head);const remaining=entry.querySelector('.pt-remaining');if(remaining)result.append(remaining);result.append(submit,output);
   const empty=document.createElement('p');empty.className='pt-flow-empty pt-help';empty.textContent='';empty.hidden=true;output.before(empty);if(actions)result.append(actions);
  }
  const k=q('[data-k-preparation] > details');if(k)k.open=false;
  // Consolidate general explanatory details without folding clinical warnings or unit labels.
  for(const f of all('.pt-flow-form')){
   const entry=f.querySelector('.pt-flow-entry');
   const candidates=[...entry.children].filter(x=>x.tagName==='DETAILS'&&/^(계산식|계산 원리|계산 근거)/.test(x.querySelector('summary')?.textContent||''));
   if(candidates.length>1){const d=details('계산식·참고 근거','pt-flow-references');entry.append(d);for(const child of candidates)d.append(child);}
  }

  const general=all('details').filter(d=>!d.closest('form')&&/^(계산기 사용 안내|계산식·근거 확인)$/.test(d.querySelector('summary')?.textContent||''));if(general.length>1){const help=details('계산기 사용 안내·공통 계산식','pt-flow-references');b.append(help);for(const d of general){const section=document.createElement('section');const title=document.createElement('h4');title.textContent=d.querySelector('summary').textContent;section.append(title,...[...d.children].filter(x=>x.tagName!=='SUMMARY'));help.append(section);d.remove();}}
  const emNav=q('nav[aria-label="응급약물 분류"]');let emSelect=null;
  if(emNav){const label=document.createElement('label');label.className='pt-flow-em-filter';label.append('응급약물 분류');emSelect=document.createElement('select');emSelect.setAttribute('aria-label','응급약물 분류 선택');label.append(emSelect);emNav.before(label);for(const btn of emNav.querySelectorAll('button')){const opt=document.createElement('option');opt.value=btn.dataset.emFilter;opt.textContent=btn.textContent;emSelect.append(opt);}emSelect.onchange=()=>emNav.querySelector('[data-em-filter="'+emSelect.value+'"]')?.click();}

  // Anesthesia is mounted lazily. Move each control once, retaining its event bindings.
  function anesthesia(){for(const card of all('.pt-an-card:not([data-flow-card])')){
   card.dataset.flowCard='';const header=document.createElement('div'),inputs=document.createElement('div'),result=document.createElement('div');header.className='pt-flow-an-header';inputs.className='pt-flow-an-inputs';result.className='pt-flow-an-result';
   const manage=details('농도 저장·불러오기·근거','pt-flow-an-manage');
   const children=[...card.children],out=card.querySelector('output');
   for(const child of children){
    if(child.matches('small,h4,[data-an-range]'))header.append(child);
    else if(child.matches('.pt-grid,[data-an-choice-label],[data-an-companion-range],[data-an-origin],[data-an-dose-state],[data-an-save-state]'))inputs.append(child);
    else if(child===out||child.matches('label.pt-choice'))result.append(child);
    else if(child.matches('[data-an-dose-reset],.pt-bar,details'))manage.append(child);
    else{child.classList.add('pt-flow-an-note');header.append(child);}
   }
   inputs.append(manage);card.append(header,inputs,result);
  }}
  let frame=0,disposed=false;
  function refresh(){
   frame=0;if(disposed||!b.isConnected)return;
   anesthesia();
   const active=all('[data-kind-panel]').find(x=>!x.hidden)?.dataset.kindPanel;
   const record=q('[data-record-weight-confirm]');
   missing=!species?.value?species:!(Number(weight?.value)>0)?weight:record&&!record.closest('label').hidden&&!record.checked?record:null;
   const needsContext=!['convert','acid'].includes(active);
   hide(notice,!needsContext||!missing);text(notice.querySelector('span'),missing===species?'동물 종류를 선택해주세요.':missing===weight?'현재 체중을 입력해주세요.':'기록 체중과 측정일을 확인해주세요.');
   // Emergency values remain hidden until the common context is complete; no repeated errors.
   b.classList.toggle('pt-flow-missing-context',!!missing);
   if(emSelect){const selected=emNav.querySelector('[aria-pressed=true]');if(selected&&emSelect.value!==selected.dataset.emFilter)emSelect.value=selected.dataset.emFilter;const count=all('[data-em-row]').filter(x=>!x.hidden).length;for(const opt of emSelect.options){const btn=emNav.querySelector('[data-em-filter="'+opt.value+'"]');text(opt,btn.textContent+(opt.selected?' · '+count+'개':''));}}
   if(rxSave)hide(rxSave,rx.querySelector('[data-result-actions]').hidden||!rx.querySelector('output')?.textContent.trim());
   for(const f of all('.pt-flow-form')){
    hide(f.querySelector('.pt-flow-empty'),true);
    const remaining=f.querySelector('.pt-remaining');
    if(remaining){const status=remaining.querySelector('span');if(status?.textContent==='필수 입력 완료 · 계산으로 결과 확인')text(status,'입력 완료');hide(remaining,!!f.querySelector('output')?.textContent.trim()&&!remaining.querySelector('button'));}
   }
   // A missing shared field is explained once in the common context bar.
   for(const x of all('[data-protocol-status],[data-quick-product-status],.pt-quick-product > .pt-help'))hide(x,!!missing&&/상단에서 동물 종류|종을 선택/.test(x.textContent));
  }
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(refresh);};
  const observer=new MutationObserver(schedule);observer.observe(b,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-pressed']});
  for(const event of ['input','change','practice-kind-selected'])b.addEventListener(event,schedule);
  refresh();
  return {dispose(){disposed=true;observer.disconnect();rx?.removeEventListener('click',moveRxStatus,true);if(frame)cancelAnimationFrame(frame);primary?.removeEventListener('input',mirror);for(const event of ['input','change','practice-kind-selected'])b.removeEventListener(event,schedule);}};
 }
 g.PracticeCalculatorFlow={mount};
})(window);
