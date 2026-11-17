(function(g){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number.isFinite(n)?n.toLocaleString('ko-KR')+'원':'확인 필요';
const count=(n,u)=>n==null?'확인 필요':Number(n)===0?'무제한':Number(n).toLocaleString('ko-KR')+u;
const mode=(p,k)=>p?.[k+'Mode']==='unlimited'?'무제한':p?.[k+'Mode']==='limited'?(k==='ai'?'월 '+p.aiCasesMonthly+'건':p.storageGb+'GB'):p?.[k+'Mode']==='disabled'?'미제공':'계약 조건 확인';
function effectiveDate(s){const raw=s.status==='trialing'?(s.trialEndsAt||s.currentPeriodEnd):(s.currentPeriodEnd||s.nextPaymentAt);return raw&&Number.isFinite(Date.parse(raw))?new Date(raw).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'적용일 확인 필요';}
function render(c){
 const {overview:d,selected:x,plan,resources:r}=c,sub=d?.subscription,box=document.getElementById('billingChangeComparison'),reserved=document.getElementById('billingReservations');if(!box||!reserved)return;
 if(!sub){box.replaceChildren();reserved.replaceChildren();return;}
 const p=d.plans?.[x.code]||{},same=x.code===sub.planCode,current=plan?.limits||{},unchanged=same&&x.cycle===sub.billingCycle;
 const currentAi=r?(r.legacy?'기존 계약 유지':r.ai.limit===null?'무제한':'월 '+r.ai.limit+'건'):mode(current,'ai');
 const currentStorage=r?(r.storage.legacyUnmetered?'기존 계약 유지':r.storage.limitGb===null?'무제한':r.storage.limitGb+'GB'):mode(current,'storage');
 const memberValue=r?.allowances?.members?r.allowances.members.limit:current.members==null?undefined:Number(current.members)===0?null:Number(current.members)+(Number(r?.extraMembers)||0);
 const currentMembers=memberValue===null?'무제한':count(memberValue,'명');
 const memberNote=r?.allowances?.members?.extra>0?`기본 ${r.allowances.members.base}명 + 추가 ${r.allowances.members.extra}명 = ${r.allowances.members.limit}명`:currentMembers;
 const rows=[['요금제',sub.planCode,x.code],['결제 주기',sub.billingCycle==='annual'?'연 결제':'월 결제',x.cycle==='annual'?'연 결제':'월 결제'],['결제액 · 부가세 포함',money(sub.effectivePriceKrw),money(x.price)],['건강검진 AI',currentAi,same?currentAi:mode(p,'ai')],['사진 저장 공간',currentStorage,same?currentStorage:mode(p,'storage')],['직원 계정',memberNote,same?memberNote:count(p.members,'명')],['월 HOME 게시',count(current.packagesMonthly,'건'),same?count(current.packagesMonthly,'건'):count(p.packagesMonthly,'건')]];
 const warning=!same&&r&&p.storageMode==='limited'&&r.storage.bytes>p.storageGb*1e9?'현재 사진 사용량이 선택한 요금제의 기본 저장 용량보다 많습니다. 기존 사진은 삭제되지 않지만 새 사진 저장이 제한될 수 있으니 병원별 추가 제공량을 확인해주세요.':'';
 box.innerHTML='<div class="billing-change-table" role="table" aria-label="요금제 변경 전후 비교"><div role="row"><b role="columnheader">항목</b><b role="columnheader">현재</b><b role="columnheader">선택한 조건</b></div>'+rows.map(row=>'<div role="row">'+row.map(v=>'<span role="cell">'+esc(v)+'</span>').join('')+'</div>').join('')+'</div><p class="resource-note">'+(unchanged?'현재와 동일한 조건입니다. 변경 예약이 필요하지 않습니다.':'적용 예정일: '+esc(effectiveDate(sub))+' · 적용 전까지 현재 계약 유지')+'</p>'+(!same?'<p class="resource-note">선택한 조건은 공통 기본 제공량입니다. 병원별 추가 제공량은 별도 적용됩니다.</p>':'')+(warning?'<p class="resource-notice">'+warning+'</p>':'');
 const disabled=!d.canManage||d.stale||c.loading;
 const button=document.getElementById('billingSchedulePlan');if(button)button.disabled=!!disabled||unchanged;
 reserved.innerHTML=(sub.pendingPlanCode?'<div class="billing-reservation"><strong>요금제 변경 예약 · '+esc(sub.pendingPlanCode)+' / '+(sub.pendingBillingCycle==='annual'?'연 결제':'월 결제')+'</strong><p>'+(sub.cancelAtPeriodEnd?'해지 예약이 우선 적용됩니다. 해지를 철회하면 아래 요금제 예약이 남아 있습니다.':'적용 예정일: '+esc(effectiveDate(sub)))+'</p><button type="button" class="btn" data-b-change '+(disabled?'disabled':'')+'>예약 변경</button> <button type="button" class="btn" data-b-cancel '+(disabled||!['active','trialing'].includes(sub.status)?'disabled':'')+'>요금제 변경 예약 취소</button></div>':'')+(sub.cancelAtPeriodEnd?'<div class="billing-reservation"><strong>구독 해지 예약</strong><p>이용 종료 예정일: '+esc(sub.currentPeriodEnd?new Date(sub.currentPeriodEnd).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):effectiveDate(sub))+'</p><button type="button" class="btn" data-b-undo '+(disabled?'disabled':'')+'>해지 예약 취소</button></div>':'');
 reserved.querySelector('[data-b-change]')?.addEventListener('click',()=>{document.getElementById('billingChangePlan').open=true;document.getElementById('billingPlanSelect').focus();});
 reserved.querySelector('[data-b-undo]')?.addEventListener('click',()=>c.undoCancel());
 reserved.querySelector('[data-b-cancel]')?.addEventListener('click',async e=>{if(!g.confirm('요금제 변경 예약만 취소할까요? 현재 요금·제공량과 구독 해지 예약 여부는 그대로 유지됩니다.'))return;const button=e.currentTarget;button.disabled=true;try{await c.cancelPlan({action:'cancel-change',expectedPlanCode:sub.pendingPlanCode,expectedBillingCycle:sub.pendingBillingCycle});}catch(err){c.notify(err.message||'예약을 취소하지 못했습니다.');}finally{if(button.isConnected)button.disabled=false;}});
}
g.CarestepBillingFlow={render,effectiveDate};
})(globalThis);
