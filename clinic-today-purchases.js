/* Read-only supply overview; reuses existing purchase permissions and data. */
(function(g){
 'use strict';
 let generation=0,key='',data=null,checked=0,pending=null;
 const identity=()=>[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':');
 const allowed=()=>saasMode==='auth'&&!!saasMe&&saasPermission('purchases.read',true);
 const active=()=>document.getElementById('dashboard')?.classList.contains('active-view');
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function root(){let e=document.getElementById('purchasesTodayRoot');if(!e){const layout=document.querySelector('#dashboard .pt-today-layout');if(!layout)return null;e=node('section',undefined,'cs-today-purchases');e.id='purchasesTodayRoot';e.setAttribute('aria-label','물품 주문 현황');e.hidden=true;layout.after(e);}return e;}
 function clear(){++generation;key='';data=null;checked=0;pending=null;const e=root();if(e){e.replaceChildren();e.hidden=true;}}
 function draw(message='',busy=false){
  const e=root();if(!e)return;if(!allowed()||key!==identity()){clear();return;}e.hidden=false;e.replaceChildren();e.setAttribute('aria-busy',String(busy));
  const head=node('div',undefined,'cs-supply-head'),title=node('h3','물품 주문'),actions=node('div'),refresh=node('button','새로고침','btn btn-secondary'),open=node('button','물품 관리 열기','btn btn-secondary');refresh.type=open.type='button';refresh.disabled=busy;refresh.onclick=()=>void load(true);const owner=key;open.onclick=()=>{if(owner===identity()&&allowed())go('practice',{practiceTab:'purchases'});};actions.append(refresh,open);head.append(title,actions);e.append(head);
  const status=node('p',message||('최근 확인 '+new Date(checked).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})),'cs-supply-status');status.setAttribute('role','status');e.append(status);if(!data)return;
  const needed=data.items.filter(x=>x.status==='needed'),urgent=needed.filter(x=>x.urgent).length,incoming=data.items.filter(x=>['ordered','partial'].includes(x.status)),claims=(data.claims||[]).filter(x=>['requested','sent'].includes(x.status));
  const grid=node('div',undefined,'cs-supply-counts');for(const [label,count,note] of [['주문 필요',needed.length,urgent?'긴급 '+urgent+'건':''],['입고 대기',incoming.length,''],['교환·반품',claims.length,'진행 중']]){const item=node('div');item.append(node('span',label),node('b',count+'건'));if(note)item.append(node('small',note,urgent&&label==='주문 필요'?'cs-supply-urgent':''));grid.append(item);}e.append(grid);

 }
 async function load(force=false){
  if(!allowed()){clear();return;}const scope=identity();if(key!==scope){clear();key=scope;}
  if(pending)return pending;if(!force&&data&&Date.now()-checked<60000){draw();return;}
  const ticket=++generation,current=()=>ticket===generation&&scope===identity()&&allowed();draw(data?'최신 정보 확인 중 · 이전 조회 내용을 표시합니다.':'물품 목록 확인 중…',true);
  const task=Promise.resolve().then(async()=>{try{const r=await saasRequest('/saas/operations/purchases');if(!current())return;if(!Array.isArray(r.items))throw Error('invalid');data=r;checked=Date.now();draw();}catch{if(current())draw(data?'갱신 실패 · 마지막 조회 내용입니다. 새로고침해주세요.':'물품 목록을 불러오지 못했습니다. 새로고침해주세요.');}finally{if(pending===task)pending=null;}});pending=task;return task;
 }
 document.addEventListener('carestep:purchases-updated',event=>{if(!allowed()){clear();return;}if(event.detail?.identity!==identity()||!Array.isArray(event.detail?.data?.items))return;++generation;pending=null;key=identity();data=event.detail.data;checked=Date.now();if(active())draw();});
 document.getElementById('refreshWorkFirst')?.addEventListener('click',()=>void load(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active())void load();});
 g.CarestepTodayPurchases={refresh:load,clear};
})(window);
