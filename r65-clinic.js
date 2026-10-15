/* R65 manual request UI. No local process launch, activation or automatic resubmit. Status reads only while pending. */
(()=>{'use strict';
 const labels={queued:'Agent 대기 중',claimed:'동기화 진행 중',running:'동기화 진행 중',success_no_changes:'최신 백업과 동일 · 변경 없음',completed:'완료',failed:'실패',stale:'시간 초과'};
 const when=v=>{const d=new Date(v);return v&&Number.isFinite(d.getTime())?d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'기록 없음';};
 const el=(tag,text)=>{const x=document.createElement(tag);if(text)x.textContent=text;return x;};
 let scope='',generation=0,key='',ownRequest='',busy=false,timer=null;
 const api=(suffix='',body)=>saasRequest('/saas/r65/manual-sync'+suffix,body===undefined?{}:{method:'POST',body:JSON.stringify(body),redirect:'error'});
 const identity=()=>typeof saasMode!=='undefined'&&saasMode==='auth'&&typeof saasMe!=='undefined'&&['owner','admin'].includes(saasMe?.role)?String(saasMe.clinic?.id||'')+':'+String(saasMe.user?.id||''):'';
 const remove=()=>document.getElementById('r65-manual-controls')?.remove();
 async function refresh(force=false){
  clearTimeout(timer);timer=null;const current=identity();if(!force&&scope===current)return;if(scope!==current){key='';ownRequest='';}scope=current;const rev=++generation;remove();if(!current)return;
  if(!key)key=crypto.randomUUID();
  let d;try{d=await api();}catch{return;}if(rev!==generation||identity()!==current||!d.enabled||!d.agentVerified)return;
  const panel=el('section');panel.id='r65-manual-controls';panel.setAttribute('aria-label','eFriends 동기화');panel.style.cssText='padding:12px;border:1px solid #cbd5e1;border-radius:12px;margin:12px';
  const message=el('p',(d.nextRunNotice||'서버 PC의 최신 백업을 반영합니다.')+(d.requestCheckSeconds===60?' 서버 PC가 켜져 있으면 약 1분 이내 요청을 확인합니다.':' Agent의 다음 실행 시 요청을 확인합니다.')+' 백업 생성 이후의 진료 내용은 다음 백업에 포함돼야 반영됩니다.'),status=el('p'),request=el('button','eFriends 최신 백업 반영'),check=el('button','상태 새로고침');request.type=check.type='button';panel.append(message,request,check,status);
  if(ownRequest&&d.requests.some(r=>r.id===ownRequest&&(r.closed||['completed','success_no_changes'].includes(r.state)))){key=crypto.randomUUID();ownRequest='';}
  const pending=d.requests.find(r=>!r.closed&&['queued','claimed','running','failed','stale'].includes(r.state));
  request.disabled=busy||!!pending;
  if(pending)status.textContent=labels[pending.state]+' · 요청 '+when(pending.requestedAt);
  for(const r of d.requests){if(pending?.id===r.id&&!r.canClose)continue;const line=el('p',(labels[r.state]||'상태 미확정')+' · 요청 '+when(r.requestedAt)+(r.startedAt?' · 시작 '+when(r.startedAt):'')+(r.finishedAt?' · 완료 '+when(r.finishedAt):'')+(r.state==='completed'?' · 반영 '+Number(r.changedCount||0)+'건':'')+(r.errorCode?' · 오류 '+r.errorCode:'')+(r.closed?' · 종료 확인됨':''));panel.append(line);
   if(r.canClose){const close=el('button','이전 요청 종료 확인');close.type='button';line.append(close);close.onclick=async()=>{if(identity()!==current||busy||!confirm('Agent 잠금 해제 확인이 기록된 이전 요청입니다. 실패·시간 초과 상태를 확인하고 종료하시겠습니까?'))return;busy=true;close.disabled=true;try{if(identity()!==current)return;await api('/close',{requestId:r.id,acknowledged:true});if(identity()!==current)return;key=crypto.randomUUID();busy=false;await refresh(true);}catch{status.textContent='종료 상태를 확인하지 못했습니다. 자동 재시도하지 않습니다.';}finally{busy=false;close.disabled=false;}};}
  }
  request.onclick=async()=>{if(identity()!==current||busy||pending)return;busy=true;request.disabled=true;try{const out=await api('',{idempotencyKey:key,mode:'delta'});if(identity()!==current)return;ownRequest=out.request.id;status.textContent=(out.reused?'기존 요청: ':'요청됨 · ')+(labels[out.request.state]||'상태 확인 필요');busy=false;await refresh(true);}catch{status.textContent='요청 결과 미확정. 상태를 새로고침해 확인하십시오. 자동 재전송하지 않습니다.';}finally{busy=false;}};
  check.onclick=()=>refresh(true);
  (document.getElementById('r61-sync-slot')||document.querySelector('main')||document.body).append(panel);
  if(pending&&['queued','claimed','running'].includes(pending.state)){timer=setTimeout(()=>{if(identity()===current&&!document.hidden)refresh(true);},15000);}
 }
 window.R65ManualSync={refresh};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh());else refresh();
})();
