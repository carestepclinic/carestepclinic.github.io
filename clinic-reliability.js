/* Clinic dates, recovery and review. Patient drafts remain in this tab only. */
(function(global){
'use strict';
const today=(now=Date.now())=>new Date(Number(now)+32400000).toISOString().slice(0,10);
function addDays(value,days){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isInteger(Number(days)))throw Error('날짜와 일수를 확인해주세요.');const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('유효한 날짜가 아닙니다.');d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10);}
function differences(a,b,prefix=''){const rows=[];for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){const x=a?.[key],y=b?.[key],path=prefix?prefix+'.'+key:key;if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y))rows.push(...differences(x,y,path));else if(JSON.stringify(x)!==JSON.stringify(y))rows.push({path,before:x,after:y});}return rows;}
function recoveredState(incoming,current){
 const local=current?.workflow||{},remote=incoming?.workflow||{};
 const workflow={...remote};
 for(const key of ['timings','usage','feedback'])if(Object.prototype.hasOwnProperty.call(local,key))workflow[key]=structuredClone(local[key]);
 if(!Object.prototype.hasOwnProperty.call(remote,'followupMessagePresets'))workflow.followupMessagePresets=structuredClone(local.followupMessagePresets||[]);
 return {...incoming,workflow};
}
function draftIdentity(patientId,date,templateId){return JSON.stringify([String(patientId),String(date||''),String(templateId||'')]);}
function comparisonRows(a,b,showEqual=false,prefix=''){
 const rows=[];for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
  const x=a?.[key],y=b?.[key],path=prefix?prefix+'.'+key:key;
  if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y))rows.push(...comparisonRows(x,y,showEqual,path));
  else{const equal=JSON.stringify(x)===JSON.stringify(y);if(showEqual||!equal)rows.push({path,before:x,after:y,equal});}
 }return rows;
}
function validateBackup(data){
 if(!data||data.schema!=='CARESTEP_CLINIC_BACKUP'||!data.hospital||typeof data.hospital!=='object'||Array.isArray(data.hospital)||!data.workflow||typeof data.workflow!=='object'||Array.isArray(data.workflow))throw Error('CARESTEP 병원 설정 백업 JSON인지 확인해주세요.');
 return data;
}
const api={today,addDays,differences,recoveredState,draftIdentity,comparisonRows,validateBackup};global.ClinicReliability=api;if(typeof module!=='undefined')module.exports=api;
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),scope=()=>typeof saasMode!=='undefined'&&saasMode==='auth'&&saasMe?.clinic?.id&&saasMe?.user?.id?JSON.stringify([saasMe.clinic.id,saasMe.user.id]):'';
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function button(parent,label,fn){const b=node('button',label);b.type='button';b.className='btn btn-secondary';b.onclick=fn;parent.append(b);return b;}
function modal(title){const d=node('dialog');d.className='clinic-recovery-dialog';const head=node('h3',title),body=node('div'),close=button(d,'닫기',()=>d.close());d.prepend(head,body);document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();return {d,body,close};}
function value(v){return v===undefined?'미설정':typeof v==='object'?JSON.stringify(v):String(v);}
const labels={patient:'환자',guardian:'보호자',home:'HOME 연결',id:'식별번호',status:'상태',patients:'연결 환자 수',timelineEvents:'건강기록 수',activeHomeLinks:'활성 HOME 연결 수',scheduledFollowups:'예정 후속관리 수',hospital:'병원',workflow:'운영 설정',name:'이름',director:'원장',phone:'전화',address:'주소',website:'홈페이지',dischargePresets:'개별지시 기본값',packagePresets:'출력 기본값',qr:'QR',followup:'후속관리',recent:'최근 사용',pilot:'시범 설정',followupMessagePresets:'병원 메시지 서식',species:'종',breed:'품종',birthDate:'생년월일',sex:'성별',neutered:'중성화',latestWeightKg:'최근 체중',timings:'자료 작성시간 통계',usage:'사용 기록',feedback:'직원 피드백'};
function comparison(parent,a,b,left='현재 PC',right='서버',showEqual=false){const rows=comparisonRows(a,b,showEqual);const changed=rows.filter(x=>!x.equal).length;parent.append(node('p',showEqual?`전체 비교 항목 ${rows.length}개 · 다른 값 ${changed}개`:rows.length?`서로 다른 항목 ${rows.length}개`:'비교한 항목의 값이 같습니다.'));const table=node('table');table.className='clinic-recovery-table';const tr=node('tr');for(const t of ['항목',left,right])tr.append(node('th',t));table.append(tr);for(const r of rows){const row=node('tr');row.dataset.equal=String(r.equal);for(const t of [r.path.split('.').map(k=>labels[k]||k).join(' · '),value(r.before),value(r.after)])row.append(node('td',t));table.append(row);}parent.append(table);}
let cloudPending=false,cloudState='idle',cloudMessage='',uploadRunning=false,uploadQueued=false;
function paintCloud(){let root=$('clinicSyncStatus');if(!root){root=node('div');root.id='clinicSyncStatus';root.className='clinic-sync-status';root.setAttribute('role','status');root.setAttribute('aria-live','polite');$('screenHelpBar')?.after(root);}if(!root)return;root.hidden=!scope();const renderKey=scope()+cloudState+cloudMessage;if(root.dataset.renderKey===renderKey)return;root.dataset.renderKey=renderKey;root.replaceChildren(node('span',cloudMessage||'병원 설정의 서버 저장 상태를 확인할 수 있습니다.'));root.dataset.state=cloudState;if(cloudState==='localonly')button(root,'서버 반영 확인',()=>saasUploadCloud(false));if(cloudState==='error'||cloudState==='conflict')button(root,cloudState==='conflict'?'차이 확인·복구':'동기화 다시 시도',()=>cloudState==='conflict'?reviewCloud():saasUploadCloud(false));}
function cloudEligibility(){
 if(!scope())return {state:'signedout',message:'병원 계정 로그인 후 서버 동기화를 사용할 수 있습니다.'};
 if(typeof saasHasFeature==='function'&&!saasHasFeature('cloudSync'))return {state:'unsupported',message:'이 PC 저장 완료 · 현재 요금제에서 설정 동기화를 사용할 수 없습니다.'};
 if(typeof saasPermission==='function'&&!saasPermission('settings.manage',['owner','admin','vet'].includes(saasMe?.role)))return {state:'forbidden',message:'이 PC 저장 완료 · 서버 설정 저장 권한이 없습니다. 병원 관리자에게 요청해주세요.'};
 return null;
}
function blockedCloud(){const blocked=cloudEligibility();if(!blocked)return false;cloudPending=false;uploadQueued=false;cloudState=blocked.state;cloudMessage=blocked.message;paintCloud();return true;}
let lastLocalPayload=JSON.stringify(saasStatePayload());
api.cloudLocalSaved=function(){
 const payload=JSON.stringify(saasStatePayload());if(payload===lastLocalPayload)return;lastLocalPayload=payload;
 if(blockedCloud())return;if(importHeld()){cloudPending=false;cloudState='localonly';cloudMessage='이 PC 복원 완료 · 서버 반영은 별도 확인이 필요합니다.';paintCloud();return;}if(uploadRunning)uploadQueued=true;
 cloudPending=saasCloudBound();cloudState=cloudPending?'pending':'unbound';cloudMessage=cloudPending?'이 PC 저장 완료 · 서버 저장 대기':'이 PC 저장 완료 · 자동 동기화 연결 전입니다. 계정 설정에서 서버 저장을 시작해주세요.';paintCloud();
};
const importHoldKey=()=>scope()?'carestep-json-restore-hold:'+saasMe.clinic.id:'';
function importHeld(){try{return !!scope()&&localStorage.getItem(importHoldKey())==='1';}catch{return false;}}
const oldUpload=saasUploadCloud;
saasUploadCloud=async function(silent=false){if(!scope())return;if(importHeld()){if(silent)return;if(!confirm('파일에서 복원한 현재 PC 설정을 서버에 반영할까요? 다른 PC가 사용하는 병원 설정도 바뀝니다.'))return;}if(blockedCloud())return;if(uploadRunning){uploadQueued=true;return;}if(saasCloudMeta?.conflict){cloudState='conflict';cloudMessage='서버 설정과 충돌했습니다. 차이를 확인한 뒤 복구해주세요.';paintCloud();return;}
 const uploadScope=scope();uploadRunning=true;cloudState='saving';cloudMessage='이 PC 저장 완료 · 서버 저장 중…';paintCloud();let failed=false;
 // The original function handles its own exception. Observe the exact request below.
 const revision=cloudRevision;try{await oldUpload(silent);if(uploadScope!==scope())return;failed=cloudRevision===revision||cloudLastFailure;if(failed){cloudState=saasCloudMeta?.conflict?'conflict':'error';cloudMessage=saasCloudMeta?.error||'서버 저장 실패 · 현재 PC의 변경사항은 남아 있습니다.';}else{cloudPending=false;localStorage.removeItem(importHoldKey());cloudState='ready';cloudMessage='서버 동기화 완료 · '+new Date().toLocaleTimeString('ko-KR');}}finally{uploadRunning=false;if(uploadScope!==scope())return;paintCloud();if(uploadQueued&&!failed){uploadQueued=false;return saasUploadCloud(true);}uploadQueued=false;}
};
let cloudRevision=0,cloudLastFailure=false;
let backupScope='',backup=null;
function applyRecoveredState(state){const current={workflow:structuredClone(workflowSettings)};applyClinicStatePayload(recoveredState(state,current));}

