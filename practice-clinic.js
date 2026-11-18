async function carestepConsentEducation(){
  if(!saasPermission('materials.read',true))throw Error('교육자료 조회 권한이 필요합니다.');
  const scope=[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id].join(':');
  const items=new Map(templates.filter(t=>t.status==='live'&&!t._studioCentral).map(t=>[t.id,t]));
  if(saasHasFeature('centralContent')){
   const r=await saasRequest('/saas/content/published',{method:'GET'});
   if(scope!==[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id].join(':'))throw Error('병원 또는 계정이 변경되었습니다.');
   for(const d of r.documents||[])if(d.workflowStatus==='published'&&d.vetReviewed&&d.template?.id)items.set(d.template.id,{...d.template,species:d.meta?.species||d.journey?.species||d.template.species||''});
  }
  return {items:Array.from(items.values()).map(t=>({id:t.id,title:t.title,short:t.short,category:t.category,species:templateSpeciesLabel(t),description:t.description,sections:t.sections,redFlags:t.redFlags}))};
}
const carestepConsentScope=()=>JSON.stringify([saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,saasMe?.role,saasMe?.permissions]);
async function carestepConsentSources(){
 const scope=carestepConsentScope(),jobs=[];
 if(saasPermission('materials.read',true)){
  jobs.push(['보호자 안내자료',()=>carestepConsentEducation().then(r=>r.items.map(t=>({...t,sourceKind:'education'})))]);
  jobs.push(['공통 진료 프로토콜',()=>saasRequest('/saas/practice/knowledge-protocols').then(r=>(r.items||[]).filter(t=>t.status==='published'&&t.sourceCurrent!==false).map(t=>({...t,sourceKind:'common'})))]);
 }
 if(saasPermission('clinical.calculate',false)&&saasPermission('clinical.protocols.read',false))jobs.push(['병원 진료 프로토콜',()=>saasRequest('/saas/practice/clinical/protocols').then(r=>(r.items||[]).filter(t=>t.status==='published').map(t=>({...t,disease:t.body?.disease,sourceKind:'hospital'})))]);
 if(!jobs.length)throw Error('안내자료 또는 진료 프로토콜 조회 권한이 필요합니다.');
 const results=await Promise.allSettled(jobs.map(([,fn])=>fn()));
 if(scope!==carestepConsentScope())throw Error('병원 또는 계정이 변경되었습니다. 다시 찾아주세요.');
 const items=[],warnings=[];results.forEach((r,i)=>{if(r.status==='fulfilled')items.push(...r.value);else warnings.push(jobs[i][0]+' 조회 실패');});
 if(results.every(r=>r.status==='rejected'))throw Error('자료를 불러오지 못했습니다. 다시 시도해주세요.');
 return {items,warnings};
}
async function carestepConsentSourceDocument(source){
 const scope=carestepConsentScope();let item;
 if(source.sourceKind==='education'){item=(await carestepConsentEducation()).items.find(t=>t.id===source.id);}
 else if(source.sourceKind==='common'){
  if(!saasPermission('materials.read',true))throw Error('자료 조회 권한이 없습니다.');
  item=(await saasRequest('/saas/practice/knowledge-protocols/'+encodeURIComponent(source.id))).document;
 }else if(source.sourceKind==='hospital'){
  if(!saasPermission('clinical.calculate',false)||!saasPermission('clinical.protocols.read',false))throw Error('프로토콜 조회 권한이 없습니다.');
  item=(await saasRequest('/saas/practice/clinical/protocols')).items?.find(t=>t.id===source.id);
 }
 if(scope!==carestepConsentScope())throw Error('병원 또는 계정이 변경되었습니다.');
 if(!item||source.sourceKind!=='education'&&item.status!=='published')throw Error('현재 공개된 자료를 확인하지 못했습니다. 다시 찾아주세요.');
 return {...item,sourceKind:source.sourceKind,title:item.body?.title||item.title,disease:item.body?.disease||item.disease,species:item.body?.species||item.species};
}
window.CarestepPractice=PracticeTools.mount(document.getElementById('practiceRoot'),{
 hospital:()=>({name:hospital.name||saasMe?.clinic?.name||'',logo:hospital.logo||'',address:hospital.address||'',phone:hospital.phone||''}),
 request:(path,options)=>saasRequest('/saas'+path,options),
 ready:()=>saasMode==='auth'&&!!saasMe,
 identity:()=>[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':'),
 preferencesIdentity:()=>[saasMe?.clinic?.id,saasMe?.user?.id].join(':'),
 consentEducation:carestepConsentEducation,consentSources:carestepConsentSources,consentSourceDocument:carestepConsentSourceDocument,
 can:key=>saasPermission(key,true),clinicalManage:()=>saasPermission('records.edit',true),medical:()=>saasPermission('clinical.approve',false),access:(tab,action)=>window.ClinicSettings?.access(tab,action)||{allowed:true},education:async id=>{go('training');await window.CarestepTraining.open();if(id)await window.CarestepTraining.openVersion(id);},materials:p=>{const current=window.crmMaterialContext?.();if(p?.id&&current?.patientId!==p.id){go('patients');toast('퇴원 자료를 작성할 환자를 선택해주세요: '+p.name);return;}go('library');},navigation:()=>window.ClinicNavigation?.changed(),navigate:(view,options)=>{if(view==='sop'){go('training',{trainingSection:'sop'});}else go(view,options);},clinicName:()=>saasMe?.clinic?.name||'우리 병원',
 patient:()=>{const x=window.crmMaterialContext?.();return x?.patientId?{id:x.patientId,name:x.patient?.name||'',guardianName:x.guardian?.name||'',species:x.patient?.species||''}:null;}
});
if(document.getElementById('practice').classList.contains('active-view'))window.CarestepPractice.open();

