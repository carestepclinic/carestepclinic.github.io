/* Short-lived, identity-scoped reads for the visible account pane. No persisted account data. */
(function(global){
 'use strict';
 let currentScope='',entries=new Map();
 function status(tab,entry,retry){
  if(typeof document==='undefined')return;
  const pane=document.querySelector(`[data-account-pane="${tab}"]`);if(!pane)return;
  let bar=pane.querySelector('.account-read-status');
  if(!bar){bar=document.createElement('div');bar.className='account-read-status';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');pane.querySelector('.account-pane-head')?.after(bar);}
  let row=bar.querySelector(`[data-read="${entry.id}"]`);
  if(!row){row=document.createElement('span');row.dataset.read=entry.id;bar.append(row);}
  row.replaceChildren();
  const time=entry.checked?new Date(entry.checked).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
  row.append(`${entry.label} · ${entry.pending?'확인 중':entry.error?'조회 실패':time+' 확인'}${entry.error&&time?' · 이전 '+time+' 정보':''}`);
  if(entry.error){const button=document.createElement('button');button.type='button';button.className='btn btn-ghost';button.textContent='다시 시도';button.addEventListener('click',retry);row.append(button);}
 }
 async function load(tab,{scope,valid=()=>true,jobs=[],force=false}){
  if(currentScope!==scope){currentScope=scope;entries=new Map();if(typeof document!=='undefined')document.querySelectorAll('.account-read-status').forEach(el=>el.remove());}
  return Promise.all(jobs.map(job=>{
   let e=entries.get(job.id);if(!e){e={id:job.id,label:job.label,checked:0,pending:null,error:false};entries.set(job.id,e);}
   const retry=()=>load(tab,{scope,valid,jobs:[job],force:true});
   if(e.pending){status(tab,e,retry);return e.pending;}
   if(!force&&!e.error&&Date.now()-e.checked<15000){status(tab,e,retry);return Promise.resolve();}
   e.error=false;
   e.pending=Promise.resolve().then(job.run).then(()=>{if(valid()&&scope===currentScope)e.checked=Date.now();},()=>{if(valid()&&scope===currentScope)e.error=true;}).finally(()=>{e.pending=null;if(valid()&&scope===currentScope)status(tab,e,retry);});
   status(tab,e,retry);return e.pending;
  }));
 }
 global.CarestepAccountReads={load};
 if(typeof module!=='undefined')module.exports=global.CarestepAccountReads;
})(typeof window==='undefined'?globalThis:window);