async function reviewCloud(){const auth=scope();if(!auth)return;try{const saved=JSON.parse(sessionStorage.getItem('carestep-settings-recovery:'+auth)||'null');if(saved?.auth===auth&&saved.expires>Date.now()){backup=saved.state;backupScope=auth;}}catch{}const {body}=modal('병원 설정 비교·복구');body.append(node('p','현재 PC의 변경사항은 이 탭에 복구본으로 보관한 뒤 서버 설정을 적용합니다. 환자 기록은 대상이 아닙니다.'));if(backup&&backupScope===auth)button(body,'보관한 PC 설정 복원',()=>{if(auth!==scope()||!confirm('보관한 PC 설정을 복원할까요? 서버 저장은 별도로 진행합니다.'))return;applyRecoveredState(backup);persistAuthenticatedClinicLocalState();renderAll();api.cloudLocalSaved();});try{const local=saasStatePayload(),server=await saasRequest('/saas/clinic/state');if(auth!==scope())throw Error('로그인이 바뀌었습니다.');if(!server.state)throw Error('서버에 저장된 설정이 없습니다.');comparison(body,local,server.state);button(body,'현재 PC 설정 보관 후 서버 설정 적용',()=>{if(auth!==scope()||!confirm('현재 PC 설정을 이 탭에 보관하고 서버 설정을 적용할까요?'))return;try{sessionStorage.setItem('carestep-settings-recovery:'+auth,JSON.stringify({auth,expires:Date.now()+7200000,state:local}));}catch{body.append(node('p','복구본 보관 실패 · 서버 설정 적용을 중단했습니다.'));return;}backup=structuredClone(local);backupScope=auth;applyRecoveredState(server.state);persistAuthenticatedClinicLocalState();saasCloudMeta={...server,conflict:false,error:''};localStorage.setItem(saasCloudKey(),'1');cloudState='ready';cloudPending=false;cloudMessage='서버 설정 적용 완료 · 이전 PC 설정은 이 탭에서 복구 가능';renderAll();paintCloud();button(body,'보관한 PC 설정 복원',()=>{if(auth!==scope()||backupScope!==auth||!backup)return;if(!confirm('보관한 PC 설정을 복원할까요? 서버에는 저장 버튼으로 별도 반영합니다.'))return;applyRecoveredState(backup);persistAuthenticatedClinicLocalState();renderAll();api.cloudLocalSaved();});});}catch(e){body.append(node('p',e.message||'비교하지 못했습니다.'));button(body,'다시 조회',()=>{body.closest('dialog').close();reviewCloud();});}}
api.reviewCloud=reviewCloud;

