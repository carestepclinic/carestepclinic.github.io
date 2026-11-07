/* Uses the existing HQ session; never distributes HQ credentials to a clinic. */
window.CarestepTraining=StaffTraining.mount(document.getElementById('staffTrainingRoot'),{
 common:true,request:(path,options)=>req('/hq/training'+path,options),
 isReady:()=>!!hqSessionToken(),
 identity:()=>[endpoint(),hqSessionToken()||'hq-signed-out'].join('|')
});
if(document.getElementById('training').classList.contains('active'))window.CarestepTraining.open();

/* Protocol filters contain UI preferences only. Opening lists never starts generation. */
(() => {
 const root=document.getElementById('protocols');if(!root)return;
 const list=root.querySelector('[data-protocol-list]'),message=root.querySelector('[data-protocol-status]');
 const search=root.querySelector('[data-protocol-search]'),filter=root.querySelector('[data-protocol-filter]');
 const labels={draft:'검토 대기',published:'공개 중',archived:'공개 중단'};
 const species={dog:'강아지',cat:'고양이',both:'강아지·고양이 공통'};
 const stateKey='carestep_hq_protocol_filters_v1';
 const extra=document.createElement('div');extra.className='hq-protocol-filters';
 extra.innerHTML='<label>대상 동물<select class="input" data-protocol-species><option value="all">전체 동물</option><option value="dog">강아지 · 공통 포함</option><option value="cat">고양이 · 공통 포함</option><option value="both">강아지·고양이 공통</option></select></label><label>진료 분야<select class="input" data-protocol-field><option value="all">전체 분야</option></select></label><label>정렬<select class="input" data-protocol-sort><option value="recent">최근 검토순</option><option value="title">제목순</option><option value="review">검토 대기 우선</option></select></label><button type="button" class="btn" data-protocol-reset>조건 초기화</button><span data-protocol-count role="status"></span><p data-protocol-conditions></p>';
 const quick=document.createElement('div');quick.className='hq-protocol-quick';quick.setAttribute('aria-label','처리할 프로토콜 모아보기');
 list.before(quick,extra);
 const animal=extra.querySelector('[data-protocol-species]'),field=extra.querySelector('[data-protocol-field]'),sort=extra.querySelector('[data-protocol-sort]');
 let sourceFields=new Map(),items=[],jobs=[],queueCounts={},triage='all',sequence=0,listOwner='',loadedAt=0,pending=null;
 const fieldOf=x=>x.category||x.field||x.body?.category||sourceFields.get(x.sourceContentId)||'';
 const updated=x=>x.updatedAt||x.updated_at||'';
 const displayDate=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ko-KR'):'';
 const ownerKey=()=>[endpoint(),hqSessionToken()].join('|');
 function ready(){return !!hqSessionToken()&&document.getElementById('loginOverlay').classList.contains('hidden');}
 function sessionAdapter(){const owner=ownerKey(),epoch=sequence;const guard=()=>ready()&&owner===ownerKey()&&epoch===sequence;return {guard,request:(p,o)=>{if(!guard())return Promise.reject(Error('연결이 변경됐습니다. 다시 열어주세요.'));return req('/hq/training'+p,o);}};}
 function saveFilters(){try{sessionStorage.setItem(stateKey,JSON.stringify({search:search.value,status:filter.value,species:animal.value,field:field.value,sort:sort.value,triage}));}catch{}}
 function restoreFilters(){
  let saved;try{saved=JSON.parse(sessionStorage.getItem(stateKey)||'{}');}catch{return;}
  if(!saved||typeof saved!=='object')return;
  if(typeof saved.search==='string')search.value=saved.search.slice(0,200);
  for(const [el,value] of [[filter,saved.status],[animal,saved.species],[sort,saved.sort]])if([...el.options].some(x=>x.value===value))el.value=value;
  if(typeof saved.field==='string'&&saved.field&&saved.field!=='all'){field.add(new Option(saved.field,saved.field));field.value=saved.field;}
  if(['all','review','changed','failed'].includes(saved.triage))triage=saved.triage;
 }
 function resetFilters(){search.value='';filter.value='all';animal.value='all';field.value='all';sort.value='recent';triage='all';}
 function updateFields(){const selectedField=field.value;const fields=[...new Set([...items,...jobs].map(fieldOf).filter(Boolean))];if(selectedField&&selectedField!=='all'&&!fields.includes(selectedField))fields.push(selectedField);field.replaceChildren(new Option('전체 분야','all'));for(const name of fields.sort((a,b)=>a.localeCompare(b,'ko')))field.add(new Option(name,name));field.value=selectedField||'all';}
 function quickDraw(){
  const counts={all:items.length,review:items.filter(x=>x.status==='draft').length,changed:items.filter(x=>x.sourceCurrent===false).length,failed:queueCounts.failed??jobs.filter(x=>x.status==='failed').length};
  quick.replaceChildren();for(const [value,label] of [['all','저장 자료'],['review','검토 대기'],['changed','원본 변경'],['failed','생성 실패']]){const b=document.createElement('button');b.type='button';b.className='btn'+(triage===value?' primary':'');b.dataset.protocolQuick=value;b.setAttribute('aria-pressed',String(triage===value));b.textContent=label+' '+counts[value]+'개';b.onclick=()=>{resetFilters();triage=value;saveFilters();draw();};quick.append(b);}
 }
 function draw(){
  quickDraw();const failed=triage==='failed',q=search.value.trim().toLowerCase();filter.disabled=failed;
  const source=failed?jobs.filter(x=>x.status==='failed'):items;
  const rows=source.filter(x=>(failed||filter.value==='all'||x.status===filter.value)&&(triage!=='review'||x.status==='draft')&&(triage!=='changed'||x.sourceCurrent===false)&&(animal.value==='all'||x.species===animal.value||(['dog','cat'].includes(animal.value)&&x.species==='both'))&&(field.value==='all'||fieldOf(x)===field.value)&&(!q||[x.title,species[x.species],fieldOf(x),failed?x.error:''].join(' ').toLowerCase().includes(q)));
  rows.sort((a,b)=>(sort.value==='review'?(a.status==='draft'?0:1)-(b.status==='draft'?0:1):0)||(sort.value==='title'?String(a.title||'').localeCompare(String(b.title||''),'ko'):String(b.reviewedAt||updated(b)).localeCompare(String(a.reviewedAt||updated(a))))||String(a.title||'').localeCompare(String(b.title||''),'ko'));
  extra.querySelector('[data-protocol-count]').textContent=`${rows.length}개 표시 · 불러온 ${failed?'실패 작업':'저장 자료'} ${source.length}개`;
  const conditions=[triage!=='all'&&({review:'검토 대기',changed:'원본 변경',failed:'생성 실패'})[triage],q&&'검색: '+search.value,!failed&&filter.value!=='all'&&labels[filter.value],animal.value!=='all'&&animal.selectedOptions[0].textContent,field.value!=='all'&&field.value,sort.value!=='recent'&&sort.selectedOptions[0].textContent].filter(Boolean);
  extra.querySelector('[data-protocol-conditions]').textContent=conditions.length?'적용 조건 · '+conditions.join(' · '):'전체 자료';
  list.replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.className='empty';p.textContent=failed?(queueCounts.failed>source.length?'실패 작업 상세를 아직 확인하지 못했습니다. 생성·진행 현황에서 확인해주세요.':'검색 조건에 맞는 생성 실패 작업이 없습니다.'):items.length?'검색 조건에 맞는 진료 프로토콜이 없습니다.':'저장된 진료 프로토콜이 없습니다. 생성·진행 현황에서 준비할 자료를 확인하세요.';list.append(p);return;}
  for(const item of rows){
   const card=document.createElement('article');card.className='card hq-protocol-card';
   const heading=document.createElement('h2');heading.textContent=item.title||'제목 없음';
   const meta=document.createElement('p');meta.className='muted';meta.textContent=[failed?'생성 실패':labels[item.status]||'상태 확인 필요',species[item.species]||'',fieldOf(item),item.revision?'수정 '+item.revision+'판':'',item.sourceCurrent===false?'원본 변경 확인':''].filter(Boolean).join(' · ');
   const dates=document.createElement('p');dates.className='hq-protocol-dates';dates.textContent=[displayDate(updated(item))&&'수정 '+displayDate(updated(item)),displayDate(item.reviewedAt||item.approvedAt)&&'검토 '+displayDate(item.reviewedAt||item.approvedAt)].filter(Boolean).join(' · ');
   const next=document.createElement('p');next.className='hq-protocol-next';next.textContent=failed?'실패 원인: '+(item.error||'생성 현황에서 원인을 확인해주세요.'):item.sourceCurrent===false?'변경된 원본과 본문·근거를 대조하고 보완해주세요.':item.status==='draft'?'본문·근거와 미해결 항목을 검토한 뒤 공개 여부를 결정하세요.':'';
   const open=document.createElement('button');open.type='button';open.className='btn';open.textContent=failed?'실패 원인·재시도 열기':'본문·검토 열기';open.onclick=()=>{if(!ready())return;const adapter=sessionAdapter();if(failed)ClinicalKnowledge.openQueue(adapter,'protocol',{status:'failed',jobId:item.id});else ClinicalKnowledge.openProtocol(adapter,encodeURIComponent(item.id),true,()=>{ClinicalKnowledge.close();load();});};
   card.append(heading,meta);if(dates.textContent)card.append(dates);if(next.textContent)card.append(next);card.append(open);list.append(card);
  }
 }
 async function load({reuse=false}={}){
  const owner=ownerKey();
  if(owner!==listOwner){sequence++;items=[];jobs=[];queueCounts={};sourceFields=new Map();list.replaceChildren();quick.replaceChildren();loadedAt=0;pending=null;listOwner=owner;}
  if(!ready()){root.setAttribute('aria-busy','false');message.textContent='HQ 연결 후 자료를 확인할 수 있습니다.';return;}
  if(reuse&&loadedAt&&Date.now()-loadedAt<30000)return;
  if(reuse&&pending?.token===sequence)return pending.promise;
  const token=++sequence;root.setAttribute('aria-busy','true');
  message.textContent=loadedAt?'목록을 업데이트하는 중입니다. 기존 자료를 계속 볼 수 있습니다.':'진료 프로토콜을 불러오는 중입니다.';
  try{
   const request=req('/hq/training/knowledge-protocols');pending={token,promise:request.catch(()=>{})};const catalogWork=req('/hq/content').then(d=>d.contents||[],()=>null);const data=await request;
   if(token!==sequence||owner!==ownerKey()||!ready())return;
   items=data.items||[];jobs=data.queue?.items||[];queueCounts=data.queue?.counts||{};loadedAt=Date.now();updateFields();
   message.textContent=`저장 자료 ${items.length}개 · 생성 대기 ${queueCounts.queued||0}개 · 생성 중 ${queueCounts.running||0}개 · 생성 실패 ${queueCounts.failed||0}개`;
   draw();
   void catalogWork.then(catalog=>{if(!catalog||token!==sequence||owner!==ownerKey()||!ready())return;sourceFields=new Map(catalog.map(x=>[x.contentId,x.category]));updateFields();draw();});
  }catch(error){if(token===sequence&&owner===ownerKey()&&ready()){loadedAt=0;message.textContent='목록을 불러오지 못했습니다. '+error.message+(items.length?' · 이전 목록입니다.':'');const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='다시 시도';retry.onclick=()=>load();if(items.length||jobs.length){draw();list.prepend(retry);}else list.replaceChildren(retry);}}
  finally{if(pending?.token===token)pending=null;if(token===sequence)root.setAttribute('aria-busy','false');}
 }
 restoreFilters();
 for(const el of [search,filter,animal,field,sort])el.addEventListener(el===search?'input':'change',()=>{saveFilters();draw();});
 extra.querySelector('[data-protocol-reset]').onclick=()=>{resetFilters();saveFilters();draw();};
 root.querySelector('[data-protocol-refresh]').onclick=()=>load();
 root.querySelector('[data-protocol-queue]').onclick=()=>{if(ready())ClinicalKnowledge.openQueue(sessionAdapter(),'protocol');};
 new MutationObserver(()=>{if(!document.getElementById('loginOverlay').classList.contains('hidden')){sequence++;loadedAt=0;pending=null;listOwner='';items=[];jobs=[];queueCounts={};sourceFields=new Map();list.replaceChildren();quick.replaceChildren();extra.querySelector('[data-protocol-count]').textContent='';globalThis.ClinicalKnowledge?.close(true);message.textContent='HQ 연결 후 자료를 확인할 수 있습니다.';root.setAttribute('aria-busy','false');}}).observe(document.getElementById('loginOverlay'),{attributes:true,attributeFilter:['class']});
 window.CarestepHqProtocols={open:(options={})=>load(options)};
 if(root.classList.contains('active'))load();
})();