window.carestepPracticeToday=async function(){void window.CarestepTodayWard?.refresh();void window.CarestepTodayPurchases?.refresh();const el=document.getElementById('practiceTodayRoot');if(!el)return;const scope=[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':');const allowed=saasMode==='auth'&&!!saasMe&&saasPermission('operations.read',true);el.hidden=!allowed;if(!allowed){el.replaceChildren();return;}el.className='pt';el.innerHTML='<section class="pt-card"><h3>업무 체크리스트</h3><p role="status">오늘·지난 미완료 업무를 확인하는 중…</p></section>';try{const r=await saasRequest('/saas/operations/');if(scope!==[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':')||saasMode!=='auth')return;const open=r.runs.filter(x=>x.status!=='done'),held=open.filter(x=>x.status==='held').length;el.replaceChildren();const card=document.createElement('section');card.className='pt-card';const h=document.createElement('h3');h.textContent='업무 체크리스트';const summary=document.createElement('p');summary.textContent=open.length?'미완료 '+open.length+'건'+(held?' · 보류 '+held+'건':''):'남은 업무 없음';card.classList.toggle('cs-today-empty',!open.length);const heading=document.createElement('div');heading.className='pt-today-summary';heading.append(h,summary);card.append(heading);for(const x of open.slice(0,5)){const line=document.createElement('button');line.type='button';line.className='pt-today-run';line.dataset.todayRun=x.id;const copy=document.createElement('span'),title=document.createElement('b'),meta=document.createElement('small');title.textContent=x.body.title;meta.textContent=x.work_date+' · '+(x.assignee_name||'담당자 확인')+(x.body.dueTime?' · 마감 '+x.body.dueTime:'');copy.append(title,meta);const label=document.createElement('span');label.textContent=x.status==='held'?'보류 · 열기':'업무 열기';line.append(copy,label);line.onclick=()=>window.CarestepPractice.operations(x.id,x.work_date);card.append(line);}const button=document.createElement('button');button.textContent=open.length?'업무 열기':'체크리스트 열기';button.onclick=()=>window.CarestepPractice.operations();heading.append(button);el.append(card);}catch{if(saasMode==='auth'&&scope===[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':')){el.textContent='업무 체크리스트를 불러오지 못했습니다. ';const retry=document.createElement('button');retry.textContent='다시 확인';retry.onclick=window.carestepPracticeToday;el.append(retry);}}};
if(document.getElementById('dashboard').classList.contains('active-view'))void window.carestepPracticeToday();
