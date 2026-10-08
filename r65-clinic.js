/* R65 manual request UI. No local process launch, polling loop, activation or automatic resubmit. */
(()=>{'use strict';
 const labels={queued:'Agent 대기 중',claimed:'동기화 진행 중',running:'동기화 진행 중',success_no_changes:'변경 없음',completed:'완료',failed:'실패',stale:'시간 초과'};
 const el=(tag,text)=>{const x=document.createElement(tag);if(text)x.textContent=text;return x;};
 let scope='',generation=0,key='',ownRequest='',busy=false;
 const api=(suffix='',body)=>saasRequest('/saas/r65/manual-sync'+suffix,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});
 const identity=()=>typeof saasMode!=='undefined'&&saasMode==='auth'&&typeof saasMe!=='undefined'&&['owner','admin'].includes(saasMe?.role)?String(saasMe.clinic?.id||'')+':'+String(saasMe.user?.id||''):'';
 const remove=()=>document.getElementById('r65-manual-controls')?.remove();
 async function refresh(force=false){
  const current=identity();if(!force&&scope===current)return;if(scope!==current){key='';ownRequest='';}scope=current;const rev=++generation;remove();if(!current)return;
  if(!key)key=crypto.randomUUID();
  let d;try{d=await api();}catch{return;}if(rev!==generation||identity()!==current||!d.enabled||!d.agentVerified)return;
  const panel=el('section');panel.id='r65-manual-controls';panel.setAttribute('aria-label','eFriends 동기화');panel.style.cssText='padding:12px;border:1px solid #cbd5e1;border-radius:12px;margin:12px';
  const message=el('p','서버 Agent의 다음 실행 시 처리됩니다. 즉시 실행은 보장하지 않습니다.'),status=el('p'),request=el('button','eFriends 동기화 요청'),check=el('button','상태 새로고침');request.type=check.type='button';panel.append(message,request,check,status);
  if(ownRequest&&d.requests.some(r=>r.id===ownRequest&&(r.closed||['completed','success_no_changes'].includes(r.state)))){key=crypto.randomUUID();ownRequest='';}
  const pending=d.requests.find(r=>!r.closed&&['queued','claimed','running','failed','stale'].includes(r.state));
  if(pending)status.textContent=labels[pending.state]+' · '+pending.requestedAt;
  for(const r of d.requests){const line=el('p',(labels[r.state]||'상태 미확정')+' · '+r.requestedAt+(r.closed?' · 종료 확인됨':''));panel.append(line);
   if(r.canClose){const close=el('button','이전 요청 종료 확인');close.type='button';line.append(close);close.onclick=async()=>{if(busy||!confirm('Agent 잠금 해제 확인이 기록된 이전 요청입니다. 실패·시간 초과 상태를 확인하고 종료하시겠습니까?'))return;busy=true;close.disabled=true;try{await api('/close',{requestId:r.id,acknowledged:true});key=crypto.randomUUID();await refresh(true);}catch{status.textContent='종료 상태를 확인하지 못했습니다. 자동 재시도하지 않습니다.';}finally{busy=false;close.disabled=false;}};}
  }
  request.onclick=async()=>{if(busy)return;busy=true;request.disabled=true;try{const out=await api('',{idempotencyKey:key,mode:'delta'});if(identity()!==current)return;ownRequest=out.request.id;status.textContent=(out.reused?'기존 요청: ':'요청됨 · ')+(labels[out.request.state]||'상태 확인 필요');await refresh(true);}catch{status.textContent='요청 결과 미확정. 상태를 새로고침해 확인하십시오. 자동 재전송하지 않습니다.';}finally{busy=false;request.disabled=false;}};
  check.onclick=()=>refresh(true);
  (document.querySelector('main')||document.body).append(panel);
 }
 window.R65ManualSync={refresh};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh());else refresh();
})();
