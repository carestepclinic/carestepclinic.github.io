/* Read-only, identity-scoped summary of saved unfinished documents. */
(function(g){
 'use strict';
 const kinds=['healthcheck','consents'],labels={healthcheck:'검진 보고서',consents:'진료 동의서'};
 function day(value=Date.now()){const t=typeof value==='number'?value:Date.parse(value);return Number.isFinite(t)?new Date(t+32400000).toISOString().slice(0,10):'';}
 function normalize(kind,r){
  if(!r||typeof r.id!=='string'||!r.id||r.deleted||r.body?.deleted)return null;
  if(kind==='healthcheck'&&!['inProgress','amended'].includes(r.clinicalStatus||'inProgress'))return null;
  if(kind==='consents'&&(r.status!=='draft'||r.signedAt))return null;
  if(!kinds.includes(kind))return null;
  const at=r.updatedAt||r.updated_at||r.createdAt||r.created_at||'',date=day(at)||(kind==='healthcheck'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')?r.date:'');
  return {kind,id:r.id,date,at,name:String(kind==='healthcheck'?r.patient?.name||'환자명 확인 필요':r.patientName||'환자명 확인 필요'),guardian:String(kind==='healthcheck'?r.patient?.guardianName||'':r.guardianName||''),title:kind==='healthcheck'?'건강검진 보고서':String(r.title||'진료 동의서'),status:kind==='healthcheck'?(r.clinicalStatus==='amended'?'검토 후 수정':'작성 중'):'서명 전',chart:kind==='healthcheck'?String(r.patient?.chartNumber||r.patient?.externalPatientId||''):''};
 }
 function groups(rows,today=day()){const sorted=[...rows].sort((a,b)=>String(b.at||b.date).localeCompare(String(a.at||a.date))||a.id.localeCompare(b.id));return {today:sorted.filter(x=>x.date===today),past:sorted.filter(x=>x.date!==today)};}
 function createLoader(a,changed=()=>{}){
  let epoch=0,scope='',pending=null;const controllers=new Set();
  const fresh=()=>({rows:[],next:'',seen:new Set(),loaded:false,busy:false,error:''});let sources={healthcheck:fresh(),consents:fresh()};
  const allowed=k=>a.ready()&&a.allowed(k),current=(n,key,k)=>n===epoch&&scope===key&&a.identity()===key&&allowed(k);
  function clear(){epoch++;for(const c of controllers)c.abort();controllers.clear();scope='';pending=null;sources={healthcheck:fresh(),consents:fresh()};changed();}
  const snapshot=()=>({sources,rows:kinds.flatMap(k=>allowed(k)?sources[k].rows:[]),visible:kinds.some(allowed)});
  async function read(path){const controller=new AbortController();controllers.add(controller);let timer;try{return await Promise.race([a.request(path,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},a.timeout||15000);})]);}finally{clearTimeout(timer);controllers.delete(controller);}}
  async function load(kind,append,pages,n,key){
   const state=sources[kind];if(!allowed(kind)||state.busy)return;if(append&&!state.next)return;state.busy=true;state.error='';changed();
   let rows=append?state.rows:[],cursor=append?state.next:'',seen=append?new Set(state.seen):new Set();
   try{for(let i=0;i<pages;i++){
    if(seen.has(cursor))throw Error('repeated cursor');
    const params=new URLSearchParams(kind==='consents'?{status:'draft'}:{});if(cursor)params.set(kind==='consents'?'before':'cursor',cursor);
    const r=await read((kind==='consents'?'/saas/practice/support/consents':'/saas/practice/clinical/healthcheck')+'?'+params);
    if(!current(n,key,kind))return;if(!Array.isArray(r?.items)||r.next!=null&&typeof r.next!=='string')throw Error('invalid list');
    const next=r.next||'';if(next&&(next===cursor||seen.has(next)))throw Error('repeated cursor');seen.add(cursor);
    // Replace a refreshed page atomically, and deduplicate stable document IDs.
    const merged=new Map(rows.map(x=>[x.id,x]));for(const item of r.items){const row=normalize(kind,item);if(row)merged.set(row.id,row);else if(item?.id)merged.delete(item.id);}
    rows=[...merged.values()];cursor=next;Object.assign(state,{rows,next:cursor,seen:new Set(seen),loaded:true});changed();if(!cursor)break;
   }}catch(e){if(current(n,key,kind))state.error='목록을 불러오지 못했습니다. 다시 확인해주세요.';}
   finally{if(current(n,key,kind)){state.busy=false;changed();}}
  }
  function refresh(){
   if(!kinds.some(allowed)){clear();return Promise.resolve();}const key=a.identity();if(scope===key&&(pending||kinds.some(k=>sources[k].busy)))return pending||Promise.resolve();
   if(scope!==key){clear();scope=key;}const n=++epoch;for(const k of kinds)if(!allowed(k))sources[k]=fresh();
   const job=Promise.all(kinds.filter(allowed).map(k=>load(k,false,3,n,key))).finally(()=>{if(pending===job)pending=null;});pending=job;return job;
  }
  function more(kind){if(!kinds.includes(kind)||scope!==a.identity()||!allowed(kind))return Promise.resolve();return load(kind,true,1,epoch,scope);}
  return {refresh,more,clear,snapshot};
 }
 function mount(root,a){
  let pastOpen=false,opening=false,notice='';
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
  const loader=createLoader(a,render);
  function render(){
   if(!root)return;const state=loader.snapshot();if(!state.visible){root.replaceChildren();root.hidden=true;pastOpen=false;notice='';return;}root.hidden=false;root.className='pt cs-today-documents';
   const old=root.querySelector('details');if(old)pastOpen=old.open;const focused=document.activeElement,focusKey=root.contains(focused)?focused.dataset.documentAction||'':'';
   root.replaceChildren();const card=node('section',null,'pt-card'),head=node('div',null,'cs-documents-head'),heading=node('div'),h=node('h3','작성 중인 문서');heading.append(h);head.append(heading);card.setAttribute('aria-label','작성 중인 검진 보고서와 서명 전 동의서');
   const active=kinds.filter(k=>a.allowed(k)),busy=active.some(k=>state.sources[k].busy),incomplete=active.some(k=>state.sources[k].next||state.sources[k].error||!state.sources[k].loaded);
   const counts=node('span',active.map(k=>labels[k]+' '+state.sources[k].rows.length+'건').join(' · '),'cs-document-count');heading.append(counts);counts.hidden=!state.rows.length;
   const reload=button(busy?'확인 중…':'새로고침',()=>{notice='';void loader.refresh();});reload.disabled=busy;reload.dataset.documentAction='refresh';head.append(reload);card.append(head);
   const status=node('p',busy?'저장된 문서 확인 중…':incomplete?'조회된 문서를 표시합니다. 남은 목록과 조회 상태를 확인해주세요.':'오늘 작성·수정한 문서 기준 · 저장된 내용부터 이어갑니다.','cs-document-help');status.setAttribute('role','status');card.append(status);
   function row(item){const line=node('div',null,'cs-document-row'),copy=node('div',null,'cs-document-copy'),type=node('span',labels[item.kind],'cs-document-kind'),title=node('b',item.name+' · '+item.title),meta=node('small',[item.date||'날짜 확인 필요',item.guardian?'보호자 '+item.guardian:'',item.chart?'차트 '+item.chart:'',item.status].filter(Boolean).join(' · '));copy.append(type,title,meta);const key=a.identity(),open=button(a.editable(item.kind)?'이어서 작성':'문서 보기',async()=>{if(opening||!a.ready()||key!==a.identity()||!a.allowed(item.kind))return;opening=true;notice='';open.disabled=true;open.textContent='여는 중…';try{const opened=await a.open(item.kind,item.id);if(opened===false&&key===a.identity())notice='현재 문서의 저장 또는 이동 안내를 확인해주세요.';}catch{if(key===a.identity())notice='문서를 열지 못했습니다. 새로고침 후 다시 시도해주세요.';}finally{opening=false;if(key===a.identity())render();}});open.dataset.documentAction=item.kind+':'+item.id;open.disabled=opening;open.setAttribute('aria-label',item.name+' '+item.title+' '+open.textContent);line.append(copy,open);return line;}
   const grouped=groups(state.rows,a.today?.()||day()),current=node('div',null,'cs-documents-current');
   if(grouped.today.length){current.append(node('h4','오늘 작성·수정 '+grouped.today.length+'건'));for(const item of grouped.today)current.append(row(item));}
   else if(!busy)current.append(node('p',incomplete?'조회된 오늘 작성·수정 문서가 없습니다.':'오늘 작성·수정한 미완료 문서가 없습니다.','cs-document-empty'));card.append(current);
   if(grouped.past.length){const details=node('details',null,'cs-documents-past'),summary=node('summary','지난 미완료 문서 '+grouped.past.length+'건');details.open=pastOpen;details.append(summary);for(const item of grouped.past)details.append(row(item));details.ontoggle=()=>{pastOpen=details.open;};card.append(details);}
   for(const kind of active){const s=state.sources[kind];if(s.error){const err=node('div',null,'cs-document-error');err.setAttribute('role','status');err.append(node('span',labels[kind]+' · '+s.error));card.append(err);}if(s.next){const more=button(labels[kind]+' 더 불러오기',()=>void loader.more(kind));more.disabled=s.busy;more.dataset.documentAction='more-'+kind;more.className='cs-document-more';card.append(more);}}
   if(notice){const n=node('p',notice,'cs-document-error');n.setAttribute('role','status');card.append(n);}root.append(card);
   if(focusKey){const target=[...root.querySelectorAll('[data-document-action]')].find(x=>x.dataset.documentAction===focusKey);target?.focus({preventScroll:true});}
  }
  return {...loader,clear(){pastOpen=false;notice='';loader.clear();if(root){root.replaceChildren();root.hidden=true;}}};
 }
 const api={day,normalize,groups,createLoader,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.ClinicTodayDocuments=api;
})(typeof window==='undefined'?globalThis:window);
