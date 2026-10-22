/* HQ-only common-content queue. The server owns consent, deduplication and job leases. */
(function(global){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={queued:'대기',running:'생성 중',completed:'초안 생성 완료',reused:'기존 자료 재사용',failed:'생성 미완료',stale:'원본 변경 확인',cancelled:'대기 중지'};
 let dialog=null,adapter=null,owner='',preview=null,state=null,working=false,epoch=0,timer=null,openDocument=null;
 const button=(text,action,extra='')=>`<button type="button" class="st-button" data-ta="${action}" ${extra}>${text}</button>`;
 function current(e=epoch){return e===epoch&&owner===(adapter?.identity?.()||'')&&(!adapter?.isReady||adapter.isReady());}
 async function api(path,body){const e=epoch,r=await adapter.request('/automation'+path,body===undefined?{method:'GET'}:{method:'POST',body:JSON.stringify(body)});if(!current(e))throw Error('로그인이 변경됐습니다. 다시 열어주세요.');return r;}
 function notice(text,error=false){const el=dialog?.querySelector('[data-ta-notice]');if(el){el.textContent=text;el.classList.toggle('st-error',error);}}
 function close(){epoch++;clearTimeout(timer);timer=null;dialog?.close();dialog?.remove();dialog=null;preview=null;state=null;working=false;}
 function progress(){if(!dialog||!state)return;const c=state.counts,host=dialog.querySelector('[data-ta-progress]'),scroll=host.querySelector('.ta-items')?.scrollTop||0;
 host.innerHTML=`<div class="ta-counts" role="status"><b>완료 ${c.completed+c.reused}개</b><span>새 초안 ${c.completed} · 재사용 ${c.reused}</span><span>대기 ${c.queued} · 생성 중 ${c.running}</span><span>미완료 ${c.failed} · 원본 확인 ${c.stale} · 중지 ${c.cancelled}</span></div><div class="st-actions">${button('진행 현황 새로고침','refresh')}${button(working?'생성 진행 중':'지금 생성 이어가기','process',working||!c.queued?'disabled':'')}${button('대기 작업 중지','cancel',!c.queued?'disabled':'')}${button('미완료·중지 일괄 재개','retry-all',!c.failed&&!c.cancelled?'disabled':'')}</div><div class="ta-items">${state.items.map(x=>`<article class="ta-item"><div><b>${esc(x.title)}</b><p>원본 ${esc(x.sourceVersion)} · ${esc(labels[x.status])}</p>${x.error?`<p class="st-muted">${esc(x.error)}</p>`:''}</div><div>${x.versionId?button('교육자료 열기','document',`data-id="${esc(x.versionId)}"`):''}${['failed','cancelled'].includes(x.status)?button('다시 생성','retry',`data-id="${esc(x.id)}"`):''}</div></article>`).join('')||'<p>등록된 자동 생성 작업이 없습니다.</p>'}</div>`;host.querySelector('.ta-items').scrollTop=scroll;if(state.items.length)host.parentNode.insertBefore(host,dialog.querySelector('[data-ta-selection]')); 
 }
 function selection(){if(!dialog||!preview)return;const c=preview.counts;dialog.querySelector('[data-ta-selection]').innerHTML=`<h3>기존 보호자 자료 일괄 생성</h3><p>원본 ${c.total}개 · 기본 ${c.builtin}개 · 중앙 게시 ${c.central}개<br>재사용 가능 ${c.reusable}개 · 나머지 ${c.total-c.reusable}개는 직원 교육 초안으로 생성합니다.</p><p>같은 원본·버전은 다시 생성하지 않습니다. 임상 핵심, 간호·보고, 보호자 상담과 평가문항 5개를 작성하고, 원본에 없는 내용은 추가 검토 항목으로 남깁니다.</p><details><summary>대상 원본 ${c.total}개 확인</summary><ul class="ta-sources">${preview.sources.map(s=>`<li>${esc(s.title)} · ${esc(s.version)}${s.existingVersionId?' · 재사용':''}</li>`).join('')}</ul></details><label class="st-choice"><input type="checkbox" data-ta-consent>위 원본을 연결된 AI로 전송하고 추가 사용료가 발생하는 것을 확인했습니다.</label>${button('전체 원본 일괄 등록·생성','enqueue',!c.total?'disabled':'')}<p class="st-muted">CARESTEP 하루 생성 횟수 제한 없음 · 동시 처리 최대 2개<br>AI 서비스 자체의 한도와 사용료는 별도로 적용됩니다. 직원 공개에는 의료진의 별도 승인이 필요합니다.</p>`;}
 async function refresh(){state=await api('');progress();}
 function poll(e){clearTimeout(timer);if(!dialog||!current(e))return;timer=setTimeout(async()=>{try{await refresh();}catch(error){notice(error.message,true);}if(current(e))poll(e);},5000);}
 async function process(){if(working)return;const e=epoch;working=true;progress();notice('직원 교육 초안을 생성하고 있습니다. 창을 닫으면 서버가 5분 간격으로 남은 대기 작업을 이어갑니다.');
  const worker=async()=>{while(current(e)&&dialog){if(state?.deferredUntil&&Date.parse(state.deferredUntil)>Date.now()){notice('AI 요청량 제한으로 잠시 대기 중입니다. '+new Date(state.deferredUntil).toLocaleTimeString('ko-KR')+' 이후 다시 이어갑니다.');await new Promise(resolve=>setTimeout(resolve,Math.min(30000,Date.parse(state.deferredUntil)-Date.now())));continue;}const r=await api('/process',{});if(!current(e))return;state=r;progress();if(!r.counts.queued)return;if(r.processed===false&&!r.deferredUntil)return;await new Promise(resolve=>setTimeout(resolve,300));}};
  try{await Promise.all([worker(),worker()]);if(current(e))notice('이번 생성 처리를 마쳤습니다. 미완료 항목은 확인 후 다시 생성할 수 있습니다.');}catch(error){if(current(e))notice('연결 결과 확인이 필요합니다. 서버 작업은 유지됩니다. 진행 현황을 새로고침해주세요. '+error.message,true);}finally{if(current(e)){working=false;await refresh().catch(()=>{});try{preview=await api('/preview');selection();}catch{}}}
 }
 async function click(event){const b=event.target.closest('[data-ta]');if(!b||b.disabled)return;const a=b.dataset.ta;
  if(a==='close'){close();return;}
  if(a==='document'){const id=b.dataset.id,open=openDocument;close();await open?.(id);return;}
  if(a==='process'){process();return;}
  b.disabled=true;
  try{
   if(a==='refresh'){await refresh();preview=await api('/preview');selection();}
   if(a==='enqueue'){if(!dialog.querySelector('[data-ta-consent]').checked)throw Error('AI 전송·사용료 안내를 확인해주세요.');state=await api('/enqueue',{confirmSend:true,sources:preview.sources.map(s=>({id:s.id,hash:s.hash,version:s.version}))});progress();notice('대상 원본을 등록했습니다. 이미 등록한 작업은 중복 처리하지 않습니다.');process();}
   if(a==='cancel'){state=await api('/cancel',{});progress();notice('대기 중인 작업을 중지했습니다. 이미 생성 중인 작업은 결과를 저장합니다.');}
   if(a==='retry-all'){const ids=state.items.filter(x=>['failed','cancelled'].includes(x.status)).map(x=>x.id);if(!global.confirm(ids.length+'개 미완료·중지 자료를 다시 처리할까요? 기존 결과는 재사용하며 새 생성에는 추가 사용료가 발생합니다.'))return;state=await api('/retry',{confirmSend:true,ids});progress();process();}
   if(a==='retry'){if(!global.confirm('이 원본의 AI 생성을 다시 요청할까요? 기존 결과가 있으면 재사용하며, 새 생성에는 추가 사용료가 발생합니다.'))return;state=await api('/'+encodeURIComponent(b.dataset.id)+'/retry',{confirmSend:true});progress();process();}
  }catch(error){notice(error.message,true);}finally{b.disabled=false;}
 }
 async function open(a,onDocument){close();adapter=a;owner=a.identity?.()||'';openDocument=onDocument;const e=epoch;
  dialog=document.createElement('dialog');dialog.className='st-dialog st-wide training-automation';dialog.setAttribute('aria-labelledby','ta-title');dialog.innerHTML=`<header><h2 id="ta-title">보호자 자료 → 직원 교육</h2>${button('닫기','close')}</header><div class="st-dialog-body"><p role="status" aria-live="polite" data-ta-notice></p><div data-ta-selection><p>원본과 기존 교육자료를 확인하고 있습니다.</p></div><section aria-label="자동 생성 진행 현황" data-ta-progress></section></div>`;document.body.append(dialog);dialog.showModal();dialog.addEventListener('click',click);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  try{state=await api('');progress();preview=await api('/preview');selection();poll(e);}catch(error){notice(error.message,true);}
 }
 global.TrainingAutomation={open,close};
})(globalThis);
