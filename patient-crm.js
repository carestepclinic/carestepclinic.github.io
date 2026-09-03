/* CARESTEP Clinic v9.4 · Stage 1 Patient CRM */
(() => {
  'use strict';
  const $crm=id=>document.getElementById(id);
  const crmState={rows:[],selectedGuardian:null,selectedPatientId:'',query:'',loading:false,metrics:{guardians:0,patients:0,homeLinked:0},demoGuardians:[]};
  let activeCrmPatient=null,crmSearchTimer=null;

  function crmEscape(v=''){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function crmDateLabel(v=''){if(!v)return '미입력';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('ko-KR');}
  function crmPhone(v=''){const n=String(v).replace(/\D/g,'');return n.length===11?n.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3'):n.length===10?n.replace(/(\d{3})(\d{3})(\d{4})/,'$1-$2-$3'):v;}
  function crmSpeciesLabel(v){return ({dog:'강아지',cat:'고양이',other:'기타'})[v]||'기타';}
  function crmSexLabel(v){return ({male:'수컷',female:'암컷',unknown:'미확인'})[v]||'미확인';}
  function crmNeuterLabel(v){return ({yes:'중성화',no:'미중성화',unknown:'미확인'})[v]||'미확인';}
  function crmDialog(id,open=true){const el=$crm(id);if(!el)return;if(open){if(typeof el.showModal==='function')el.showModal();else el.setAttribute('open','');}else if(typeof el.close==='function')el.close();else el.removeAttribute('open');}
  function crmStatus(id,text='',kind=''){const el=$crm(id);if(!el)return;el.textContent=text;el.className='patient-crm-status '+kind;}
  function crmAuthReady(show=true){if(typeof saasMode!=='undefined'&&saasMode==='auth'&&typeof saasMe!=='undefined'&&saasMe)return true;if(typeof saasMode!=='undefined'&&saasMode==='demo')return true;if(show&&typeof toast==='function')toast('보호자·환자 CRM은 병원 계정 로그인 후 사용할 수 있습니다.');return false;}
  function crmDemoId(prefix){return `${prefix}_${crypto.randomUUID()}`;}
  function crmDemoLoad(){return {ok:true,metrics:{guardians:crmState.demoGuardians.length,patients:crmState.demoGuardians.reduce((n,g)=>n+(g.patients||[]).length,0),homeLinked:0},guardians:crmState.demoGuardians};}
  async function crmApi(path,opt={}){
    if(typeof saasMode!=='undefined'&&saasMode==='demo')return crmDemoApi(path,opt);
    return saasRequest(path,opt);
  }
  async function crmDemoApi(path,opt={}){
    const method=opt.method||'GET';let body={};try{body=JSON.parse(opt.body||'{}');}catch{}
    if(path.startsWith('/saas/patient-directory')&&method==='GET')return crmDemoLoad();
    if(path==='/saas/guardians'&&method==='POST'){
      const row={id:crmDemoId('gdn'),name:body.name,phone:crmPhone(body.phone),memo:body.memo||'',homeStatus:body.homeStatus||'not_invited',consentAt:new Date().toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),patients:[]};crmState.demoGuardians.unshift(row);return {ok:true,guardian:row};
    }
    const gm=path.match(/^\/saas\/guardians\/([^/]+)$/),pm=path.match(/^\/saas\/patients\/([^/]+)$/);
    if(gm){const g=crmState.demoGuardians.find(x=>x.id===decodeURIComponent(gm[1]));if(!g)throw new Error('보호자를 찾지 못했습니다.');if(method==='GET')return {ok:true,guardian:g,patients:g.patients||[]};if(method==='PUT'){Object.assign(g,body,{updatedAt:new Date().toISOString()});return {ok:true,guardian:g};}if(method==='DELETE'){crmState.demoGuardians=crmState.demoGuardians.filter(x=>x!==g);return {ok:true};}}
    if(path==='/saas/patients'&&method==='POST'){const g=crmState.demoGuardians.find(x=>x.id===body.guardianId);if(!g)throw new Error('보호자를 선택해주세요.');const p={id:crmDemoId('pet'),guardianId:g.id,...body,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};g.patients.unshift(p);return {ok:true,patient:p};}
    if(pm){let found=null,g=null;for(const row of crmState.demoGuardians){const p=(row.patients||[]).find(x=>x.id===decodeURIComponent(pm[1]));if(p){found=p;g=row;break;}}if(!found)throw new Error('환자를 찾지 못했습니다.');if(method==='PUT'){Object.assign(found,body,{updatedAt:new Date().toISOString()});return {ok:true,patient:found};}if(method==='DELETE'){g.patients=g.patients.filter(x=>x!==found);return {ok:true};}}
    throw new Error('로컬 데모에서 지원하지 않는 요청입니다.');
  }

  async function crmLoad(showToast=false){
    if(!crmAuthReady(false)){crmRenderSignedOut();return;}
    crmState.loading=true;crmRenderList();
    try{
      const q=crmState.query?`?q=${encodeURIComponent(crmState.query)}`:'';
      const d=await crmApi('/saas/patient-directory'+q,{method:'GET'});
      crmState.rows=d.guardians||[];crmState.metrics=d.metrics||{guardians:0,patients:0,homeLinked:0};crmRenderMetrics();crmRenderList();
      if(crmState.selectedGuardian){const still=crmState.rows.find(x=>x.id===crmState.selectedGuardian.id);if(still)await crmSelectGuardian(still.id,false);else{crmState.selectedGuardian=null;crmRenderDetail();}}
      if(showToast&&typeof toast==='function')toast('보호자·환자 목록을 새로 불러왔습니다.');
    }catch(e){crmState.rows=[];crmRenderList(e.message||'목록을 불러오지 못했습니다.');if(showToast&&typeof toast==='function')toast(e.message||'목록을 불러오지 못했습니다.');}
    finally{crmState.loading=false;crmRenderList();}
  }
  function crmRenderSignedOut(){const list=$crm('patientCrmList'),detail=$crm('patientCrmDetail');if(list)list.innerHTML='<div class="patient-crm-empty"><div><b>병원 계정 로그인이 필요합니다</b><span>병원별로 분리된 보호자·환자 정보를 안전하게 관리하려면 로그인해주세요.</span></div></div>';if(detail)detail.innerHTML='<div class="patient-crm-empty"><div><b>환자 CRM</b><span>로그인 후 보호자와 환자를 등록하고 기존 자료 생성에 연결할 수 있습니다.</span></div></div>';}
  function crmRenderMetrics(){if($crm('crmGuardianCount'))$crm('crmGuardianCount').textContent=crmState.metrics.guardians||0;if($crm('crmPatientCount'))$crm('crmPatientCount').textContent=crmState.metrics.patients||0;if($crm('crmHomeCount'))$crm('crmHomeCount').textContent=crmState.metrics.homeLinked||0;}
  function crmRenderList(error=''){
    const list=$crm('patientCrmList'),meta=$crm('patientCrmResultMeta');if(!list)return;
    if(meta)meta.textContent=crmState.loading?'불러오는 중…':`${crmState.rows.length}명의 보호자`;
    if(crmState.loading){list.innerHTML='<div class="patient-crm-empty"><div><b>목록을 불러오는 중입니다</b><span>잠시만 기다려주세요.</span></div></div>';return;}
    if(error){list.innerHTML=`<div class="patient-crm-empty"><div><b>목록을 불러오지 못했습니다</b><span>${crmEscape(error)}</span></div></div>`;return;}
    if(!crmState.rows.length){list.innerHTML='<div class="patient-crm-empty"><div><b>등록된 보호자·환자가 없습니다</b><span>보호자를 먼저 등록한 뒤 반려동물을 연결하세요.</span></div></div>';return;}
    list.innerHTML=crmState.rows.map(g=>`<button class="patient-crm-row ${crmState.selectedGuardian?.id===g.id?'active':''}" type="button" data-crm-guardian="${crmEscape(g.id)}"><span class="patient-crm-avatar">${crmEscape((g.name||'?').slice(0,1))}</span><span class="patient-crm-row-copy"><b>${crmEscape(g.name||'이름 미입력')}</b><span>${crmEscape(g.phone||'전화번호 미입력')} · ${(g.patients||[]).map(p=>p.name).filter(Boolean).join(', ')||'등록 환자 없음'}</span></span><span class="patient-crm-row-side">${(g.patients||[]).length}마리<br>${crmEscape(g.homeStatus==='linked'?'Home 연결':'Clinic')}</span></button>`).join('');
    list.querySelectorAll('[data-crm-guardian]').forEach(b=>b.addEventListener('click',()=>crmSelectGuardian(b.dataset.crmGuardian)));
  }
  async function crmSelectGuardian(id,paint=true){
    try{const d=await crmApi('/saas/guardians/'+encodeURIComponent(id),{method:'GET'});crmState.selectedGuardian={...d.guardian,patients:d.patients||[]};if(paint)crmRenderList();crmRenderDetail();}
    catch(e){if(typeof toast==='function')toast(e.message||'보호자 정보를 불러오지 못했습니다.');}
  }
  function crmRenderDetail(){
    const box=$crm('patientCrmDetail'),g=crmState.selectedGuardian;if(!box)return;
    if(!g){box.innerHTML='<div class="patient-crm-empty"><div><b>보호자를 선택하세요</b><span>왼쪽 목록에서 보호자를 선택하면 연결된 환자와 기본 정보를 확인할 수 있습니다.</span></div></div>';return;}
    const patients=g.patients||[];
    box.innerHTML=`<div class="patient-detail-head"><div><p class="eyebrow">GUARDIAN</p><h4>${crmEscape(g.name)}</h4><p>최근 수정 ${crmDateLabel(g.updatedAt)}</p></div><div class="patient-detail-actions"><button class="btn btn-secondary" type="button" data-crm-edit-guardian>보호자 수정</button><button class="btn btn-primary" type="button" data-crm-add-patient>+ 환자 등록</button></div></div><div class="guardian-summary"><div><span>휴대전화</span><b>${crmEscape(g.phone||'미입력')}</b></div><div><span>Carestep Home</span><b>${crmEscape(g.homeStatus==='linked'?'연결됨':g.homeStatus==='invited'?'초대함':'미연결')}</b></div><div><span>메모</span><b>${crmEscape(g.memo||'없음')}</b></div></div><div class="patient-detail-section"><div class="patient-detail-section-head"><h5>연결된 환자</h5><span class="patient-count-pill">${patients.length}마리</span></div>${patients.length?`<div class="guardian-patient-grid">${patients.map(p=>crmPatientCard(p,g)).join('')}</div>`:'<div class="patient-crm-empty"><div><b>연결된 환자가 없습니다</b><span>환자 등록을 눌러 이 보호자에게 반려동물을 연결하세요.</span></div></div>'}</div><div class="patient-detail-section"><button class="btn btn-ghost" type="button" data-crm-delete-guardian>보호자 정보 삭제</button></div>`;
    box.querySelector('[data-crm-edit-guardian]')?.addEventListener('click',()=>crmOpenGuardian(g));box.querySelector('[data-crm-add-patient]')?.addEventListener('click',()=>crmOpenPatient(null,g.id));box.querySelector('[data-crm-delete-guardian]')?.addEventListener('click',()=>crmDeleteGuardian(g));
    box.querySelectorAll('[data-crm-use-patient]').forEach(b=>b.addEventListener('click',()=>crmUsePatient(patients.find(p=>p.id===b.dataset.crmUsePatient),g)));
    box.querySelectorAll('[data-crm-edit-patient]').forEach(b=>b.addEventListener('click',()=>crmOpenPatient(patients.find(p=>p.id===b.dataset.crmEditPatient),g.id)));
    box.querySelectorAll('[data-crm-delete-patient]').forEach(b=>b.addEventListener('click',()=>crmDeletePatient(patients.find(p=>p.id===b.dataset.crmDeletePatient))));
  }
  function crmPatientCard(p,g){const tags=[crmSpeciesLabel(p.species),p.breed,crmSexLabel(p.sex),crmNeuterLabel(p.neutered),p.latestWeightKg?`${p.latestWeightKg}kg`:null].filter(Boolean);return `<article class="guardian-patient-card ${crmState.selectedPatientId===p.id?'selected':''}"><div class="guardian-patient-top"><div><h6>${crmEscape(p.name)}</h6><p>${crmEscape(p.mainConditions||'주요 질환 미입력')}</p></div><span class="patient-crm-avatar ${p.species==='cat'?'cat':''}">${p.species==='cat'?'CAT':'PET'}</span></div><div class="guardian-patient-meta">${tags.map(x=>`<span class="patient-tag">${crmEscape(x)}</span>`).join('')}</div><div class="guardian-patient-actions"><button class="btn btn-primary" type="button" data-crm-use-patient="${crmEscape(p.id)}">이 환자로 자료 생성</button><button class="btn btn-secondary" type="button" data-crm-edit-patient="${crmEscape(p.id)}">수정</button><button class="btn btn-ghost" type="button" data-crm-delete-patient="${crmEscape(p.id)}">삭제</button></div></article>`;}

  function crmOpenGuardian(g=null){if(!crmAuthReady())return;$crm('crmGuardianForm').reset();$crm('crmGuardianId').value=g?.id||'';$crm('crmGuardianName').value=g?.name||'';$crm('crmGuardianPhone').value=g?.phone||'';$crm('crmGuardianMemo').value=g?.memo||'';$crm('crmGuardianHomeStatus').value=g?.homeStatus||'not_invited';$crm('crmGuardianConsent').checked=!!g;$crm('crmGuardianDialogTitle').textContent=g?'보호자 정보 수정':'새 보호자 등록';crmStatus('crmGuardianStatus');crmDialog('crmGuardianDialog');}
  async function crmSaveGuardian(e){e.preventDefault();const id=$crm('crmGuardianId').value,body={name:$crm('crmGuardianName').value.trim(),phone:$crm('crmGuardianPhone').value.trim(),memo:$crm('crmGuardianMemo').value.trim(),homeStatus:$crm('crmGuardianHomeStatus').value,consentConfirmed:!!$crm('crmGuardianConsent').checked};if(!body.name){crmStatus('crmGuardianStatus','보호자명을 입력해주세요.','error');return;}if(!body.consentConfirmed){crmStatus('crmGuardianStatus','개인정보 저장 안내와 병원의 수집 근거 확인이 필요합니다.','error');return;}const btn=$crm('crmGuardianSave');btn.disabled=true;try{const d=await crmApi(id?'/saas/guardians/'+encodeURIComponent(id):'/saas/guardians',{method:id?'PUT':'POST',body:JSON.stringify(body)});crmDialog('crmGuardianDialog',false);crmState.selectedGuardian={...d.guardian,patients:crmState.selectedGuardian?.id===d.guardian.id?(crmState.selectedGuardian.patients||[]):[]};await crmLoad();await crmSelectGuardian(d.guardian.id);if(typeof toast==='function')toast(id?'보호자 정보를 수정했습니다.':'보호자를 등록했습니다. 이어서 환자를 등록할 수 있습니다.');}catch(err){crmStatus('crmGuardianStatus',err.message||'저장하지 못했습니다.','error');}finally{btn.disabled=false;}}
  function crmOpenPatient(p=null,guardianId=''){if(!crmAuthReady())return;if(!crmState.rows.length){if(typeof toast==='function')toast('보호자를 먼저 등록해주세요.');crmOpenGuardian();return;}$crm('crmPatientForm').reset();$crm('crmPatientId').value=p?.id||'';$crm('crmPatientGuardian').innerHTML=crmState.rows.map(g=>`<option value="${crmEscape(g.id)}">${crmEscape(g.name)} · ${crmEscape(g.phone||'번호 없음')}</option>`).join('');$crm('crmPatientGuardian').value=p?.guardianId||guardianId||crmState.selectedGuardian?.id||crmState.rows[0].id;$crm('crmPatientName').value=p?.name||'';$crm('crmPatientSpecies').value=p?.species||'dog';$crm('crmPatientBreed').value=p?.breed||'';$crm('crmPatientSex').value=p?.sex||'unknown';$crm('crmPatientBirthDate').value=p?.birthDate||'';$crm('crmPatientNeutered').value=p?.neutered||'unknown';$crm('crmPatientWeight').value=p?.latestWeightKg||'';$crm('crmPatientConditions').value=p?.mainConditions||'';$crm('crmPatientNotes').value=p?.notes||'';$crm('crmPatientDialogTitle').textContent=p?'환자 정보 수정':'새 환자 등록';crmStatus('crmPatientStatus');crmDialog('crmPatientDialog');}
  async function crmSavePatient(e){e.preventDefault();const id=$crm('crmPatientId').value,body={guardianId:$crm('crmPatientGuardian').value,name:$crm('crmPatientName').value.trim(),species:$crm('crmPatientSpecies').value,breed:$crm('crmPatientBreed').value.trim(),sex:$crm('crmPatientSex').value,birthDate:$crm('crmPatientBirthDate').value,neutered:$crm('crmPatientNeutered').value,latestWeightKg:$crm('crmPatientWeight').value,mainConditions:$crm('crmPatientConditions').value.trim(),notes:$crm('crmPatientNotes').value.trim()};if(!body.guardianId||!body.name){crmStatus('crmPatientStatus','보호자와 환자명을 입력해주세요.','error');return;}const btn=$crm('crmPatientSave');btn.disabled=true;try{const d=await crmApi(id?'/saas/patients/'+encodeURIComponent(id):'/saas/patients',{method:id?'PUT':'POST',body:JSON.stringify(body)});crmDialog('crmPatientDialog',false);crmState.selectedPatientId=d.patient.id;await crmLoad();await crmSelectGuardian(d.patient.guardianId);if(typeof toast==='function')toast(id?'환자 정보를 수정했습니다.':'환자를 등록했습니다.');}catch(err){crmStatus('crmPatientStatus',err.message||'저장하지 못했습니다.','error');}finally{btn.disabled=false;}}
  async function crmDeleteGuardian(g){if(!confirm(`“${g.name}” 보호자와 연결 환자 ${(g.patients||[]).length}마리의 CRM 정보를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`))return;try{await crmApi('/saas/guardians/'+encodeURIComponent(g.id),{method:'DELETE'});crmState.selectedGuardian=null;await crmLoad();crmRenderDetail();if(typeof toast==='function')toast('보호자와 연결 환자 정보를 삭제했습니다.');}catch(e){if(typeof toast==='function')toast(e.message||'삭제하지 못했습니다.');}}
  async function crmDeletePatient(p){if(!p||!confirm(`“${p.name}” 환자 정보를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`))return;try{await crmApi('/saas/patients/'+encodeURIComponent(p.id),{method:'DELETE'});crmState.selectedPatientId='';await crmLoad();if(crmState.selectedGuardian)await crmSelectGuardian(crmState.selectedGuardian.id);if(typeof toast==='function')toast('환자 정보를 삭제했습니다.');}catch(e){if(typeof toast==='function')toast(e.message||'삭제하지 못했습니다.');}}
  function crmUsePatient(p,g){if(!p||!g)return;activeCrmPatient={patientId:p.id,guardianId:g.id,patient:p,guardian:g};crmState.selectedPatientId=p.id;if($crm('patientName'))$crm('patientName').value=p.name||'';if($crm('guardianName'))$crm('guardianName').value=g.name||'';if($crm('messagingRecipientPhone')&&g.phone)$crm('messagingRecipientPhone').value=g.phone;if($crm('caseProcedure')&&!$crm('caseProcedure').value&&p.mainConditions)$crm('caseProcedure').value=p.mainConditions;if($crm('dischargeDate')&&!$crm('dischargeDate').value)$crm('dischargeDate').value=new Date().toISOString().slice(0,10);try{readCaseInfoFromForm();caseInfo.patientId=p.id;caseInfo.guardianId=g.id;caseInfo.latestWeightKg=p.latestWeightKg||'';currentCasePhase='editing';renderGlobalCaseBadge();renderBuilder();updateReadiness();crmPaintBuilderSelection();go('builder');setWizardStep(1);toast(`${p.name} 환자 정보를 자료 생성에 불러왔습니다.`);}catch(e){console.error(e);}}
  function crmPaintBuilderSelection(){const el=$crm('crmBuilderSelection');if(!el)return;if(!activeCrmPatient){el.classList.add('hidden');el.innerHTML='';return;}const {patient,guardian}=activeCrmPatient;el.classList.remove('hidden');el.innerHTML=`<span><b>CRM 환자 연결됨</b> · ${crmEscape(patient.name)} / 보호자 ${crmEscape(guardian.name)}${patient.latestWeightKg?` / ${crmEscape(patient.latestWeightKg)}kg`:''}</span><button type="button" id="crmBuilderUnlink">연결 해제</button>`;$crm('crmBuilderUnlink')?.addEventListener('click',()=>{activeCrmPatient=null;if(caseInfo){delete caseInfo.patientId;delete caseInfo.guardianId;delete caseInfo.latestWeightKg;}crmPaintBuilderSelection();toast('CRM 연결만 해제했습니다. 현재 입력값은 유지됩니다.');});}
  function crmOpenPicker(){go('patients');setTimeout(()=>{$crm('patientCrmSearch')?.focus();},50);}
  function crmOpen(){crmRenderMetrics();crmRenderDetail();crmLoad(false);}
  function crmBind(){
    $crm('patientCrmRefresh')?.addEventListener('click',()=>crmLoad(true));$crm('patientCrmNewGuardian')?.addEventListener('click',()=>crmOpenGuardian());$crm('patientCrmNewPatient')?.addEventListener('click',()=>crmOpenPatient(null,crmState.selectedGuardian?.id||''));
    $crm('patientCrmSearch')?.addEventListener('input',e=>{clearTimeout(crmSearchTimer);crmState.query=e.target.value.trim();crmSearchTimer=setTimeout(()=>crmLoad(false),250);});$crm('patientCrmSearchClear')?.addEventListener('click',()=>{crmState.query='';$crm('patientCrmSearch').value='';crmLoad(false);});
    $crm('crmGuardianForm')?.addEventListener('submit',crmSaveGuardian);$crm('crmPatientForm')?.addEventListener('submit',crmSavePatient);document.querySelectorAll('[data-crm-dialog-close]').forEach(b=>b.addEventListener('click',()=>crmDialog(b.dataset.crmDialogClose,false)));
    $crm('openPatientCrmPicker')?.addEventListener('click',crmOpenPicker);
    document.addEventListener('click',e=>{const b=e.target.closest('[data-go="patients"]');if(b)setTimeout(crmOpen,0);});
    crmPaintBuilderSelection();
  }
  window.crmOpen=crmOpen;window.crmLoad=crmLoad;window.crmUsePatient=crmUsePatient;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',crmBind);else crmBind();
})();
