/* HQ presentation and review flow. All writes continue through the existing APIs. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const regions=new Map(),sequences=new Map(),editors=new Map(),viewPositions=new Map();
  const stateKey='carestep_hq_ui_v20261020';
  let currentView='dashboard',billingPane='subscriptions',restoring=false,reviewOpen=false;
  let activeSave=null,quickSequence=0,clinicListSequence=0,clinicDetailSequence=0;
  const filterIds=['clinicSearch','clinicStatus','clinicApproval','journeySearch','journeyScope','journeyStatusFilter','billingMonth','hqSubscriptionSearch'];
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
    const filters=Object.fromEntries(filterIds.filter(id=>byId(id)).map(id=>[id,byId(id).value]));
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
      if(['subPrice','subMessagingOveragePrice'].includes(field.id)&&Number(value)===0)return '플랜 기본값 적용 (0)';
      if(field.matches('.monthly,.annual,.founding,.credit')||field.id.startsWith('rate')||['subPrice','subMessagingOveragePrice','subExtraMessageBudget'].includes(field.id))return won(value);
      if(field.matches('.members,.packages'))return Number(value)===0?'계약상 제한 없음':Number(value).toLocaleString('ko-KR')+(field.matches('.members')?'명':'건');
    }
    return String(value);
  }
  function updateEditor(editor){
    const changed=dirty(editor);
    editor.root.dataset.editing=String(editor.editing);
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
  const subscriptionLabels={subPlan:'플랜',subStatus:'구독 상태',subCycle:'결제주기',subPrice:'계약 결제금액 · 부가세 포함',subFounding:'초기 가입 가격보장',subPeriodStart:'사용 시작일',subPeriodEnd:'사용 종료일',subTrialEnd:'체험 종료일',subNote:'구독 메모',subMessagesOverride:'기존 계약 문자 제공량',subMessagingOverage:'초과 사용 허용',subMessagingOveragePrice:'기존 계약 초과요금',subExtraMessageBudget:'월 추가 문자 예산'};
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
  }
  function setRegion(id,state,{error='',retry=null}={}){
    const target=byId(id);if(!target)return;
    let record=regions.get(id);
    if(!record||!record.box.isConnected){const box=document.createElement('div');box.className='hq-load-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');if(target.matches('.view,#hqRateEditor'))target.prepend(box);else target.before(box);record={box,at:record?.at||null};regions.set(id,record);}
    if(state==='ready')record.at=new Date();
    record.box.dataset.state=state;target.setAttribute('aria-busy',String(state==='loading'));
    record.box.replaceChildren();
    const label=document.createElement('span');
    const checked=record.at?record.at.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
    label.textContent=state==='loading'?'불러오는 중…':state==='error'?`조회하지 못했습니다. ${error||'잠시 후 다시 시도해주세요.'}${checked?' · 마지막 확인 '+checked+' (이전 결과)':''}`:`확인 ${checked}`;
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
    document.querySelectorAll('#subscriptionTable tbody tr').forEach(row=>row.hidden=!!q&&!row.cells[0]?.textContent.toLowerCase().includes(q));
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
    if(['billing','usageBilling','clinics'].includes(view)){await loader();return;}
    await region(view,loader,()=>{},()=>reloadView(view));
  }
  function navigate(view,{push=true,check=true}={}){
    const target=byId(view);if(!target?.classList.contains('view')){toast('현재 제공되지 않는 화면입니다.');return false;}
    if(check&&!allowLeave())return false;
    viewPositions.set(currentView,window.scrollY||0);
    currentView=view;
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===target));
    document.querySelectorAll('#nav [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    syncHqNavForView(view);if(view==='billing')setBillingPane(billingPane,{push:false,check:false});
    if(push)writeRoute();saveState();
    window.scrollTo({top:viewPositions.get(view)||0,behavior:'instant'});
    reloadView(view);return true;
  }
  function restoreRoute(){
    const saved=loadState(),parsed=route(location.hash||('#'+(saved.view||'dashboard')+(saved.view==='billing'?'/'+(saved.pane||'subscriptions'):'')));
    for(const id of filterIds)if(byId(id)&&typeof saved.filters?.[id]==='string')byId(id).value=saved.filters[id];
    selectedClinic=typeof saved.clinic==='string'?saved.clinic:'';
    billingPane=parsed.pane;navigate(parsed.view,{push:false,check:false});writeRoute(true);
  }
  const originalRenderPlans=renderPlans,originalRenderSubscriptions=renderSubscriptions;
  renderPlans=function(){originalRenderPlans();enhancePlans();};
  renderSubscriptions=function(){originalRenderSubscriptions();renderChannelCounts();filterSubscriptions();bindHospitalLinks();};
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
      else{clinicDetailSequence++;byId('clinicDetail').innerHTML='<div class="empty">목록에서 병원을 선택해주세요.</div>';editors.delete('subscription');}
    }catch(e){if(seq!==clinicListSequence)return;byId('clinicList').replaceChildren();setRegion('clinicList','error',{error:e.message,retry:()=>loadClinics()});}
  };
  const originalClinicList=renderClinicList;
  renderClinicList=function(){
    originalClinicList();
    document.querySelectorAll('.clinic-item').forEach(row=>row.onclick=()=>{
      if(!allowLeave())return;selectedClinic=row.dataset.id;renderClinicList();saveState();loadClinicDetail(selectedClinic).catch(()=>{});
    });
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
  const originalClinicSave=saveClinic;
  saveClinic=()=>{if(!allowLeave())return;return originalClinicSave();};
  byId('usageBillingRefresh').onclick=()=>loadUsageBilling();
  byId('billingMonth').onchange=()=>loadUsageBilling();
  billingLayout();
  document.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('aria-label','표 · 좌우로 스크롤할 수 있습니다.');});
  globalThis.CarestepHqUX={won,priceText,changes,latest,allowLeave,restoreRoute,enhanceClinic,setRegion,
    beginClinic(id){const seq=++clinicDetailSequence;setRegion('clinicDetail','loading');byId('clinicDetail').innerHTML='<div class="hq-detail-loading">병원 정보를 불러오는 중…</div>';return ()=>seq===clinicDetailSequence&&selectedClinic===id;},
    clinicReady(){enhanceClinic();setRegion('clinicDetail','ready');saveState();},
    clinicError(error){setRegion('clinicDetail','error',{error:error.message,retry:()=>loadClinicDetail(selectedClinic)});},
    isSaving:()=>!!activeSave,reviewedSave};
})();