function backupContext(){return scope()||(typeof saasMode!=='undefined'&&saasMode==='demo'?'demo':'');}
function fileRecoveryKey(){return 'carestep-json-restore-recovery:'+backupContext();}
function saveLocalConfiguration(state){
 const hk=clinicHospitalStorageKey(),wk=clinicWorkflowStorageKey(),oldH=localStorage.getItem(hk),oldW=localStorage.getItem(wk),hold=importHoldKey(),oldHold=hold?localStorage.getItem(hold):null;
 try{if(hold)localStorage.setItem(hold,'1');localStorage.setItem(hk,JSON.stringify(state.hospital));localStorage.setItem(wk,JSON.stringify(state.workflow));}
 catch(error){try{oldH===null?localStorage.removeItem(hk):localStorage.setItem(hk,oldH);oldW===null?localStorage.removeItem(wk):localStorage.setItem(wk,oldW);if(hold){oldHold===null?localStorage.removeItem(hold):localStorage.setItem(hold,oldHold);}}catch{}throw Error('이 PC에 설정을 저장하지 못했습니다. 기존 설정을 확인해주세요.');}
 hospital=structuredClone(state.hospital);workflowSettings=structuredClone(state.workflow);
 clearTimeout(typeof saasCloudTimer==='undefined'?undefined:saasCloudTimer);lastLocalPayload=JSON.stringify(saasStatePayload());cloudPending=false;cloudState='localonly';cloudMessage='이 PC 복원 완료 · 서버에는 반영하지 않았습니다.';renderAll();paintCloud();
}
async function restoreFileRecovery(){
 const auth=backupContext();if(!auth)return;
 try{const saved=JSON.parse(sessionStorage.getItem(fileRecoveryKey())||'null');if(!saved||saved.auth!==auth||saved.expires<=Date.now())throw Error('복구본이 없거나 보관 기간이 지났습니다.');
 if(!confirm('JSON 파일 복원 직전의 PC 설정으로 되돌릴까요? 서버에는 반영하지 않습니다.'))return;
 if(auth!==backupContext())return;saveLocalConfiguration(saved.state);toast('파일 복원 직전의 PC 설정으로 되돌렸습니다.');
 }catch(e){toast(e.message||'복구하지 못했습니다.');}
}
api.importBackup=async function(file){
 const auth=backupContext();if(!auth){toast('로그인 또는 체험 화면에서 백업을 복원해주세요.');return;}
 if(scope()&&typeof saasPermission==='function'&&!saasPermission('settings.manage')){toast('병원 설정 관리 권한이 필요합니다.');return;}
 try{
  if(file.size>8*1024*1024)throw Error('백업 파일이 너무 큽니다. 8MB 이하 파일을 선택해주세요.');
  const data=validateBackup(JSON.parse(await file.text()));if(auth!==backupContext())return;
  const incoming={hospital:{...defaultHospital,...data.hospital},workflow:normalizedWorkflowState(data.workflow)};
  const {d,body}=modal('설정 복원 내용 확인');
  body.append(node('p','파일: '+(file.name||'백업 JSON')),node('p','병원: '+(data.hospital.name||'미입력')+' · 백업 시각: '+(data.exportedAt||'기록 없음')));
  body.append(node('p','병원 설정과 PC 사용 통계를 파일의 내용으로 바꿉니다. 환자 진료기록·공개 자료는 이 복원 대상이 아닙니다. 복원 직전 상태는 이 탭에 2시간 보관합니다.'));
  const changes=differences({hospital,workflow:workflowSettings},incoming);body.append(node('p','변경 항목 '+changes.length+'개 · 사용 기록 '+(workflowSettings.usage||[]).length+' → '+(incoming.workflow.usage||[]).length+'건 · 메시지 서식 '+(workflowSettings.followupMessagePresets||[]).length+' → '+(incoming.workflow.followupMessagePresets||[]).length+'개'));
  const details=node('details');details.append(node('summary','전체 변경 내용 보기'));comparison(details,{hospital,workflow:workflowSettings},incoming,'현재 PC','백업 파일');body.append(details);
  const different=!!(data.clinicId&&scope()&&data.clinicId!==saasMe?.clinic?.id)||(String(data.hospital.name||'').trim()!==String(hospital.name||'').trim());
  const confirmBox=node('input');confirmBox.type='checkbox';const confirmLabel=node('label',different?' 병원이 다르거나 병원명이 다른 백업임을 확인했습니다.':' 변경 내용과 백업 시각을 확인했습니다.');confirmLabel.prepend(confirmBox);body.append(confirmLabel);
  const sync=node('input');sync.type='checkbox';const syncLabel=node('label',' 복원 후 서버 설정에도 반영합니다. 다른 PC의 병원 설정도 변경됩니다.');syncLabel.prepend(sync);if(scope())body.append(syncLabel);
  const status=node('p');status.setAttribute('role','status');body.append(status);let applied=false;
  const apply=button(body,'복구본 보관 후 이 PC에 복원',async()=>{
   if(applied||!confirmBox.checked||auth!==backupContext())return;
   if(!confirm('확인한 백업 파일로 이 PC 설정을 복원할까요?'))return;
   apply.disabled=true;
   try{
    const before={hospital:structuredClone(hospital),workflow:structuredClone(workflowSettings)};
    sessionStorage.setItem(fileRecoveryKey(),JSON.stringify({auth,expires:Date.now()+7200000,state:before}));
    saveLocalConfiguration(incoming);applied=true;confirmBox.disabled=sync.disabled=true;status.textContent='PC 복원 완료 · 복원 직전 상태를 이 탭에 보관했습니다.';
    button(body,'파일 복원 직전 상태로 되돌리기',restoreFileRecovery);
    if(sync.checked&&scope()){await saasUploadCloud(false);status.textContent=cloudState==='ready'?'PC 복원과 서버 동기화 완료':'PC 복원 완료 · 서버 반영 결과는 상단 동기화 상태에서 확인해주세요.';}
   }catch(error){status.textContent='복원 중단 · '+(error.message||'복구본 보관 또는 PC 저장에 실패했습니다.');apply.disabled=false;}
  });apply.disabled=true;confirmBox.onchange=()=>apply.disabled=applied||!confirmBox.checked;
 }catch(e){toast(e.message||'백업 파일을 읽지 못했습니다.');}
};

