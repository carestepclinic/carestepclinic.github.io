/* Navigation and presentation only. Reuse the original calculation and review gates. */
(function(g){
 'use strict';
 function mount(b,o){
  const q=s=>b.querySelector(s),all=s=>[...b.querySelectorAll(s)];
  const nav=q('.pt-calc-menu'),main=q('.pt-calc-main'),toolbar=q('.pt-calc-view-tools');
  if(!nav||!main||!toolbar)return null;
  b.classList.add('pt-organized');
  const set=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const hide=(el,value)=>{if(el&&el.hidden!==value)el.hidden=value;};
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
  toolbar.querySelector(':scope > strong')?.remove();
  const view=q('.pt-view-options');set(view?.querySelector('summary'),'화면 설정');
  const more=document.createElement('details');more.className='pt-workspace-more';more.innerHTML='<summary>더보기</summary><div class="pt-workspace-options"></div>';toolbar.append(more);
  const options=more.querySelector('div');options.append(view,convert);if(settings)options.append(settings);
  q('.pt-calc-common').append(toolbar);
  queueMicrotask(()=>{const reset=q('.pt-reset-calculation');if(reset){reset.textContent='전체 초기화';toolbar.prepend(reset);}});

  // Prescription text/photo, injections and manual entry share the same destination.
  const modes=q('[aria-label="처방 계산 방식"]');
  if(modes){
   modes.classList.add('pt-prescription-modes');main.prepend(modes);
   for(const button of modes.querySelectorAll('[data-injection-mode]'))button.addEventListener('click',()=>o.selectKind('batch'),true);
   set(modes.querySelector('[data-injection-mode=oral]'),'경구 처방');
   set(modes.querySelector('[data-injection-mode=injection]'),'주사 처방');
   const manual=document.createElement('button');manual.type='button';manual.dataset.prescriptionManual='';manual.textContent='단일 약물 계산';manual.className='pt-single-drug-action';manual.onclick=()=>o.selectKind('med');modes.append(manual);
  }
  const med=q('[data-calc=dose]'),rx=q('[data-calc=batch]');
  set(med?.querySelector('h3'),'단일 약물 계산');set(rx?.querySelector('h3'),'경구 처방');
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
   const clear=rx.querySelector('[data-rx-clear]');clear.parentElement.classList.add('pt-rx-entry-actions');set(clear,'처방 지우기');clear.title='처방 입력만 지우기';tabs.append(clear);
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
  const knowledge=q('[data-library-knowledge]');if(knowledge&&settings)settings.append(knowledge);
  const referenceHome=q('.pt-drug-reference');if(referenceHome&&med)med.querySelector('.pt-flow-entry').append(referenceHome);
  const criHome=q('.pt-cri-reference');if(criHome)q('[data-kind-panel=cri]').append(criHome);
  const productApplied=()=>{const product=med?.querySelector('.pt-medication-products');if(product&&med.elements.concentration.value)product.open=false;};
  b.addEventListener('practice-product-applied',productApplied);
  // One product editor and a separate optional course. No implicit total course.
  if(med){
   const product=med.querySelector('.pt-medication-products'),fields=med.querySelector('[data-settings]');
   if(product&&fields){
    fields.classList.add('pt-product-fields');fields.open=true;product.append(fields);
    med.querySelector('.pt-quick-products')?.after(product);
    product.open=!med.elements.concentration.value;
   }
   const mode=med.elements.courseMode,course=document.createElement('details');
   course.className='pt-course-settings';course.innerHTML='<summary>전체 필요량 계산</summary>';
   med.querySelector('.pt-flow-entry').append(course);
   course.append(mode.closest('label'),med.querySelector('[data-days]'),med.querySelector('[data-total]'));
   course.addEventListener('toggle',()=>{if(course.open&&mode.value==='single'){mode.value='days';mode.dispatchEvent(new Event('change',{bubbles:true}));}});
   mode.addEventListener('change',()=>{course.open=mode.value!=='single';});
  }
  // Keep management controls in their form (native form.elements stays intact),
  // but expose them from the hospital settings hub, not the daily input sequence.
  const managed=[];
  if(settings)for(const control of all('[data-protocol-manage]')){
   control.classList.add('pt-managed-control');
   const form=control.closest('form'),link=document.createElement('button');link.type='button';
   link.textContent=(form.querySelector('h3')?.textContent||'계산')+' 서식 관리';settings.append(link);
   link.onclick=()=>{const panel=form.closest('[data-kind-panel]');if(panel)o.selectKind(panel.dataset.kindPanel);more.open=false;control.classList.add('pt-manage-open');control.open=true;control.scrollIntoView({block:'nearest'});};
   control.addEventListener('toggle',()=>{if(!control.open)control.classList.remove('pt-manage-open');});
   managed.push([control,link]);
  }
  // Schedule is one editable summary. Retain the exact parsed per-drug regimen.
  const regimen=document.createElement('details');regimen.className='pt-schedule-summary';regimen.innerHTML='<summary>일정 확인·변경</summary>';
  if(rx){const date=rx.querySelector('.pt-rx-date'),common=rx.querySelector('.pt-rx-common-settings');date.before(regimen);regimen.append(date,common);}
  const contextKey=()=>JSON.stringify([o.patientKey?.()||q('[data-patient-summary]')?.textContent,q('[data-ref-species]')?.value,q('[data-common-weight]')?.value]);
  let previous=null,previousKey='';
  const placeholder=document.createElement('section');placeholder.className='pt-result-placeholder';placeholder.setAttribute('role','status');
  rx?.querySelector('.pt-prescription-result').prepend(placeholder);
  const safety=rx?.querySelector('.pt-rx-safety');
  if(safety){
   rx.querySelector('output').after(safety);
   safety.querySelector(':scope > p.pt-help')?.remove();
   const library=safety.querySelector('.pt-private-safety');
   if(library){
    const manage=library.querySelector('[data-private-prepare]');
    if(manage&&settings){if(q('[data-library-knowledge]'))manage.remove();else settings.append(manage);}
    const originals=library.querySelector('[data-private-originals]');
    if(originals)set(originals.querySelector('summary'),'근거 원문·약물 연결');
   }
  }

  function capturePrevious(){
   const out=rx?.querySelector('output');if(rx?.dataset.calculationState!=='complete'||!out?.querySelector('.pt-rx-drug-summary'))return;
   previous=[...out.querySelectorAll('.pt-rx-drug-summary>summary')].map(x=>x.innerText);previousKey=contextKey();
  }
  const forget=()=>{previous=null;previousKey='';};
  b.addEventListener('practice-rx-invalidating',capturePrevious);b.addEventListener('practice-rx-reset',forget);
  function stableResult(){
   if(!rx)return;
   const out=rx.querySelector('output'),state=rx.dataset.calculationState,empty=!out.textContent.trim();
   if(previousKey!==contextKey())forget();
   hide(placeholder,!empty);
   const key=empty?JSON.stringify([state,!!rx.querySelector('[data-rx-text]').value.trim(),previous]):'';
   if(placeholder.dataset.contentKey!==key){placeholder.dataset.contentKey=key;placeholder.replaceChildren();if(empty){
    const title=document.createElement('p');title.textContent=state==='loading'||state==='pending'?'다시 계산 중 · 결과 사용 잠시 중지':'처방을 입력하면 이곳에 계산 결과가 표시됩니다.';placeholder.append(title);
    if(previous&&rx.querySelector('[data-rx-text]').value.trim()){title.textContent='입력 변경 · 이전 결과는 사용할 수 없습니다. 다시 계산 중…';const cards=document.createElement('div');cards.className='pt-previous-results';cards.inert=true;for(const value of previous){const card=document.createElement('div');card.textContent=value;cards.append(card);}placeholder.append(cards);}
   }}
   rx.querySelector('.pt-prescription-result').setAttribute('aria-busy',String(state==='pending'||state==='loading'));
  }
  function scheduleSummary(){
   if(!rx)return;const rows=o.rows?.()||[],date=rx.querySelector('[data-rx-start]').value;
   const schedules=[...new Set(rows.map(r=>[r.days? r.days+'일':'기간 미입력',String(r.intervalDays)==='2'?'격일(EOD)':r.times?'하루 '+r.times+'회':'횟수 미입력',r.timing||''].filter(Boolean).join(' · ')))];
   set(regimen.querySelector('summary'),(date?date+' 시작':'시작일 미입력')+' · '+(schedules.length===1?schedules[0]:schedules.length?'약물별 일정 '+schedules.length+'종':'용법은 처방에서 읽기')+' · 변경');
   if(rows.some(r=>!r.route||!r.times||!r.days)||!date){regimen.open=true;rx.querySelector('.pt-rx-common-settings').open=true;}
  }
  function compactCards(){
   for(const card of all('.pt-rx-drug-card:not([data-compact-card])')){
    card.dataset.compactCard='';const inline=card.querySelector('.pt-rx-inline-strength'),editor=inline?.querySelector('details');if(!editor)continue;
    editor.classList.add('pt-card-edit');set(editor.querySelector('summary'),'수정');
    const origin=inline.querySelector(':scope > p');if(origin)editor.append(origin);
    const editButtons=[...card.querySelectorAll('[data-rx-edit]')];for(const button of editButtons){button.textContent=editButtons.length>1?'단계 '+(editButtons.indexOf(button)+1)+' 용량·일정 변경':'용량·일정 변경';editor.querySelector('summary').after(button);button.classList.add('pt-inline-edit');}
    const details=card.querySelector('.pt-rx-drug-summary');if(details?.dataset.pending==='true'){details.open=false;editor.open=true;}
   }
  }
  function resultUse(){
   for(const f of all('form[data-calc]')){
    const actions=f.querySelector('[data-result-actions]');if(!actions)continue;
    let use=f.querySelector('.pt-result-use');if(!use){use=document.createElement('section');use.className='pt-result-use';use.setAttribute('aria-label','계산 결과 작업');actions.before(use);use.append(actions);}
    hide(use,actions.hidden);
    const print=actions.querySelector('[data-print]');let extra=use.querySelector('.pt-result-more');if(!extra){extra=document.createElement('details');extra.className='pt-result-more';extra.innerHTML='<summary>저장</summary>';use.append(extra);}if(print){extra.querySelector('[data-print]')?.remove();actions.append(print);}
    if(f===rx){const save=f.querySelector('.pt-flow-rx-save'),ward=f.querySelector('[data-ward-calculator-import]');
     if(extra&&save&&save.parentElement!==extra)extra.append(save);
     if(ward){const destination=use;if(ward.parentElement!==destination)destination.append(ward);}
     if(ward){set(ward,'입원 처치에 연결');ward.classList.toggle('pt-primary',o.destination?.()==='ward');ward.disabled=!actions.querySelector('[data-checked]')?.checked;}
    }
   }
   const injection=q('[data-injection-send]');if(injection&&!injection.closest('.pt-injection-use')){const use=document.createElement('section');use.className='pt-injection-use';use.setAttribute('aria-label','계산 결과 작업');injection.before(use);use.append(q('[data-injection-copy]'),injection);set(injection,'마취기록에 연결');injection.title='투약 대기로 등록';injection.classList.add('pt-primary');}
   if(injection)hide(injection.closest('.pt-injection-use'),injection.hidden&&q('[data-injection-copy]').hidden);
  }
  // Fold generic instructions, never errors, active warnings or clinical review controls.
  for(const f of all('.pt-flow-form')){
   const entry=f.querySelector('.pt-flow-entry');if(!entry)continue;
   const help=[...entry.children].filter(x=>x.matches('p.pt-help')&&!x.hasAttribute('role'));
   if(help.length){const d=document.createElement('details');d.className='pt-entry-help';d.innerHTML='<summary>입력 도움말</summary>';entry.append(d);d.append(...help);const sources=[...d.querySelectorAll('a[href]')];if(sources.length){const references=document.createElement('details');references.className='pt-entry-help';references.innerHTML='<summary>참고문헌</summary>';d.after(references);references.append(...sources);}}
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
   if(modes){hide(modes,!['med','batch'].includes(active));modes.querySelector('[data-prescription-manual]').setAttribute('aria-pressed',String(active==='med'));if(active==='med')modes.querySelectorAll('[data-injection-mode]').forEach(x=>{if(x.getAttribute('aria-pressed')!=='false')x.setAttribute('aria-pressed','false');});else if(!modes.querySelector('[data-injection-mode][aria-pressed=true]')){const oral=!rx.hidden;modes.querySelector('[data-injection-mode="'+(oral?'oral':'injection')+'"]').setAttribute('aria-pressed','true');}}
   const batch=q('[data-kind=batch]');if(active==='med'&&batch.getAttribute('aria-pressed')!=='true')batch.setAttribute('aria-pressed','true');
   const mobile=q('[data-calc-jump]');if(mobile)mobile.value=active==='med'?'batch':active;
   for(const [control,link] of managed)hide(link,control.hidden);
   const species=q('[data-ref-species]');if(species?.closest('label')?.firstChild?.nodeType===3)species.closest('label').firstChild.textContent='동물종';
   const product=med?.querySelector('.pt-medication-products');
   if(product){const v=med.elements,unit={tablet:'정',capsule:'캡슐',liquid:'mL'}[v.form.value];set(product.querySelector(':scope > summary'),v.concentration.value?({tablet:'정제',capsule:'캡슐',liquid:'액상'}[v.form.value]+' · '+v.concentration.value+' '+v.strengthUnit.value+'/'+unit+' · 변경'):'제품 함량 입력');}
   const course=med?.querySelector('.pt-course-settings');if(course){const mode=med.elements.courseMode.value;set(course.querySelector('summary'),mode==='single'?'전체 필요량 계산':mode==='total'?'전체 필요량 · 총 '+(med.elements.totalDoses.value||'—')+'회':'전체 필요량 · 하루 '+(med.elements.times.value||'—')+'회 × '+(med.elements.days.value||'—')+'일');if(mode!=='single'&&!course.open&&med.elements.days.required)course.dataset.active='true';else delete course.dataset.active;}
   const rxStatus=rx?.querySelector('[data-rx-status]');if(rxStatus)hide(rxStatus,rx.dataset.calculationState==='idle'&&!rx.querySelector('[data-rx-text]').value.trim()||rx.dataset.calculationState==='complete'&&rxStatus.textContent.startsWith('단계별 함량 연결:'));
   const output=rx?.querySelector('output');if(output)rx.classList.toggle('pt-has-results',!!output.textContent.trim());stableResult();scheduleSummary();compactCards();resultUse();
   const ward=rx?.querySelector('[data-ward-calculator-import]');if(ward){const hidden=rx.dataset.calculationState!=='complete';if(ward.hidden!==hidden)ward.hidden=hidden;}
   for(const f of all('.pt-flow-form')){const submit=f.querySelector('.pt-flow-result > button.pt-primary'),out=f.querySelector('output');if(submit&&autoKinds.has(f.dataset.calc)){const error=out?.classList.contains('pt-error')&&!!out.textContent.trim();hide(submit,!error);set(submit,'다시 계산');let state=f.querySelector('[data-auto-state]');if(!state){state=document.createElement('p');state.dataset.autoState='';state.className='pt-help';state.setAttribute('role','status');submit.before(state);}set(state,error?'입력값을 확인해주세요.':out?.textContent.trim()?'':'필수 입력 후 자동 계산됩니다.');hide(state,!state.textContent||!!f.querySelector('.pt-remaining button'));}}
   const retry=rx?.querySelector('[data-rx-parse]');if(retry){hide(retry,rx.dataset.calculationState!=='review');set(retry,'다시 계산');} const dock=q('[data-dock-calculate]');if(dock)dock.classList.add('pt-auto-dock');
  }
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(refresh);};
  const observer=new MutationObserver(schedule);observer.observe(b,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-calculation-state']});
  b.addEventListener('practice-kind-selected',schedule);b.addEventListener('change',schedule);refresh();
  return {dispose(){disposed=true;b.removeEventListener('practice-product-applied',productApplied);clearTimeout(timer);cancelAnimationFrame(frame);observer.disconnect();b.removeEventListener('input',changed);b.removeEventListener('change',changed);b.removeEventListener('change',schedule);b.removeEventListener('practice-kind-selected',schedule);b.removeEventListener('practice-rx-invalidating',capturePrevious);b.removeEventListener('practice-rx-reset',forget);}};
 }
 g.PracticeCalculatorOrganize={mount};
})(window);
