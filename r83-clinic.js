/* R83: clinical confirmations; never setup wizard completion or outbound scheduling. */
(()=>{'use strict';
 const pending=new Map(),busy=new Set(),finished=new Set();
 const subject=()=>window.crmCurrentPatient?.()||window.crmWorkspaceSelection?.()||{};
 function identity(s){const x=contexts.get(s)?.snapshot;if(!x)throw Error('PATIENT_OR_CLINIC_CHANGED');return JSON.stringify([x.clinicId,x.userId,x.sessionId,x.patientId,x.caseKey,x.nonce,x.revision]);}
 function confirmed(d,s,key){const r=d?.completion;return d?.ok===true&&d.clinicId===s.clinicId&&d.case?.caseKey===s.case.caseKey&&d.case.patientId===s.case.patientId&&d.case.status==='completed'&&r?.kind==='R83_TRUE_FINAL'&&r.confirmed===true&&r.usageRecorded===true&&r.auditRecorded===true&&r.receiptId&&r.clinicId===s.clinicId&&r.caseKey===s.case.caseKey&&r.patientId===s.case.patientId&&(r.idempotencyKey===key||d.idempotent===true);}
 const contexts=new WeakMap();
 const textId=x=>typeof x==='string'&&x.length>0&&!/\s/u.test(x)?x:null;
 function openingSnapshot(){
  if(saasMode!=='auth')throw Error('PATIENT_OR_CLINIC_CHANGED');
  const p=subject(),x={clinicId:saasMe?.clinic?.id,userId:saasMe?.user?.id,sessionId:saasSessionMeta?.id,patientId:p.patientId,nonce:followupCaseNonce};
  if(Object.values(x).some(v=>textId(v)===null))throw Error('PATIENT_OR_CLINIC_CHANGED');
  return Object.freeze(x);
 }
 const openingEqual=(a,b)=>a.clinicId===b.clinicId&&a.userId===b.userId&&a.sessionId===b.sessionId&&a.patientId===b.patientId&&a.nonce===b.nonce;
 function currentContext(s){const x=openingSnapshot();return {...x,caseKey:s?.case?.caseKey};}
 function canonical(s,deps){
  const x=deps.current(s);
  if(!x||['clinicId','userId','sessionId','patientId','caseKey','nonce'].some(k=>textId(x[k])===null))throw Error('PATIENT_OR_CLINIC_CHANGED');
  if(x.clinicId!==s?.clinicId||x.patientId!==s?.case?.patientId||x.caseKey!==s?.case?.caseKey||!Number.isSafeInteger(s?.case?.revision)||s.case.revision<1||typeof s.contractSHA256!=='string'||!/^[A-F0-9]{64}$/.test(s.contractSHA256))throw Error('PATIENT_OR_CLINIC_CHANGED');
  return Object.freeze({clinicId:x.clinicId,userId:x.userId,sessionId:x.sessionId,patientId:x.patientId,caseKey:x.caseKey,nonce:x.nonce,revision:s.case.revision,contractSHA256:s.contractSHA256});
 }
 function sameContext(a,b){return a.clinicId===b.clinicId&&a.userId===b.userId&&a.sessionId===b.sessionId&&a.patientId===b.patientId&&a.caseKey===b.caseKey&&a.nonce===b.nonce&&a.revision===b.revision&&a.contractSHA256===b.contractSHA256;}
 function sameSelection(s,deps){try{const entry=contexts.get(s);return entry?.enabled===true&&sameContext(entry.snapshot,canonical(s,deps));}catch{return false;}}
 const defaults=()=>({request:saasRequest,current:currentContext,reset:followupResetAfterConfirmed,nonce:()=>crypto.randomUUID()});
 window.r83BindConfirmationContext=(s,enabled,deps=defaults())=>{
  if(enabled!==true)throw Error('FOLLOWUP_AUTO_COMPLETION_OFF');
  const snapshot=canonical(s,deps),entry=contexts.get(s);
  if(entry&&!sameContext(entry.snapshot,snapshot))throw Error('PATIENT_OR_CLINIC_CHANGED');
  if(!entry)contexts.set(s,Object.freeze({enabled:true,snapshot}));
  return contexts.get(s).snapshot;
 };
 window.r83ConfirmStage=async(s,stageDay,deps=defaults())=>{
  if(!sameSelection(s,deps))throw Error('PATIENT_OR_CLINIC_CHANGED');
  const identityKey=identity(s),k=identityKey+':'+stageDay;
  if(finished.has(identityKey))return {completed:true,idempotent:true,resetRepeated:false};
  if(busy.has(identityKey))throw Error('CONFIRMATION_IN_PROGRESS');
  if(pending.get(k)?.uncertain)throw Error('CONFIRMATION_RESULT_UNCONFIRMED_READ_ONLY_CHECK_REQUIRED');
  const key=pending.get(k)?.key||'r83_'+deps.nonce();pending.set(k,{key,uncertain:false});busy.add(identityKey);
  try{
   const d=await deps.request('/saas/followup/cases/'+encodeURIComponent(s.case.caseKey)+'/required-stages',{method:'POST',body:JSON.stringify({patientId:s.case.patientId,stageDay,expectedRevision:s.case.revision,contractSHA256:s.contractSHA256,idempotencyKey:key,confirmed:true,finalConfirmation:stageDay===s.requiredStages.at(-1)})});
   if(!sameSelection(s,deps))throw Error('PATIENT_OR_CLINIC_CHANGED');
   if(stageDay===s.requiredStages.at(-1)){
    if(!confirmed(d,s,key))throw Error('COMPLETION_RECEIPT_UNCONFIRMED');
    finished.add(identity(s));deps.reset();pending.delete(k);return {completed:true,response:d};
   }
   if(d.ok!==true||d.clinicId!==s.clinicId||d.case?.caseKey!==s.case.caseKey||d.case.patientId!==s.case.patientId||d.stage?.day!==stageDay||d.stage.confirmed!==true)throw Error('STAGE_RECEIPT_UNCONFIRMED');
   pending.delete(k);return {completed:false,response:d};
  }catch(e){pending.set(k,{key,uncertain:true});throw e;}finally{busy.delete(identityKey);}
 };
 window.r83ReadConfirmation=async(s,stageDay,deps=defaults())=>{
  const k=identity(s)+':'+stageDay,item=pending.get(k);if(!item||!sameSelection(s,deps))throw Error('CONFIRMATION_NOT_SELECTED');
  const d=await deps.request('/saas/followup/cases/'+encodeURIComponent(s.case.caseKey)+'/required-stages?patientId='+encodeURIComponent(s.case.patientId)+'&idempotencyKey='+encodeURIComponent(item.key));
  if(!sameSelection(s,deps))throw Error('PATIENT_OR_CLINIC_CHANGED');
  if(confirmed(d,s,item.key)){finished.add(identity(s));deps.reset();pending.delete(k);return {completed:true,response:d};}
  // No automatic POST after an uncertain result. Preserve patient and current view.
  return {completed:false,response:d,unconfirmed:true};
 };
 async function open(){
  const opening=openingSnapshot(),deps=defaults();
  const cfg=await saasRequest('/saas/r61/config');if(!openingEqual(opening,openingSnapshot()))throw Error('PATIENT_OR_CLINIC_CHANGED');if(cfg.flags.followup_auto_completion!==true)throw Error('FOLLOWUP_AUTO_COMPLETION_OFF');
  const p=subject();if(!p.patientId)throw Error('PATIENT_REQUIRED');
  const cases=await saasRequest('/saas/followup/cases?patientId='+encodeURIComponent(p.patientId));if(!openingEqual(opening,openingSnapshot()))throw Error('PATIENT_OR_CLINIC_CHANGED');
  const d=document.createElement('dialog'),title=document.createElement('h2');title.textContent='실제 후속관리 단계 확인';d.append(title);
  const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>d.close();d.append(close);d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
  for(const c of cases.items.filter(x=>x.patientId===p.patientId&&x.status==='active')){
   const box=document.createElement('section'),h=document.createElement('h3'),status=document.createElement('p');h.textContent='관리 시작 '+c.startDate+' · '+c.caseKey;box.append(h,status);d.append(box);
   const s=await saasRequest('/saas/followup/cases/'+encodeURIComponent(c.caseKey)+'/required-stages?patientId='+encodeURIComponent(p.patientId));if(!openingEqual(opening,openingSnapshot()))throw Error('PATIENT_OR_CLINIC_CHANGED');window.r83BindConfirmationContext(s,cfg.flags.followup_auto_completion,deps);
   for(const day of s.requiredStages){
    const b=document.createElement('button');b.textContent='D+'+day+(s.confirmedStages.includes(day)?' 확인 완료':day===s.requiredStages.at(-1)?' 실제 마지막 단계 · 최종 확인':' 실제 단계 확인');b.disabled=s.confirmedStages.includes(day);box.append(b);
    b.onclick=async()=>{if(!confirm('해당 환자의 D+'+day+' 필수 후속관리 수행을 실제로 확인했습니까? 설정 마법사 확인이 아닙니다.'))return;b.disabled=true;try{const x=await window.r83ConfirmStage(s,day);status.textContent=x.completed?'완료 이력을 보존하고 다음 환자 화면으로 이동했습니다.':'단계 확인을 저장했습니다.';if(x.completed)d.close();}catch{status.textContent='결과 미확정 또는 거부. 현재 환자를 유지합니다. 자동 재요청하지 않습니다.';}};
    const read=document.createElement('button');read.textContent='D+'+day+' 앞선 요청 결과만 확인';box.append(read);read.onclick=async()=>{try{const x=await window.r83ReadConfirmation(s,day);status.textContent=x.completed?'완료 receipt 확인 후 다음 환자 화면으로 이동했습니다.':'완료 미확정. 현재 환자를 유지합니다.';if(x.completed)d.close();}catch{status.textContent='조회 실패. 현재 환자를 유지합니다.';}};
   }
  }
  if(!cases.items.some(x=>x.patientId===p.patientId&&x.status==='active')){const n=document.createElement('p');n.textContent='진행 중 케이스가 없습니다. 완료 이력은 환자 작업공간에서 조회할 수 있습니다.';d.append(n);}
 }
 window.r83OpenRequiredStages=open;
})();
