/* HQ presentation and review flow. All writes continue through the existing APIs. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const regions=new Map(),sequences=new Map(),editors=new Map(),viewPositions=new Map();
  const stateKey='carestep_hq_ui_v20261020';
  let currentView='dashboard',billingPane='subscriptions',restoring=false,reviewOpen=false;
  let activeSave=null,quickSequence=0,clinicListSequence=0,clinicDetailSequence=0;
  const clinicPanes=new Map();
  let clinicFocusRequested='';
  const filterIds=['clinicSearch','clinicStatus','clinicApproval','journeySearch','journeyScope','journeyStatusFilter','billingMonth','hqSubscriptionSearch','crmHqPeriod','voiceType','voiceStatus','contentSearch','contentStatus','contentCategory','contentDueOnly'];
  const safeNumber=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
  const won=n=>safeNumber(n)?`${Number(n).toLocaleString('ko-KR')}원`:'금액 확인 필요';
  const latest=key=>{const n=(sequences.get(key)||0)+1;sequences.set(key,n);return ()=>sequences.get(key)===n;};
  const changes=(before,after)=>after.filter(x=>!before.some(y=>y.key===x.key&&y.value===x.value)).map(x=>({...x,before:before.find(y=>y.key===x.key)?.value??''}));
  function priceText(plan,net) {
    if(plan==='PILOT')return {detail:'PRO 기능 30일 무료체험',total:'무료체험 · 0원'};
    if(!safeNumber(net))return {detail:'요금 정보를 확인해주세요.',total:'금액 확인 필요'};
    const supply=Number(net),tax=Math.round(supply*.1);
    return plan==='ENTERPRISE'
      ? {detail:`월 기준 공급가 ${won(supply)} · 부가세 별도`,total:'최종 결제금액은 개별 계약에 따릅니다.'}
      : {detail:`월 공급가 ${won(supply)} + 부가세 ${won(tax)}`,total:`월 결제 총액 ${won(supply+tax)}`};
  }
  function saveState() {
    const filters=Object.fromEntries(filterIds.filter(id=>byId(id)).map(id=>[id,byId(id).type==='checkbox'?byId(id).checked:byId(id).value]));
    try{sessionStorage.setItem(stateKey,JSON.stringify({view:currentView,pane:billingPane,clinic:selectedClinic,filters}));}catch{}
  }
  function loadState() {try{return JSON.parse(sessionStorage.getItem(stateKey)||'{}');}catch{return {};}}
  function route(hash) {
    const [view,pane]=String(hash||'').replace(/^#/,'').split('/');
    return {view:byId(view)?.classList.contains('view')?view:'dashboard',pane:['subscriptions','plans','payments'].includes(pane)?pane:'subscriptions'};
  }
  function writeRoute(replace=false) {
    const hash='#'+currentView+(currentView==='billing'?'/'+billingPane:'');
    if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);
    saveState();
  }
  function snapshot(editor) {
    return editor.fields.map((el,index)=>({key:el.id||el.dataset.feature||el.className||String(index),
      label:el.dataset.hqLabel||[...(el.closest('label')?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||el.getAttribute('aria-label')||el.placeholder||el.id||'설정',
      value:el.type==='checkbox'?!!el.checked:el.value}));
  }
  function dirty(editor){return editor.editing&&changes(editor.baseline,snapshot(editor)).length>0;}
  function hasDirty(){return [...editors.values()].some(dirty);}
  function allowLeave(){
    if(activeSave){toast('저장 결과를 확인하고 있습니다. 잠시 기다려주세요.');return false;}
    if(reviewOpen)return false;
    if(!hasDirty())return true;
    if(!confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 취소하고 이동할까요?'))return false;
    for(const e of editors.values())if(e.editing)cancelEdit(e);
    return true;
  }
  function formatted(value,field) {
    if(typeof value==='boolean')return value?'사용':'사용 안 함';
    if(field?.tagName==='SELECT')return [...field.options].find(x=>x.value===value)?.textContent||value||'미설정';
    if(value==='')return '미설정';
    if(field?.type==='number'&&safeNumber(value)){
      if(field.id==='subMessagesOverride')return Number(value)<0?'기존 플랜 기준':Number(value)===0?'기존 계약상 제한 없음':Number(value).toLocaleString('ko-KR')+'건';
      if(field.id==='subPrice'&&Number(value)===0)return '별도 금액 미설정 · 계약 기본가격 적용';
      if(field.id==='subMessagingOveragePrice'&&Number(value)===0)return '계약 기본단가 적용';
      if(field.matches('.monthly,.annual,.founding,.credit')||field.id.startsWith('rate')||['subPrice','subMessagingOveragePrice','subExtraMessageBudget'].includes(field.id))return won(value);
      if(field.matches('.members,.packages'))return Number(value)===0?'계약상 제한 없음':Number(value).toLocaleString('ko-KR')+(field.matches('.members')?'명':'건');
    }
    return String(value);
  }
  function updateEditor(editor){
    const changed=dirty(editor);
    editor.root.dataset.editing=String(editor.editing);
    if(editor.key==='subscription'&&editor.editing){const details=editor.root.querySelector('.hq-contract-settings');if(details)details.open=true;}
    editor.state.textContent=changed?'저장하지 않은 변경사항 있음':editor.editing?'수정 중':'현재 저장된 설정';
    editor.state.classList.toggle('dirty',changed);
    editor.edit.hidden=editor.editing;editor.cancel.hidden=!editor.editing;editor.save.hidden=!editor.editing;
    editor.edit.disabled=!!activeSave;editor.cancel.disabled=!!activeSave;
    editor.fields.forEach((el,index)=>{
      let locked=editor.locked[index];
      if(editor.key==='subscription'){
        if(['subCycle','subPrice'].includes(el.id))locked=!!byId('subFounding')?.checked;
        if(el.id==='subExtraMessageBudget')locked=byId('subPlan')?.value==='PILOT';
      }
      el.disabled=!!activeSave||!editor.editing||locked;
      if(el.type!=='checkbox'){
        let out=el.nextElementSibling;
        if(!out?.classList.contains('hq-read-value')){out=document.createElement('output');out.className='hq-read-value';el.after(out);}
        out.textContent=formatted(el.type==='checkbox'?el.checked:el.value,el);
      }
    });
    editor.save.disabled=!changed||!!activeSave;
    if(editor.root.matches('.plan-card'))updatePlanPrice(editor.root);
  }
  function cancelEdit(editor){
    editor.fields.forEach((el,i)=>{if(el.type==='checkbox')el.checked=editor.baseline[i].value;else el.value=editor.baseline[i].value;});
    editor.editing=false;updateEditor(editor);
  }
  function registerEditor(key,root,fields,save,title,effect){
    if(!root||!save||!fields.length)return;
    const old=editors.get(key);if(old?.root===root)return old;
    const toolbar=document.createElement('div');toolbar.className='hq-editor-toolbar';
    const state=document.createElement('span');state.className='hq-edit-state';state.setAttribute('aria-live','polite');
    const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='수정';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='수정 취소';
    toolbar.append(state,edit,cancel);root.prepend(toolbar);root.classList.add('hq-editor');
    const editor={key,root,fields,save,title,effect,state,edit,cancel,editing:false,locked:fields.map(x=>x.disabled)};
    editor.baseline=snapshot(editor);editors.set(key,editor);
    edit.onclick=()=>{
      if(activeSave||!allowLeave())return;
      for(const other of editors.values())if(other!==editor&&other.editing)cancelEdit(other);
      editor.editing=true;updateEditor(editor);fields.find(x=>!x.disabled)?.focus();
    };
    cancel.onclick=()=>cancelEdit(editor);
    fields.forEach(x=>{x.addEventListener('input',()=>updateEditor(editor));x.addEventListener('change',()=>updateEditor(editor));});
    save.textContent='변경 내용 확인';updateEditor(editor);return editor;
  }
  function review(editor){
    const diff=changes(editor.baseline,snapshot(editor));if(!diff.length)return Promise.resolve(false);
    return new Promise(resolve=>{
      reviewOpen=true;
      const dialog=document.createElement('dialog');dialog.className='hq-review';dialog.setAttribute('aria-labelledby','hqReviewTitle');
      dialog.innerHTML=`<h2 id="hqReviewTitle">${esc(editor.title)}</h2><p>${esc(editor.effect)}</p><table class="hq-review-table"><thead><tr><th>항목</th><th>변경 전</th><th>변경 후</th></tr></thead><tbody>${diff.map(x=>{const field=editor.fields.find((_,i)=>editor.baseline[i]?.key===x.key);return `<tr><th>${esc(x.label)}</th><td>${esc(formatted(x.before,field))}</td><td>${esc(formatted(x.value,field))}</td></tr>`;}).join('')}</tbody></table><div class="hq-review-actions"><button type="button" class="btn" data-review-cancel>돌아가서 수정</button><button type="button" class="btn primary" data-review-save>확인 후 저장</button></div>`;
      const finish=value=>{reviewOpen=false;dialog.close();dialog.remove();resolve(value);};
      dialog.querySelector('[data-review-cancel]').onclick=()=>finish(false);
      dialog.querySelector('[data-review-save]').onclick=()=>finish(true);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-review-cancel]').focus();
    });
  }
  async function reviewedSave(key,save){
    const editor=editors.get(key);
    if(!editor||!editor.editing||activeSave||reviewOpen)return false;
    if(editor.fields.some(x=>x.type==='number'&&!x.disabled&&!x.checkValidity())){editor.fields.find(x=>x.type==='number'&&!x.disabled&&!x.checkValidity()).reportValidity();return false;}
    if(!await review(editor))return false;
    activeSave=key;for(const e of editors.values())if(e.root.isConnected)updateEditor(e);
    try{
      const saved=await save();
      if(saved===true){editor.baseline=snapshot(editor);editor.editing=false;}
      return saved;
    }finally{activeSave=null;for(const e of editors.values())if(e.root.isConnected)updateEditor(e);}
  }
  function updatePlanPrice(card){
    const box=card.querySelector('.hq-price-summary');if(!box)return;
    const p=priceText(card.dataset.plan,card.querySelector('.monthly')?.value);
    box.innerHTML=`${esc(p.detail)}<strong>${esc(p.total)}</strong>`;
  }
  function enhancePlans(){
    for(const [key,e] of editors)if(key.startsWith('plan:')&&!e.root.isConnected)editors.delete(key);
    document.querySelectorAll('#planGrid .plan-card').forEach(card=>{
      registerEditor('plan:'+card.dataset.plan,card,[...card.querySelectorAll('input')],card.querySelector('.save-plan'),
        `${card.dataset.plan} 공통 요금제 변경`,'저장 후 신규 계약과 명시적인 플랜 변경에 적용됩니다. 기존 계약 가격·할인·제공량은 유지됩니다.');
    });
  }
  const subscriptionLabels={subPlan:'플랜',subStatus:'구독 상태',subCycle:'결제주기',subPrice:'별도 계약금액 · 부가세 포함',subFounding:'초기 가입 가격보장',subPeriodStart:'사용 시작일',subPeriodEnd:'사용 종료일',subTrialEnd:'체험 종료일',subNote:'구독 메모',subMessagesOverride:'기존 계약 문자 제공량',subMessagingOverage:'초과 사용 허용',subMessagingOveragePrice:'기존 계약 초과요금',subExtraMessageBudget:'중앙계정 월 추가 문자 예산'};
  function enhanceClinic(){
    const root=byId('clinicDetail');if(!root)return;
    const fields=Object.keys(subscriptionLabels).map(byId).filter(Boolean);fields.forEach(x=>{
      x.dataset.hqLabel=subscriptionLabels[x.id];
      if(!x.closest('label')){const label=document.createElement('label');label.className=x.classList.contains('wide')?'wide':'';label.textContent=subscriptionLabels[x.id];x.before(label);label.append(x);}
    });
    // Only subscription controls participate; other hospital tasks remain separate.
    let section=root.querySelector('.hq-subscription-editor');
    if(!section){
      section=document.createElement('div');section.className='hq-subscription-editor';
      const form=byId('subPlan')?.closest('.form-grid');if(!form)return;
      form.before(section);section.append(form);
      const save=byId('saveSub');if(save)section.append(save);
      const extra=byId('subExtraMessageBudget');if(extra)section.append(extra.closest('.notice'));
    }
    editors.delete('subscription');
    registerEditor('subscription',section,fields,byId('saveSub'),`${root.querySelector('h2')?.textContent||'선택 병원'} 구독 변경`,
      '이 병원의 구독 설정에 저장 즉시 반영됩니다. 결제주기·가격·기간을 확인해주세요. 구독을 중지하거나 해지하면 병원 세션과 유료 기능이 제한됩니다.');
    const features=root.querySelector('.entitlement');
    if(features){const details=document.createElement('details');details.className='hq-feature-details';const summary=document.createElement('summary');summary.textContent='현재 계약의 포함 기능 보기';features.before(details);details.append(summary,features);}
    const comparison=root.querySelector('.hq-contract-summary');
    if(comparison){const common=comparison.children[1],note=comparison.querySelector('p'),details=document.createElement('details'),summary=document.createElement('summary');details.className='hq-catalog-comparison';summary.textContent='최신 공통 요금제와 비교';details.append(summary,common);if(note)details.append(note);comparison.append(details);}
    const settings=document.createElement('details');settings.className='hq-contract-settings';
    const summary=document.createElement('summary');summary.textContent='계약 설정 상세 · 기간·가격보장·메모';settings.append(summary);
    for(const node of [...section.children])if(!node.classList.contains('hq-editor-toolbar'))settings.append(node);
    const note=comparison?.nextElementSibling;if(note?.classList.contains('sub'))settings.append(note);section.append(settings);
    organizeClinicDetail(root);
  }
  function organizeClinicDetail(root){
    if(root.querySelector('.hq-detail-tabs'))return;
    const hospital=selectedClinic,title=root.querySelector('.detail-title');
    if(!title)return;
    const heading=title.querySelector('h2');heading.tabIndex=-1;
    const back=document.createElement('button');back.className='btn hq-back-to-list';back.type='button';back.textContent='병원 목록으로';
    back.onclick=()=>{byId('clinicSearch').focus({preventScroll:true});byId('clinicSearch').scrollIntoView({block:'center'});};title.prepend(back);
    const definitions=[['subscription','구독·이용현황'],['operation','승인·운영'],['connection','연동'],['members','직원'],['content','콘텐츠'],['errors','오류']];
    const sections=new Map(definitions.map(([key,label])=>{
      const panel=document.createElement('section');panel.className='hq-detail-pane';panel.id='hqClinicPane-'+key;
      panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','hqClinicTab-'+key);
      return [key,panel];
    }));
    let current='subscription';
    for(const node of [...root.children]){
      if(node===title)continue;
      if(node.matches('h2')){
        const text=node.textContent;
        current=text.includes('연동')?'connection':text==='직원'?'members':text.includes('중앙 콘텐츠')?'content':text.includes('최근 오류')?'errors':'subscription';
      }
      if(node.matches('.approval-card')||node.querySelector('#saveClinic'))sections.get('operation').append(node);
      else sections.get(current).append(node);
    }
    const tabs=document.createElement('div');tabs.className='hq-tabs hq-detail-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','병원 상세 항목');
    function select(key,check=true){
      if(check&&!allowLeave())return false;
      clinicPanes.set(hospital,key);
      for(const [k,panel] of sections)panel.hidden=k!==key;
      tabs.querySelectorAll('button').forEach(b=>{const on=b.dataset.pane===key;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
      return true;
    }
    for(const [key,label] of definitions){
      const b=document.createElement('button');b.type='button';b.className='btn';b.id='hqClinicTab-'+key;b.dataset.pane=key;b.textContent=label;
      b.setAttribute('role','tab');b.setAttribute('aria-controls',sections.get(key).id);b.onclick=()=>select(key);
      tabs.append(b);
    }
    tabs.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const buttons=[...tabs.querySelectorAll('button')],at=buttons.indexOf(document.activeElement);if(at<0)return;
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(at+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      event.preventDefault();if(select(buttons[next].dataset.pane))buttons[next].focus();
    };
    root.append(tabs,...sections.values());select(clinicPanes.get(hospital)||'subscription',false);
    if(clinicFocusRequested===hospital){
      clinicFocusRequested='';heading.focus({preventScroll:true});
      if(matchMedia('(max-width:900px)').matches)root.scrollIntoView({block:'start'});
    }
  }
  function setRegion(id,state,{error='',retry=null}={}){
    const target=byId(id);if(!target)return;
    let record=regions.get(id);
    if(!record||!record.box.isConnected){const box=document.createElement('div');box.className='hq-load-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');if(target.matches('.view')&&target.querySelector('.head'))target.querySelector('.head').append(box);else if(target.matches('.view,#hqRateEditor'))target.prepend(box);else target.before(box);record={box,at:record?.at||null};regions.set(id,record);}
    if(state==='ready')record.at=new Date();
    record.box.dataset.state=state;target.setAttribute('aria-busy',String(state==='loading'));
    record.box.replaceChildren();
    const label=document.createElement('span');
    const checked=record.at?record.at.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
    label.textContent=state==='loading'?'불러오는 중…':state==='error'?`조회하지 못했습니다. ${error||'잠시 후 다시 시도해주세요.'}${checked?' · 마지막 확인 '+checked+' (이전 결과)':''}`:`마지막 확인 ${checked}`;
    record.box.append(label);
    if(state==='error'&&retry){const button=document.createElement('button');button.type='button';button.className='btn small';button.textContent='다시 시도';button.onclick=()=>retry();record.box.append(button);}
  }
  async function region(id,fetchData,commit,retry){
    const isLatest=latest(id);setRegion(id,'loading');
    try{const data=await fetchData();if(!isLatest())return;commit(data);setRegion(id,'ready');return true;}
    catch(error){if(!isLatest())return;setRegion(id,'error',{error:error.message,retry});return false;}
  }
  function billingLayout(){
    const container=byId('billing');if(!container||byId('hqBillingTabs'))return;
    const tabs=document.createElement('div');tabs.id='hqBillingTabs';tabs.className='hq-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','구독 관리 업무');
    const panes={subscriptions:byId('subscriptionTable')?.closest('.card'),plans:byId('hqPolicyPane'),payments:container.querySelector('.hq-payment-card')};
    const labels={subscriptions:'병원별 구독',plans:'공통 요금제',payments:'결제내역'};
    for(const [key,pane] of Object.entries(panes)){
      if(!pane)continue;pane.id=key==='plans'?'hqPolicyPane':'hqBilling'+key;pane.setAttribute('role','tabpanel');
      const b=document.createElement('button');b.className='btn';b.type='button';b.id='hqTab'+key;b.textContent=labels[key];b.dataset.billingPane=key;b.setAttribute('role','tab');b.setAttribute('aria-controls',pane.id);pane.setAttribute('aria-labelledby',b.id);b.onclick=()=>setBillingPane(key);tabs.append(b);
    }
    container.querySelector('.head').after(tabs);
    const input=document.createElement('input');input.id='hqSubscriptionSearch';input.type='search';input.className='input hq-subscription-search';input.placeholder='병원명 검색';input.setAttribute('aria-label','구독 병원 검색');byId('subscriptionTable').before(input);
    input.oninput=()=>{filterSubscriptions();saveState();};
    setBillingPane(billingPane,{push:false,check:false});
  }
  function filterSubscriptions(){
    const q=(byId('hqSubscriptionSearch')?.value||'').trim().toLowerCase();
    document.querySelectorAll('#subscriptionTable tbody .hq-compact-main-row').forEach(row=>{
      row.hidden=!!q&&!row.cells[0]?.textContent.toLowerCase().includes(q);
      row.nextElementSibling.hidden=row.hidden||row.querySelector('.hq-row-toggle').getAttribute('aria-expanded')!=='true';
    });
  }
  function setBillingPane(pane,{push=true,check=true}={}){
    if(check&&!allowLeave())return false;
    billingPane=['subscriptions','plans','payments'].includes(pane)?pane:'subscriptions';
    const ids={subscriptions:'hqBillingsubscriptions',plans:'hqPolicyPane',payments:'hqBillingpayments'};
    for(const [key,id] of Object.entries(ids))if(byId(id))byId(id).hidden=key!==billingPane;
    document.querySelectorAll('[data-billing-pane]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.billingPane===billingPane)));
    if(push)writeRoute();return true;
  }
  function viewLoader(view){
    return ({dashboard:loadOverview,approval:loadApproval,clinics:loadClinics,onboarding:loadOnboardingPortfolio,customerSuccess:loadCustomerSuccess,billing:loadBilling,usageBilling:loadUsageBilling,
      integrations:()=>Promise.all([loadCalendarIntegration(),loadMessagingIntegration()]),senders:()=>Promise.all([loadSenderOnboarding(),loadMessagingIntegration()]),
      journeys:loadPatientJourneysHQ,surveys:loadGuardianSurveyHQ,crm:loadFollowupCrmHQ,content:loadContent,voice:loadVoice,production:loadProductionLaunch,audit:loadAudit})[view];
  }
  async function reloadView(view=currentView){
    if(!allowLeave())return;
    const loader=viewLoader(view);if(!loader)return;
    if(['billing','usageBilling','clinics','onboarding','crm','voice','content'].includes(view)){await loader();return;}
    await region(view,loader,()=>{},()=>reloadView(view));
  }
  function navigate(view,{push=true,check=true}={}){
    const target=byId(view);if(!target?.classList.contains('view')){toast('현재 제공되지 않는 화면입니다.');return false;}
    if(check&&!allowLeave())return false;
    viewPositions.set(currentView,window.scrollY||0);
    currentView=view;
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===target));
    document.querySelectorAll('#nav [data-view]').forEach(x=>{
      x.classList.toggle('active',x.dataset.view===view);
      if(x.dataset.view===view)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');
    });
    document.title=`${target.querySelector('h1')?.textContent||'관리'} · CARESTEP HQ`;
    byId('hqCurrentView').textContent=target.querySelector('h1')?.textContent||'운영 관리';
    if(closeCompactMenu()){const heading=target.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
    byId('refresh').title=byId('hqCurrentView').textContent+' 새로고침';
    syncHqNavForView(view);if(view==='billing')setBillingPane(billingPane,{push:false,check:false});
    if(push)writeRoute();saveState();
    window.scrollTo({top:viewPositions.get(view)||0,behavior:'instant'});
    reloadView(view);return true;
  }
  function restoreRoute(){
    const saved=loadState(),parsed=route(location.hash||('#'+(saved.view||'dashboard')+(saved.view==='billing'?'/'+(saved.pane||'subscriptions'):'')));
    for(const id of filterIds){
      const el=byId(id),value=saved.filters?.[id];if(!el)continue;
      if(el.type==='checkbox'&&typeof value==='boolean')el.checked=value;
      else if(typeof value==='string'){if(id==='contentCategory')el.dataset.restoreValue=value;else el.value=value;}
    }
    selectedClinic=typeof saved.clinic==='string'?saved.clinic:'';
    billingPane=parsed.pane;navigate(parsed.view,{push:false,check:false});writeRoute(true);
  }
  let compactDetailSequence=0;
  function compactHqTable(table,labels,keep,detailLabel){
    if(!table)return;
    table.classList.add('hq-compact-table');
    table.closest('.table-wrap')?.classList.add('hq-compact-wrap');
    const shown=[...keep.map(i=>labels[i]),'상세'];
    table.tHead.innerHTML='<tr>'+shown.map(label=>`<th scope="col">${esc(label)}</th>`).join('')+'</tr>';
    for(const row of [...(table.tBodies[0]?.rows||[])]){
      const cells=[...row.cells];if(cells.length!==labels.length){if(cells[0])cells[0].colSpan=shown.length;continue;}
      const name=cells[0].querySelector('button')?.textContent||cells[0].textContent;
      const detail=document.createElement('td'),disclosure=document.createElement('div'),toggle=document.createElement('button'),list=document.createElement('dl');
      const detailRow=document.createElement('tr'),detailCell=document.createElement('td'),id='hqRowDetail'+(++compactDetailSequence);
      detail.dataset.label='상세';disclosure.className='hq-row-details';disclosure.id=id;
      toggle.type='button';toggle.className='hq-row-toggle';toggle.textContent=detailLabel;toggle.id=id+'Toggle';
      toggle.setAttribute('aria-label',`${name} ${detailLabel}`);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',id);
      disclosure.setAttribute('role','region');disclosure.setAttribute('aria-labelledby',toggle.id);
      for(let i=0;i<cells.length;i++)if(!keep.includes(i)){
        const pair=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');
        term.textContent=labels[i];value.append(...cells[i].childNodes);pair.append(term,value);list.append(pair);
      }
      disclosure.append(list);detail.append(toggle);
      detailRow.className='hq-compact-detail-row';detailRow.hidden=true;detailCell.colSpan=shown.length;detailCell.append(disclosure);detailRow.append(detailCell);
      const visible=keep.map(i=>{cells[i].dataset.label=labels[i];return cells[i];});
      row.classList.add('hq-compact-main-row');row.replaceChildren(...visible,detail);row.after(detailRow);
      toggle.onclick=()=>{
        const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));detailRow.hidden=!open;
      };
      disclosure.querySelectorAll('.onboarding-step-dots i').forEach(step=>{step.textContent=step.title||step.textContent;});
    }
    const wrap=table.parentElement;wrap.style.removeProperty('overflow');wrap.style.removeProperty('max-height');
    wrap.classList.add('hq-compact-wrap');wrap.tabIndex=0;wrap.setAttribute('aria-label','병원 목록');
  }
  const originalOnboardingRender=renderOnboardingPortfolio;
  renderOnboardingPortfolio=function(){
    originalOnboardingRender();
    compactHqTable(document.querySelector('.onboarding-table'),
      ['병원','준비율','개통 단계','SOLAPI 연결','시험 문자','문자 결제','알림톡','보호자 회복응답','체험 기간','최근 사용','개통 상태','확인할 사항'],[0,10,1,11],'연동·체험 상세');
  };
  byId('onboardingSearch').oninput=()=>renderOnboardingPortfolio();
  byId('onboardingStatusFilter').onchange=()=>renderOnboardingPortfolio();
  loadOnboardingPortfolio=async function(){
    const ok=await region('onboarding',()=>req('/hq/onboarding'),data=>{onboardingPortfolio=data;renderOnboardingPortfolio();},()=>loadOnboardingPortfolio());
    if(ok===false&&!onboardingPortfolio)byId('onboardingRows').innerHTML='<tr><td colspan="5">개통 정보를 조회하지 못했습니다. 다시 시도를 눌러주세요.</td></tr>';
  };
  function compactSubscriptionTable(){
    const table=byId('subscriptionTable')?.querySelector('table');
    if(table)for(const row of table.tBodies[0]?.rows||[]){
      if(row.cells.length!==10)continue;
      const label=document.createElement('small');label.className='hq-contract-plan-label';label.textContent=row.cells[4].textContent+' · '+row.cells[6].textContent;row.cells[7].prepend(label);
    }
    compactHqTable(table,['병원','판매 채널','청구 주체','가입 승인','플랜','구독 상태','결제주기','적용 금액','문자 안내','사용 기간'],[0,5,7,9],'계약 상세');
  }
  function setupCompactHeader(){
    const menu=byId('hqMenuToggle'),close=byId('hqMenuClose'),nav=byId('nav'),backdrop=byId('hqNavBackdrop'),tools=byId('hqHeaderTools'),toolsToggle=byId('hqToolsToggle'),main=document.querySelector('main');
    const mobile=matchMedia('(max-width:900px)');
    const isOpen=()=>document.body.classList.contains('hq-menu-open');
    const originalSetGroup=setHqNavGroup;
    setHqNavGroup=function(key){
      originalSetGroup(key);
      document.querySelectorAll('[data-hq-nav-group]').forEach(group=>{
        const button=group.querySelector('[data-hq-nav-toggle]'),items=group.querySelector('.hq-nav-items');
        items.id='hqNavItems-'+group.dataset.hqNavGroup;button.setAttribute('aria-controls',items.id);button.setAttribute('aria-expanded',String(group.classList.contains('open')));
      });
    };
    setHqNavGroup(document.querySelector('[data-hq-nav-group].open')?.dataset.hqNavGroup||'today');
    function setMenu(open,restore=true){
      const visible=!!open&&mobile.matches;document.body.classList.toggle('hq-menu-open',visible);
      menu.setAttribute('aria-expanded',String(visible));backdrop.hidden=!visible;
      main.inert=visible;tools.inert=visible;
      if(visible){nav.setAttribute('role','dialog');nav.setAttribute('aria-modal','true');close.focus();}
      else{nav.removeAttribute('role');nav.removeAttribute('aria-modal');if(restore&&mobile.matches)menu.focus();}
    }
    menu.onclick=()=>setMenu(!isOpen());close.onclick=()=>setMenu(false);backdrop.onclick=()=>setMenu(false);
    toolsToggle.onclick=()=>{const open=document.body.classList.toggle('hq-tools-open');toolsToggle.setAttribute('aria-expanded',String(open));if(open)byId('hqQuickClinicSearch').focus();};
    document.addEventListener('keydown',event=>{
      if(!mobile.matches)return;
      if(isOpen()){
        if(event.key==='Escape'){event.preventDefault();setMenu(false);return;}
        if(event.key==='Tab'){
          const items=[...nav.querySelectorAll('button,a,input')].filter(el=>!el.disabled&&el.getClientRects().length);
          const first=items[0],last=items[items.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      }else if(event.key==='Escape'&&document.body.classList.contains('hq-tools-open')){
        document.body.classList.remove('hq-tools-open');toolsToggle.setAttribute('aria-expanded','false');toolsToggle.focus();
      }
    });
    mobile.addEventListener('change',()=>{setMenu(false,false);document.body.classList.remove('hq-tools-open');toolsToggle.setAttribute('aria-expanded','false');});
    const setHeight=()=>document.documentElement.style.setProperty('--hq-header-height',document.querySelector('.top').getBoundingClientRect().height+'px');
    new ResizeObserver(setHeight).observe(document.querySelector('.top'));setHeight();
    return ()=>{const wasOpen=isOpen();setMenu(false,false);return wasOpen;};
  }
  const closeCompactMenu=setupCompactHeader();

  const originalRenderPlans=renderPlans,originalRenderSubscriptions=renderSubscriptions;
  renderPlans=function(){originalRenderPlans();enhancePlans();};
  renderSubscriptions=function(){originalRenderSubscriptions();compactSubscriptionTable();renderChannelCounts();filterSubscriptions();bindHospitalLinks();};
  function bindHospitalLinks(){
    document.querySelectorAll('[data-sub-clinic],[data-billing-clinic],[data-report-clinic]').forEach(b=>b.onclick=()=>{
      if(!allowLeave())return;
      selectedClinic=b.dataset.subClinic||b.dataset.billingClinic||b.dataset.reportClinic;
      byId('clinicSearch').value='';byId('clinicStatus').value='all';byId('clinicApproval').value='all';
      navigate('clinics',{check:false});
    });
  }
  const originalSavePlan=savePlan,originalSaveSubscription=saveSubscription;
  savePlan=card=>reviewedSave('plan:'+card.dataset.plan,()=>originalSavePlan(card));
  saveSubscription=()=>reviewedSave('subscription',()=>originalSaveSubscription());
  showView=view=>navigate(view);
  loadBilling=async function(){
    if(hasDirty()&&!activeSave&&!allowLeave())return;
    const retry=()=>loadBilling();
    salesChannels=null;renderChannelCounts();
    await Promise.all([
      region('planGrid',()=>req('/hq/plans'),data=>{plans=data.plans||[];foundingPolicy=data.foundingPolicy||foundingPolicy;renderPlans();},retry),
      region('subscriptionTable',()=>req('/hq/subscriptions'),data=>{subscriptions=data.subscriptions||[];foundingPolicy=data.foundingPolicy||foundingPolicy;renderSubscriptions();},retry),
      loadPaymentAutomation(),
      region('hqBillingChannels',()=>req('/hq/overview'),data=>{salesChannels=data.salesChannels||{};renderChannelCounts();},retry)
    ]);
  };
  function renderChannelCounts(){
    for(const [id,key] of [['billingDirectCount','direct'],['billingPartnerCount','partner'],['billingActivePartnerCount','activePartners']])
      byId(id).textContent=safeNumber(salesChannels?.[key])?Number(salesChannels[key]).toLocaleString('ko-KR'):'확인 필요';
  }
  loadPaymentAutomation=async function(){
    if(byId('hqRunBilling'))byId('hqRunBilling').disabled=true;
    return region('hqPaymentRecent',async()=>{
      try{return await req('/hq/payments/overview');}catch(e){paymentAutomation={ok:false,error:e.message};renderPaymentAutomation();throw e;}
    },data=>{paymentAutomation=data;renderPaymentAutomation();},()=>loadPaymentAutomation());
  };
  loadClinics=async function(){
    if(activeSave!=='subscription'&&!allowLeave())return;
    const seq=++clinicListSequence,q=byId('clinicSearch').value.trim(),status=byId('clinicStatus').value,approval=byId('clinicApproval').value;
    clinicDetailSequence++;
    saveState();setRegion('clinicList','loading');
    try{
      const data=await req(`/hq/clinics?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&approval=${encodeURIComponent(approval)}`);
      if(seq!==clinicListSequence)return;
      clinics=data.clinics||[];renderClinicList();setRegion('clinicList','ready');
      if(selectedClinic&&clinics.some(x=>x.id===selectedClinic))await loadClinicDetail(selectedClinic);
      else{clinicDetailSequence++;byId('clinicDetail').innerHTML='<div class="empty">목록에서 병원을 선택해주세요.</div>';regions.get('clinicDetail')?.box.remove();editors.delete('subscription');}
    }catch(e){if(seq!==clinicListSequence)return;byId('clinicList').replaceChildren();setRegion('clinicList','error',{error:e.message,retry:()=>loadClinics()});}
  };
  const originalClinicList=renderClinicList;
  renderClinicList=function(){
    originalClinicList();
    byId('clinicListCount').textContent=`검색 결과 ${clinics.length}곳`;
    document.querySelectorAll('.clinic-item').forEach(row=>{
      row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-pressed',String(row.dataset.id===selectedClinic));
      row.onclick=()=>{
        if(!allowLeave())return;selectedClinic=row.dataset.id;clinicFocusRequested=selectedClinic;renderClinicList();saveState();loadClinicDetail(selectedClinic).catch(()=>{});
      };
      row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();row.click();}};
    });
  };
  byId('clinicSearch')?.setAttribute('aria-label','병원명 검색');
  byId('clinicApproval')?.setAttribute('aria-label','가입 승인 상태');
  byId('clinicStatus')?.setAttribute('aria-label','병원 운영 상태');
  byId('clinicFilterReset').onclick=()=>{
    if(!allowLeave())return;byId('clinicSearch').value='';byId('clinicApproval').value='all';byId('clinicStatus').value='all';loadClinics();
  };
  const originalQuickRender=renderHqQuickClinicResults;
  renderHqQuickClinicResults=function(rows,q){originalQuickRender(rows,q);byId('hqQuickClinicResults')?.querySelectorAll('[data-quick-clinic]').forEach(b=>b.onclick=()=>{
    if(!allowLeave())return;selectedClinic=b.dataset.quickClinic;byId('clinicSearch').value=b.dataset.quickName||'';hideHqQuickResults();navigate('clinics',{check:false});
  });};
  runHqQuickClinicSearch=async function(){
    const seq=++quickSequence,q=byId('hqQuickClinicSearch')?.value.trim()||'';
    if(!q){hideHqQuickResults();return;}
    const box=byId('hqQuickClinicResults');box.innerHTML='<div class="hq-quick-empty">검색 중…</div>';box.classList.remove('hidden');
    try{const data=await req(`/hq/clinics?q=${encodeURIComponent(q)}&status=all&approval=all`);if(seq!==quickSequence||byId('hqQuickClinicSearch').value.trim()!==q)return;renderHqQuickClinicResults(data.clinics||[],q);}
    catch(e){if(seq!==quickSequence||byId('hqQuickClinicSearch').value.trim()!==q)return;box.innerHTML='<div class="hq-quick-empty">검색하지 못했습니다. 다시 입력해주세요.</div>';}
  };
  const originalHide=hideHqQuickResults;
  hideHqQuickResults=function(){quickSequence++;originalHide();};
  byId('hqQuickClinicSearch')?.addEventListener('input',()=>{quickSequence++;if(!byId('hqQuickClinicSearch').value.trim())hideHqQuickResults();});
  byId('refresh').onclick=()=>reloadView();
  byId('billingRefresh').onclick=()=>{if(allowLeave())loadBilling();};
  byId('hqPaymentRefresh').onclick=()=>{if(allowLeave())loadPaymentAutomation();};
  window.addEventListener('beforeunload',event=>{if(hasDirty()||activeSave){event.preventDefault();event.returnValue='';}});
  window.addEventListener('popstate',()=>{
    if(restoring)return;
    if(!allowLeave()){writeRoute();return;}
    restoring=true;const next=route(location.hash);billingPane=next.pane;navigate(next.view,{push:false,check:false});restoring=false;
  });
  filterIds.forEach(id=>{byId(id)?.addEventListener('change',saveState);byId(id)?.addEventListener('input',saveState);});
  const originalUsageRender=renderUsageBilling,originalReportRender=renderMonthlyOperationsReportsHQ;
  renderUsageBilling=function(){originalUsageRender();bindHospitalLinks();};
  renderMonthlyOperationsReportsHQ=function(){originalReportRender();bindHospitalLinks();};
  function clearCounts(ids){ids.forEach(id=>{if(byId(id))byId(id).textContent='—';});}
  loadUsageBilling=async function(){
    if(!activeSave&&!allowLeave())return;
    const month=byId('billingMonth')?.value||'',q=month?`?month=${encodeURIComponent(month)}`:'';
    const retry=()=>loadUsageBilling();
    await Promise.all([
      region('messagingBillingTable',async()=>{try{return await req('/hq/billing/messaging'+q);}catch(e){clearCounts(['buMessages','buMonth','buBaseRevenue','buOverageRevenue','buProviderCost','buGross']);throw e;}},data=>{messagingBilling=data;renderUsageBilling();},retry),
      region('hqRateEditor',()=>req('/hq/billing/messaging-settings'),data=>{
        messagingRates=data.settings||{};renderMessagingRates();const root=byId('hqRateEditor');
        const old=editors.get('rates');if(old){old.root.querySelector('.hq-editor-toolbar')?.remove();editors.delete('rates');}
        root.querySelectorAll('input,textarea').forEach(x=>x.disabled=false);
        registerEditor('rates',root,[...root.querySelectorAll('input,textarea')],byId('saveMessagingRates'),'외부 메시지 원가 단가 변경','저장 후 원가 추정에 사용합니다. 기존에 확정한 결제금액은 변경하지 않습니다.');
      },retry),
      region('hqMonthlyReportTable',async()=>{try{return await req('/hq/reports/monthly'+q);}catch(e){clearCounts(['hqReportPackages','hqReportFollowups','hqReportRisks','hqReportTouchpoints','hqReportSatisfaction']);throw e;}},data=>{monthlyOperationsReports=data;renderMonthlyOperationsReportsHQ();},retry)
    ]);
  };
  const originalRatesSave=saveMessagingRates;
  saveMessagingRates=()=>reviewedSave('rates',()=>originalRatesSave());
  const crmCountIds=['crmHqActive','crmHqReview','crmHqCritical','crmHqRisk','crmHqSurvey','crmHqMessage'];
  loadFollowupCrmHQ=async function(){
    const current=latest('crm-data'),days=byId('crmHqPeriod').value;
    saveState();setRegion('crm','loading');clearCounts(crmCountIds);
    for(const id of ['crmHqClinicTable','crmHqJourneyTable'])byId(id).innerHTML='<div class="empty">후속관리 현황을 불러오는 중입니다.</div>';
    try{
      const data=await req('/hq/followup-crm?days='+encodeURIComponent(days));
      if(!current())return;
      if(!data.overall||!Array.isArray(data.byClinic)||!Array.isArray(data.byJourney))throw Error('후속관리 조회 결과를 확인할 수 없습니다.');
      crmAnalytics=data;renderFollowupCrmHQ();setRegion('crm','ready');
    }catch(error){
      if(!current())return;
      clearCounts(crmCountIds);
      for(const id of ['crmHqClinicTable','crmHqJourneyTable'])byId(id).innerHTML='<div class="empty">조회하지 못했습니다. 위의 다시 시도를 눌러주세요.</div>';
      setRegion('crm','error',{error:error.message,retry:()=>loadFollowupCrmHQ()});
    }
  };
  const originalCrmRender=renderFollowupCrmHQ;
  renderFollowupCrmHQ=function(){
    originalCrmRender();
    for(const id of ['crmHqClinicTable','crmHqJourneyTable']){
      const table=byId(id);
      table.querySelectorAll('td').forEach(cell=>{if(cell.textContent==='CRM 데이터 없음')cell.textContent='선택한 기간에 집계된 후속관리가 없습니다.';});
      table.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('aria-label','후속관리 현황 · 좌우로 스크롤할 수 있습니다.');});
    }
  };
  const contentCounts=['contentTotal','contentPublished','contentArchived','contentReviewDue'];
  const contentStates={published:'게시 중',archived:'보관 · 게시 중단',draft:'초안',review:'검수 중',deleted:'삭제 이력'};
  let contentReady=false;
  const contentDue=x=>x.status==='published'&&!!x.reviewDueAt&&Number.isFinite(Date.parse(x.reviewDueAt))&&Date.parse(x.reviewDueAt)<=Date.now();
  const contentDate=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ko-KR'):'미등록';
  function lockContent(locked){
    byId('content').querySelectorAll('button,input,select').forEach(el=>el.disabled=locked);
    if(!locked)updateContentBulkUi();
  }
  loadContent=async function({keepResult=false}={}){
    if(activeSave)return;
    const current=latest('content-data');contentReady=false;contents=[];
    setRegion('content','loading');clearCounts(contentCounts);lockContent(true);
    if(!keepResult)byId('contentBulkResult').textContent='';
    byId('contentResultSummary').textContent='자료 목록을 불러오는 중입니다.';
    byId('contentTable').innerHTML='<div class="empty">자료 목록을 불러오는 중입니다.</div>';
    updateContentBulkUi();
    try{
      const data=await req('/hq/content');if(!current())return;
      if(!Array.isArray(data.contents))throw Error('중앙 콘텐츠 조회 결과를 확인할 수 없습니다.');
      contents=data.contents;contentReady=true;
      const category=byId('contentCategory'),selected=category.dataset.restoreValue||category.value;
      delete category.dataset.restoreValue;
      const categories=[...new Set(contents.map(x=>x.category||'').filter(Boolean))].sort((a,b)=>hqCategoryLabel(a).localeCompare(hqCategoryLabel(b),'ko'));
      category.innerHTML='<option value="all">전체 분류</option>'+categories.map(x=>`<option value="${esc(x)}">${esc(hqCategoryLabel(x))}</option>`).join('');
      category.value=categories.includes(selected)?selected:'all';
      const counts=[contents.filter(x=>x.status!=='deleted').length,contents.filter(x=>x.status==='published').length,contents.filter(x=>x.status==='archived').length,contents.filter(contentDue).length];
      contentCounts.forEach((id,i)=>byId(id).textContent=fmt(counts[i]));
      renderContent();setRegion('content','ready');
    }catch(error){
      if(!current())return;
      contents=[];contentReady=false;clearCounts(contentCounts);
      byId('contentResultSummary').textContent='조회 실패 · 자료 건수를 확인하지 못했습니다.';
      byId('contentTable').innerHTML='<div class="empty">조회하지 못했습니다. 위의 다시 시도를 눌러주세요.</div>';
      setRegion('content','error',{error:error.message,retry:()=>loadContent({keepResult:true})});
    }finally{if(current()){lockContent(false);saveState();}}
  };
  updateContentBulkUi=function(){
    const boxes=[...byId('contentTable').querySelectorAll('[data-content-bulk]')],selected=boxes.filter(x=>x.checked).length,all=byId('contentSelectAllArchived');
    all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;
    all.disabled=!contentReady||!!activeSave||!boxes.length;
    byId('contentBulkSummary').textContent=`선택 ${fmt(selected)}건 · 선택 가능 ${fmt(boxes.length)}건`;
    byId('contentBulkDelete').disabled=!contentReady||!!activeSave||!selected;
  };
  renderContent=function(){
    if(!contentReady)return;
    const q=byId('contentSearch').value.trim().toLowerCase(),status=byId('contentStatus').value,category=byId('contentCategory').value,dueOnly=byId('contentDueOnly').checked;
    const rows=contents.filter(x=>(status==='all'?x.status!=='deleted':x.status===status)&&(category==='all'||x.category===category)&&(!dueOnly||contentDue(x))&&(!q||`${x.title||''} ${hqCategoryLabel(x.category)} ${x.contentId||''}`.toLowerCase().includes(q)));
    byId('contentResultSummary').textContent=`현재 조건 ${fmt(rows.length)}건 · 전체 자료 ${fmt(contents.filter(x=>x.status!=='deleted').length)}건 (삭제 제외)`;
    byId('contentTable').innerHTML=rows.length?`<div class="table-wrap" tabindex="0" aria-label="중앙 콘텐츠 목록"><table class="table hq-content-table"><thead><tr><th>선택</th><th>교육자료</th><th>게시 상태</th><th>품질 점수</th><th>검토 정보</th><th>병원별 제공 설정</th><th>관리</th></tr></thead><tbody>${rows.map(x=>`<tr data-content-row="${esc(x.contentId)}"><td data-label="선택">${x.status==='archived'?`<label class="hq-content-check"><input type="checkbox" data-content-bulk value="${esc(x.contentId)}" aria-label="${esc(x.title)} 선택"><span>선택</span></label>`:'—'}</td><td data-label="교육자료" class="hq-content-title"><b>${esc(x.title||'제목 없음')}</b><span class="muted">${esc(hqCategoryLabel(x.category))} · 버전 ${esc(x.version||'미등록')}</span></td><td data-label="게시 상태"><span class="status ${esc(x.status)}">${esc(contentStates[x.status]||x.status||'확인 필요')}</span></td><td data-label="품질 점수">${safeNumber(x.qualityScore)?fmt(x.qualityScore)+' / 100':'미등록'}</td><td data-label="검토 정보">${esc(x.reviewerName||'검토자 미등록')}<br><span class="${contentDue(x)?'hq-content-due':'muted'}">재검토 ${esc(contentDate(x.reviewDueAt))}${contentDue(x)?' · 기한 도래':''}</span></td><td data-label="병원별 제공 설정">${x.status==='published'?`허용 ${fmt(x.enabledClinics)}곳 · 숨김 ${fmt(x.disabledClinics)}곳`:'현재 제공 중 아님'}</td><td data-label="관리"><div class="hq-content-actions">${x.status==='published'?`<button class="btn small" data-content-status="${esc(x.contentId)}" data-next="archived">게시 중단</button>`:x.status==='archived'?`<button class="btn small" data-content-status="${esc(x.contentId)}" data-next="published">다시 게시</button><button class="btn small danger" data-content-delete="${esc(x.contentId)}">삭제</button>`:'—'}</div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${contents.length?'선택한 조건에 해당하는 자료가 없습니다. 검색 조건을 초기화해보세요.':'등록된 중앙 콘텐츠가 없습니다.'}</div>`;
    byId('contentTable').querySelectorAll('[data-content-status]').forEach(b=>b.onclick=()=>patchContent(b.dataset.contentStatus,b.dataset.next));
    byId('contentTable').querySelectorAll('[data-content-delete]').forEach(b=>b.onclick=()=>deleteContent(b.dataset.contentDelete));
    byId('contentTable').querySelectorAll('[data-content-bulk]').forEach(b=>b.onchange=updateContentBulkUi);
    updateContentBulkUi();saveState();
  };
  async function changeContent(ids,status){
    if(activeSave||!contentReady)return false;
    const targets=[...new Set(ids)].map(id=>contents.find(x=>x.contentId===id)).filter(x=>x&&(status==='archived'?x.status==='published':x.status==='archived'));
    if(!targets.length)return false;
    const action=status==='archived'?'게시 중단':status==='published'?'다시 게시':'삭제';
    const names=targets.slice(0,5).map(x=>x.title||x.contentId).join('\n')+(targets.length>5?`\n외 ${targets.length-5}건`:'');
    const impact=status?'연결된 자동생성 회복관리 일정의 상태도 함께 변경됩니다.':'연결된 자동생성 회복관리 일정도 삭제 처리됩니다. 과거 운영 이력용 최소 정보는 보존됩니다. 화면에서 삭제를 되돌릴 수 없습니다.';
    if(!confirm(`${targets.length}건을 ${action}할까요?\n\n${names}\n\n${impact}`))return false;
    activeSave='content';lockContent(true);
    const result=byId('contentBulkResult'),failed=[];let done=0;
    try{
      for(const entry of targets){
        result.textContent=`${action} 처리 중 · ${done+failed.length+1} / ${targets.length}건`;
        try{
          await req('/hq/content/'+encodeURIComponent(entry.contentId),status?{method:'PATCH',body:JSON.stringify({status})}:{method:'DELETE'});
          done++;
        }catch(error){failed.push({id:entry.contentId,title:entry.title||entry.contentId,error:error.message||'처리 결과 확인 필요'});}
      }
    }finally{activeSave=null;lockContent(false);}
    result.textContent=`${action} 완료 ${done}건${failed.length?` · 결과 확인 필요 ${failed.length}건\n`+failed.map(x=>`${x.title}: ${x.error}`).join('\n'):''}`;
    await loadContent({keepResult:true});
    byId('contentTable').querySelectorAll('[data-content-bulk]').forEach(box=>box.checked=failed.some(x=>x.id===box.value));
    updateContentBulkUi();
    if(done)loadHqActionCenter().catch(()=>{});
    return !failed.length;
  }
  patchContent=(id,status)=>['published','archived'].includes(status)?changeContent([id],status):Promise.resolve(false);
  deleteContent=id=>changeContent([id],null);
  bulkDeleteArchivedContent=()=>changeContent(selectedContentBulkIds(),null);
  byId('contentRefresh').onclick=()=>loadContent();
  byId('contentSearch').oninput=()=>renderContent();
  for(const id of ['contentStatus','contentCategory','contentDueOnly'])byId(id).onchange=()=>renderContent();
  byId('contentReset').onclick=()=>{
    byId('contentSearch').value='';byId('contentStatus').value='all';byId('contentCategory').value='all';byId('contentDueOnly').checked=false;
    renderContent();
  };
  byId('contentSelectAllArchived').onchange=event=>{
    byId('contentTable').querySelectorAll('[data-content-bulk]').forEach(box=>box.checked=event.target.checked);
    updateContentBulkUi();
  };
  byId('contentBulkDelete').onclick=()=>bulkDeleteArchivedContent();
  const voiceTypes={condition:'질환 자료 요청',feature:'기능 제안',inquiry:'문의'};
  const voiceStates={new:'신규',reviewing:'검토 중',planned:'제작 예정',building:'제작 중',review:'검수 중',published:'공개 완료',answered:'답변 완료',hold:'보류'};
  function voiceControlsDisabled(disabled){
    byId('voice').querySelectorAll('select,button').forEach(el=>{
      el.disabled=disabled||(el.matches('.voice-save')&&el.closest('tr')?.querySelector('.voice-status')?.value===el.closest('tr')?.dataset.savedStatus);
    });
  }
  loadVoice=async function(){
    if(activeSave)return;
    const current=latest('voice-data'),type=byId('voiceType').value,status=byId('voiceStatus').value;
    saveState();setRegion('voice','loading');
    byId('voiceResultSummary').textContent='요청 목록을 불러오는 중입니다.';
    byId('voiceTable').innerHTML='<div class="empty">요청 목록을 불러오는 중입니다.</div>';
    try{
      const data=await req(`/hq/voice?type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`);
      if(!current())return;
      if(!Array.isArray(data.requests))throw Error('요청 목록의 조회 결과를 확인할 수 없습니다.');
      voice=data.requests;renderVoice();setRegion('voice','ready');
    }catch(error){
      if(!current())return;
      byId('voiceResultSummary').textContent='조회 실패 · 요청 건수를 확인하지 못했습니다.';
      byId('voiceTable').innerHTML='<div class="empty">조회하지 못했습니다. 위의 다시 시도를 눌러주세요.</div>';
      setRegion('voice','error',{error:error.message,retry:()=>loadVoice()});
    }
  };
  renderVoice=function(){
    byId('voiceResultSummary').textContent=`조회 ${voice.length.toLocaleString('ko-KR')}건 · 최신순${voice.length>=250?' · 최근 250건까지 표시':''}`;
    byId('voiceTable').innerHTML=voice.length?`<div class="table-wrap" tabindex="0" aria-label="병원 요청 목록 · 좌우로 스크롤할 수 있습니다."><table class="table"><thead><tr><th>요청</th><th>병원</th><th>내용</th><th>동일 요청</th><th>처리 상태</th><th>저장</th></tr></thead><tbody>${voice.map(x=>`<tr data-voice="${esc(x.id)}" data-saved-status="${esc(x.status)}"><td><b>${esc(x.title)}</b><br><span class="muted">${esc(voiceTypes[x.type]||x.type)} · ${date(x.createdAt)}</span></td><td>${esc(x.clinicName||'병원 미연결')}</td><td><details><summary>요청 내용 보기</summary><div class="hq-voice-body">${esc(x.details||'추가 내용 없음')}</div>${x.adminNote?`<p class="hq-voice-body"><b>기존 관리 메모</b><br>${esc(x.adminNote)}</p>`:''}</details></td><td>${fmt(x.sameRequestCount)}건</td><td><select class="input voice-status" aria-label="${esc(x.title)} 처리 상태">${Object.entries(voiceStates).map(([key,label])=>`<option value="${key}" ${x.status===key?'selected':''}>${label}</option>`).join('')}</select></td><td><button type="button" class="btn small voice-save" disabled>상태 저장</button><span class="hq-voice-save-result" role="status"></span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">선택한 조건에 해당하는 병원 요청이 없습니다.</div>';
    byId('voiceTable').querySelectorAll('[data-voice]').forEach(row=>{
      row.querySelector('.voice-status').onchange=()=>{row.querySelector('.voice-save').disabled=!!activeSave||row.querySelector('.voice-status').value===row.dataset.savedStatus;};
      row.querySelector('.voice-save').onclick=()=>saveVoice(row);
    });
  };
  saveVoice=async function(row){
    if(activeSave)return false;
    const id=row.dataset.voice,entry=voice.find(x=>x.id===id),status=row.querySelector('.voice-status').value,result=row.querySelector('.hq-voice-save-result');
    if(!entry||status===entry.status||!Object.hasOwn(voiceStates,status))return false;
    activeSave='voice:'+id;voiceControlsDisabled(true);result.textContent='저장 중…';
    try{
      await req('/hq/voice/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status,adminNote:entry.adminNote||''})});
      entry.status=status;row.dataset.savedStatus=status;result.textContent='저장 완료';toast('요청 상태를 저장했습니다.');
    }catch(error){result.textContent=error.message||'저장 실패 · 다시 시도해주세요.';return false;}
    finally{activeSave=null;voiceControlsDisabled(false);}
    await loadVoice();return true;
  };
  byId('crmHqRefresh').onclick=()=>loadFollowupCrmHQ();
  byId('crmHqPeriod').onchange=()=>loadFollowupCrmHQ();
  byId('voiceRefresh').onclick=()=>loadVoice();
  byId('voiceType').onchange=()=>loadVoice();
  byId('voiceStatus').onchange=()=>loadVoice();
  const originalClinicSave=saveClinic;
  saveClinic=()=>{if(!allowLeave())return;return originalClinicSave();};
  byId('usageBillingRefresh').onclick=()=>loadUsageBilling();
  byId('billingMonth').onchange=()=>loadUsageBilling();
  billingLayout();
  document.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('aria-label','표 · 좌우로 스크롤할 수 있습니다.');});
  globalThis.CarestepHqUX={won,priceText,changes,latest,allowLeave,restoreRoute,enhanceClinic,setRegion,
    beginClinic(id){const seq=++clinicDetailSequence;setRegion('clinicDetail','loading');byId('clinicDetail').innerHTML='<div class="hq-detail-loading"><p>병원 정보를 불러오는 중입니다.</p><div class="hq-loading-lines" aria-hidden="true"><i></i><i></i><i></i></div></div>';return ()=>seq===clinicDetailSequence&&selectedClinic===id;},
    clinicReady(){enhanceClinic();setRegion('clinicDetail','ready');saveState();},
    clinicError(error){setRegion('clinicDetail','error',{error:error.message,retry:()=>loadClinicDetail(selectedClinic)});},
    isSaving:()=>!!activeSave,reviewedSave};
})();