// Observe confirmed writes only; do not retry an uncertain clinical write automatically.
const originalRequest=saasRequest;const observed=[],snapshots=new Map();
function rememberSnapshot(key,data){if(data===undefined)return;snapshots.set(key,structuredClone(data));while(snapshots.size>200)snapshots.delete(snapshots.keys().next().value);}
saasRequest=async function(path,options={}){
 const auth=scope(),method=options.method||'GET',key=path.split('?')[0],isCloud=path==='/saas/clinic/state'&&method==='PUT';
 try{
  const out=await originalRequest(path,options);if(auth!==scope()||out?.ok===false)return out;
  if(isCloud){cloudRevision++;cloudLastFailure=false;}
  if(method==='GET'&&key.startsWith('/saas/patients/')){
   rememberSnapshot(key,out?.event||out?.patient||out?.guardian||out);
   if(Array.isArray(out?.events))for(const x of out.events)rememberSnapshot(key+'/'+encodeURIComponent(x.id),x);
  }
  if(method!=='GET'&&/\/(patients|r61|followup|medication)/.test(path)){
   let body={};try{body=JSON.parse(options.body||'{}');}catch{}
   const fromPath=path.match(/\/patients\/([^/?]+)/),patientId=body.patientId||fromPath?.[1],before=snapshots.get(key),after=out?.event||out?.patient||out?.guardian;
   if(patientId)observed.unshift({patientId:String(patientId),auth,at:new Date().toISOString(),actor:saasMe?.user?.displayName||'병원 직원',method,
    operation:/withdraw/.test(path)?'자료 공개 철회':/supersede/.test(path)?'이전 안내 표시 변경':/messages/.test(path)?'메시지 처리':/timeline/.test(path)?'건강기록 처리':/materials|deliveries/.test(path)?'자료 처리':'환자 관련 처리',
    changes:before&&after?differences(before,after).filter(x=>!/(phone|token|key)/i.test(x.path)).slice(0,15):[],fields:Object.keys(body).filter(k=>!/(token|phone|consent|key)/i.test(k))});
   observed.splice(100);
   if(method==='DELETE')snapshots.delete(key);else if(after)rememberSnapshot(key,after);else snapshots.delete(key);
  }
  return out;
 }catch(e){if(isCloud&&auth===scope()){cloudRevision++;cloudLastFailure=true;saasCloudMeta={...(saasCloudMeta||{}),error:e.message||'서버 저장 실패',conflict:e.status===409||!!saasCloudMeta?.conflict};}throw e;}
};
// Selection and merge preview uses fresh server detail and impact, never the first candidate automatically.
api.chooseMerge=async function({kind,item,candidates,guardian}){const auth=scope();if(!auth)return null;const {d,body}=modal('중복 후보 비교');body.append(node('p','병합 대상은 직접 선택합니다. 원본은 대상에 통합되며 되돌릴 수 없습니다. 기록별 병합 규칙은 서버에서 적용합니다.'));const select=node('select');select.className='input';select.setAttribute('aria-label','병합 대상');select.append(node('option','대상을 선택하세요'));select.options[0].value='';for(const [i,c]of candidates.entries()){const o=node('option',`${c.name||'이름 미확인'} · ${c.guardianName||''} · ${c.reason||'후보'}`);o.value=String(i);select.append(o);}const preview=node('div'),confirmBox=node('input');confirmBox.type='checkbox';const label=node('label',' 비교 결과와 병합 방향을 확인했습니다.');label.prepend(confirmBox);body.append(select,preview,label);let selected=null,revision=0;
return new Promise(resolve=>{d.addEventListener('close',()=>resolve(null),{once:true});const accept=button(body,'선택한 대상으로 병합',()=>{if(!selected||!confirmBox.checked||auth!==scope())return;const result=selected;resolve(result);d.close();});accept.disabled=true;confirmBox.onchange=()=>accept.disabled=!selected||!confirmBox.checked;select.onchange=async()=>{const seq=++revision;selected=null;accept.disabled=true;confirmBox.checked=false;preview.replaceChildren(node('p','양쪽 정보와 연결 기록을 조회 중…'));if(!select.value){preview.replaceChildren();return;}const c=candidates[Number(select.value)],target=kind==='patient'?c.patientId:c.guardianId;if(!target)return;try{const base='/saas/'+(kind==='patient'?'patients':'guardians')+'/',details=kind==='patient'?await Promise.all([saasRequest(base+encodeURIComponent(item.id)+'/workspace'),saasRequest(base+encodeURIComponent(target)+'/workspace')]):await Promise.all([saasRequest(base+encodeURIComponent(item.id)),saasRequest(base+encodeURIComponent(target))]);const impacts=await Promise.all([saasRequest(base+encodeURIComponent(item.id)+'/deletion-impact'),saasRequest(base+encodeURIComponent(target)+'/deletion-impact')]);if(seq!==revision||auth!==scope())return;if(!details.every((x,i)=>String((kind==='patient'?x.patient:x.guardian)?.id||'')===String(i?target:item.id))||!impacts.every(x=>x.impact&&typeof x.impact==='object'))throw Error('양쪽 정보와 연결 기록을 확인할 수 없습니다.');preview.replaceChildren(node('p',`병합 방향: ${item.name} → ${c.name}`));const pick=x=>kind==='patient'?{patient:x.patient,guardian:x.guardian,home:x.home}:x.guardian||x;comparison(preview,pick(details[0]),pick(details[1]),'원본 · 통합될 정보','대상 · 남길 정보',true);comparison(preview,impacts[0].impact||{},impacts[1].impact||{},'원본 연결 기록','대상 연결 기록',true);preview.append(node('p','위 연결 건수는 현재 상태입니다. 병합 후 건수나 필드별 최종값을 미리 확정한 결과는 아닙니다.'));selected={...c,guardianId:details[1].guardian?.id||c.guardianId};}catch(e){if(seq===revision)preview.replaceChildren(node('p','비교 조회 실패 · 대상을 다시 선택해주세요. '+e.message));}};});};
// Draft snapshots are opt-in, bounded and isolated by clinic and employee.
const draftKey=()=>scope()?'carestep-builder-drafts-v1:'+scope():'';let draftsEnabled=false,draftTimer;
function drafts(){try{
 const all=JSON.parse(sessionStorage.getItem(draftKey())||'[]'),seen=new Set();
 return (Array.isArray(all)?all:[]).filter(x=>x.expires>Date.now()&&x.auth===scope()).map(x=>{
  const patientId=x.patientId||x.id;return {...x,patientId,id:draftIdentity(patientId,x.caseInfo?.dischargeDate,x.templateId)};
 }).filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;}).slice(0,10);
}catch{return [];}}
function writeDrafts(rows){try{sessionStorage.setItem(draftKey(),JSON.stringify(rows));return true;}catch{return false;}}
function captureDraft(){if(!draftsEnabled||!scope()||scope()!==lastScope||currentCasePhase==='completed')return;const patient=global.crmCurrentPatient?.();if(!patient?.patientId||!patient.guardianId)return;readCaseInfoFromForm();const data={id:draftIdentity(patient.patientId,caseInfo.dischargeDate,currentTemplateId),patientId:patient.patientId,guardianId:patient.guardianId,auth:scope(),at:Date.now(),expires:Date.now()+7200000,caseInfo:structuredClone(caseInfo),medications:structuredClone(medications),templateId:currentTemplateId};const okay=writeDrafts([data,...drafts().filter(x=>x.id!==data.id)]);$('clinicDraftStatus').textContent=okay?'이 탭에 임시저장 완료 · 2시간 보관':'임시저장 실패 · 이 화면을 닫지 마세요.';}
async function openDrafts(){clearTimeout(draftTimer);captureDraft();const auth=scope(),{body}=modal('작성 중인 보호자 안내자료');body.append(node('p','이 탭에서 보관한 초안입니다. 2시간 후 만료되며 다른 PC와 공유되지 않습니다. 복원해도 자료 게시·예약 발송은 실행되지 않습니다.'));const list=node('div');body.append(list);function paint(){list.replaceChildren();const rows=drafts();if(!rows.length)list.append(node('p','보관된 초안이 없습니다.'));for(const x of rows){const card=node('article');card.append(node('b',x.caseInfo.patientName||'환자'),node('p',(x.caseInfo.dischargeDate||'진료일 미입력')+' · '+(templates.find(t=>t.id===x.templateId)?.title||x.templateId||'자료 미선택')+' · 저장 '+new Date(x.at).toLocaleString('ko-KR')));button(card,'복원',async()=>{if(auth!==scope()||x.expires<=Date.now())return;if(!confirm('현재 작성 내용을 바꾸고 이 초안을 복원할까요?'))return;try{const good=await global.crmOpenPatientRecord?.(x.guardianId,x.patientId);if(!good||auth!==scope())throw Error('환자 접근 권한을 확인해주세요.');const c=global.crmMaterialContext?.();if(!c||String(c.patientId)!==String(x.patientId))throw Error('환자를 다시 선택해주세요.');if(!templates.some(t=>t.id===x.templateId))throw Error('선택했던 자료를 사용할 수 없습니다.');beginNewCase(false,true);global.crmUsePatient(c.patient,c.guardian,{stay:true});currentTemplateId=x.templateId;if(typeof clinicSetEducationChoice==='function')clinicSetEducationChoice(x.templateId);caseInfo={...x.caseInfo,patientId:c.patientId,guardianId:c.guardianId};medications=structuredClone(x.medications);const map={patientName:'patientName',guardianName:'guardianName',dischargeDate:'dischargeDate',procedure:'caseProcedure',medication:'caseMedication',feeding:'caseFeeding',activity:'caseActivity',protection:'caseProtection',extra:'caseExtra',recheckMode:'recheckMode',recheckManual:'recheckManual'};for(const [key,id]of Object.entries(map))if($(id))$(id).value=caseInfo[key]||'';if($('includePatientNames'))$('includePatientNames').checked=!!caseInfo.includeNames;renderMedicationRows();currentCasePhase='editing';go('builder');renderBuilder();body.closest('dialog').close();toast('초안을 복원했습니다. 게시 전 내용을 확인해주세요.');}catch(e){card.append(node('p','복원 실패 · '+e.message));}});button(card,'삭제',()=>{writeDrafts(drafts().filter(d=>d.id!==x.id));paint();});list.append(card);}}paint();}
async function openHistory(){const c=global.crmMaterialContext?.();if(!c?.patientId){toast('환자를 먼저 선택해주세요.');return;}const auth=scope(),pid=String(c.patientId),{body}=modal('환자 처리 이력');body.append(node('p','서버의 건강기록·자료 전달 내역과 이 탭에서 확인한 처리 내역입니다. 과거 변경 전 값이나 수정자는 서버가 제공하는 범위에서만 확인됩니다.'));const list=node('div');body.append(list);const guard=()=>auth===scope()&&String(global.crmMaterialContext?.()?.patientId||'')===pid;
async function load(){list.replaceChildren(node('p','조회 중…'));const sources=await Promise.allSettled([saasRequest('/saas/patients/'+encodeURIComponent(pid)+'/timeline?limit=500'),saasRequest('/saas/r61/deliveries?patientId='+encodeURIComponent(pid))]);if(!guard()){list.replaceChildren(node('p','환자 또는 로그인이 바뀌었습니다. 닫고 다시 열어주세요.'));return;}list.replaceChildren();const rows=[];for(const [i,r]of sources.entries()){if(r.status==='rejected'){list.append(node('p',(i?'자료 전달':'건강기록')+' 조회 실패 · 새로고침으로 다시 시도해주세요.'));continue;}const items=i?r.value.deliveries:r.value.events;if(!Array.isArray(items)){list.append(node('p',(i?'자료 전달':'건강기록')+' 응답 확인 필요'));continue;}for(const x of items)rows.push({at:x.updatedAt||x.updated_at||x.createdAt||x.created_at||x.eventDate||'',title:i?(x.title||'자료 전달'):(x.title||x.type||'건강기록'),actor:x.updatedByName||x.createdByName||x.actorName||'기록 없음',status:i?((x.accessRevoked===true||Number(x.accessRevoked)===1)?'공개 철회':x.superseded_by?'이전 안내':x.status||'상태 미확인'):(x.status||'기록'),detail:i?'채널 '+(x.channel||'미확인'):'기록일 '+(x.eventDate||'미확인')});}
for(const x of observed.filter(x=>x.auth===auth&&x.patientId===pid))rows.push({at:x.at,title:'이 탭에서 확인한 처리',actor:x.actor,status:x.method==='DELETE'?'삭제 요청 완료':x.method==='POST'?'등록·처리 요청 완료':'변경 요청 완료',detail:x.operation+(x.changes.length?' · '+x.changes.map(c=>c.path+': '+value(c.before)+' → '+value(c.after)).join(' / '):' · 변경 전후 값 기록 없음')});rows.sort((a,b)=>b.at.localeCompare(a.at));if(!rows.length)list.append(node('p','조회된 이력이 없습니다.'));for(const x of rows){const card=node('article');card.append(node('b',x.title),node('p',x.at+' · '+x.actor),node('p',x.status+' · '+x.detail));list.append(card);}}
button(body,'이력 새로고침',load);await load();}
api.openHistory=openHistory;
function mount(){const builder=$('builder');if(builder&&!$('clinicDraftTools')){const box=node('div');box.id='clinicDraftTools';box.className='clinic-sync-status';const label=node('label',' 이 탭에 작성 초안 임시보관 · 2시간');const check=node('input');check.type='checkbox';label.prepend(check);box.append(label);button(box,'작성 중 목록',openDrafts);const status=node('span','등록 환자를 선택한 작성 내용만 보관합니다.');status.id='clinicDraftStatus';box.append(status);builder.prepend(box);check.onchange=()=>{draftsEnabled=check.checked;if(draftsEnabled)captureDraft();};builder.addEventListener('input',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(captureDraft,400);});builder.addEventListener('change',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(captureDraft,400);});}
const account=$('saasCloudNote');if(account&&!$('clinicCloudReview')){const b=button(account.parentElement,'PC·서버 설정 비교·복구',reviewCloud);b.id='clinicCloudReview';}
let fileRestore=$('clinicFileRestoreRecovery');if(!fileRestore&&account){fileRestore=button(account.parentElement,'JSON 복원 직전 상태로 되돌리기',restoreFileRecovery);fileRestore.id='clinicFileRestoreRecovery';}if(fileRestore){try{const saved=JSON.parse(sessionStorage.getItem(fileRecoveryKey())||'null');fileRestore.hidden=!saved||saved.auth!==backupContext()||saved.expires<=Date.now();}catch{fileRestore.hidden=true;}}
const root=$('crmPatientWorkspace');if(root&&!$('clinicPatientHistory')){const b=button(root.parentElement,'선택 환자 처리 이력',openHistory);b.id='clinicPatientHistory';}if(importHeld()&&['idle','unbound','pending'].includes(cloudState)){cloudState='localonly';cloudMessage='이 PC에 파일 복원한 설정이 있습니다. 서버 반영은 별도로 확인해주세요.';}paintCloud();}
api.clearPrivate=()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('carestep-builder-drafts-v1:')||key.startsWith('carestep-settings-recovery:')||key.startsWith('carestep-json-restore-recovery:')||key.startsWith('carestep-json-restore-hold:'))sessionStorage.removeItem(key);backup=null;backupScope='';observed.splice(0);snapshots.clear();draftsEnabled=false;cloudPending=false;uploadQueued=false;clearTimeout(draftTimer);document.querySelectorAll('.clinic-recovery-dialog').forEach(d=>{if(d.open)d.close();d.remove();});};
api.mount=mount;let lastScope=scope();setInterval(()=>{if(lastScope!==scope()){if(lastScope)api.clearPrivate();const cb=$('clinicDraftTools')?.querySelector('input');if(cb)cb.checked=false;cloudMessage='';cloudState='idle';lastLocalPayload=JSON.stringify(saasStatePayload());lastScope=scope();}if(currentCasePhase==='completed'&&scope()){const id=global.crmCurrentPatient?.()?.patientId;if(id)writeDrafts(drafts().filter(x=>x.id!==draftIdentity(id,caseInfo.dischargeDate,currentTemplateId)));}if(scope()){for(const prefix of ['carestep-builder-drafts-v1:','carestep-settings-recovery:','carestep-json-restore-recovery:']){const key=prefix+scope();try{const stored=JSON.parse(sessionStorage.getItem(key)||'null');if(Array.isArray(stored)){const live=stored.filter(x=>x.expires>Date.now());if(live.length!==stored.length)sessionStorage.setItem(key,JSON.stringify(live));}else if(stored&&stored.expires<=Date.now())sessionStorage.removeItem(key);}catch{}}}mount();},1500);
window.addEventListener('online',()=>{if(cloudPending&&cloudState==='error'&&!saasCloudMeta?.conflict)saasUploadCloud(true);});
window.addEventListener('beforeunload',()=>{clearTimeout(draftTimer);captureDraft();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window==='undefined'?globalThis:window);
