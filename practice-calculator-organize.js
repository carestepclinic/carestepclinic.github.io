/* Navigation and presentation only. Reuse the original calculation and review gates. */
(function(g){
 'use strict';
 function mount(b,o){
  const q=s=>b.querySelector(s),all=s=>[...b.querySelectorAll(s)];
  const nav=q('.pt-calc-menu'),main=q('.pt-calc-main'),toolbar=q('.pt-calc-view-tools');
  if(!nav||!main||!toolbar)return null;
  b.classList.add('pt-organized');
  const set=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const groups=[['약물 투여',[['batch','처방 계산'],['emergency','응급약물'],['anesthesia','마취약물']]],['수액·주입',[['fluid','수액 계산'],['cri','정맥 주입·CRI'],['transfusion','수혈 계산']]],['보충·보정',[['potassium','전해질 보충'],['acid','산·염기 계산']]],['영양',[['nutrition','영양·급여 계산']]]];
  for(const [title,items] of groups){
   const group=document.createElement('section');group.className='pt-calc-group';
   const heading=document.createElement('h4');heading.textContent=title;group.append(heading);
   for(const [id,label] of items){const button=q('[data-kind="'+id+'"]');if(!button)continue;set(button.querySelector('b')||button,label);button.dataset.calcGroup=title;group.append(button);}
   nav.append(group);
  }
  // Keep legacy routes addressable, but provide a single prescription menu entry.
  const direct=q('[data-kind=med]');direct.dataset.calcAux='true';direct.hidden=true;toolbar.append(direct);
  q('[data-kind=batch]').onclick=()=>o.selectKind('batch');
  const convert=q('[data-kind=convert]');convert.dataset.calcAux='true';convert.classList.add('pt-calc-aux');set(convert.querySelector('b'),'단위·희석');toolbar.append(convert);
  const settings=q('.pt-drug-management');if(settings){set(settings.querySelector(':scope > summary'),'병원 설정');toolbar.append(settings);}
  set(toolbar.querySelector(':scope > strong'),'계산 준비');
  const view=q('.pt-view-options');set(view?.querySelector('summary'),'화면 설정');
  queueMicrotask(()=>{const reset=q('.pt-reset-calculation');if(reset){reset.textContent='새 계산';toolbar.append(reset);}});

  // Prescription text/photo, injections and manual entry share the same destination.
  const modes=q('[aria-label="처방 계산 방식"]');
  if(modes){
   modes.classList.add('pt-prescription-modes');main.prepend(modes);
   for(const button of modes.querySelectorAll('[data-injection-mode]'))button.addEventListener('click',()=>o.selectKind('batch'),true);
   set(modes.querySelector('[data-injection-mode=oral]'),'경구 처방');
   set(modes.querySelector('[data-injection-mode=injection]'),'주사 처방');
   const manual=document.createElement('button');manual.type='button';manual.dataset.prescriptionManual='';manual.textContent='직접 입력';manual.onclick=()=>o.selectKind('med');modes.append(manual);
  }
  const med=q('[data-calc=dose]'),rx=q('[data-calc=batch]');
  set(med?.querySelector('h3'),'1회량·전체 필요량');set(rx?.querySelector('h3'),'처방 계산');
  const duplicateEntry=med?.querySelector('.pt-rx-entry');if(duplicateEntry)duplicateEntry.hidden=true;
  set(q('.pt-medication-products > summary'),'함량·제형 변경');
  if(rx){
   const help=rx.querySelector(':scope > p.pt-help'),instructions=rx.querySelector('.pt-rx-instructions');
   if(help&&instructions){help.remove();instructions.classList.add('pt-entry-help');}
   const tabs=document.createElement('nav'),load=rx.querySelector('.pt-flow-rx-load');
   tabs.className='pt-prescription-inputs';tabs.setAttribute('aria-label','처방 입력 선택');tabs.innerHTML='<button type="button" data-prescription-text>원문 입력</button><button type="button" data-prescription-photo>사진 입력</button>';
   rx.querySelector('h3').after(tabs);
   tabs.querySelector('[data-prescription-text]').onclick=()=>{rx.querySelector('[data-mode=text]')?.click();rx.querySelector('[data-rx-text]').focus({preventScroll:true});};
   tabs.querySelector('[data-prescription-photo]').onclick=()=>{const mode=rx.querySelector('[data-mode=image]');if(mode)mode.click();else rx.querySelector('.pt-image-launch')?.click();};
   if(load){
    const saved=document.createElement('button');saved.type='button';saved.dataset.prescriptionSaved='';saved.textContent='저장 처방';saved.setAttribute('aria-expanded','false');
    saved.onclick=()=>{load.open=!load.open;if(load.open)load.scrollIntoView({block:'nearest'});};tabs.append(saved);
    load.addEventListener('toggle',()=>saved.setAttribute('aria-expanded',String(load.open)));
    set(load.querySelector('summary'),'저장 처방·단계별 작성');
   }
   const common=rx.querySelector('.pt-rx-common-settings');if(common){common.classList.add('pt-common-regimen');set(common.querySelector('summary'),'공통 용법 · 누락된 조건만 적용');}
   const dateHelp=rx.querySelector('.pt-rx-date .pt-help');if(dateHelp&&instructions)instructions.append(dateHelp);
   if(instructions)rx.append(instructions);
   // Results remain outside the input column so all completed drugs can be scanned together.
   const input=document.createElement('div'),result=document.createElement('section');input.className='pt-prescription-entry';result.className='pt-prescription-result';
   const output=rx.querySelector('output'),actions=rx.querySelector('[data-result-actions]'),save=rx.querySelector('.pt-flow-rx-save');
   for(const child of [...rx.children])if(child!==output&&child!==actions&&child!==save)input.append(child);
   const resultTabs=input.querySelector('.pt-rx-view-tabs');if(resultTabs)result.append(resultTabs);
   result.append(output,actions);if(save)result.append(save);rx.append(input,result);
   const ward=input.querySelector('[data-ward-calculator-import]');if(ward)result.append(ward);
  }
  // Fold generic instructions, never errors, active warnings or clinical review controls.
  for(const f of all('.pt-flow-form')){
   const entry=f.querySelector('.pt-flow-entry');if(!entry)continue;
   const help=[...entry.children].filter(x=>x.matches('p.pt-help')&&!x.hasAttribute('role'));
   if(help.length){const d=document.createElement('details');d.className='pt-entry-help';d.innerHTML='<summary>입력 안내·참고 근거</summary>';entry.append(d);d.append(...help);}
   const confirm=entry.querySelector('input[name=confirmed]');if(confirm)f.querySelector('.pt-flow-result')?.prepend(confirm.closest('label'));
  }

  // Automatic previews invoke existing handlers only after every native requirement
  // (including clinical checks) is met. They cannot save or administer medication.
  const autoKinds=new Set(['dose','fluid','convert','dilute','cri','potassium','nutrition','ag','bicarbonate','calcium','transfusion']);
  let timer=0,disposed=false,frame=0;
  function calculate(){
   timer=0;if(disposed||!b.isConnected||!o.alive())return;
   for(const f of all('form[data-calc]')){
    if(!autoKinds.has(f.dataset.calc)||f.closest('[hidden]')||!f.onsubmit)continue;
    const fields=[...f.elements];
    if(fields.some(x=>x.willValidate&&!x.validity.valid))continue;
    if(fields.some(x=>x.name==='confirmed'&&!x.checked))continue;
    f.requestSubmit();
   }
  }
  function changed(e){if(e.target.closest('[data-result-actions],.pt-drug-management,.pt-view-options'))return;if(!e.target.name&&!e.target.matches('[data-common-weight],[data-ref-species],[data-record-weight-confirm]'))return;clearTimeout(timer);timer=setTimeout(calculate,350);}
  b.addEventListener('input',changed);b.addEventListener('change',changed);
  const search=q('[data-calc-search]');
  search.oninput=()=>{const term=search.value.trim().toLowerCase();for(const group of nav.querySelectorAll('.pt-calc-group')){for(const button of group.querySelectorAll('[data-kind]'))button.hidden=!(button.textContent+' '+group.querySelector('h4').textContent).toLowerCase().includes(term);group.hidden=![...group.querySelectorAll('[data-kind]')].some(x=>!x.hidden);}q('[data-calc-empty]').hidden=!!nav.querySelector('.pt-calc-group:not([hidden])');};
  function refresh(){
   frame=0;if(disposed)return;
   const active=q('[data-kind-panel]:not([hidden])')?.dataset.kindPanel||'batch';
   if(modes){modes.hidden=!['med','batch'].includes(active);modes.querySelector('[data-prescription-manual]').setAttribute('aria-pressed',String(active==='med'));if(active==='med')modes.querySelectorAll('[data-injection-mode]').forEach(x=>{if(x.getAttribute('aria-pressed')!=='false')x.setAttribute('aria-pressed','false');});else if(!modes.querySelector('[data-injection-mode][aria-pressed=true]')){const oral=!rx.hidden;modes.querySelector('[data-injection-mode="'+(oral?'oral':'injection')+'"]').setAttribute('aria-pressed','true');}}
   const batch=q('[data-kind=batch]');if(active==='med'&&batch.getAttribute('aria-pressed')!=='true')batch.setAttribute('aria-pressed','true');
   const mobile=q('[data-calc-jump]');if(mobile)mobile.value=active==='med'?'batch':active;
   const output=rx?.querySelector('output');if(output)rx.classList.toggle('pt-has-results',!!output.textContent.trim());
   const ward=rx?.querySelector('[data-ward-calculator-import]');if(ward){const hidden=rx.dataset.calculationState!=='complete';if(ward.hidden!==hidden)ward.hidden=hidden;}
   for(const f of all('.pt-flow-form')){const submit=f.querySelector('.pt-flow-result > button.pt-primary'),out=f.querySelector('output');if(submit)set(submit,out?.textContent.trim()?'다시 계산':'계산');}
  }
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(refresh);};
  const observer=new MutationObserver(schedule);observer.observe(b,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  b.addEventListener('practice-kind-selected',schedule);refresh();
  return {dispose(){disposed=true;clearTimeout(timer);cancelAnimationFrame(frame);observer.disconnect();b.removeEventListener('input',changed);b.removeEventListener('change',changed);b.removeEventListener('practice-kind-selected',schedule);}};
 }
 g.PracticeCalculatorOrganize={mount};
})(window);
