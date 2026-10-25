/* Reduce repeated entry. Persist identifiers only; never patient details or prescribing values. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 function mount(b,o){
  const med=b.querySelector('[data-calc=dose]'),species=b.querySelector('[data-ref-species]'),weight=b.querySelector('[data-common-weight]');
  if(!med||!weight)return null;
  let items=[],ready=false,record=null,selection=0;
  const storageKey='carestep-calculator-recent-v1:'+o.identity;let recent={products:[],protocols:[]};
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');for(const type of Object.keys(recent))if(Array.isArray(saved[type]))recent[type]=saved[type].filter(x=>typeof x==='string'&&/^[\w-]{1,200}$/.test(x)).slice(0,6);}catch{}
  function remember(type,id){recent[type]=[id,...recent[type].filter(x=>x!==id)].slice(0,6);try{localStorage.setItem(storageKey,JSON.stringify(recent));}catch{}renderProducts();renderProtocols();}
  function focus(field){for(let node=field?.parentElement;node&&node!==b;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;field?.focus();field?.scrollIntoView({block:'center',behavior:'smooth'});}
  const weightReview=document.createElement('label');weightReview.className='pt-choice pt-weight-review';weightReview.hidden=true;weightReview.innerHTML='<input type="checkbox" data-record-weight-confirm>표시된 측정일·체중을 확인했고, 이번 계산에 사용할 수 있습니다.';
  b.querySelector('[data-weight-status]').after(weightReview);const confirm=weightReview.querySelector('input');
  confirm.addEventListener('change',()=>{o.clear();refresh();});
  function usesWeight(f){return !['convert','dilute','ag'].includes(f.dataset.calc)&&!(f.dataset.calc==='fluid'&&f.elements.mode.value!=='weight');}
  function recordWeight(p){record=p&&Number.isFinite(Number(p.weight))&&Number(p.weight)>0?{weight:String(p.weight)}:null;weightReview.hidden=!record;confirm.checked=false;b.querySelector('[data-use-weight]').hidden=true;if(record){b.querySelectorAll('[name=weight]').forEach(x=>x.value=record.weight);o.weightUsed();}refresh();}
  function reset(){selection++;record=null;weightReview.hidden=true;confirm.checked=false;query.value='';status.textContent='';renderProducts();refresh();}
  function manualWeight(){record=null;weightReview.hidden=true;confirm.checked=false;refresh();}
  // Record weights are filled without another click, but only used after the measurement is reviewed.
  b.addEventListener('submit',e=>{const f=e.target.closest('form[data-calc]');if(!f||!usesWeight(f)||!record||confirm.checked)return;e.preventDefault();e.stopImmediatePropagation();o.clear();const out=f.querySelector('output');out.className='pt-error';out.textContent='상단의 기록 체중과 측정일을 확인해주세요.';focus(confirm);},true);
  species.addEventListener('change',()=>{selection++;confirm.checked=false;renderProducts();renderProtocols();refresh();});
  const productHost=document.createElement('section');productHost.className='pt-quick-products';productHost.innerHTML='<label>우리 병원 약품 빠른 입력<input type="search" data-quick-product-search autocomplete="off" placeholder="저장한 제품명·성분명·약칭"></label><p class="pt-help" data-quick-product-count></p><div data-quick-product-results></div><p data-quick-product-status role="status" aria-live="polite"></p>';
  med.querySelector('.pt-product-entry').prepend(productHost);const query=productHost.querySelector('input'),status=productHost.querySelector('[data-quick-product-status]'),results=productHost.querySelector('[data-quick-product-results]');
  query.addEventListener('input',()=>{selection++;status.textContent='';renderProducts();});
  query.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const buttons=results.querySelectorAll('button');if(buttons.length===1&&!buttons[0].disabled)buttons[0].click();else status.textContent='제품명·함량을 확인해 검색 결과에서 선택해주세요.';});
  med.elements.doseUnit.addEventListener('change',renderProducts);
  function renderProducts(){
   const all=items.filter(p=>p.body?.formulary),terms=normalize(query.value).split(' ').filter(Boolean),matches=terms.length?all.filter(p=>terms.every(q=>normalize([p.body.title,...(p.body.formulary.aliases||[])].join(' ')).includes(q))):recent.products.map(id=>all.find(p=>p.id===id)).filter(Boolean);
   productHost.querySelector('[data-quick-product-count]').textContent=!ready?'병원 약품을 불러오는 중…':terms.length?`검색 ${matches.length}개 · 최대 6개 표시`:`저장된 약품 ${all.length}개${matches.length?' · 최근 선택한 제품':' · 검색하면 저장된 제형·함량을 바로 불러옵니다.'}`;
   results.replaceChildren();for(const p of matches.slice(0,6)){const issue=o.productIssue(p),row=document.createElement('div');row.className='pt-quick-product';row.innerHTML=`<button type="button" data-quick-product="${esc(p.id)}" ${issue?'disabled':''}><b>${esc(p.body.title)}</b><small>${esc(p.body.value)} ${esc(p.body.unit)}/${({tablet:'정',capsule:'캡슐',liquid:'mL'})[p.body.kind]||''}${p.body.formulary.calculationBasis?' · '+esc(p.body.formulary.calculationBasis):''} · ${p.body.formulary.route==='oral'?'경구':p.body.formulary.route==='injection'?'주사':'경로 확인'}</small></button>${issue?'<p class="pt-help">'+esc(issue)+'</p>':''}`;
    row.querySelector('button').onclick=async e=>{const epoch=++selection,button=e.currentTarget;button.disabled=true;status.textContent='현재 저장된 함량을 확인하는 중…';try{await o.applyProduct(p,()=>epoch===selection);if(epoch!==selection)return;remember('products',p.id);status.textContent='저장된 제형·함량을 입력했습니다. 처방량·횟수·기간을 확인해주세요.';focus(!med.elements.dose.value?med.elements.dose:med.elements.courseMode.value==='total'?med.elements.totalDoses:med.elements.days);}catch(err){if(epoch===selection)status.textContent=err.message;}finally{if(epoch===selection){renderProducts();refresh();}}};results.append(row);}
   if(ready&&terms.length&&!matches.length)results.textContent='저장된 약품이 없습니다. 아래 ‘국내 제품·함량 찾기’에서 확인해주세요.';
  }
  const protocolHosts=[];for(const select of b.querySelectorAll('[data-protocol]')){const host=document.createElement('div');host.className='pt-recent-protocols';select.closest('label').after(host);protocolHosts.push({select,host});}
  function renderProtocols(){for(const {select,host} of protocolHosts){host.replaceChildren();const available=recent.protocols.map(id=>items.find(p=>p.id===id&&p.body.kind==='protocol'&&p.body.calculator===select.dataset.protocol&&p.body.species===species.value)).filter(Boolean);host.hidden=!available.length;if(!available.length)continue;const label=document.createElement('small');label.textContent='최근 선택한 병원 서식';host.append(label);for(const p of available){const button=document.createElement('button');button.type='button';button.dataset.recentProtocol=p.id;button.textContent=p.body.title;button.onclick=()=>{select.value=p.id;if(select.value===p.id)select.dispatchEvent(new Event('change',{bubbles:true}));else host.hidden=true;};host.append(button);}}}
  b.addEventListener('practice-protocol-applied',e=>{remember('protocols',e.detail.id);refresh();});
  b.addEventListener('practice-protocols-loaded',e=>{items=[...items.filter(p=>p.body.kind!=='protocol'),...e.detail.items.filter(p=>p.body.kind==='protocol')];renderProtocols();refresh();});
  // Keep daily frequency next to duration, including when advanced settings are closed.
  const daysGroup=med.querySelector('[data-days]');daysGroup.prepend(med.elements.times.closest('label'));
  const chips=[];
  function quick(field,values,label){if(!field)return;const host=document.createElement('div');host.className='pt-input-shortcuts';host.setAttribute('role','group');host.setAttribute('aria-label',label);field.after(host);for(const value of values){const button=document.createElement('button');button.type='button';button.dataset.quickValue=String(value);button.textContent=String(value)+(field.name==='times'||field.dataset.rxCommon==='times'?'회':'일');button.onclick=()=>{field.value=String(value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));refresh();};host.append(button);}chips.push({field,host});}
  quick(med.elements.times,[1,2,3,4],'하루 투여 횟수 선택');quick(med.elements.days,[3,5,7,14,28],'처방 일수 선택');
  quick(b.querySelector('[data-rx-common=times]'),[1,2,3,4],'공통 하루 투여 횟수 선택');quick(b.querySelector('[data-rx-common=days]'),[3,5,7,14,28],'공통 처방 일수 선택');
  const labels={dose:'1회 처방량',concentration:'제품 함량',times:'하루 횟수',days:'투약 일수',totalDoses:'총 투여 횟수',bsa:'체표면적',confirmed:'계산 조건 확인',protocolConfirmed:'서식 적용 확인',doseUnit:'처방 단위',stockUnit:'제품 단위'};
  const remaining=[];for(const f of b.querySelectorAll('form[data-calc]:not([data-calc=batch])')){const button=f.querySelector('button.pt-primary'),host=document.createElement('div');host.className='pt-remaining';host.dataset.remaining=f.dataset.calc;button.before(host);remaining.push({f,host,previous:null});}
  function refresh(){
   for(const {field,host} of chips)for(const button of host.children)button.setAttribute('aria-pressed',button.dataset.quickValue===field.value);
   for(const state of remaining){const {f,host}=state;const fields=[...f.querySelectorAll('input[required],select[name],textarea[required]')].filter(x=>!x.disabled&&x.type!=='hidden'&&!x.closest('[hidden]')&&(x.type==='checkbox'?!x.checked:!x.value.trim()));
    if(usesWeight(f)){if(!species.value)fields.unshift(species);if(!weight.value.trim())fields.unshift(weight);if(record&&!confirm.checked)fields.push(confirm);}
    if(state.previous&&fields.length===state.previous.length&&fields.every((x,i)=>x===state.previous[i]))continue;state.previous=fields;
    host.replaceChildren();const label=document.createElement('span');const checks=fields.filter(x=>x.type==='checkbox').length;label.textContent=fields.length?`남은 입력 ${fields.length-checks}개${checks?' · 확인 '+checks+'개':''}`:'필수 입력 완료 · 계산으로 결과 확인';host.append(label);
    for(const field of fields){const button=document.createElement('button');button.type='button';button.textContent=field===weight?'체중':field===species?'동물 종류':field===confirm?'기록 체중 확인':labels[field.name]||field.closest('label')?.childNodes[0]?.textContent?.trim()||field.name;button.onclick=()=>focus(field);host.append(button);}
   }
  }
  for(const event of ['input','change','click','reset'])b.addEventListener(event,()=>queueMicrotask(refresh));
  renderProducts();renderProtocols();refresh();
  const presentation=organize(b,o);
  return {dispose:presentation?.dispose,loaded(r){items=r.items||[];ready=true;renderProducts();renderProtocols();refresh();},failed(){items=[];ready=true;renderProducts();status.textContent='병원 약품을 불러오지 못했습니다. 다시 열거나 제품 값을 직접 입력해주세요.';},recordWeight,manualWeight,reset,weightStatus(){return record&&!confirm.checked?'상단의 기록 체중과 측정일을 확인해주세요.':'';}};
 }
 // Presentation changes reuse the existing inputs, validations and submit handlers.
 function organize(b,o){
  const med=b.querySelector('[data-calc=dose]'),common=b.querySelector('.pt-calc-common'),nav=b.querySelector('.pt-calc-nav');
  if(!med||!common||!nav)return null;
  b.classList.add('pt-calculator-focused');
  const toolbar=document.createElement('section');toolbar.className='pt-calc-view-tools';toolbar.innerHTML='<strong>임상 계산기</strong><div><button type="button" data-calc-nav-toggle aria-expanded="true">계산기 메뉴 접기</button><button type="button" data-calc-expand aria-pressed="false">계산기 넓게 보기</button></div>';b.prepend(toolbar);
  const collapse=toolbar.querySelector('[data-calc-nav-toggle]'),expand=toolbar.querySelector('[data-calc-expand]');
  collapse.onclick=()=>{const hidden=b.classList.toggle('pt-nav-collapsed');collapse.setAttribute('aria-expanded',String(!hidden));collapse.textContent=hidden?'계산기 메뉴 펼치기':'계산기 메뉴 접기';};
  function expanded(value){b.classList.toggle('pt-calculator-expanded',value);expand.setAttribute('aria-pressed',String(value));expand.textContent=value?'기본 화면으로':'계산기 넓게 보기';}
  expand.onclick=()=>expanded(!b.classList.contains('pt-calculator-expanded'));
  b.addEventListener('keydown',e=>{if(e.key==='Escape'&&b.classList.contains('pt-calculator-expanded')&&!document.querySelector('dialog[open]')){expanded(false);expand.focus();}});
  const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const setFlag=(el,key,value)=>{if(el[key]!==value)el[key]=value;};
  const species=b.querySelector('[data-ref-species]'),weight=b.querySelector('[data-common-weight]');
  const patient=b.querySelector('[data-patient-summary]'),unlink=b.querySelector('[data-manual]');
  common.classList.add('pt-compact-context');
  const intro=b.querySelector(':scope > .pt-notice');
  if(intro){const help=document.createElement('details');help.className='pt-calculator-help';help.innerHTML='<summary>계산기 사용 안내</summary>';help.append(intro);b.append(help);}

  const products=med.querySelector('.pt-product-entry'),quick=products.querySelector('.pt-quick-products');
  products.classList.add('pt-drug-hub');
  setText(quick.querySelector('label').firstChild,'약물 찾기 · 병원 약품 우선');
  const management=document.createElement('details');management.className='pt-drug-management';management.dataset.drugManagement='';management.innerHTML='<summary class="pt-summary">약품·기본 함량 관리</summary><p class="pt-help">병원 약품은 제품별로, 기본 함량은 성분별로 저장합니다. 참고 용법과 제품 함량을 구분해 확인하세요.</p><div class="pt-bar"></div>';
  for(const button of products.querySelectorAll(':scope > button'))management.querySelector('.pt-bar').append(button);
  products.append(management);
  const legacy=b.querySelector('[data-legacy-presets]');if(legacy)management.append(legacy);
  const reference=b.querySelector('[data-reference-picker=med]');if(reference)management.append(reference);
  const library=b.querySelector('.pt-library'),libraryHome=document.createElement('div');libraryHome.className='pt-drug-reference';products.append(libraryHome);
  const criHome=document.createElement('section');criHome.className='pt-cri-reference';b.querySelector('[data-kind-panel=cri]')?.prepend(criHome);
  if(library)libraryHome.append(library);
  const paste=med.querySelector('.pt-rx-entry');if(paste){paste.classList.remove('pt-primary');paste.classList.add('pt-secondary-entry');med.append(paste);}

  for(const form of b.querySelectorAll('form[data-calc]:not([data-calc=batch])')){
   // Put reusable setup after the daily inputs. Empty setup summaries are hidden by Simple.
   const bar=form.querySelector('.pt-protocol-bar'),settings=form.querySelector('[data-settings]');
   if(bar&&settings)settings.before(bar);
   const summary=form.querySelector('.pt-setting-summary');if(summary&&bar)bar.after(summary);
   const explanation=[...form.children].filter(x=>x.matches('p.pt-help')&&x.textContent.length>140);
   if(explanation.length){const help=document.createElement('details');help.className='pt-field-help';help.innerHTML='<summary>입력 단위·계산 시 확인사항</summary>';for(const p of explanation)help.append(p);form.querySelector('button.pt-primary')?.before(help);}
   form.querySelector('output')?.setAttribute('tabindex','-1');
  }

  const dock=document.createElement('section');dock.className='pt-calc-dock';dock.setAttribute('aria-label','현재 환자와 계산 작업');dock.innerHTML='<button type="button" data-dock-context></button><div><button type="button" data-dock-calculate class="pt-primary">계산</button><button type="button" data-dock-result disabled>결과 보기</button></div>';
  b.append(dock);
  const context=dock.querySelector('[data-dock-context]'),calculate=dock.querySelector('[data-dock-calculate]'),result=dock.querySelector('[data-dock-result]');
  let focusedForm=null,disposed=false,frame=0,maxHeight=window.visualViewport?.height||innerHeight;
  const activePanel=()=>b.querySelector('[data-kind-panel]:not([hidden])');
  const visible=f=>f&&f.isConnected&&!f.closest('[hidden]')&&f.getClientRects().length>0;
  function activeForm(){const panel=activePanel();return visible(focusedForm)&&panel?.contains(focusedForm)?focusedForm:[...(panel?.querySelectorAll('form[data-calc]')||[])].find(visible);}
  function reveal(el){if(!el)return;for(let n=el.parentElement;n&&n!==b;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});el.focus({preventScroll:true});}
  context.onclick=()=>reveal(weight);
  calculate.onclick=()=>{const form=activeForm(),submit=form&&[...form.querySelectorAll('button')].find(x=>x.type==='submit');if(!form||submit?.disabled)return;form.requestSubmit(submit);};
  result.onclick=()=>reveal(activeForm()?.querySelector('output'));

  function decorateResults(){
   for(const out of b.querySelectorAll('output.pt-output:not(.pt-error)')){
    const highlights=[...out.children].filter(x=>x.matches('span.pt-calc-highlight'));
    if(!highlights.length)continue;
    const grid=document.createElement('div');grid.className='pt-result-key-grid';
    for(const span of highlights){span.classList.add('pt-result-key');grid.append(span);}
    const details=document.createElement('details');details.className='pt-result-details';details.innerHTML='<summary>계산 과정·입력값 확인</summary>';
    const notes=document.createElement('div');notes.className='pt-result-notes';
    for(const node of [...out.childNodes])if(/주의|금지|초과|적합함|모니터링|확인하세요|별도 확인|희석액을|처방 확인:|펌프 최소|펌프의/.test(node.textContent))notes.append(node);
    const content=document.createElement('div');content.className='pt-pre';content.append(...out.childNodes);details.append(content);out.append(grid);if(notes.childNodes.length)out.append(notes);out.append(details);
   }
  }
  function refreshLayout(){
   frame=0;if(disposed)return;if(!b.isConnected||o.alive&&!o.alive()){dispose();return;}
   const kind=activePanel()?.dataset.kindPanel;
   if(library){const parent=kind==='cri'?criHome:libraryHome;if(library.parentElement!==parent)parent.append(library);setFlag(library,'hidden',!['med','cri'].includes(kind));}
   if(unlink)setFlag(unlink,'hidden',!patient.textContent||patient.textContent.startsWith('환자 미연결'));
   const animal=species.value==='dog'?'개':species.value==='cat'?'고양이':'동물 미선택';
   const record=b.querySelector('[data-weight-status]')?.textContent||'';
   const checked=b.querySelector('[data-record-weight-confirm]');
   const needsReview=checked&&!checked.closest('[hidden]')&&!checked.checked;
   setText(context,`${patient.textContent||'환자 미연결'} · ${animal} · ${weight.value?weight.value+' kg':'체중 미입력'}${needsReview?' · 기록 체중 확인 필요':''}`);
   context.title=record;
   const height=window.visualViewport?.height||innerHeight;maxHeight=Math.max(maxHeight,height);
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
   setFlag(dock,'hidden',!b.offsetWidth||!!document.querySelector('dialog[open]')||typing&&maxHeight-height>160);
   decorateResults();
   const form=activeForm(),out=form?.querySelector('output'),submit=form&&[...form.querySelectorAll('button')].find(x=>x.type==='submit');
   setFlag(calculate,'disabled',!form||!!submit?.disabled);setFlag(calculate,'hidden',form?.dataset.calc==='batch');setText(calculate,'계산');
   const batch=b.querySelector('[data-calc=batch]'),primary=batch?.querySelector('[data-rx-parse]');
   if(primary){const state=batch.dataset.calculationState;setText(primary,state==='loading'?'계산 중…':state==='complete'?'다시 계산':'처방 계산');setFlag(primary,'disabled',state==='loading');batch.setAttribute('aria-busy',String(state==='loading'));}
   setFlag(result,'disabled',!out?.textContent.trim());
  }
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(refreshLayout);}
  const controller=new AbortController(),listen=(target,event,fn)=>target?.addEventListener(event,fn,{signal:controller.signal});
  listen(b,'focusin',e=>{focusedForm=e.target.closest('form[data-calc]')||focusedForm;schedule();});
  for(const event of ['input','change','click','reset'])listen(b,event,schedule);
  for(const event of ['resize','scroll','click'])listen(window,event,schedule);
  listen(window.visualViewport,'resize',schedule);
  listen(library,'keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT')e.preventDefault();});
  const observer=new MutationObserver(schedule);observer.observe(b,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','aria-pressed','data-calculation-state']});
  function dispose(){if(disposed)return;disposed=true;b.classList.remove('pt-calculator-expanded','pt-nav-collapsed');observer.disconnect();controller.abort();if(frame)cancelAnimationFrame(frame);dock.remove();}
  refreshLayout();return {dispose};
 }
 g.PracticeCalculatorEase={mount};
})(window);
