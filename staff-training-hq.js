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
 const extra=document.createElement('div');extra.className='hq-protocol-filters';
 extra.innerHTML='<label>대상 동물<select class="input" data-protocol-species><option value="all">전체 동물</option><option value="dog">강아지</option><option value="cat">고양이</option><option value="both">강아지·고양이 공통</option></select></label><label>진료 분야<select class="input" data-protocol-field><option value="all">전체 분야</option></select></label><label>정렬<select class="input" data-protocol-sort><option value="recent">최근 검토순</option><option value="title">제목순</option><option value="review">검토 대기 우선</option></select></label><span data-protocol-count role="status"></span>';
 list.before(extra);
 const animal=extra.querySelector('[data-protocol-species]'),field=extra.querySelector('[data-protocol-field]'),sort=extra.querySelector('[data-protocol-sort]');
 let sourceFields=new Map();
 const fieldOf=x=>x.category||x.field||x.body?.category||sourceFields.get(x.sourceContentId)||'';
 const updated=x=>x.updatedAt||x.updated_at||'';
 const displayDate=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ko-KR'):'';
 let items=[],sequence=0,listOwner='',loadedAt=0,pending=null;
 const ownerKey=()=>[endpoint(),hqSessionToken()].join('|');
 const adapter={request:(p,o)=>req('/hq/training'+p,o),guard:()=>!!hqSessionToken()};
 function updateFields(){const selectedField=field.value;field.replaceChildren(new Option('전체 분야','all'));for(const name of [...new Set(items.map(fieldOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')))field.add(new Option(name,name));field.value=[...field.options].some(x=>x.value===selectedField)?selectedField:'all';}
 function draw(){
  const q=search.value.trim().toLowerCase();
  const rows=items.filter(x=>(filter.value==='all'||x.status===filter.value)&&(animal.value==='all'||x.species===animal.value)&&(field.value==='all'||fieldOf(x)===field.value)&&(!q||[x.title,species[x.species],fieldOf(x)].join(' ').toLowerCase().includes(q)));
  rows.sort((a,b)=>(sort.value==='review'?(a.status==='draft'?0:1)-(b.status==='draft'?0:1):0)||(sort.value==='title'?String(a.title||'').localeCompare(String(b.title||''),'ko'):String(b.reviewedAt||updated(b)).localeCompare(String(a.reviewedAt||updated(a))))||String(a.title||'').localeCompare(String(b.title||''),'ko'));
  extra.querySelector('[data-protocol-count]').textContent=`${rows.length}개 표시 · 전체 ${items.length}개`;
  list.replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.className='empty';p.textContent=items.length?'검색 조건에 맞는 진료 프로토콜이 없습니다.':'저장된 진료 프로토콜이 없습니다. 생성·진행 현황에서 준비할 자료를 확인하세요.';list.append(p);return;}
  for(const item of rows){
   const card=document.createElement('article');card.className='card hq-protocol-card';
   const heading=document.createElement('h2');heading.textContent=item.title||'제목 없음';
   const meta=document.createElement('p');meta.className='muted';meta.textContent=[labels[item.status]||'상태 확인 필요',species[item.species]||'대상 동물 확인',fieldOf(item),item.revision?'수정 '+item.revision+'판':'',item.sourceCurrent===false?'원본 변경 확인':''].filter(Boolean).join(' · ');
   const dates=document.createElement('p');dates.className='hq-protocol-dates';dates.textContent=[displayDate(updated(item))&&'수정 '+displayDate(updated(item)),displayDate(item.reviewedAt||item.approvedAt)&&'검토 '+displayDate(item.reviewedAt||item.approvedAt)].filter(Boolean).join(' · ');
   const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='본문·검토 열기';open.onclick=()=>{if(!adapter.guard())return;ClinicalKnowledge.openProtocol(adapter,encodeURIComponent(item.id),true,()=>{ClinicalKnowledge.close();load();});};
   card.append(heading,meta);if(dates.textContent)card.append(dates);card.append(open);list.append(card);
  }
 }
 async function load({reuse=false}={}){
  const owner=ownerKey();
  if(owner!==listOwner){sequence++;items=[];sourceFields=new Map();list.replaceChildren();loadedAt=0;pending=null;listOwner=owner;}
  if(!hqSessionToken()){root.setAttribute('aria-busy','false');message.textContent='HQ 연결 후 자료를 확인할 수 있습니다.';return;}
  if(reuse&&loadedAt&&Date.now()-loadedAt<30000)return;
  if(reuse&&pending?.token===sequence)return pending.promise;
  const token=++sequence;root.setAttribute('aria-busy','true');
  message.textContent=loadedAt?'목록을 업데이트하는 중입니다. 기존 자료를 계속 볼 수 있습니다.':'진료 프로토콜을 불러오는 중입니다.';
  try{
   const request=adapter.request('/knowledge-protocols');pending={token,promise:request.catch(()=>{})};const catalogWork=req('/hq/content').then(d=>d.contents||[],()=>null);const data=await request;
   if(token!==sequence||owner!==ownerKey())return;
   items=data.items||[];loadedAt=Date.now();const c=data.queue?.counts||{};
   updateFields();
   message.textContent=`저장 자료 ${items.length}개 · 생성 대기 ${c.queued||0}개 · 생성 중 ${c.running||0}개 · 미완료 ${c.failed||0}개`;
   draw();
   void catalogWork.then(catalog=>{if(!catalog||token!==sequence||owner!==ownerKey())return;sourceFields=new Map(catalog.map(x=>[x.contentId,x.category]));updateFields();draw();});
  }catch(error){if(token===sequence&&owner===ownerKey()){loadedAt=0;message.textContent='목록을 불러오지 못했습니다. '+error.message+(items.length?' · 이전 목록입니다.':'');const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='다시 시도';retry.onclick=()=>load();if(items.length){draw();list.prepend(retry);}else list.replaceChildren(retry);}}
  finally{if(pending?.token===token)pending=null;if(token===sequence)root.setAttribute('aria-busy','false');}
 }
 search.oninput=draw;filter.onchange=draw;
 animal.onchange=draw;field.onchange=draw;sort.onchange=draw;
 root.querySelector('[data-protocol-refresh]').onclick=load;
 root.querySelector('[data-protocol-queue]').onclick=()=>{if(adapter.guard())ClinicalKnowledge.openQueue(adapter,'protocol');};
 new MutationObserver(()=>{if(!document.getElementById('loginOverlay').classList.contains('hidden')){sequence++;loadedAt=0;pending=null;listOwner='';items=[];list.replaceChildren();message.textContent='HQ 연결 후 자료를 확인할 수 있습니다.';root.setAttribute('aria-busy','false');}}).observe(document.getElementById('loginOverlay'),{attributes:true,attributeFilter:['class']});
 window.CarestepHqProtocols={open:(options={})=>load(options)};
 if(root.classList.contains('active'))load();
})();
