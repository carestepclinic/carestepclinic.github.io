/* HQ presentation and review flow. All writes continue through the existing APIs. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const regions=new Map(),sequences=new Map(),editors=new Map(),viewPositions=new Map();
  const stateKey='carestep_hq_ui_v20261020';
  let currentView='dashboard',billingPane='subscriptions',restoring=false,reviewOpen=false,closeReview=null;
  let activeSave=null,quickSequence=0,clinicListSequence=0,clinicDetailSequence=0;
  const clinicPanes=new Map();
  let clinicFocusRequested='';
  const filterIds=['hqAuditFrom','hqAuditTo','hqAuditClinic','hqAuditAction','hqAuditActor','clinicSearch','clinicStatus','clinicApproval','journeySearch','journeyScope','journeyStatusFilter','billingMonth','hqSubscriptionSearch','crmHqPeriod','voiceType','voiceStatus','hqVoiceSearch','contentSearch','contentStatus','contentCategory','contentDueOnly','contentSpecies','contentSort','surveyHqPeriod','hqSurveyScope','hqSubscriptionStatus','customerSuccessSearch','customerSuccessStatus','customerSuccessPlan','customerSuccessSignal','onboardingSearch','onboardingStatusFilter'];
  const safeNumber=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
  const won=n=>safeNumber(n)?`${Number(n).toLocaleString('ko-KR')}원`:'금액 확인 필요';
  const hqReadScope=()=>JSON.stringify([endpoint(),hqSessionToken(),key()]);
  let readEpoch=0,navigationEpoch=0,listChangeSequence=0;
  let planCatalog=null,planPending=null,clinicListSnapshot=null;
  async function readPlans(force=false){
    const owner=hqReadScope(),change=listChangeSequence,epoch=readEpoch;
    if(!force&&planCatalog?.scope===owner&&Date.now()-planCatalog.at<60000)return planCatalog.value;
    if(planPending?.scope===owner)return planPending.work;
    planCatalog=null;
    const work=req('/hq/plans').then(value=>{if(owner===hqReadScope()&&change===listChangeSequence&&epoch===readEpoch)planCatalog={scope:owner,at:Date.now(),value};return value;});
    planPending={scope:owner,work};try{return await work;}finally{if(planPending?.work===work)planPending=null;}
  }
  function catalogState(pending){
    for(const id of ['subPlan','subFounding']){const field=byId(id);if(field)field.dataset.catalogPending=String(pending);}
    const editor=editors.get('subscription');if(editor?.root.isConnected)updateEditor(editor);
  }
  function updateCatalogComparison(detail,catalog){
    if(!detail)return;const root=byId('clinicDetail'),old=root?.querySelector('.hq-catalog-comparison>div');if(!old)return;
    const temp=document.createElement('div');temp.innerHTML=hqContractSummary(detail,catalog);old.replaceWith(temp.querySelector('.hq-contract-summary').children[1]);
  }
  function catalogFailed(retry,detail){updateCatalogComparison(detail,[]);catalogState(true);setRegion('clinicDetail','error',{error:'병원 정보는 표시했습니다. 요금제 목록을 불러오지 못했습니다.',retry});}
  function catalogReady(detail){updateCatalogComparison(detail,plans);catalogState(false);const notice=regions.get('clinicDetail');if(notice?.box.textContent.includes('요금제 목록'))setRegion('clinicDetail','ready');}
  function summarizeReadStatus(){
    const view=byId(currentView);if(!view)return;
    let summary=view.querySelector('[data-hq-read-summary]');
    if(!summary){summary=document.createElement('div');summary.dataset.hqReadSummary='';summary.className='hq-read-summary';summary.setAttribute('role','status');(view.querySelector('.head')||view).append(summary);}
    const rows=[...regions.values()].filter(r=>r.box.isConnected&&view.contains(r.box));
    const ready=rows.filter(r=>r.box.dataset.state==='ready'),times=ready.map(r=>r.at).filter(Boolean);
    for(const r of rows)r.box.hidden=r.box.dataset.state==='ready';
    const pending=rows.some(r=>r.box.dataset.state==='loading'),failed=rows.some(r=>r.box.dataset.state==='error');
    summary.textContent=pending?'최신 정보 확인 중…':failed?'일부 정보 조회 실패':times.length?'마지막 확인 '+new Date(Math.max(...times.map(t=>+t))).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
    summary.hidden=!summary.textContent;
  }
  const listReads=new Map();
  const latest=key=>{const n=(sequences.get(key)||0)+1,owner=hqReadScope(),epoch=readEpoch;sequences.set(key,n);return ()=>sequences.get(key)===n&&owner===hqReadScope()&&epoch===readEpoch;};
  function listSignature(view){return JSON.stringify([hqReadScope(),view,view==='crm'?byId('crmHqPeriod').value:view==='surveys'?byId('surveyHqPeriod').value:view==='voice'?[byId('voiceType').value,byId('voiceStatus').value,byId('hqVoiceSearch')?.value||'']:'']);}
  function listState(view){const signature=listSignature(view);let state=listReads.get(view);if(!state||state.signature!==signature){state={signature,good:false,freshAt:0,failed:false,pending:null};listReads.set(view,state);const region=regions.get(view);if(region)region.at=null;}return state;}
  function beginList(view){const state=listState(view);state.failed=false;return {keep:state.good,current:latest(view+'-data')};}
  function wrapList(view,load){return async function(options={}){const state=listState(view);if(options.reuse&&state.pending)return state.pending;if(options.reuse&&state.good&&!state.failed&&Date.now()-state.freshAt<30000&&!(view==='content'&&byId('contentCategory').dataset.restoreValue!==undefined))return true;const position=currentView===view?window.scrollY:null,nav=navigationEpoch,change=listChangeSequence;let moved=false;const onScroll=()=>{if(window.scrollY!==position)moved=true;};window.addEventListener('scroll',onScroll,{passive:true});const work=Promise.resolve(load(options));state.pending=work;try{return await work;}finally{window.removeEventListener('scroll',onScroll);if(state.pending===work)state.pending=null;if(change!==listChangeSequence)state.freshAt=0;if(position!==null&&!moved&&nav===navigationEpoch&&currentView===view)window.scrollTo({top:position,behavior:'instant'});}};}

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
    try{sessionStorage.setItem(stateKey,JSON.stringify({view:currentView,pane:billingPane,clinic:selectedClinic,filters,adoptionQuick:customerSuccessQuick}));}catch{}
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
  function allowLeave(resume){
    if(activeSave){toast('저장 결과를 확인하고 있습니다. 잠시 기다려주세요.');return false;}
    if(reviewOpen)return false;
    if(!hasDirty())return true;
    const owner=hqReadScope();void CarestepHqWorkspace.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 취소하고 이동할까요?',{confirmLabel:'변경 취소하고 이동',valid:()=>owner===hqReadScope()}).then(ok=>{if(ok){for(const e of editors.values())if(e.editing)cancelEdit(e);resume?.();}});return false;
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
        if(['subPlan','subFounding'].includes(el.id))locked=el.dataset.catalogPending==='true';
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
      if(activeSave||!allowLeave(()=>edit.click()))return;
      for(const other of editors.values())if(other!==editor&&other.editing)cancelEdit(other);
      editor.owner=hqReadScope();editor.epoch=readEpoch;editor.clinic=selectedClinic;editor.editing=true;updateEditor(editor);fields.find(x=>!x.disabled)?.focus();
    };
    cancel.onclick=()=>cancelEdit(editor);
    fields.forEach(x=>{x.addEventListener('input',()=>updateEditor(editor));x.addEventListener('change',()=>updateEditor(editor));});
    save.textContent='변경 내용 확인';updateEditor(editor);return editor;
  }
  function editorIsCurrent(editor){
    return byId('loginOverlay').classList.contains('hidden')&&!!(hqSessionToken()||key())&&editor.owner===hqReadScope()&&editor.epoch===readEpoch&&editor.root.isConnected&&editors.get(editor.key)===editor&&editor.editing&&(editor.key!=='subscription'||editor.clinic===selectedClinic);
  }
  function review(editor){
    const diff=changes(editor.baseline,snapshot(editor));if(!diff.length)return Promise.resolve(false);
    return new Promise(resolve=>{
      reviewOpen=true;const confirmedSnapshot=JSON.stringify(snapshot(editor));let finished=false;
      const dialog=document.createElement('dialog');dialog.className='hq-review';dialog.setAttribute('aria-labelledby','hqReviewTitle');
      dialog.innerHTML=`<h2 id="hqReviewTitle">${esc(editor.title)}</h2><p>${esc(editor.effect)}</p><table class="hq-review-table"><thead><tr><th>항목</th><th>변경 전</th><th>변경 후</th></tr></thead><tbody>${diff.map(x=>{const field=editor.fields.find((_,i)=>editor.baseline[i]?.key===x.key);return `<tr><th>${esc(x.label)}</th><td>${esc(formatted(x.before,field))}</td><td>${esc(formatted(x.value,field))}</td></tr>`;}).join('')}</tbody></table><div class="hq-review-actions"><button type="button" class="btn" data-review-cancel>돌아가서 수정</button><button type="button" class="btn primary" data-review-save>확인 후 저장</button></div>`;
      const finish=value=>{if(finished)return;finished=true;const accepted=value&&editorIsCurrent(editor)&&confirmedSnapshot===JSON.stringify(snapshot(editor));reviewOpen=false;closeReview=null;dialog.close();dialog.remove();resolve(accepted);};
      closeReview=()=>finish(false);
      dialog.querySelector('[data-review-cancel]').onclick=()=>finish(false);
      dialog.querySelector('[data-review-save]').onclick=()=>finish(true);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-review-cancel]').focus();
    });
  }
  async function reviewedSave(key,save){
    const editor=editors.get(key);
    if(!editor||!editorIsCurrent(editor)||activeSave||reviewOpen)return false;
    if(editor.fields.some(x=>x.type==='number'&&!x.disabled&&!x.checkValidity())){editor.fields.find(x=>x.type==='number'&&!x.disabled&&!x.checkValidity()).reportValidity();return false;}
    if(!await review(editor)||!editorIsCurrent(editor))return false;
    activeSave=key;for(const e of editors.values())if(e.root.isConnected)updateEditor(e);
    try{
      const saved=await save();
      if(saved===true&&editorIsCurrent(editor)){editor.baseline=snapshot(editor);editor.editing=false;}
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
    if(clinicReturnContext&&clinicReturnContext.view!=='clinics')back.textContent=(byId(clinicReturnContext.view)?.querySelector('h1')?.textContent||'이전 화면')+' · 돌아가기';
    if(clinicReturnContext&&(clinicReturnContext.view!=='clinics'||clinicReturnContext.sourceAttribute))back.classList.add('hq-source-back');
    back.onclick=returnFromClinic;title.prepend(back);
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
      if(check&&!allowLeave(()=>select(key,check)))return false;
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
      root.scrollIntoView({block:'start'});
    }
  }
  function setRegion(id,state,{error='',retry=null}={}){
    const target=byId(id);if(!target)return;
    let record=regions.get(id);
    if(!record||!record.box.isConnected){const box=document.createElement('div');box.className='hq-load-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');if(target.matches('.view')&&target.querySelector('.head'))target.querySelector('.head').append(box);else if(target.matches('.view,#hqRateEditor'))target.prepend(box);else target.before(box);record={box,at:record?.at||null};regions.set(id,record);}
    const list=listReads.get(id);if(list){if(state==='ready'){list.good=true;list.freshAt=Date.now();list.failed=false;}if(state==='error'){list.failed=true;list.freshAt=0;}}
    if(state==='ready')record.at=new Date();
    record.box.dataset.state=state;target.setAttribute('aria-busy',String(state==='loading'));
    if(id==='hqBillingChannels')record.box.hidden=billingPane!=='subscriptions';
    record.box.replaceChildren();
    const label=document.createElement('span');
    const checked=record.at?record.at.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
    label.textContent=state==='loading'?(list?.good?'새로 확인 중 · 이전 결과 표시':'불러오는 중…'):state==='error'?`조회하지 못했습니다. ${error||'잠시 후 다시 시도해주세요.'}${checked?' · 마지막 확인 '+checked+' (이전 결과)':''}`:`마지막 확인 ${checked}`;
    record.box.append(label);summarizeReadStatus();
    if(state==='error'&&retry){const button=document.createElement('button');button.type='button';button.className='btn small';button.textContent='다시 시도';button.onclick=()=>retry();record.box.append(button);}
  }
  async function region(id,fetchData,commit,retry){
    const isLatest=latest(id);setRegion(id,'loading');
    try{const data=await fetchData();if(!isLatest())return;if(data===false||(Array.isArray(data)&&data.includes(false)))throw Error('최신 정보를 불러오지 못했습니다. 표시된 수치는 이전 결과일 수 있습니다.');commit(data);setRegion(id,'ready');return true;}
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
    const q=(byId('hqSubscriptionSearch')?.value||'').trim().toLowerCase(),rows=[...document.querySelectorAll('#subscriptionTable tbody .hq-compact-main-row')];let shown=0;
    for(const row of rows){const status=byId('hqSubscriptionStatus')?.value||'all',id=row.querySelector('[data-sub-clinic]')?.dataset.subClinic;row.hidden=(!!q&&!row.cells[0]?.textContent.toLowerCase().includes(q))||(status!=='all'&&subscriptions.find(x=>x.clinicId===id)?.status!==status);row.nextElementSibling.hidden=row.hidden||row.querySelector('.hq-row-toggle').getAttribute('aria-expanded')!=='true';shown+=!row.hidden;}
    let result=byId('hqSubscriptionResults');if(!result){result=document.createElement('div');result.id='hqSubscriptionResults';result.className='hq-results-summary';byId('subscriptionTable').before(result);}
    result.replaceChildren();const count=document.createElement('span');count.setAttribute('role','status');count.textContent=`검색 결과 ${shown}건 · 전체 ${rows.length}건`;result.append(count);
    if(rows.length&&!shown){const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent='검색 조건 초기화';reset.onclick=()=>{byId('hqSubscriptionSearch').value='';if(byId('hqSubscriptionStatus'))byId('hqSubscriptionStatus').value='all';filterSubscriptions();saveState();byId('hqSubscriptionSearch').focus();};result.append(reset);}
  }
  function setBillingPane(pane,{push=true,check=true}={}){
    if(check&&!allowLeave(()=>setBillingPane(pane,{push,check})))return false;
    billingPane=['subscriptions','plans','payments'].includes(pane)?pane:'subscriptions';
    const ids={subscriptions:'hqBillingsubscriptions',plans:'hqPolicyPane',payments:'hqBillingpayments'};
    for(const [key,id] of Object.entries(ids))if(byId(id))byId(id).hidden=key!==billingPane;
    document.querySelectorAll('[data-billing-pane]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.billingPane===billingPane)));
    if(byId('hqBillingChannels'))byId('hqBillingChannels').hidden=billingPane!=='subscriptions';
    if(regions.get('hqBillingChannels'))regions.get('hqBillingChannels').box.hidden=billingPane!=='subscriptions';
    if(push){writeRoute();if(currentView==='billing'&&byId('loginOverlay').classList.contains('hidden'))void reloadView('billing');}return true;
  }
  function viewLoader(view,force=true){
    return ({protocols:()=>window.CarestepHqProtocols?.open({reuse:!force}),training:()=>window.CarestepTraining?.open({reuse:!force}),dashboard:()=>loadOverview({reuse:!force}),approval:loadApproval,clinics:()=>loadClinics({forceCatalog:force}),onboarding:loadOnboardingPortfolio,customerSuccess:loadCustomerSuccess,billing:()=>loadBilling({forceCatalog:force}),usageBilling:loadUsageBilling,
      integrations:async()=>{if(await loadMessagingIntegration()===false)throw Error(byId('msgQueueSummary')?.textContent||'외부 연동 상태를 불러오지 못했습니다.');},senders:()=>Promise.all([loadSenderOnboarding(),loadMessagingIntegration()]),
      journeys:loadPatientJourneysHQ,surveys:()=>loadGuardianSurveyHQ({reuse:!force}),crm:()=>loadFollowupCrmHQ({reuse:!force}),content:()=>loadContent({reuse:!force}),voice:()=>loadVoice({reuse:!force}),production:loadProductionLaunch,audit:loadAudit})[view];
  }
  const pendingViews=new Map();
  async function reloadView(view=currentView,{force=true}={}){
    if(!byId('loginOverlay').classList.contains('hidden'))return;
    if(!allowLeave(()=>reloadView(view,{force})))return;
    const loader=viewLoader(view,force);if(!loader)return;
    const key=JSON.stringify([endpoint(),hqSessionToken(),view,billingPane,selectedClinic,...filterIds.map(id=>byId(id)?.value)]);
    if(pendingViews.has(key))return pendingViews.get(key);
    const work=(async()=>{try{
      if(['training','protocols','dashboard','billing','usageBilling','clinics','onboarding','customerSuccess','surveys','crm','voice','content'].includes(view)){await loader();return;}
      await region(view,loader,()=>{},()=>reloadView(view));
    }finally{if(currentView===view)restoreClinicReturn(view);}})();
    pendingViews.set(key,work);try{return await work;}finally{if(pendingViews.get(key)===work)pendingViews.delete(key);}
  }
  function navigate(view,{push=true,check=true}={}){
    const target=byId(view);if(!target?.classList.contains('view')){toast('현재 제공되지 않는 화면입니다.');return false;}
    if(check&&!allowLeave(()=>navigate(view,{push,check})))return false;
    viewPositions.set(currentView,window.scrollY||0);
    if(view!=='clinics'&&!pendingClinicReturn)clinicReturnContext=null;
    currentView=view;navigationEpoch++;
    document.querySelectorAll('[data-material-view]').forEach(button=>{
      if(button.dataset.materialView===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===target));
    document.querySelectorAll('#nav [data-view]').forEach(x=>{
      x.classList.toggle('active',x.dataset.view===view);
      if(x.dataset.view===view)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');
    });
    document.title=`${target.querySelector('h1')?.textContent||'관리'} · CARESTEP HQ`;
    byId('hqCurrentView').textContent=target.querySelector('h1')?.textContent||'운영 관리';
    if(closeCompactMenu()){const heading=target.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
    byId('refresh').title=byId('hqCurrentView').textContent+' 새로고침';byId('refresh').hidden=['content','training','protocols','integrations','onboarding','customerSuccess','senders'].includes(view);
    syncHqNavForView(view);if(view==='billing')setBillingPane(billingPane,{push:false,check:false});
    if(push)writeRoute();saveState();
    window.scrollTo({top:viewPositions.get(view)||0,behavior:'instant'});
    summarizeReadStatus();void reloadView(view,{force:false});return true;
  }
  function restoreRoute(){
    const saved=loadState(),parsed=route(location.hash||('#'+(saved.view||'dashboard')+(saved.view==='billing'?'/'+(saved.pane||'subscriptions'):'')));
    for(const id of filterIds){
      const el=byId(id),value=saved.filters?.[id];if(!el)continue;
      if(el.type==='checkbox'&&typeof value==='boolean')el.checked=value;
      else if(typeof value==='string'){if(id==='contentCategory'||id==='hqAuditAction')el.dataset.restoreValue=value;else el.value=value;}
    }
    selectedClinic=typeof saved.clinic==='string'?saved.clinic:'';
    customerSuccessQuick=['all','action','risk','trial3','payment','inactive14'].includes(saved.adoptionQuick)?saved.adoptionQuick:'all';
    billingPane=parsed.pane;navigate(parsed.view,{push:false,check:false});writeRoute(true);
  }
  let compactDetailSequence=0;
  const compactExpanded=new Set();
  function compactHqTable(table,labels,keep,detailLabel){
    if(!table)return;
    table.classList.add('hq-compact-table');
    table.closest('.table-wrap')?.classList.add('hq-compact-wrap');
    const numericColumns=new Set([...(table.tHead?.rows[0]?.cells||[])].flatMap((cell,i)=>cell.classList.contains('right')?[i]:[]));
    const shown=[...keep.map(i=>labels[i]),'상세'];
    table.dataset.columns=String(shown.length);
    table.tHead.innerHTML='<tr>'+shown.map((label,i)=>`<th scope="col"${numericColumns.has(keep[i])?' class="right"':''}>${esc(label)}</th>`).join('')+'</tr>';
    for(const row of [...(table.tBodies[0]?.rows||[])]){
      const cells=[...row.cells];if(cells.length!==labels.length){if(cells[0])cells[0].colSpan=shown.length;continue;}
      const name=cells[0].querySelector('button')?.textContent||cells[0].textContent;
      const identity=cells[0].querySelector('[data-open-onboarding-clinic],[data-cs-clinic],[data-sub-clinic],[data-billing-clinic],[data-report-clinic]');
      const identityAttribute=['data-open-onboarding-clinic','data-cs-clinic','data-sub-clinic','data-billing-clinic','data-report-clinic'].find(key=>identity?.hasAttribute(key));
      const stateKey=identityAttribute?(table.tBodies[0].id||table.closest('[id]')?.id||'')+':'+identityAttribute+':'+identity.getAttribute(identityAttribute):'';
      const expanded=!!stateKey&&compactExpanded.has(stateKey);
      const detail=document.createElement('td'),disclosure=document.createElement('div'),toggle=document.createElement('button'),list=document.createElement('dl');
      const detailRow=document.createElement('tr'),detailCell=document.createElement('td'),id='hqRowDetail'+(++compactDetailSequence);
      detail.dataset.label='상세';disclosure.className='hq-row-details';disclosure.id=id;
      toggle.type='button';toggle.className='hq-row-toggle';toggle.textContent=detailLabel;toggle.id=id+'Toggle';
      toggle.setAttribute('aria-label',`${name} ${detailLabel}`);toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-controls',id);
      disclosure.setAttribute('role','region');disclosure.setAttribute('aria-labelledby',toggle.id);
      for(let i=0;i<cells.length;i++)if(!keep.includes(i)){
        const pair=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');
        term.textContent=labels[i];value.append(...cells[i].childNodes);pair.append(term,value);list.append(pair);
      }
      disclosure.append(list);detail.append(toggle);
      detailRow.className='hq-compact-detail-row';detailRow.hidden=!expanded;detailCell.colSpan=shown.length;detailCell.append(disclosure);detailRow.append(detailCell);
      const visible=keep.map(i=>{cells[i].dataset.label=labels[i];return cells[i];});
      row.classList.add('hq-compact-main-row');row.replaceChildren(...visible,detail);row.after(detailRow);
      toggle.onclick=()=>{
        const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));detailRow.hidden=!open;
        if(stateKey){if(open)compactExpanded.add(stateKey);else compactExpanded.delete(stateKey);}
      };
      disclosure.querySelectorAll('.onboarding-step-dots i').forEach(step=>{step.textContent=step.title||step.textContent;});
    }
    const wrap=table.parentElement;wrap.style.removeProperty('overflow');wrap.style.removeProperty('max-height');
    wrap.classList.add('hq-compact-wrap');wrap.tabIndex=0;wrap.setAttribute('aria-label',detailLabel+' 목록');
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

  let clinicReturnContext=null,pendingClinicReturn=null,selectedPlanCode='BASIC';
  const clinicLinkAttributes=['data-audit-clinic','data-sub-clinic','data-billing-clinic','data-report-clinic','data-open-onboarding-clinic','data-cs-clinic','data-cs-action-clinic','data-clinic','data-quick-clinic'];
  function captureClinicReturn(source){
    const attribute=clinicLinkAttributes.find(key=>source?.hasAttribute(key));
    return {view:currentView,pane:billingPane,scroll:window.scrollY||0,listScroll:byId('clinicList').scrollTop,
      sourceAttribute:attribute,sourceValue:attribute?source.getAttribute(attribute):'',adoptionQuick:customerSuccessQuick,
      filters:Object.fromEntries(filterIds.filter(byId).map(id=>[id,byId(id).type==='checkbox'?byId(id).checked:byId(id).value]))};
  }
  function openClinicFrom(id,source){
    if(!id||!allowLeave(()=>openClinicFrom(id,source)))return false;
    clinicReturnContext=captureClinicReturn(source);pendingClinicReturn=null;selectedClinic=id;clinicFocusRequested=id;
    const pane=source?.dataset.clinicPane;
    if(['subscription','operation','connection'].includes(pane))clinicPanes.set(id,pane);
    byId('clinicSearch').value='';byId('clinicStatus').value='all';byId('clinicApproval').value='all';
    if(source?.hasAttribute('data-quick-clinic'))hideHqQuickResults();
    return navigate('clinics',{check:false});
  }
  document.addEventListener('click',event=>{
    const source=event.target.closest?.(clinicLinkAttributes.map(key=>'['+key+']').join(','));
    if(!source)return;
    event.preventDefault();event.stopImmediatePropagation();
    const attribute=clinicLinkAttributes.find(key=>source.hasAttribute(key));openClinicFrom(source.getAttribute(attribute),source);
  },true);
  async function returnFromClinic(){
    if(!allowLeave(()=>returnFromClinic()))return;
    const context=clinicReturnContext;
    if(!context||context.view==='clinics'){
      if(context){
        let changed=false;
        for(const id of ['clinicSearch','clinicStatus','clinicApproval'])if(byId(id).value!==context.filters[id]){byId(id).value=context.filters[id];changed=true;}
        clinicFocusRequested='';if(changed)await loadClinics();
      }
      byId('clinicSearch').focus({preventScroll:true});byId('clinicSearch').scrollIntoView({block:'center'});
      if(context)byId('clinicList').scrollTop=context.listScroll;return;
    }
    clinicReturnContext=null;pendingClinicReturn=context;clinicFocusRequested='';
    for(const [id,value] of Object.entries(context.filters)){
      const field=byId(id);if(!field)continue;if(field.type==='checkbox')field.checked=value;else field.value=value;
    }
    customerSuccessQuick=context.adoptionQuick||'all';
    billingPane=context.pane;viewPositions.set(context.view,context.scroll);navigate(context.view,{check:false});
  }
  function restoreClinicReturn(view){
    const context=pendingClinicReturn;if(!context||context.view!==view||currentView!==view)return;
    pendingClinicReturn=null;
    const source=context.sourceAttribute?[...document.querySelectorAll('['+context.sourceAttribute+']')].find(el=>el.getAttribute(context.sourceAttribute)===context.sourceValue&&el.getClientRects().length):null;
    source?.focus({preventScroll:true});window.scrollTo({top:context.scroll,behavior:'instant'});
  }
  function dashboardLayout(){
    const dashboard=byId('dashboard'),head=dashboard.querySelector('.head'),actions=dashboard.querySelector('.approval-center');
    actions.id='hqActionWork';head.after(actions);actions.querySelector('h2').textContent='지금 처리할 업무';
    const metrics=document.createElement('details');metrics.id='hqOverviewMetrics';metrics.className='hq-dashboard-details';
    metrics.innerHTML='<summary>사용량·운영 통계 보기</summary>';
    metrics.append(dashboard.querySelector('.kpis'),dashboard.querySelector('.grid2'));actions.after(metrics);
    const generated=byId('generated');if(generated)metrics.append(generated);
    const diagnostics=document.createElement('details');diagnostics.className='hq-dashboard-details';diagnostics.id='hqDashboardDiagnostics';
    diagnostics.innerHTML='<summary>연동·배포 상태 보기</summary>';
    const services=actions.querySelector('.hq-service-grid'),deployment=byId('hqDeploymentCard');
    if(services)diagnostics.append(services);if(deployment)diagnostics.append(deployment);metrics.after(diagnostics);
    actions.querySelectorAll('[data-approval-center]').forEach(card=>{
      card.tabIndex=0;card.setAttribute('role','button');
      card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click();}};
    });
  }
  const originalOverview=loadOverview;
  const overviewReads=new Map();
  async function dashboardPart(key,load,force=false){
    const owner=hqReadScope(),old=overviewReads.get(key);
    if(old?.scope===owner&&old.pending)return old.pending;
    if(!force&&old?.scope===owner&&old.at&&Date.now()-old.at<30000)return;
    const entry={scope:owner,at:0,pending:null};overviewReads.set(key,entry);
    entry.pending=Promise.resolve().then(load).then(ok=>{if(ok!==false&&owner===hqReadScope())entry.at=Date.now();}).finally(()=>entry.pending=null);return entry.pending;
  }
  function overviewMetrics(force=false){return dashboardPart('metrics',()=>region('hqOverviewMetrics',()=>originalOverview(),()=>{
    document.querySelectorAll('#recentClinics [data-clinic]').forEach(link=>{link.tabIndex=0;link.setAttribute('role','button');link.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();link.click();}};});
  },()=>overviewMetrics(true)),force);}
  function overviewDiagnostics(force=false){return dashboardPart('diagnostics',()=>region('hqDashboardDiagnostics',async()=>{const results=await Promise.all([req('/hq/health'),req('/hq/integrations/messaging'),loadHqDeploymentStatus(false)]);if(!results[2])throw Error('배포 상태 조회 실패');return results;},values=>{
    const [health,messaging]=values;setHqService('hqCarestep','ok','정상');setHqService('hqDb',health.db?'ok':'bad',health.db?'연결됨':'확인 필요');const oauth=!!messaging.platform?.oauthAppConfigured,legacy=!!messaging.platform?.apiConfigured;setHqService('hqSolapi',oauth?'ok':legacy?'warn':'bad',oauth?'OAuth 앱 정상':legacy?'기존 API만 설정':'설정 필요');
  },()=>overviewDiagnostics(true)),force);}
  loadOverview=async function(options={}){
    const jobs=[dashboardPart('actions',()=>region('hqActionWork',async()=>{if(await loadHqActionCenter()===false)throw Error('일부 업무를 불러오지 못했습니다. 표시된 항목을 확인해주세요.');},()=>{},()=>loadOverview()),!options.reuse)];
    if(byId('hqOverviewMetrics')?.open)jobs.push(overviewMetrics(!options.reuse));
    if(byId('hqDashboardDiagnostics')?.open)jobs.push(overviewDiagnostics(!options.reuse));
    await Promise.all(jobs);
  };
  function selectPlan(code,{check=true,focus=false}={}){
    if(check&&code!==selectedPlanCode&&!allowLeave(()=>selectPlan(code,{check,focus})))return false;
    selectedPlanCode=code;
    for(const card of document.querySelectorAll('#planGrid .plan-card'))card.hidden=card.dataset.plan!==code;
    for(const button of document.querySelectorAll('[data-choose-plan]'))button.setAttribute('aria-pressed',String(button.dataset.choosePlan===code));
    if(focus){
      const card=[...document.querySelectorAll('#planGrid .plan-card')].find(x=>x.dataset.plan===code);
      const heading=card?.querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});card.scrollIntoView({block:'start'});}
    }
    return true;
  }
  function renderPlanComparison(){
    let comparison=byId('hqPlanComparison');
    if(!comparison){comparison=document.createElement('section');comparison.id='hqPlanComparison';comparison.className='hq-plan-comparison';byId('planGrid').before(comparison);}
    const limit=(n,unit)=>!safeNumber(n)?'확인 필요':Number(n)===0?'제한 없음':Number(n).toLocaleString('ko-KR')+unit;
    comparison.innerHTML=`<h2>요금제 비교</h2><p class="muted">월 결제 총액은 부가세 포함입니다. 요금제를 선택하면 아래에서 상세 조건을 확인하고 수정할 수 있습니다.</p><div class="table-wrap"><table class="table hq-plan-compare-table"><thead><tr><th>요금제</th><th>월 결제 총액</th><th>직원</th><th>월 HOME 게시</th><th>상세</th></tr></thead><tbody>${plans.map(plan=>{
      const code=plan.planCode,price=code==='PILOT'?'무료체험 · 0원':code==='ENTERPRISE'?'별도 견적':safeNumber(plan.monthlyPriceKrw)?won(Math.round(Number(plan.monthlyPriceKrw)*(plan.limits?.vatExclusive?1.1:1))):'금액 확인 필요';
      return `<tr><th scope="row">${esc(plan.displayName||code)}${!plan.isActive?'<small class="hq-plan-disabled">신규 선택 중단</small>':''}</th><td data-label="월 결제 총액"><b>${esc(price)}</b></td><td data-label="직원">${esc(limit(plan.limits?.members,'명'))}</td><td data-label="월 HOME 게시">${esc(limit(plan.limits?.packagesMonthly,'건'))}</td><td><button type="button" class="btn" data-choose-plan="${esc(code)}" aria-controls="hqPlanDetail-${esc(code)}" aria-pressed="false">${esc(code)} 상세</button></td></tr>`;
    }).join('')||'<tr><td colspan="5">등록된 요금제가 없습니다.</td></tr>'}</tbody></table></div>`;
    for(const card of document.querySelectorAll('#planGrid .plan-card')){
      card.id='hqPlanDetail-'+card.dataset.plan;
      for(const p of card.querySelectorAll('p'))if(p.textContent.includes('연결한 병원 SOLAPI 계정'))p.remove();
    }
    const notice=byId('planGrid').querySelector(':scope>.notice');
    if(notice&&!notice.textContent.includes('HOME 앱 푸시는 구독에 포함됩니다.'))notice.insertAdjacentHTML('beforeend','<p>HOME 앱 푸시는 구독에 포함됩니다.</p>');
    if(!plans.some(plan=>plan.planCode===selectedPlanCode))selectedPlanCode=plans[0]?.planCode||'';
    comparison.querySelectorAll('[data-choose-plan]').forEach(button=>button.onclick=()=>selectPlan(button.dataset.choosePlan,{focus:true}));
    selectPlan(selectedPlanCode,{check:false});
  }

  const originalRenderPlans=renderPlans,originalRenderSubscriptions=renderSubscriptions;
  renderPlans=function(){originalRenderPlans();enhancePlans();renderPlanComparison();};
  renderSubscriptions=function(){originalRenderSubscriptions();compactSubscriptionTable();renderChannelCounts();filterSubscriptions();bindHospitalLinks();};
  function bindHospitalLinks(){
    document.querySelectorAll('[data-sub-clinic],[data-billing-clinic],[data-report-clinic]').forEach(b=>b.onclick=()=>{
      if(!allowLeave(()=>b.click()))return;
      selectedClinic=b.dataset.subClinic||b.dataset.billingClinic||b.dataset.reportClinic;
      byId('clinicSearch').value='';byId('clinicStatus').value='all';byId('clinicApproval').value='all';
      navigate('clinics',{check:false});
    });
  }
  const originalSavePlan=savePlan,originalSaveSubscription=saveSubscription;
  savePlan=card=>reviewedSave('plan:'+card.dataset.plan,()=>originalSavePlan(card));
  saveSubscription=()=>reviewedSave('subscription',()=>originalSaveSubscription());
  showView=view=>navigate(view);
  document.querySelectorAll('[data-material-view]').forEach(button=>button.onclick=()=>showView(button.dataset.materialView));
  loadBilling=async function(options={}){
    if(hasDirty()&&!activeSave&&!allowLeave(()=>loadBilling(options)))return;
    const pane=billingPane,retry=()=>loadBilling();
    if(pane==='payments')return loadPaymentAutomation();
    const planLoad=region('planGrid',()=>readPlans(!!options.forceCatalog),data=>{plans=data.plans||[];foundingPolicy=data.foundingPolicy||foundingPolicy;renderPlans();},retry);
    if(pane==='plans')return planLoad;
    salesChannels=null;renderChannelCounts();
    await Promise.all([
      planLoad,
      region('subscriptionTable',()=>req('/hq/subscriptions'),data=>{subscriptions=data.subscriptions||[];foundingPolicy=data.foundingPolicy||foundingPolicy;renderSubscriptions();},retry),
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
  loadClinics=async function(options={}){
    if(activeSave!=='subscription'&&!allowLeave(()=>loadClinics(options)))return;
    const seq=++clinicListSequence,q=byId('clinicSearch').value.trim(),status=byId('clinicStatus').value,approval=byId('clinicApproval').value;
    clinicDetailSequence++;
    saveState();setRegion('clinicList','loading');
    try{
      const data=await req(`/hq/clinics?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&approval=${encodeURIComponent(approval)}`);
      if(seq!==clinicListSequence)return;
      clinics=data.clinics||[];clinicListSnapshot={scope:hqReadScope(),q,status,approval};renderClinicList();setRegion('clinicList','ready');
      if(selectedClinic&&clinics.some(x=>x.id===selectedClinic))await loadClinicDetail(selectedClinic,{forceCatalog:!!options.forceCatalog});
      else{clinicDetailSequence++;byId('clinicDetail').innerHTML='<div class="empty">목록에서 병원을 선택해주세요.</div>';regions.get('clinicDetail')?.box.remove();editors.delete('subscription');}
    }catch(e){if(seq!==clinicListSequence)return;const keep=clinicListSnapshot?.scope===hqReadScope();if(!keep)byId('clinicList').replaceChildren();setRegion('clinicList','error',{error:e.message+(keep?' · 이전 검색 결과 유지 ('+(clinicListSnapshot.q||'전체 병원')+' / 승인 '+(clinicListSnapshot.approval==='all'?'전체':hqStatusLabel(clinicListSnapshot.approval,'approval'))+' / 운영 '+(clinicListSnapshot.status==='all'?'전체':hqStatusLabel(clinicListSnapshot.status,'operation'))+')':''),retry:()=>loadClinics()});}
  };
  const originalClinicList=renderClinicList;
  renderClinicList=function(){
    originalClinicList();
    byId('clinicListCount').textContent=`검색 결과 ${clinics.length}곳`;
    document.querySelectorAll('.clinic-item').forEach(row=>{
      row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-pressed',String(row.dataset.id===selectedClinic));
      row.onclick=()=>{
        if(!allowLeave(()=>row.click()))return;clinicReturnContext=captureClinicReturn(row);selectedClinic=row.dataset.id;clinicFocusRequested=selectedClinic;renderClinicList();saveState();loadClinicDetail(selectedClinic).catch(()=>{});
      };
      row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();row.click();}};
    });
  };
  byId('clinicSearch')?.setAttribute('aria-label','병원명 검색');
  byId('clinicApproval')?.setAttribute('aria-label','가입 승인 상태');
  byId('clinicStatus')?.setAttribute('aria-label','병원 운영 상태');
  byId('clinicFilterReset').onclick=()=>{
    if(!allowLeave(()=>byId('clinicFilterReset').click()))return;byId('clinicSearch').value='';byId('clinicApproval').value='all';byId('clinicStatus').value='all';loadClinics();
  };
  const originalQuickRender=renderHqQuickClinicResults;
  renderHqQuickClinicResults=function(rows,q){originalQuickRender(rows,q);byId('hqQuickClinicResults')?.querySelectorAll('[data-quick-clinic]').forEach(b=>b.onclick=()=>{
    if(!allowLeave(()=>b.click()))return;selectedClinic=b.dataset.quickClinic;byId('clinicSearch').value=b.dataset.quickName||'';hideHqQuickResults();navigate('clinics',{check:false});
  });};
  runHqQuickClinicSearch=async function(){
    const seq=++quickSequence,q=byId('hqQuickClinicSearch')?.value.trim()||'';
    if(!q||!byId('loginOverlay').classList.contains('hidden')){hideHqQuickResults();return;}
    const box=byId('hqQuickClinicResults');box.innerHTML='<div class="hq-quick-empty">검색 중…</div>';box.classList.remove('hidden');
    try{const data=await req(`/hq/clinics?q=${encodeURIComponent(q)}&status=all&approval=all`);if(seq!==quickSequence||byId('hqQuickClinicSearch').value.trim()!==q)return;renderHqQuickClinicResults(data.clinics||[],q);}
    catch(e){if(seq!==quickSequence||byId('hqQuickClinicSearch').value.trim()!==q)return;box.innerHTML='<div class="hq-quick-empty">검색하지 못했습니다. 다시 입력해주세요.</div>';}
  };
  const originalHide=hideHqQuickResults;
  hideHqQuickResults=function(){quickSequence++;originalHide();};
  byId('hqQuickClinicSearch')?.addEventListener('input',()=>{quickSequence++;if(!byId('hqQuickClinicSearch').value.trim())hideHqQuickResults();});
  byId('refresh').onclick=()=>reloadView();
  for(const [id,view] of [['integrationRefresh','integrations'],['refreshMessagingIntegration','integrations'],['productionRefresh','production']])if(byId(id))byId(id).onclick=()=>reloadView(view);
  byId('billingRefresh').onclick=()=>{if(allowLeave(()=>loadBilling()))loadBilling();};
  byId('hqPaymentRefresh').onclick=()=>{if(allowLeave(()=>loadPaymentAutomation()))loadPaymentAutomation();};
  window.addEventListener('beforeunload',event=>{if(hasDirty()||activeSave||voiceDrafts.size){event.preventDefault();event.returnValue='';}});
  window.addEventListener('popstate',()=>{
    if(restoring)return;
    const next=route(location.hash);
    if(!allowLeave(()=>{billingPane=next.pane;navigate(next.view,{push:true,check:false});})){writeRoute();return;}
    restoring=true;billingPane=next.pane;navigate(next.view,{push:false,check:false});restoring=false;
  });
  filterIds.forEach(id=>{byId(id)?.addEventListener('change',saveState);byId(id)?.addEventListener('input',saveState);});
  const originalUsageRender=renderUsageBilling,originalReportRender=renderMonthlyOperationsReportsHQ;
  renderUsageBilling=function(){originalUsageRender();bindHospitalLinks();};
  renderMonthlyOperationsReportsHQ=function(){originalReportRender();bindHospitalLinks();};
  function clearCounts(ids){ids.forEach(id=>{if(byId(id))byId(id).textContent='—';});}
  loadUsageBilling=async function(){
    if(!activeSave&&!allowLeave(()=>loadUsageBilling()))return;
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
    const {current,keep}=beginList('crm'),days=byId('crmHqPeriod').value;
    saveState();setRegion('crm','loading');if(!keep)clearCounts(crmCountIds);
    if(!keep)for(const id of ['crmHqClinicTable','crmHqJourneyTable'])byId(id).replaceChildren();
    try{
      const data=await req('/hq/followup-crm?days='+encodeURIComponent(days));
      if(!current())return;
      if(!data.overall||!Array.isArray(data.byClinic)||!Array.isArray(data.byJourney))throw Error('후속관리 조회 결과를 확인할 수 없습니다.');
      crmAnalytics=data;renderFollowupCrmHQ();setRegion('crm','ready');
    }catch(error){
      if(!current())return;
      if(!keep)clearCounts(crmCountIds);
      if(!keep)for(const id of ['crmHqClinicTable','crmHqJourneyTable'])byId(id).innerHTML='<div class="empty">조회하지 못했습니다. 위의 다시 시도를 눌러주세요.</div>';
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
  const contentStates={published:'공개 중',archived:'공개 중단',draft:'작성 중',review:'검토 대기',deleted:'삭제 이력'};
  let contentReady=false,contentLoading=false,contentCategoriesReady=false;const contentWindow={};
  const contentDue=x=>x.status==='published'&&!!x.reviewDueAt&&Number.isFinite(Date.parse(x.reviewDueAt))&&Date.parse(x.reviewDueAt)<=Date.now();
  const contentDate=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ko-KR'):'미등록';
  function lockContent(locked){
    // Read-only navigation remains available while the previous list is visible.
    byId('content').querySelectorAll('[data-content-status],[data-content-delete],[data-content-bulk],[data-guardian-category]').forEach(el=>el.disabled=locked||!contentReady);
    byId('contentRefresh').disabled=contentLoading||!!activeSave;
    byId('content').querySelectorAll('[data-guardian-category]').forEach(el=>el.disabled=locked||!contentReady||!contentCategoriesReady);
    updateContentBulkUi();
  }
  loadContent=async function({keepResult=false}={}){
    if(activeSave)return;
    const {current,keep}=beginList('content');contentReady=false;contentLoading=true;contentCategoriesReady=false;if(!keep)contents=[];
    globalThis.GuardianStudio?.refresh();
    setRegion('content','loading');if(!keep)clearCounts(contentCounts);lockContent(true);
    if(!keepResult)byId('contentBulkResult').textContent='';
    if(!keep){byId('contentResultSummary').textContent='';byId('contentTable').replaceChildren();}
    updateContentBulkUi();
    try{
      const [listResult,categoryResult]=await Promise.allSettled([req('/hq/content'),req('/hq/category-overrides')]);if(!current())return;
      if(listResult.status==='rejected')throw listResult.reason;const data=listResult.value;
      contentCategoriesReady=categoryResult.status==='fulfilled'&&Array.isArray(categoryResult.value.overrides);
      const categoryMap=new Map((contentCategoriesReady?categoryResult.value.overrides:[]).map(x=>[x.contentId,x.category]));
      if(!Array.isArray(data.contents))throw Error('보호자 안내자료 조회 결과를 확인할 수 없습니다.');
      contents=data.contents.map(x=>({...x,originalCategory:x.category,category:categoryMap.get(x.contentId)||x.category}));contentReady=true;
      const category=byId('contentCategory'),selected=category.dataset.restoreValue||category.value;
      delete category.dataset.restoreValue;
      const categories=[...new Set(contents.map(x=>CarestepHqWorkspace.category(x)).filter(Boolean))].sort((a,b)=>hqCategoryLabel(a).localeCompare(hqCategoryLabel(b),'ko'));
      category.innerHTML='<option value="all">전체 분류</option>'+categories.map(x=>`<option value="${esc(x)}">${esc(hqCategoryLabel(x))}</option>`).join('');
      globalThis.GuardianStudio?.updateCategories();category.value=[...category.options].some(x=>x.value===selected)?selected:'all';
      const counts=[contents.filter(x=>x.status!=='deleted').length,contents.filter(x=>x.status==='published').length,contents.filter(x=>x.status==='archived').length,contents.filter(contentDue).length];
      contentCounts.forEach((id,i)=>byId(id).textContent=fmt(counts[i]));
      renderContent();setRegion('content','ready');
      if(!contentCategoriesReady)byId('contentBulkResult').textContent='분류 설정을 불러오지 못했습니다. 원본 분류로 표시합니다. 새로고침 후 다시 확인해주세요.';
    }catch(error){
      if(!current())return;
      contentReady=false;if(!keep){contents=[];clearCounts(contentCounts);byId('contentResultSummary').textContent='';byId('contentTable').replaceChildren();}
      setRegion('content','error',{error:error.message,retry:()=>loadContent({keepResult:true})});
    }finally{if(current()){contentLoading=false;lockContent(false);saveState();}}
  };
  updateContentBulkUi=function(){
    const boxes=[...byId('contentTable').querySelectorAll('[data-content-bulk]')],selected=boxes.filter(x=>x.checked).length,all=byId('contentSelectAllArchived');
    all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;
    all.disabled=!contentReady||!!activeSave||!boxes.length;
    byId('contentBulkSummary').textContent=`선택 ${fmt(selected)}건 · 선택 가능 ${fmt(boxes.length)}건`;
    byId('contentBulkDelete').disabled=!contentReady||!!activeSave||!selected;
  };
  renderContent=function(){
    if(!contentReady&&!contents.length)return;
    const q=byId('contentSearch').value.trim().toLowerCase(),status=byId('contentStatus').value,category=byId('contentCategory').value,dueOnly=byId('contentDueOnly').checked;
    const groups=new Map(contents.map(x=>[x.contentId,{...x,drafts:[]}]));
    for(const d of globalThis.GuardianStudio?.items()||[]){const id=d.contentId||d.content_id||d.id;if(!groups.has(id))groups.set(id,{contentId:id,title:d.title,category:d.category||d.brief?.category||d.document?.template?.category||'',species:d.species||d.brief?.species||'',status:'unpublished',drafts:[]});groups.get(id).drafts.push(d);}
    const kind=x=>['draft','review'].includes(x.status)?'review':x.status==='published'?'published':'draft';
    const animal=byId('contentSpecies').value,order=byId('contentSort').value;
    const rows=[...groups.values()].filter(x=>(status==='all'?x.status!=='deleted':['draft','review'].includes(status)?x.drafts.some(d=>kind(d)===status):x.status===status)&&(category==='all'||CarestepHqWorkspace.category(x)===category||x.drafts.some(d=>CarestepHqWorkspace.category(d)===category))&&(!dueOnly||contentDue(x))&&(animal==='all'||[animal,'both'].includes(CarestepHqWorkspace.species(x.species)))&&(!q||[x.title,hqCategoryLabel(CarestepHqWorkspace.category(x)),x.contentId,x.species,...x.drafts.flatMap(d=>[d.title,d.category,d.species])].join(' ').toLowerCase().includes(q)));
    rows.forEach(x=>x.drafts.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))));
    rows.sort((a,b)=>order==='title'?String(a.title||'').localeCompare(String(b.title||''),'ko'):String(b.drafts[0]?.updatedAt||b.updatedAt||'').localeCompare(String(a.drafts[0]?.updatedAt||a.updatedAt||''))||String(a.title||'').localeCompare(String(b.title||''),'ko'));
    const shown=CarestepHqWorkspace.slice(rows,contentWindow,JSON.stringify([hqReadScope(),q,status,category,dueOnly,animal,order]));
    byId('contentResultSummary').textContent=`검색 결과 ${fmt(rows.length)}개`;
    const draftAction=d=>`<button type="button" class="btn small" data-guardian-draft="${esc(d.id)}">${kind(d)==='published'?'이전 공개본':'수정 초안 이어쓰기'} · ${esc(d.version||'미정')}판</button>`;
    byId('contentTable').innerHTML=shown.length?`<div class="table-wrap" tabindex="0" aria-label="보호자 안내자료 목록"><table class="table hq-content-table"><thead><tr><th class="gs-manage-cell">선택</th><th>안내자료</th><th>상태</th><th>검토 정보</th><th>관리</th></tr></thead><tbody>${shown.map(x=>{const drafts=x.drafts.filter(d=>d.status!=='published'),latest=drafts[0];return `<tr data-content-row="${esc(x.contentId)}"><td data-label="선택" class="gs-manage-cell">${x.status==='archived'?`<label class="hq-content-check"><input type="checkbox" data-content-bulk value="${esc(x.contentId)}" aria-label="${esc(x.title)} 선택"><span>선택</span></label>`:'—'}</td><td data-label="안내자료" class="hq-content-title"><b>${esc(x.title||'제목 없음')}</b><span class="muted">${esc(hqCategoryLabel(CarestepHqWorkspace.category(x)))}${x.species?' · '+esc(x.species):''}${x.version?' · 버전 '+esc(x.version):''}</span></td><td data-label="상태">${x.status!=='unpublished'?`<span class="status ${esc(x.status)}">${esc(contentStates[x.status]||x.status)}</span>`:''}${latest?`<span class="status">${kind(latest)==='review'?'검토 대기':'작성 중'} · ${esc(latest.version||'초안')}판</span>`:''}</td><td data-label="검토 정보">${esc(x.reviewerName||'검토자 미등록')}<br><span class="${contentDue(x)?'hq-content-due':'muted'}">재검토 ${esc(contentDate(x.reviewDueAt))}${contentDue(x)?' · 기한 도래':''}</span>${latest?`<br><span class="muted">초안 저장 ${esc(date(latest.updatedAt))}</span>`:''}</td><td data-label="관리"><div class="hq-content-actions">${['published','archived'].includes(x.status)?`<button class="btn small" data-guardian-document="${esc(x.contentId)}">공개본 열기</button>`:''}${latest?draftAction(latest):''}${x.status==='published'?`<button class="btn small" data-content-status="${esc(x.contentId)}" data-next="archived">공개 중단</button>`:x.status==='archived'?`<button class="btn small" data-content-status="${esc(x.contentId)}" data-next="published">다시 공개</button><button class="btn small danger" data-content-delete="${esc(x.contentId)}">삭제</button>`:''}</div><details class="gs-list-details"><summary>버전·상세 정보</summary><div class="hq-version-history">${x.drafts.filter(d=>d!==latest).map(draftAction).join('')}</div><button type="button" class="btn small" data-guardian-history="${esc(x.contentId)}">전체 작성 이력 확인</button><p>품질 점수 ${safeNumber(x.qualityScore)?fmt(x.qualityScore)+' / 100':'미등록'}</p><p>병원별 제공: ${x.status==='published'?`허용 ${fmt(x.enabledClinics)}곳 · 숨김 ${fmt(x.disabledClinics)}곳`:'현재 제공 중 아님'}</p><p>원본 분류: ${esc(x.originalCategory||x.category||'미분류')}${x.originalCategory&&x.category!==x.originalCategory?' · 적용 분류: '+esc(hqCategoryLabel(x.category)):''}</p><button type="button" class="btn small" data-guardian-category="${esc(x.contentId)}">분류 확인·수정</button><p>자료 ID: ${esc(x.contentId)}</p></details></td></tr>`;}).join('')}</tbody></table></div>`:`<div class="empty">${groups.size?'선택한 조건에 해당하는 자료가 없습니다. 검색 조건을 초기화해보세요.':'등록된 보호자 안내자료가 없습니다.'}</div>`;
    CarestepHqWorkspace.pager(byId('contentTable'),contentWindow,rows.length,renderContent,{top:true});
    byId('contentTable').querySelectorAll('[data-guardian-draft]').forEach(b=>b.onclick=()=>globalThis.GuardianStudio?.open(b.dataset.guardianDraft));
    byId('contentTable').querySelectorAll('[data-guardian-history]').forEach(b=>b.onclick=()=>globalThis.GuardianStudio?.history(b.dataset.guardianHistory,b));
    byId('contentTable').querySelectorAll('[data-guardian-category]').forEach(b=>b.onclick=()=>editContentCategory(b.dataset.guardianCategory));
    byId('contentTable').querySelectorAll('[data-guardian-document]').forEach(b=>b.onclick=()=>globalThis.GuardianStudio?.published(b.dataset.guardianDocument));
    byId('contentTable').querySelectorAll('[data-content-status]').forEach(b=>b.onclick=()=>patchContent(b.dataset.contentStatus,b.dataset.next));
    byId('contentTable').querySelectorAll('[data-content-delete]').forEach(b=>b.onclick=()=>deleteContent(b.dataset.contentDelete));
    byId('contentTable').querySelectorAll('[data-content-bulk]').forEach(b=>b.onchange=updateContentBulkUi);
    lockContent(contentLoading||!!activeSave);saveState();
  };
  function editContentCategory(id){
    if(activeSave||reviewOpen||!contentReady||!contentCategoriesReady)return;
    const item=contents.find(x=>x.contentId===id);if(!item)return;
    const owner=hqReadScope(),epoch=readEpoch;
    const dialog=document.createElement('dialog');dialog.className='hq-review';dialog.setAttribute('aria-labelledby','hqCategoryTitle');
    const codes=['수술시술','입원퇴원','만성질환','예방관리','재활생활','종양중증','고양이특화','병원제작'];
    dialog.innerHTML=`<h2 id="hqCategoryTitle">안내자료 분류 수정</h2><p><b>${esc(item.title||id)}</b></p><p>현재 분류: ${esc(hqCategoryLabel(item.category))}</p><label>변경할 분류<select class="input" data-category-value><option value="">분류 선택</option>${codes.map(x=>`<option value="${x}">${esc(hqCategoryLabel(x))}</option>`).join('')}</select></label><p class="muted">자료 검색과 연결된 회복관리 일정의 분류에 적용합니다. 본문·버전·공개 상태는 유지됩니다.</p><p role="status" data-category-message></p><div class="hq-review-actions"><button class="btn" data-category-cancel>취소</button><button class="btn primary" data-category-save>분류 저장</button></div>`;
    const select=dialog.querySelector('[data-category-value]'),save=dialog.querySelector('[data-category-save]'),cancel=dialog.querySelector('[data-category-cancel]'),message=dialog.querySelector('[data-category-message]');
    select.value=codes.includes(item.category)?item.category:'';let busy=false;
    const valid=()=>owner===hqReadScope()&&epoch===readEpoch&&CarestepHqWorkspace.ready();
    const close=()=>{if(busy)return;reviewOpen=false;closeReview=null;dialog.close();dialog.remove();};
    const update=()=>{save.disabled=busy||!select.value||select.value===item.category;};
    select.onchange=update;cancel.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});reviewOpen=true;closeReview=close;
    save.onclick=async()=>{
      if(busy||activeSave||!valid()||!select.value||select.value===item.category)return;
      busy=true;activeSave='content-category';update();select.disabled=true;cancel.disabled=true;lockContent(true);message.textContent='분류 저장 중…';
      try{
        await req('/hq/category-overrides/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({category:select.value})});
        if(!valid())return;
        item.category=select.value;message.textContent='분류를 저장했습니다.';
        busy=false;activeSave=null;close();await loadContent({keepResult:true});byId('contentBulkResult').textContent='분류 저장 완료 · '+item.title+' · '+hqCategoryLabel(item.category);
      }catch(error){if(valid())message.textContent='저장하지 못했습니다. '+(error.message||'다시 확인해주세요.');}
      finally{busy=false;activeSave=null;select.disabled=false;cancel.disabled=false;update();lockContent(false);if(!valid())close();}
    };
    document.body.append(dialog);dialog.showModal();update();select.focus();
  }
  async function changeContent(ids,status){
    if(activeSave||!contentReady)return false;
    const targets=[...new Set(ids)].map(id=>contents.find(x=>x.contentId===id)).filter(x=>x&&(status==='archived'?x.status==='published':x.status==='archived'));
    if(!targets.length)return false;
    const action=status==='archived'?'공개 중단':status==='published'?'다시 공개':'삭제';
    const names=targets.slice(0,5).map(x=>x.title||x.contentId).join('\n')+(targets.length>5?`\n외 ${targets.length-5}건`:'');
    const impact=status?'연결된 자동생성 회복관리 일정의 상태도 함께 변경됩니다.':'연결된 자동생성 회복관리 일정도 삭제 처리됩니다. 과거 운영 이력용 최소 정보는 보존됩니다. 화면에서 삭제를 되돌릴 수 없습니다.';
    const owner=hqReadScope(),epoch=readEpoch,states=targets.map(x=>[x.contentId,x.status]);
    const valid=()=>contentReady&&owner===hqReadScope()&&epoch===readEpoch&&states.every(([id,value])=>contents.find(x=>x.contentId===id)?.status===value);
    if(!await CarestepHqWorkspace.confirm(`${targets.length}건을 ${action}할까요?\n\n${names}\n\n${impact}`,{valid}))return false;
    if(activeSave||!valid())return false;
    activeSave='content';lockContent(true);
    const result=byId('contentBulkResult'),failed=[];let done=0;
    try{
      for(const entry of targets){
        if(owner!==hqReadScope()||epoch!==readEpoch||!CarestepHqWorkspace.ready())break;
        result.textContent=`${action} 처리 중 · ${done+failed.length+1} / ${targets.length}건`;
        try{
          await req('/hq/content/'+encodeURIComponent(entry.contentId),status?{method:'PATCH',body:JSON.stringify({status})}:{method:'DELETE'});
          done++;
        }catch(error){failed.push({id:entry.contentId,title:entry.title||entry.contentId,error:error.message||'처리 결과 확인 필요'});}
      }
    }finally{activeSave=null;lockContent(false);}
    if(owner!==hqReadScope()||epoch!==readEpoch)return false;
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
  byId('contentManageMode').onchange=event=>{byId('content').classList.toggle('gs-managing',event.target.checked);if(!event.target.checked){byId('contentTable').querySelectorAll('[data-content-bulk]').forEach(x=>x.checked=false);updateContentBulkUi();}};
  const contentOptions=document.createElement('details');contentOptions.className='hq-secondary-filters';contentOptions.innerHTML='<summary>상세 조건·정렬</summary><div class="hq-secondary-grid"></div>';
  for(const id of ['contentCategory','contentSpecies','contentSort','contentDueOnly'])contentOptions.lastElementChild.append(byId(id).closest('label'));
  byId('contentSearch').closest('.hq-content-filters').append(contentOptions);
  byId('contentRefresh').onclick=()=>loadContent();
  byId('contentSearch').oninput=()=>{renderContent();globalThis.GuardianStudio?.search();};
  for(const id of ['contentStatus','contentCategory','contentDueOnly','contentSpecies','contentSort'])byId(id).onchange=()=>{renderContent();};
  byId('contentReset').onclick=()=>{
    byId('contentSearch').value='';byId('contentStatus').value='all';byId('contentCategory').value='all';byId('contentDueOnly').checked=false;byId('contentSpecies').value='all';byId('contentSort').value='recent';
    renderContent();globalThis.GuardianStudio?.search();
  };
  byId('contentSelectAllArchived').onchange=event=>{
    byId('contentTable').querySelectorAll('[data-content-bulk]').forEach(box=>box.checked=event.target.checked);
    updateContentBulkUi();
  };
  byId('contentBulkDelete').onclick=()=>bulkDeleteArchivedContent();
  const voiceTypes={condition:'질환 자료 요청',feature:'기능 제안',inquiry:'문의'};
  const voiceStates={new:'신규',reviewing:'접수 검토',planned:'제작 예정',building:'제작 중',review:'내용 검토',published:'공개 완료',answered:'답변 완료',hold:'보류'};
  const voiceDrafts=new Map(),voiceWindow={};let voiceOwner='',voiceCursor=null,voiceLoading=false;
  const voiceSearch=document.createElement('form');voiceSearch.className='hq-voice-search';voiceSearch.innerHTML='<label>문의 검색<input type="search" class="input" id="hqVoiceSearch" placeholder="병원명·제목·문의 내용" maxlength="160"></label><button class="btn" type="submit">검색</button><button class="btn" type="button" data-voice-reset>조건 초기화</button>';byId('voiceTable').before(voiceSearch);voiceSearch.onsubmit=e=>{e.preventDefault();void loadVoice();};voiceSearch.querySelector('[data-voice-reset]').onclick=()=>{byId('hqVoiceSearch').value='';byId('voiceType').value='all';byId('voiceStatus').value='all';void loadVoice();};
  function voiceDirty(id){return voiceDrafts.has(id);}
  function voiceControlsDisabled(disabled){byId('voice').querySelectorAll('select,button,input,textarea').forEach(el=>{el.disabled=disabled||(el.matches('.voice-save,.voice-cancel')&&!voiceDirty(el.closest('tr')?.dataset.voice));});}
  loadVoice=async function(options={}){
    if(activeSave||options.more&&voiceLoading)return;const owner=hqReadScope();if(voiceOwner!==owner){voiceDrafts.clear();voiceOwner=owner;voiceCursor=null;voice=[];}
    const {current,keep}=beginList('voice'),type=byId('voiceType').value,status=byId('voiceStatus').value,q=byId('hqVoiceSearch').value.trim();saveState();setRegion('voice','loading');voiceLoading=true;
    if(!keep&&!options.more){byId('voiceResultSummary').textContent='';byId('voiceTable').replaceChildren();}voiceControlsDisabled(true);
    const params=new URLSearchParams({type,status});if(q)params.set('q',q);if(options.more&&voiceCursor)params.set('cursor',voiceCursor);
    try{const data=await req('/hq/voice?'+params);if(!current())return;if(!Array.isArray(data.requests))throw Error('요청 목록의 조회 결과를 확인할 수 없습니다.');voice=options.more?[...new Map([...voice,...data.requests].map(x=>[x.id,x])).values()]:data.requests;voiceCursor=data.pagination?.nextCursor||null;renderVoice();setRegion('voice','ready');}
    catch(error){if(current())setRegion('voice','error',{error:error.message,retry:()=>loadVoice(options)});}
    finally{if(current()){voiceLoading=false;voiceControlsDisabled(false);}}
  };
  renderVoice=function(){
    const signature=JSON.stringify([voiceOwner,byId('voiceType').value,byId('voiceStatus').value,byId('hqVoiceSearch').value]),rows=CarestepHqWorkspace.slice(voice,voiceWindow,signature);
    byId('voiceResultSummary').textContent=`조회 ${voice.length.toLocaleString('ko-KR')}건 · 최신순${voiceCursor?' · 이전 요청 더 있음':''}${voiceDrafts.size?' · 저장 전 변경 '+voiceDrafts.size+'건 유지 중':''}`;
    byId('voiceTable').innerHTML=voice.length?`<div class="table-wrap"><table class="table hq-voice-table hq-responsive-table"><thead><tr><th>요청·병원</th><th>내용</th><th>처리 상태·메모</th><th>저장</th></tr></thead><tbody>${rows.map(x=>{const pending=voiceDrafts.get(x.id),v=pending||x;return `<tr data-voice="${esc(x.id)}" data-saved-status="${esc(x.status)}"><td data-label="요청·병원"><b>${esc(x.title)}</b><p>${esc(x.clinicName||'병원 미연결')}</p><small>${esc(voiceTypes[x.type]||x.type)} · ${date(x.createdAt)} · 동일 요청 ${fmt(x.sameRequestCount)}건</small></td><td data-label="내용"><details><summary>요청 내용 보기</summary><div class="hq-voice-body">${esc(x.details||'추가 내용 없음')}</div>${x.adminNote?`<p class="hq-voice-body"><b>기존 관리 메모</b><br>${esc(x.adminNote)}</p>`:''}</details></td><td data-label="처리 상태·메모"><label>처리 상태<select class="input voice-status" aria-label="${esc(x.title)} 처리 상태">${Object.entries(voiceStates).map(([key,label])=>`<option value="${key}" ${v.status===key?'selected':''}>${label}</option>`).join('')}</select></label><label>관리 메모<textarea class="input voice-note" maxlength="1200" rows="3" aria-label="${esc(x.title)} 관리 메모">${esc(v.adminNote||'')}</textarea></label><small>최근 처리 ${date(x.updatedAt||x.createdAt)}</small></td><td data-label="저장"><button type="button" class="btn primary voice-save" ${pending?'':'disabled'}>변경 저장</button><button type="button" class="btn voice-cancel" ${pending?'':'disabled'}>수정 취소</button><span class="hq-voice-save-result" role="status">${pending?'저장 전 · 입력 유지':''}</span></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty">선택한 조건에 해당하는 병원 요청이 없습니다. 검색 조건을 초기화해보세요.</div>';
    for(const row of byId('voiceTable').querySelectorAll('[data-voice]')){const id=row.dataset.voice,entry=voice.find(x=>x.id===id);const change=()=>{const value={status:row.querySelector('.voice-status').value,adminNote:row.querySelector('.voice-note').value};if(value.status===entry.status&&value.adminNote===(entry.adminNote||''))voiceDrafts.delete(id);else voiceDrafts.set(id,value);row.querySelector('.hq-voice-save-result').textContent=voiceDirty(id)?'저장 전 · 입력 유지':'';voiceControlsDisabled(false);};row.querySelector('.voice-status').onchange=change;row.querySelector('.voice-note').oninput=change;row.querySelector('.voice-save').onclick=()=>saveVoice(row);row.querySelector('.voice-cancel').onclick=async()=>{if(await CarestepHqWorkspace.confirm('이 문의의 저장하지 않은 변경사항을 취소할까요?')){voiceDrafts.delete(id);renderVoice();}};}
    CarestepHqWorkspace.pager(byId('voiceTable'),voiceWindow,voice.length,renderVoice);
    if(voiceCursor){const more=document.createElement('button');more.className='btn hq-load-more';more.textContent='이전 요청 더 불러오기';more.onclick=()=>loadVoice({more:true});byId('voiceTable').append(more);}
  };
  saveVoice=async function(row){
    if(activeSave)return false;const id=row.dataset.voice,entry=voice.find(x=>x.id===id),body=voiceDrafts.get(id),owner=hqReadScope(),epoch=readEpoch,result=row.querySelector('.hq-voice-save-result');
    if(!entry||!body||!Object.hasOwn(voiceStates,body.status)||!byId('loginOverlay').classList.contains('hidden'))return false;
    activeSave='voice:'+id;voiceControlsDisabled(true);result.textContent='저장 중…';
    try{await req('/hq/voice/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(body)});if(owner!==hqReadScope()||epoch!==readEpoch)return false;Object.assign(entry,body);voiceDrafts.delete(id);result.textContent='저장 완료';toast('처리 상태와 관리 메모를 저장했습니다.');}
    catch(error){if(owner===hqReadScope()&&epoch===readEpoch)result.textContent=(error.message||'저장 실패')+' · 입력 유지 · 다시 시도해주세요.';return false;}
    finally{activeSave=null;if(owner===hqReadScope()&&epoch===readEpoch)voiceControlsDisabled(false);}
    await loadVoice();return true;
  };
  byId('crmHqRefresh').onclick=()=>loadFollowupCrmHQ();
  byId('crmHqPeriod').onchange=()=>loadFollowupCrmHQ();
  byId('voiceRefresh').onclick=()=>loadVoice();
  byId('voiceType').onchange=()=>loadVoice();
  byId('voiceStatus').onchange=()=>loadVoice();
  const originalClinicSave=saveClinic;
  saveClinic=()=>{if(!allowLeave(()=>saveClinic()))return;return originalClinicSave();};
  byId('usageBillingRefresh').onclick=()=>loadUsageBilling();
  byId('billingMonth').onchange=()=>loadUsageBilling();
  billingLayout();dashboardLayout();
  byId('hqOverviewMetrics')?.addEventListener('toggle',()=>{if(byId('hqOverviewMetrics').open&&currentView==='dashboard')void overviewMetrics();});
  byId('hqDashboardDiagnostics')?.addEventListener('toggle',()=>{if(byId('hqDashboardDiagnostics').open&&currentView==='dashboard')void overviewDiagnostics();});
  byId('journeySearch').parentElement.classList.add('hq-journey-filters');
  document.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('aria-label','표 · 좌우로 스크롤할 수 있습니다.');});
  // One set of visible status controls and a reliable way back to all schedules.
  const journeyStatus=byId('journeyStatusFilter');
  journeyStatus.hidden=true;
  byId('journeyScope').querySelector('option[value="review"]')?.remove();
  byId('journeyScope').setAttribute('aria-label','회복관리 제공 범위');
  byId('journeySearch').setAttribute('aria-label','회복관리 검색');
  const resetJourneys=document.createElement('button');
  resetJourneys.type='button';resetJourneys.className='btn';resetJourneys.id='hqJourneyReset';
  resetJourneys.textContent='조건 초기화';
  byId('journeyScope').after(resetJourneys);
  function resetJourneyFilters(){
    byId('journeySearch').value='';byId('journeyScope').value='all';journeyStatus.value='all';
    renderPatientJourneysHQ();saveState();
  }
  resetJourneys.onclick=resetJourneyFilters;
  const journeyKpis=byId('journeys').querySelector('.kpis');
  journeyKpis.classList.add('hq-journey-summary');
  const applyCard=byId('journeyApplyCount').closest('.kpi');
  applyCard.querySelector('span').textContent='누적 적용 횟수';
  applyCard.querySelector('small').textContent='병원에서 일정에 적용한 횟수';
  journeyKpis.innerHTML='<div class="kpi"><span>전체 회복관리</span><strong id="hqJourneyTotal">—</strong></div><div class="kpi"><span>승인 필요</span><strong id="hqJourneyReview">—</strong></div>';
  journeyKpis.append(applyCard);
  const originalJourneyRender=renderPatientJourneysHQ;
  renderPatientJourneysHQ=function(){
    if(!byId('journeyScope').value)byId('journeyScope').value='all';
    originalJourneyRender();
    byId('hqJourneyTotal').textContent=fmt(patientJourneys.length);
    byId('hqJourneyReview').textContent=fmt(patientJourneys.filter(x=>['draft','update'].includes(journeyOperationalState(x))).length);
    byId('journeyStatusQuick').querySelector('[data-journey-status-quick="all"]').onclick=()=>{if(!journeyBulkBusy)resetJourneyFilters();};
    resetJourneys.disabled=journeyBulkBusy;
    saveState();
  };
  function foldHelp(selector,title){
    const node=document.querySelector(selector);if(!node)return;
    const details=document.createElement('details'),summary=document.createElement('summary');
    details.className='hq-help';summary.textContent=title;node.before(details);details.append(summary,node);
  }
  foldHelp('#journeys .card>.notice','사용 안내');
  foldHelp('#journeys .card>.notice','개인정보 안내');

  const actionGrid=byId('dashboard').querySelector('.approval-center-grid');
  const actionCards=[...actionGrid.querySelectorAll('[data-approval-center]')];
  const actionTotal=byId('acTotalPending').parentElement;
  actionTotal.className='hq-action-summary';actionGrid.before(actionTotal);
  actionTotal.querySelector('span').textContent='확인 항목';
  actionTotal.querySelector('small').id='acTargetClinics';
  actionTotal.querySelector('small').textContent='대상 병원 확인 중';
  const units=document.createElement('span');units.textContent='건';units.className='hq-action-unit';
  byId('acTotalPending').after(units);
  actionTotal.title='대상 병원은 중복을 제외합니다. 공통 콘텐츠와 회복관리 승인 건은 병원 수에 포함하지 않습니다.';
  const zeroActions=document.createElement('details'),zeroSummary=document.createElement('summary'),zeroGrid=document.createElement('div');
  zeroActions.id='hqZeroActions';zeroActions.className='hq-zero-actions';zeroGrid.className='approval-center-grid';
  zeroActions.append(zeroSummary,zeroGrid);actionGrid.after(zeroActions);
  const noActions=document.createElement('p');noActions.id='hqNoActions';noActions.className='hq-no-actions';
  noActions.textContent='현재 확인할 업무가 없습니다.';actionGrid.after(noActions);
  function updateActionLayout(){
    for(const card of actionCards){
      (card.querySelector('b')?.dataset.state==='ready'&&card.classList.contains('hq-action-zero')?zeroGrid:actionGrid).append(card);
    }
    zeroSummary.textContent=`대기 없음 · ${zeroGrid.children.length}개 분류`;
    zeroActions.hidden=!zeroGrid.children.length;
    noActions.hidden=!!actionGrid.children.length;
    units.hidden=!/^\d[\d,]*$/.test(byId('acTotalPending').textContent);
  }
  updateActionLayout();

  const subscriptionStatus=document.createElement('select');
  subscriptionStatus.id='hqSubscriptionStatus';subscriptionStatus.className='input';
  subscriptionStatus.setAttribute('aria-label','구독 목록 상태');
  subscriptionStatus.innerHTML='<option value="all">전체 구독</option><option value="past_due">결제 확인 필요</option>';
  byId('hqSubscriptionSearch').after(subscriptionStatus);
  subscriptionStatus.onchange=()=>{filterSubscriptions();saveState();};
  const surveyScope=document.createElement('select');
  surveyScope.id='hqSurveyScope';surveyScope.className='input';surveyScope.setAttribute('aria-label','회복응답 목록 범위');
  surveyScope.innerHTML='<option value="all">전체 회복응답</option><option value="open">미확인 응답 있는 항목</option>';
  byId('surveyHqPeriod').after(surveyScope);
  byId('surveyHqPeriod').setAttribute('aria-label','회복응답 집계 기간');
  surveyScope.onchange=()=>{if(surveyAnalytics)renderGuardianSurveyHQ();saveState();};
  const surveyScopeNote=document.createElement('p');surveyScopeNote.id='hqSurveyScopeNote';surveyScopeNote.className='muted';
  byId('surveys').querySelector('.grid2').before(surveyScopeNote);
  openApprovalCenterTarget=function(view){
    if(!allowLeave(()=>openApprovalCenterTarget(view)))return;
    if(view==='journeys'){
      byId('journeySearch').value='';byId('journeyScope').value='all';journeyStatus.value='review';
    }else if(view==='content'){
      byId('contentSearch').value='';byId('contentCategory').value='all';byId('contentStatus').value='published';byId('contentDueOnly').checked=true;
    }else if(view==='senders'){
      byId('senderSearch').value='';byId('senderStatusFilter').value='attention';byId('senderAutoFilter').value='all';
    }else if(view==='onboarding'){
      byId('onboardingSearch').value='';byId('onboardingStatusFilter').value='attention';
    }else if(view==='customerSuccess'){
      byId('customerSuccessSearch').value='';byId('customerSuccessStatus').value='risk';
      byId('customerSuccessPlan').value='all';byId('customerSuccessSignal').value='all';customerSuccessQuick='all';
    }else if(view==='billing'){
      setBillingPane('subscriptions',{push:false,check:false});byId('hqSubscriptionSearch').value='';subscriptionStatus.value='past_due';
    }else if(view==='surveys'){
      byId('surveyHqPeriod').value='90';surveyScope.value='open';
    }
    navigate(view,{check:false});
  };

  const originalSuccessRender=renderCustomerSuccess;
  renderCustomerSuccess=function(){
    originalSuccessRender();
    const table=byId('customerSuccessRows').closest('table');
    table.classList.add('hq-adoption-table');
    compactHqTable(table,['병원','사용 현황','안내·후속관리 활용 점수','확인 우선순위 점수','최근 30일 활용','개통 상태','체험·구독','최근 활동','핵심 사유','다음 작업'],[0,1,8,9],'점수·이용 상세');
  };
  function compactAnalytics(id,labels,keep){
    const table=byId(id).querySelector('table');if(table)compactHqTable(table,labels,keep,'집계 상세');
  }
  const surveyIds=['surveyHqInvited','surveyHqResponded','surveyHqUrgent','surveyHqWatch','surveyHqOpen','surveyHqCallbacks','surveyHqSat'];
  let surveyReady=false;
  function surveyPending(){
    for(const id of surveyIds)byId(id).textContent='—';
    byId('surveyHqRate').textContent='응답률 확인 중';byId('surveyHqOpenMeta').textContent='미확인 건수 확인 중';
  }
  surveyPending();
  loadGuardianSurveyHQ=async function(){
    const {current,keep}=beginList('surveys'),days=byId('surveyHqPeriod').value;
    saveState();surveyReady=false;if(!keep){surveyPending();byId('hqSurveyScopeNote').textContent='';for(const id of ['surveyHqClinicTable','surveyHqJourneyTable'])byId(id).replaceChildren();}setRegion('surveys','loading');
    try{
      const data=await req('/hq/surveys?days='+encodeURIComponent(days));if(!current())return;
      if(data.ok===false||!data.overall||!Array.isArray(data.byClinic)||!Array.isArray(data.byJourney))throw Error('회복응답 조회 결과를 확인할 수 없습니다.');
      surveyAnalytics=data;surveyReady=true;renderGuardianSurveyHQ();setRegion('surveys','ready');
    }catch(error){
      if(!current())return;
      if(!keep){surveyPending();byId('surveyHqRate').textContent='응답률 확인 필요';byId('surveyHqOpenMeta').textContent='미확인 건수 확인 필요';
      byId('hqSurveyScopeNote').textContent='선택한 기간의 결과를 조회하지 못했습니다.';
      for(const id of ['surveyHqClinicTable','surveyHqJourneyTable'])byId(id).innerHTML='<div class="empty">조회하지 못했습니다. 위의 다시 시도를 눌러주세요.</div>';
      }
      setRegion('surveys','error',{error:error.message,retry:()=>loadGuardianSurveyHQ()});
    }
  };
  const originalSurveyRender=renderGuardianSurveyHQ;
  renderGuardianSurveyHQ=function(){
    if(!surveyReady)return;
    originalSurveyRender();
    byId('hqSurveyScopeNote').textContent=`최근 ${byId('surveyHqPeriod').value}일 전체 집계 · 아래 목록: ${surveyScope.value==='open'?'미확인 응답이 있는 병원·회복관리만':'전체 병원·회복관리'}`;
    compactAnalytics('surveyHqClinicTable',['병원','응답 요청','응답률','빠른 확인 필요','확인 권장','미확인','연락 요청'],[0,5,3,6]);
    compactAnalytics('surveyHqJourneyTable',['회복관리','응답률','빠른 확인 필요','확인 권장','미확인','호전 응답률'],[0,4,2,1]);
  };
  byId('surveyHqRefresh').onclick=()=>loadGuardianSurveyHQ();
  byId('surveyHqPeriod').onchange=()=>loadGuardianSurveyHQ();
  const readableCrmRender=renderFollowupCrmHQ;
  renderFollowupCrmHQ=function(){
    readableCrmRender();
    compactAnalytics('crmHqClinicTable',['병원','진행 중','검토 필요','최우선 확인','평균 위험 점수','회복응답률'],[0,1,2,3]);
    compactAnalytics('crmHqJourneyTable',['회복관리','진행 중','검토 필요','고위험 이상','호전 응답률','문자 발송 성공률'],[0,1,2,3]);
  };

  // Keep the hospital list primary; reveal metrics and detailed conditions on demand.
  function foldPortfolioMetrics(view,selector,coreIds,detailId){
    const root=byId(view),grid=root.querySelector(selector),details=document.createElement('details');
    details.id=detailId;details.className='hq-portfolio-metrics';
    details.innerHTML='<summary>전체 지표 보기</summary><div class="hq-extra-metrics"></div>';
    for(const card of [...grid.children])if(!coreIds.some(id=>card.querySelector('#'+id)))details.lastElementChild.append(card);
    grid.classList.add('hq-core-metrics');grid.after(details);
    return details;
  }
  const adoptionMetrics=foldPortfolioMetrics('customerSuccess','.customer-success-kpis',['csTotal','csRisk','csTrialEnding'],'hqAdoptionMetrics');
  const onboardingMetrics=foldPortfolioMetrics('onboarding','.hq-onboarding-kpis',['obTotal','obLive','obAttention'],'hqOnboardingMetrics');
  adoptionMetrics.append(byId('customerSuccessGenerated'));
  onboardingMetrics.append(byId('onboardingGenerated'));
  byId('csTotal').previousElementSibling.textContent='전체 병원';
  byId('csRisk').previousElementSibling.textContent='사용 현황 확인 필요';
  byId('obTotal').previousElementSibling.textContent='전체 병원';
  byId('obLive').previousElementSibling.textContent='기본 준비 완료';
  byId('obAttention').previousElementSibling.textContent='기본 준비 확인 필요';
  for(const option of byId('onboardingStatusFilter').options){if(option.value==='live')option.textContent='기본 준비 완료';if(option.value==='attention')option.textContent='기본 준비 확인 필요';if(option.value==='setting')option.textContent='기본 준비 중';}

  const adoptionFilters=document.createElement('details');
  adoptionFilters.id='hqAdoptionFilters';adoptionFilters.className='hq-list-filters';
  adoptionFilters.innerHTML='<summary>상세 조건</summary><div class="hq-filter-fields"></div>';
  const filterFields=adoptionFilters.lastElementChild,searchBar=byId('customerSuccessSearch').parentElement;
  for(const [id,label] of [['customerSuccessStatus','이용 상태'],['customerSuccessPlan','요금제'],['customerSuccessSignal','확인할 사항']]){
    const field=byId(id),wrap=document.createElement('label');
    wrap.textContent=label;field.setAttribute('aria-label',label);wrap.append(field);filterFields.append(wrap);
  }
  const extraQuick=document.createElement('div');extraQuick.className='hq-priority-chips';
  for(const key of ['trial3','payment','inactive14'])extraQuick.append(document.querySelector('[data-cs-quick="'+key+'"]'));
  adoptionFilters.append(extraQuick,byId('customerSuccessQuick').querySelector('.hq-priority-legend'));
  searchBar.after(adoptionFilters);
  searchBar.classList.add('hq-portfolio-search');
  byId('customerSuccessSearch').setAttribute('aria-label','도입 현황 병원명 검색');
  const resetAdoption=document.createElement('button');resetAdoption.type='button';resetAdoption.className='btn';resetAdoption.id='hqAdoptionReset';resetAdoption.textContent='조건 초기화';searchBar.append(resetAdoption);
  const adoptionSummary=document.createElement('p');adoptionSummary.id='hqAdoptionResults';adoptionSummary.className='hq-results-summary';adoptionSummary.setAttribute('role','status');adoptionFilters.after(adoptionSummary);
  adoptionSummary.textContent='병원 목록을 확인하고 있습니다.';
  function clearAdoptionFilters(){
    byId('customerSuccessSearch').value='';
    for(const id of ['customerSuccessStatus','customerSuccessPlan','customerSuccessSignal'])byId(id).value='all';
  }
  function adoptionConditions(){
    const labels=[],q=byId('customerSuccessSearch').value.trim();
    if(q)labels.push('검색: '+q);
    if(customerSuccessQuick!=='all')labels.push(document.querySelector('[data-cs-quick="'+customerSuccessQuick+'"]')?.textContent||'빠른 조건');
    for(const id of ['customerSuccessStatus','customerSuccessPlan','customerSuccessSignal'])if(byId(id).value!=='all')labels.push(byId(id).selectedOptions[0]?.textContent);
    return labels.filter(Boolean);
  }
  function updateAdoptionResults(){
    const conditions=adoptionConditions(),loaded=Array.isArray(customerSuccessPortfolio?.clinics);
    const count=byId('customerSuccessRows').querySelectorAll('.hq-compact-main-row').length;
    adoptionSummary.textContent=loaded?`전체 ${fmt(customerSuccessPortfolio.clinics.length)}곳 · 현재 표시 ${fmt(count)}곳${conditions.length?' · '+conditions.join(' · '):''}`:'병원 목록을 확인하고 있습니다.';
    adoptionFilters.querySelector('summary').textContent='상세 조건'+(conditions.length?` · 적용 ${conditions.length}개`:'');
    document.querySelectorAll('[data-cs-quick]').forEach(button=>{
      const selected=button.dataset.csQuick===customerSuccessQuick&&(customerSuccessQuick!=='all'||!conditions.length);
      button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
    });
    saveState();
  }
  document.querySelectorAll('[data-cs-quick]').forEach(button=>{
    if(button.dataset.csQuick==='all')button.textContent='전체 병원';
    if(button.dataset.csQuick==='risk')button.textContent='사용 현황 확인 필요';
    button.onclick=()=>{clearAdoptionFilters();customerSuccessQuick=button.dataset.csQuick||'all';renderCustomerSuccess();};
  });
  resetAdoption.onclick=()=>{clearAdoptionFilters();customerSuccessQuick='all';renderCustomerSuccess();};
  for(const id of ['customerSuccessStatus','customerSuccessPlan','customerSuccessSignal'])byId(id).onchange=()=>renderCustomerSuccess();
  byId('customerSuccessSearch').oninput=()=>renderCustomerSuccess();
  byId('customerSuccessStatus').querySelector('[value="risk"]').textContent='사용 현황 확인 필요';
  byId('customerSuccessSignal').querySelector('[value="neverUsed"]').textContent='사용 기록 없음';

  function operationalText(value){
    return String(value||'').replaceAll('온보딩','개통 준비').replaceAll('Calendar','캘린더')
      .replaceAll('실사용 이벤트','사용 기록').replaceAll('실사용 없음','사용 기록 없음')
      .replaceAll('첫 퇴원자료 미생성','안내자료 사용 현황 확인').replaceAll('첫 후속관리 미완료','후속관리 진행 현황 확인').replaceAll('퇴원자료','보호자 안내자료');
  }
  function condenseReasons(root,selector){
    root.querySelectorAll(selector).forEach(box=>{
      const reasons=[...box.children];
      for(const reason of reasons)reason.textContent=operationalText(reason.textContent);
      if(reasons.length<=2)return;
      const details=document.createElement('details'),summary=document.createElement('summary'),more=document.createElement('div');
      details.className='hq-more-reasons';summary.textContent=`추가 사유 ${reasons.length-2}개`;
      more.className='hq-reason-list';more.append(...reasons.slice(2));details.append(summary,more);box.append(details);
    });
  }
  const onboardingNotice=byId('onboarding').querySelector('.notice');
  byId('onboarding').querySelector('.head p').textContent='기본 준비는 병원 정보·직원 계정으로 확인합니다. 문자 발송·안내자료·후속관리는 필요할 때 설정하는 선택 기능입니다.';
  onboardingNotice.innerHTML='<details class="hq-technical-help"><summary>문자·알림톡 연동 안내</summary><p>SOLAPI 계정을 연결하면 문자 발송과 알림톡 설정을 확인할 수 있습니다. 알림톡 채널·승인 템플릿을 조회하려면 연결 권한에 kakao:read가 필요합니다.</p></details>';
  const adoptionNote=byId('customerSuccess').querySelector('.customer-success-note');

  const scoringHelp=document.createElement('details');scoringHelp.className='hq-help';scoringHelp.innerHTML='<summary>점수·정렬 기준</summary>';adoptionNote.before(scoringHelp);scoringHelp.append(adoptionNote);

  function preparePortfolioTable(id,labels){
    const table=byId(id).closest('table');
    table.classList.add('hq-compact-table');
    table.tHead.innerHTML='<tr>'+labels.map(x=>`<th scope="col">${esc(x)}</th>`).join('')+'</tr>';
    table.parentElement.classList.add('hq-compact-wrap');
    table.parentElement.style.removeProperty('overflow');table.parentElement.style.removeProperty('max-height');
    byId(id).innerHTML=`<tr class="hq-portfolio-loading"><td colspan="${labels.length}"><div class="hq-loading-lines" aria-hidden="true"><i></i><i></i><i></i></div><span>병원 목록을 불러오는 중입니다.</span></td></tr>`;
  }
  preparePortfolioTable('onboardingRows',['병원','기본 준비','준비율','확인할 사항','선택 기능·상세']);
  preparePortfolioTable('customerSuccessRows',['병원','사용 현황','핵심 사유','다음 작업','상세']);
  byId('customerSuccessRows').closest('table').classList.add('hq-adoption-table');

  const portfolioRowKey=row=>row?.querySelector('[data-open-onboarding-clinic],[data-cs-clinic]')?.getAttribute(row?.querySelector('[data-open-onboarding-clinic]')?'data-open-onboarding-clinic':'data-cs-clinic');
  function capturePortfolioPosition(view){
    if(currentView!==view)return null;
    const rows=[...byId(view).querySelectorAll('.hq-compact-main-row')],anchor=rows.find(row=>row.getBoundingClientRect().bottom>90&&row.getBoundingClientRect().top<innerHeight);
    const focus=document.activeElement?.closest('.hq-compact-main-row');
    return {scroll:scrollY,key:portfolioRowKey(anchor),top:anchor?.getBoundingClientRect().top,focus:document.activeElement?.matches('.hq-row-toggle')?portfolioRowKey(focus):null};
  }
  function restorePortfolioPosition(view,position){
    if(!position||currentView!==view)return;
    const rows=[...byId(view).querySelectorAll('.hq-compact-main-row')];
    const anchor=rows.find(row=>portfolioRowKey(row)===position.key);
    if(position.focus)rows.find(row=>portfolioRowKey(row)===position.focus)?.querySelector('.hq-row-toggle')?.focus({preventScroll:true});
    if(anchor&&Number.isFinite(position.top))window.scrollTo({top:scrollY+anchor.getBoundingClientRect().top-position.top,behavior:'instant'});
    else window.scrollTo({top:position.scroll,behavior:'instant'});
  }
  const readableOnboardingRender=renderOnboardingPortfolio;
  renderOnboardingPortfolio=function(){
    if(!Array.isArray(onboardingPortfolio?.clinics))return;
    readableOnboardingRender();
    condenseReasons(byId('onboardingRows'),'.onboarding-reasons');
    byId('onboardingRows').querySelectorAll('.onboarding-step-dots i').forEach(step=>step.textContent=operationalText(step.textContent));
  };
  const readableAdoptionRender=renderCustomerSuccess;
  renderCustomerSuccess=function(){
    if(!Array.isArray(customerSuccessPortfolio?.clinics)){updateAdoptionResults();return;}
    readableAdoptionRender();
    condenseReasons(byId('customerSuccessRows'),'.cs-reasons');
    for(const row of byId('customerSuccessRows').querySelectorAll('.hq-compact-main-row')){
      const id=row.querySelector('[data-cs-clinic]')?.dataset.csClinic,entry=customerSuccessPortfolio.clinics.find(x=>x.clinicId===id);
      if(!entry)continue;
      const status=row.querySelector('.cs-status');if(status?.textContent==='위험')status.textContent='사용 현황 확인 필요';
      const next=row.querySelector('.cs-next');next.textContent=operationalText(CarestepHqWorkspace.adoptionAction(entry));
      const subscription=['past_due','paused','canceled','trialing'].includes(entry.subscription?.status);
      const setup=entry.onboarding&&(entry.onboarding.ready===false||Number(entry.onboarding.percent)<100);
      const action=document.createElement('button');action.type='button';action.className='btn hq-next-action';
      action.dataset.csActionClinic=id;action.dataset.clinicPane=subscription?'subscription':setup?'connection':'operation';
      action.textContent=subscription?'구독 확인':setup?'개통·연동 확인':'병원 운영 확인';
      action.setAttribute('aria-label',`${entry.clinicName} ${action.textContent}`);
      next.append(action);
    }
    updateAdoptionResults();
  };
  async function loadPortfolio(view,path,assign,render,retry){
    const current=latest(view+'-portfolio'),position=capturePortfolioPosition(view);
    setRegion(view,'loading');
    try{
      const data=await req(path);if(!current())return;
      if(data?.ok===false||!Array.isArray(data?.clinics))throw Error('병원 목록의 조회 결과를 확인할 수 없습니다.');
      const keepPosition=position&&currentView===view&&Math.abs(scrollY-position.scroll)<2;
      assign(data);render();setRegion(view,'ready');
      if(keepPosition)restorePortfolioPosition(view,position);
    }catch(error){
      if(!current())return;
      setRegion(view,'error',{error:error.message,retry});
      const body=byId(view==='onboarding'?'onboardingRows':'customerSuccessRows');
      if(!body.querySelector('.hq-compact-main-row')){
        body.innerHTML='<tr><td colspan="5"><div class="empty">병원 목록을 조회하지 못했습니다. 다시 시도를 눌러주세요.</div></td></tr>';
        if(view==='customerSuccess')adoptionSummary.textContent='조회 실패 · 병원 수를 확인하지 못했습니다.';
      }
    }
  }
  loadOnboardingPortfolio=()=>loadPortfolio('onboarding','/hq/onboarding',data=>onboardingPortfolio=data,()=>renderOnboardingPortfolio(),()=>loadOnboardingPortfolio());
  loadCustomerSuccess=()=>loadPortfolio('customerSuccess','/hq/customer-success',data=>customerSuccessPortfolio=data,()=>renderCustomerSuccess(),()=>loadCustomerSuccess());
  byId('onboardingRefresh').onclick=()=>loadOnboardingPortfolio();
  byId('customerSuccessRefresh').onclick=()=>loadCustomerSuccess();

  // Shared presentation for the remaining operational screens.
  const finalUsageRender=renderUsageBilling,finalReportRender=renderMonthlyOperationsReportsHQ;
  renderUsageBilling=function(){
    finalUsageRender();
    const table=byId('messagingBillingTable').querySelector('table');
    if(table){for(const i of [5,8])table.tHead.rows[0].cells[i]?.classList.add('right');for(const row of table.tBodies[0].rows)for(const i of [5,8])row.cells[i]?.classList.add('right');
      compactHqTable(table,['병원','요금제·구독','사용량','채널','발송 상태','예상 원가','추가 사용','정산 상태','월 환산 구독'],[0,2,7,5],'사용·정산 상세');}
  };
  renderMonthlyOperationsReportsHQ=function(){
    finalReportRender();
    compactHqTable(byId('hqMonthlyReportTable').querySelector('table'),['병원','요금제','보호자 안내자료','후속 케이스','완료율','문자 성공률','설문 응답률','만족도','위험 케이스','관리 접점'],[0,2,4,8],'운영 지표 상세');
  };
  const finalSenderRender=renderSenderOnboarding;
  renderSenderOnboarding=function(){
    finalSenderRender();
    const table=byId('senderOnboardingTable').querySelector('table');if(!table)return;
    table.classList.add('hq-sender-table','hq-responsive-table');
    const labels=['병원','신청 발신번호','상태','검토 정보','처리'];
    table.tHead.innerHTML='<tr>'+labels.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr>';
    for(const row of table.tBodies[0].rows){
      const cells=[...row.cells];if(cells.length!==6){cells[0].colSpan=5;continue;}
      const details=document.createElement('details'),summary=document.createElement('summary'),dates=document.createElement('p');
      summary.textContent='일정·메모 보기';dates.className='muted';dates.append(...cells[3].childNodes);
      const label=document.createElement('label');label.textContent='검토 메모';const input=cells[4].querySelector('input');
      input.style.removeProperty('min-width');label.append(input);details.append(summary,dates,label);cells[4].replaceChildren(details);
      row.replaceChildren(cells[0],cells[1],cells[2],cells[4],cells[5]);
      [...row.cells].forEach((cell,i)=>cell.dataset.label=labels[i]);
    }
    table.parentElement.tabIndex=0;table.parentElement.setAttribute('aria-label','발신번호 신청 목록');
  };
  byId('senderSearch').oninput=()=>renderSenderOnboarding();
  byId('senderStatusFilter').onchange=()=>renderSenderOnboarding();
  byId('senderAutoFilter').onchange=()=>renderSenderOnboarding();
  const finalProductionRender=renderProductionLaunch;
  renderProductionLaunch=function(){
    const root=byId('productionSecurityChecks'),open=!!root.querySelector('details[open]');
    finalProductionRender();
    const checks=[...root.querySelectorAll('.launch-check')],passed=checks.filter(x=>x.classList.contains('pass')),attention=checks.filter(x=>!x.classList.contains('pass'));
    const summary=document.createElement('p');summary.className='hq-check-summary';
    summary.textContent=checks.length?`확인 필요 ${attention.length}개 · 정상 ${passed.length}개`:'자동 점검 결과가 없습니다. 새로고침해 확인해주세요.';
    const details=document.createElement('details'),heading=document.createElement('summary');details.className='hq-passed-checks';details.open=open;
    heading.textContent=`정상 항목 ${passed.length}개 보기`;details.append(heading,...passed);details.hidden=!passed.length;
    root.replaceChildren(summary,...attention,details);
    byId('plReady').textContent=productionLaunch?.goLiveReady?'준비 완료':'확인 필요';
    byId('plSecurityMeta').textContent=`필수 항목 ${productionLaunch?.security?.criticalPassed||0}/${productionLaunch?.security?.criticalTotal||0}`;
    byId('plToss').textContent=productionLaunch?.security?.liveToss?'실결제':productionLaunch?.security?.testMode?'시험 결제':'미설정';
  };
  const auditActions={
    'clinic.signup':'병원 가입 신청','clinic.approval':'가입 승인 상태 변경','clinic.update':'병원 설정 변경','clinic.content':'병원별 콘텐츠 설정 변경',
    'subscription.update':'구독 설정 변경','subscription.canceled':'구독 해지','subscription.channel_changed':'구독 계약 채널 변경','subscription.plan_scheduled':'요금제 변경 예약','subscription.cancel_scheduled':'구독 해지 예약','subscription.cancel_revoked':'구독 해지 예약 취소',
    'plan.update':'공통 요금제 변경','content.status':'콘텐츠 공개 상태 변경','content.delete':'콘텐츠 삭제','content.category':'콘텐츠 분류 변경','content.category.reset':'콘텐츠 분류 초기화','content.short_bulk_repair':'콘텐츠 일괄 정리',
    'billing.payment_succeeded':'구독 결제 성공','billing.payment_failed':'구독 결제 실패','billing.method_registered':'결제 수단 등록','billing.messaging_rates':'메시지 원가 단가 변경','billing.overage_final_succeeded':'추가 사용료 정산 완료','billing.test_failure_simulated':'결제 실패 시험 실행',
    'sender.onboarding.review':'발신번호 신청 검토','voice.status':'병원 요청 처리 상태 변경','integration.calendar.update':'캘린더 연동 설정 변경',
    'production.checklist.update':'운영 체크리스트 변경','incident.status':'장애 처리 상태 변경','backup.create':'구성백업 생성','backup.restore':'구성백업 복원',
    'clinic.deletion_requested':'병원 데이터 삭제 요청','clinic.deletion_canceled':'병원 데이터 삭제 요청 취소','clinic.deletion_executed':'병원 데이터 삭제 실행',
    'journey.auto_sync.publish':'회복관리 자동 동기화 게시','journey.auto_sync.rescan':'회복관리 자동 동기화 재검색','legal.accept':'약관 동의','account.withdraw':'계정 탈퇴',
    'partner.create':'제휴사 등록','partner.update':'제휴사 설정 변경','partner.api_key.created':'제휴사 API 키 생성','partner.api_key.revoked':'제휴사 API 키 해제','partner.settlement.generated':'제휴 정산 생성','partner.settlement.status':'제휴 정산 상태 변경','onboarding.team_skipped':'직원 초대 단계 건너뛰기'
  };
  const auditTargets={clinic:'병원',subscription:'구독',content:'콘텐츠',plan:'요금제',invoice:'청구',payment_method:'결제 수단',incident:'장애',backup:'백업',partner:'제휴사'};
  const auditFields={from:'변경 전',to:'변경 후',status:'상태',plan:'요금제',planCode:'요금제',clinicName:'병원',title:'자료명',billingCycle:'결제 주기',amountKrw:'금액',priceOverrideKrw:'계약 금액',reviewNote:'검토 메모'};
  function auditDetail(detail){
    if(typeof detail==='string'){try{return JSON.parse(detail);}catch{return {};}}
    return detail&&typeof detail==='object'?detail:{};
  }
  function auditDisplay(value,key){
    if(value===null||value===undefined||value==='')return '미등록';
    if(typeof value==='boolean')return value?'사용':'사용 안 함';
    if(typeof value==='object')return '원본 상세에서 확인';
    if(/Krw$/.test(key)&&safeNumber(value))return won(value);
    if(['from','to','status'].includes(key))return hqStatusLabel(String(value));
    if(key==='billingCycle')return ({monthly:'월간',annual:'연간'})[value]||String(value);
    return String(value);
  }
  const auditClinicId=(x,detail)=>x.clinicId||detail.clinicId||(x.targetType==='clinic'?x.targetId:'');
  function renderAudit(){
    const action=byId('hqAuditAction'),selection=action.dataset.restoreValue??action.value??'all';delete action.dataset.restoreValue;
    const actions=[...new Set(audit.map(x=>x.action).filter(Boolean))];if(selection!=='all'&&selection&&!actions.includes(selection))actions.push(selection);
    action.replaceChildren(new Option('전체 작업','all'));for(const value of actions.sort((a,b)=>(auditActions[a]||a).localeCompare(auditActions[b]||b,'ko')))action.add(new Option(auditActions[value]||value,value));action.value=selection||'all';
    const from=byId('hqAuditFrom').value,to=byId('hqAuditTo').value,clinic=byId('hqAuditClinic').value.trim().toLowerCase(),actor=byId('hqAuditActor').value.trim().toLowerCase();
    if(from&&to&&from>to){byId('hqAuditSummary').textContent='시작일은 종료일보다 늦을 수 없습니다.';byId('auditList').innerHTML='<div class="empty">조회 기간을 확인해주세요.</div>';return;}
    const lower=from?Date.parse(from+'T00:00:00+09:00'):-Infinity,upper=to?Date.parse(to+'T00:00:00+09:00')+86400000:Infinity;
    const rows=audit.filter(x=>{const detail=auditDetail(x.detail),when=Date.parse(x.createdAt),id=auditClinicId(x,detail);return ((!from&&!to)||(Number.isFinite(when)&&when>=lower&&when<upper))&&(!clinic||[id,detail.clinicName,x.clinicName,x.targetType==='clinic'?x.targetName:''].join(' ').toLowerCase().includes(clinic))&&(action.value==='all'||x.action===action.value)&&(!actor||String(x.actor==='HQ'||!x.actor?'HQ 운영자':x.actor).toLowerCase().includes(actor));});
    byId('hqAuditSummary').textContent=`${rows.length}건 표시 · 서버에서 불러온 최근 기록 ${audit.length}건 내 검색 · 날짜 기준: 한국시간`;
    byId('auditList').innerHTML=rows.length?`<div class="table-wrap" tabindex="0" aria-label="운영 감사로그"><table class="table hq-audit-table hq-responsive-table"><thead><tr><th scope="col">시각</th><th scope="col">작업자</th><th scope="col">작업</th><th scope="col">대상</th><th scope="col">변경 내용</th></tr></thead><tbody>${rows.map(x=>{
      const detail=auditDetail(x.detail),known=auditActions[x.action],summary=Object.entries(auditFields).filter(([key])=>Object.hasOwn(detail,key)).map(([key,label])=>`<div><dt>${label}</dt><dd>${esc(auditDisplay(detail[key],key))}</dd></div>`).join('');
      const targetName=detail.clinicName||detail.title||x.targetName||'',clinicId=auditClinicId(x,detail),clinicLink=clinicId?`<br><button type="button" class="btn small" data-audit-clinic="${esc(clinicId)}">관련 병원 열기</button>`:'';
      return `<tr><td data-label="시각">${esc(x.createdAt?new Date(x.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미확인')}</td><td data-label="작업자">${esc(x.actor==='HQ'||!x.actor?'HQ 운영자':x.actor)}</td><td data-label="작업"><b>${esc(known||'운영 작업 · 원본 코드 확인')}</b></td><td data-label="대상">${esc(auditTargets[x.targetType]||'기타 대상')}${targetName?'<br><b>'+esc(targetName)+'</b>':''}${clinicLink}</td><td data-label="변경 내용">${summary?'<dl class="hq-audit-summary">'+summary+'</dl>':'<span class="muted">변경 내용은 원본 상세에서 확인하세요.</span>'}<details class="hq-audit-raw"><summary>원본 상세</summary><p>작업 코드: ${esc(x.action)}<br>대상 유형: ${esc(x.targetType)}<br>대상 ID: ${esc(x.targetId)}</p><pre>${esc(typeof x.detail==='string'?x.detail:JSON.stringify(x.detail??{},null,2))}</pre></details></td></tr>`;
    }).join('')}</tbody></table></div>`:`<div class="empty">${audit.length?'검색 조건에 맞는 운영 기록이 없습니다. 조건을 초기화해 다시 확인하세요.':'서버에서 반환한 운영 기록이 없습니다.'}</div>`;
  }
  loadAudit=async function(){
    const current=latest('audit-read');byId('hqAuditSummary').textContent='최근 운영 기록을 불러오는 중…';
    try{const d=await req('/hq/audit');if(!current())return;audit=d.events||[];renderAudit();}
    catch(error){if(current())byId('hqAuditSummary').textContent='조회 실패'+(audit.length?' · 이전에 불러온 기록입니다.':'');throw error;}
  };
  for(const id of ['hqAuditFrom','hqAuditTo','hqAuditClinic','hqAuditAction','hqAuditActor'])byId(id).addEventListener(['hqAuditClinic','hqAuditActor'].includes(id)?'input':'change',()=>{renderAudit();saveState();});
  byId('hqAuditReset').onclick=()=>{for(const id of ['hqAuditFrom','hqAuditTo','hqAuditClinic','hqAuditActor'])byId(id).value='';byId('hqAuditAction').value='all';delete byId('hqAuditAction').dataset.restoreValue;renderAudit();saveState();};
  byId('auditRefresh').onclick=()=>reloadView('audit');
  const quickInput=byId('hqQuickClinicSearch'),quickBox=byId('hqQuickClinicResults');
  quickInput.setAttribute('role','combobox');quickInput.setAttribute('aria-autocomplete','list');quickInput.setAttribute('aria-controls',quickBox.id);quickInput.setAttribute('aria-expanded','false');
  quickBox.setAttribute('role','listbox');quickBox.setAttribute('aria-label','병원 검색 결과');
  let quickActive=-1;
  const quickRenderWithLinks=renderHqQuickClinicResults;
  renderHqQuickClinicResults=function(rows,q){
    quickRenderWithLinks(rows,q);quickActive=-1;quickInput.removeAttribute('aria-activedescendant');
    quickBox.querySelectorAll('[data-quick-clinic]').forEach((button,i)=>{
      button.id='hqQuickOption'+i;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;
      const small=button.querySelector('small'),row=rows[i];if(small&&row)small.textContent=(row.plan||'요금제 미등록')+' · '+hqStatusLabel(row.subscriptionStatus||row.approvalStatus||'미등록');
    });
    quickInput.setAttribute('aria-expanded','true');
  };
  const quickHideWithSequence=hideHqQuickResults;
  hideHqQuickResults=function(){quickHideWithSequence();quickActive=-1;quickInput.setAttribute('aria-expanded','false');quickInput.removeAttribute('aria-activedescendant');};
  quickInput.addEventListener('keydown',event=>{
    const options=[...quickBox.querySelectorAll('[data-quick-clinic]')];
    if(quickBox.classList.contains('hidden')||!options.length)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();quickActive=event.key==='ArrowDown'?(quickActive+1)%options.length:(quickActive<0?options.length-1:(quickActive-1+options.length)%options.length);
      options.forEach((button,i)=>button.setAttribute('aria-selected',String(i===quickActive)));
      quickInput.setAttribute('aria-activedescendant',options[quickActive].id);options[quickActive].scrollIntoView({block:'nearest'});
    }else if(event.key==='Enter'&&quickActive>=0){event.preventDefault();options[quickActive].click();}
    else if(event.key==='Tab')hideHqQuickResults();
  });
  loadContent=wrapList('content',loadContent);
  loadVoice=wrapList('voice',loadVoice);
  loadFollowupCrmHQ=wrapList('crm',loadFollowupCrmHQ);
  loadGuardianSurveyHQ=wrapList('surveys',loadGuardianSurveyHQ);
  const listRequest=req;
  req=async function(url,options={}){const result=await listRequest(url,options);if(options.method&&!['GET','HEAD'].includes(options.method.toUpperCase())){listChangeSequence++;planCatalog=null;planPending=null;overviewReads.clear();for(const state of listReads.values()){state.freshAt=0;state.pending=null;}pendingViews.clear();}return result;};
  // Keep one refresh action per screen. Component buttons remain for their own panels.
  for(const id of ['approvalRefresh','billingRefresh','usageBillingRefresh','onboardingRefresh','customerSuccessRefresh','crmHqRefresh','surveyHqRefresh','journeyRefresh','auditRefresh']){const button=byId(id);if(button)button.hidden=true;}
  const loginOverlay=byId('loginOverlay'),shell=document.querySelector('.shell');
  function syncAuthenticationPresentation(){
    const locked=!loginOverlay.classList.contains('hidden');document.body.classList.toggle('hq-auth-locked',locked);shell.inert=locked;
    byId('hqHeaderTools').inert=locked;byId('hqMenuToggle').disabled=locked;byId('hqToolsToggle').disabled=locked;
    if(locked){voiceDrafts.clear();voiceOwner='';voiceCursor=null;voiceLoading=false;readEpoch++;closeReview?.();for(const editor of editors.values()){if(editor.editing)cancelEdit(editor);editor.owner=null;}hqDeploymentState=null;hqDeploymentSequence++;audit=[];byId('auditList').replaceChildren();byId('hqAuditSummary').textContent='HQ 연결 후 기록을 확인할 수 있습니다.';if(byId('hqDeploymentCard'))renderHqDeploymentStatus();clinicListSequence++;clinicDetailSequence++;hqActionLoadSequence++;plans=[];planCatalog=null;planPending=null;clinicListSnapshot=null;overviewReads.clear();listReads.clear();viewPositions.clear();pendingViews.clear();for(const id of ['contentTable','voiceTable','crmHqClinicTable','crmHqJourneyTable','surveyHqClinicTable','surveyHqJourneyTable'])byId(id)?.replaceChildren();hideHqQuickResults();document.body.classList.remove('hq-menu-open');byId('hqNavBackdrop').hidden=true;}
  }
  new MutationObserver(syncAuthenticationPresentation).observe(loginOverlay,{attributes:true,attributeFilter:['class']});syncAuthenticationPresentation();

  globalThis.CarestepHqUX={renderMaterials:()=>renderContent(),readPlans,catalogFailed,catalogReady,updateActionLayout,won,priceText,changes,latest,allowLeave,restoreRoute,enhanceClinic,setRegion,
    beginClinic(id){const seq=++clinicDetailSequence,owner=hqReadScope(),epoch=readEpoch;setRegion('clinicDetail','loading');byId('clinicDetail').innerHTML='<div class="hq-detail-loading"><p>병원 정보를 불러오는 중입니다.</p><div class="hq-loading-lines" aria-hidden="true"><i></i><i></i><i></i></div></div>';return ()=>seq===clinicDetailSequence&&selectedClinic===id&&owner===hqReadScope()&&epoch===readEpoch;},
    clinicReady(){enhanceClinic();setRegion('clinicDetail','ready');saveState();},
    clinicError(error){setRegion('clinicDetail','error',{error:error.message,retry:()=>loadClinicDetail(selectedClinic)});},
    isSaving:()=>!!activeSave,reviewedSave};
})();

// Partial refresh identifies its scope; full view refresh remains in the header.
document.getElementById('hqPaymentRefresh').textContent='결제내역 갱신';
