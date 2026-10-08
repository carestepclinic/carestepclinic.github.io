/* R61 patient routes: stable IDs only; no patient/guardian names in URL. */
(function(global){
 'use strict';
 const allowed=new Set(['vaccination','heartworm','weight','visit']);
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(v)?v:'';
 function parse(url){
  const u=new URL(url,'https://local.invalid');return {patientId:id(u.searchParams.get('patient')),guardianId:id(u.searchParams.get('guardian')),type:allowed.has(u.searchParams.get('record'))?u.searchParams.get('record'):'',taskId:id(u.searchParams.get('task'))};
 }
 function urlFor(base,x){const u=new URL(base);for(const k of ['patient','guardian','record','task'])u.searchParams.delete(k);u.searchParams.set('patient',x.patientId);u.searchParams.set('guardian',x.guardianId);if(x.type)u.searchParams.set('record',x.type);if(x.taskId)u.searchParams.set('task',x.taskId);return u.pathname+u.search+u.hash;}
 let revision=0;
 async function open(x,{history=true,record=true}={}){
  const rev=++revision;
  if(!id(x.patientId)||!id(x.guardianId)){global.toast?.('환자 연결 정보를 확인해주세요.');return false;}
  let ok=false;try{ok=await global.crmOpenPatientRecord?.(x.guardianId,x.patientId);}catch{}
  if(rev!==revision)return false;
  if(!ok){global.toast?.('환자가 없거나 삭제되었거나 접근 권한이 없습니다. 환자 연결을 다시 확인해주세요.');return false;}
  if(history)global.history.pushState({r61:true},'',urlFor(global.location.href,x));
  if(record&&allowed.has(x.type)&&typeof global.crmOpenConfirmedQuick==='function'){
   // A completed/deleted task must never reopen a new completion form from a stale link.
   let active=false;
   try{active=!!x.taskId&&await global.r61TaskStillActive?.(x);}catch{}
   if(rev!==revision)return false;
   if(!active){global.toast?.('업무가 완료·삭제되었거나 현재 환자와 일치하지 않습니다. 목록을 확인해주세요.');return false;}
   if(!await global.crmOpenConfirmedQuick(x.guardianId,x.patientId,x.type)){global.toast?.('환자 기록 연결을 확인하지 못했습니다. 다시 선택해주세요.');return false;}
  }
  return true;
 }
 const api={parse,urlFor,open};
 global.R61PatientRoute=api;
 if(typeof module!=='undefined')module.exports=api;
 if(global.addEventListener){
  global.addEventListener('popstate',()=>{const x=parse(global.location.href);if(x.patientId)void open(x,{history:false,record:false});else{revision++;global.crmClearPatientSelection?.();}});
  global.addEventListener('r61-auth-ready',()=>{const x=parse(global.location.href);if(x.patientId)void open(x,{history:false,record:false});});
 }
})(typeof window==='undefined'?globalThis:window);
