/* Read-only, anonymous signup outcome overview. */
(()=>{
 'use strict';
 const root=document.getElementById('hqSignupMonitor');if(!root)return;
 const period=root.querySelector('select'),status=root.querySelector('[role=status]'),body=root.querySelector('[data-signup-body]');
 let sequence=0;
 const scope=()=>JSON.stringify([endpoint(),hqSessionToken(),key()]);
 const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
 async function load(){
  const ticket=++sequence,owner=scope(),days=period.value;
  body.replaceChildren();status.textContent='가입 접수·실패 현황 확인 중…';
  try{
   const d=await req('/hq/signup-monitor?days='+encodeURIComponent(days));
   if(ticket!==sequence||scope()!==owner||!document.getElementById('loginOverlay')?.classList.contains('hidden'))return;
   if(!d?.ok||![d.accepted,d.failed,d.cancelled].every(Number.isFinite))throw Error('가입 현황을 확인하지 못했습니다.');
   status.textContent='최근 '+days+'일 · '+new Date(d.asOf).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})+' 기준';
   const stats=text('div','');stats.className='storage-kpis';
   for(const [label,n] of [['접수 완료',d.accepted],['실패',d.failed],['취소',d.cancelled]]){const card=text('div','');card.append(text('span',label),text('strong',n+'건'));stats.append(card);}body.append(stats);
   if(d.reasons?.length){const list=text('ul','');list.className='hq-signup-reasons';for(const r of d.reasons)list.append(text('li',r.label+' · '+r.count+'건'));body.append(list);}
   if(d.recent?.length){
    const details=document.createElement('details');details.append(text('summary','최근 실패·취소 내역 '+d.recent.length+'건'));
    const list=text('ul','');list.className='hq-signup-recent';
    for(const row of d.recent){const item=text('li','');item.append(text('span',new Date(row.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})),text('b',row.label),text('small',row.source==='server'?'서버 확인':'브라우저 보고 · 접수 여부 확인 필요'));list.append(item);}
    details.append(list);body.append(details);
   }else body.append(text('p','기록된 실패·취소가 없습니다.'));
  }catch{
   if(ticket!==sequence||scope()!==owner)return;
   status.textContent='가입 현황을 불러오지 못했습니다. 승인 대기 목록은 별도로 확인할 수 있습니다.';
   const retry=text('button','현황 다시 조회');retry.type='button';retry.className='btn';retry.onclick=load;body.replaceChildren(retry);
  }
 }
 const previous=loadApproval;
 loadApproval=async function(...args){const result=await Promise.allSettled([previous(...args),load()]);if(result[0].status==='rejected')throw result[0].reason;};
 document.getElementById('approvalRefresh').onclick=()=>loadApproval();
 period.onchange=load;
 new MutationObserver(()=>{if(!document.getElementById('loginOverlay').classList.contains('hidden')){sequence++;body.replaceChildren();status.textContent='HQ 로그인 후 조회할 수 있습니다.';}}).observe(document.getElementById('loginOverlay'),{attributes:true,attributeFilter:['class']});
 window.CarestepHqSignup={load};
 if(document.getElementById('approval')?.classList.contains('active')&&document.getElementById('loginOverlay')?.classList.contains('hidden'))void load();
})();

