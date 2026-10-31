/* Uses the existing HQ session; never distributes HQ credentials to a clinic. */
window.CarestepTraining=StaffTraining.mount(document.getElementById('staffTrainingRoot'),{
 common:true,request:(path,options)=>req('/hq/training'+path,options),
 isReady:()=>!!hqSessionToken(),
 identity:()=>[endpoint(),hqSessionToken()||'hq-signed-out'].join('|')
});
if(document.getElementById('training').classList.contains('active'))window.CarestepTraining.open();

/* Protocols have their own view; opening a tab only reads saved documents. */
(() => {
 const root=document.getElementById('protocols');
 if(!root)return;
 const list=root.querySelector('[data-protocol-list]'),message=root.querySelector('[data-protocol-status]');
 const search=root.querySelector('[data-protocol-search]'),filter=root.querySelector('[data-protocol-filter]');
 const labels={draft:'검토 대기',published:'공개 중',archived:'공개 중단'};
 const species={dog:'강아지',cat:'고양이',both:'강아지·고양이'};
 let items=[],sequence=0,listOwner='',loadedAt=0,pending=null;
 const ownerKey=()=>[endpoint(),hqSessionToken()].join('|');
 const adapter={request:(p,o)=>req('/hq/training'+p,o),guard:()=>!!hqSessionToken()};
 function draw(){
  const q=search.value.trim().toLowerCase();
  const rows=items.filter(x=>(filter.value==='all'||x.status===filter.value)&&(!q||[x.title,species[x.species]].join(' ').toLowerCase().includes(q)));
  list.replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.className='empty';p.textContent=items.length?'검색 조건에 맞는 진료 프로토콜이 없습니다.':'저장된 진료 프로토콜이 없습니다. 생성·진행 현황에서 준비할 자료를 확인하세요.';list.append(p);return;}
  for(const item of rows){
   const card=document.createElement('article');card.className='card hq-protocol-card';
   const heading=document.createElement('h2');heading.textContent=item.title||'제목 없음';
   const meta=document.createElement('p');meta.className='muted';meta.textContent=[labels[item.status]||'상태 확인 필요',species[item.species]||'대상 동물 확인',item.sourceCurrent?'':'원본 변경 확인'].filter(Boolean).join(' · ');
   const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='본문·검토 열기';open.onclick=()=>{if(!adapter.guard())return;ClinicalKnowledge.openProtocol(adapter,encodeURIComponent(item.id),true,()=>{ClinicalKnowledge.close();load();});};
   card.append(heading,meta,open);list.append(card);
  }
 }
 async function load({reuse=false}={}){
  const owner=ownerKey();
  if(owner!==listOwner){sequence++;items=[];list.replaceChildren();loadedAt=0;pending=null;listOwner=owner;}
  if(!hqSessionToken()){root.setAttribute('aria-busy','false');message.textContent='HQ 연결 후 자료를 확인할 수 있습니다.';return;}
  if(reuse&&loadedAt&&Date.now()-loadedAt<30000)return;
  if(reuse&&pending?.token===sequence)return pending.promise;
  const token=++sequence;root.setAttribute('aria-busy','true');
  message.textContent=loadedAt?'목록을 업데이트하는 중입니다. 기존 자료를 계속 볼 수 있습니다.':'진료 프로토콜을 불러오는 중입니다.';
  try{
   const request=adapter.request('/knowledge-protocols');pending={token,promise:request.catch(()=>{})};const data=await request;
   if(token!==sequence||owner!==ownerKey())return;
   items=data.items||[];loadedAt=Date.now();const c=data.queue?.counts||{};
   message.textContent=`저장 자료 ${items.length}개 · 생성 대기 ${c.queued||0}개 · 생성 중 ${c.running||0}개 · 미완료 ${c.failed||0}개`;
   draw();
  }catch(error){if(token===sequence&&owner===ownerKey()){loadedAt=0;message.textContent='목록을 불러오지 못했습니다. '+error.message+(items.length?' · 이전 목록입니다.':'');const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='다시 시도';retry.onclick=()=>load();if(items.length){draw();list.prepend(retry);}else list.replaceChildren(retry);}}
  finally{if(pending?.token===token)pending=null;if(token===sequence)root.setAttribute('aria-busy','false');}
 }
 search.oninput=draw;filter.onchange=draw;
 root.querySelector('[data-protocol-refresh]').onclick=load;
 root.querySelector('[data-protocol-queue]').onclick=()=>{if(adapter.guard())ClinicalKnowledge.openQueue(adapter,'protocol');};
 new MutationObserver(()=>{if(!document.getElementById('loginOverlay').classList.contains('hidden')){sequence++;loadedAt=0;pending=null;listOwner='';items=[];list.replaceChildren();message.textContent='HQ 연결 후 자료를 확인할 수 있습니다.';root.setAttribute('aria-busy','false');}}).observe(document.getElementById('loginOverlay'),{attributes:true,attributeFilter:['class']});
 window.CarestepHqProtocols={open:(options={})=>load(options)};
 if(root.classList.contains('active'))load();
})();
