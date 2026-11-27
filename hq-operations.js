/* HQ operational workspace: local drafts and independent read-only panels. */
(function(g){'use strict';
 const $=id=>document.getElementById(id), ws=g.CarestepHqWorkspace, safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let identity='',epoch=0,saving=false,baseline={},draft=new Map(),materialTab='writing',materialAt=0,materialPending=null,materialVersion=0;
 const materialReads=new Map();
 const panels=new Map(),deferred=new Map(),materials=new Map(),kinds={training:'직원 교육·업무지침',content:'보호자 안내자료',protocols:'진료 프로토콜',consentLibrary:'진료 동의서'};
 const owned=()=>ws.ready()&&identity===ws.owner();
 function enter(){if(!ws.ready())return false;const next=ws.owner();if(identity!==next){clear();identity=next;}return true;}
 function clear(){epoch++;identity='';saving=false;baseline={};draft.clear();panels.clear();deferred.clear();materials.clear();materialReads.clear();materialVersion++;materialAt=0;materialPending=null;productionLaunch=null;productionDeletions=[];productionBackups=[];for(const id of ['productionSecurityChecks','productionManualChecklist','productionDeletionRows','productionBackupRows'])$(id)?.replaceChildren();$('productionBackupClinic')?.replaceChildren(new Option('병원 선택',''));renderDeferred();renderMaterials();for(const node of document.querySelectorAll('[data-hq-panel-state]'))node.replaceChildren();paintDraft();}
 function status(name,host){let node=document.querySelector('[data-hq-panel-state="'+name+'"]');if(!node){node=document.createElement('p');node.dataset.hqPanelState=name;node.className='hq-panel-state';node.setAttribute('role','status');host?.prepend(node);}return node;}
 async function panel(name,host,read,apply){if(!enter())return;const turn=epoch,token=Symbol();panels.set(name,token);const node=status(name,host);node.textContent='불러오는 중…';
  try{const data=await read();if(!owned()||turn!==epoch||panels.get(name)!==token)return;apply(data);node.textContent='';}
  catch(e){if(!owned()||turn!==epoch||panels.get(name)!==token)return;node.textContent='조회 실패 · '+(e.message||'연결을 확인해주세요.')+' ';const retry=document.createElement('button');retry.className='btn small';retry.textContent='이 항목 다시 조회';retry.onclick=()=>panel(name,host,read,apply);node.append(retry);}
 }
 const launchCard=$('productionSecurityChecks')?.closest('.card'),deletionCard=$('productionDeletionRows')?.closest('.card'),backupCard=$('productionBackupClinic')?.closest('.card');
 const previousRender=renderProductionLaunch;
 renderProductionLaunch=function(){previousRender();paintDraft();};
 function paintDraft(){for(const box of document.querySelectorAll('[data-launch-key]')){const key=box.dataset.launchKey;if(draft.has(key))box.checked=draft.get(key);box.disabled=saving;}
  let note=$('hqChecklistDraft');if(!note&&$('productionManualChecklist')){note=document.createElement('p');note.id='hqChecklistDraft';note.className='hq-draft-state';note.setAttribute('role','status');$('productionManualChecklist').after(note);}
  if(note)note.textContent=saving?'체크리스트 저장 중…':draft.size?'저장하지 않은 변경 '+draft.size+'개 · 화면 이동·다시 조회 후에도 유지됩니다.':'';
  if($('saveProductionChecklist'))$('saveProductionChecklist').disabled=saving||!draft.size;
 }
 document.addEventListener('change',e=>{const box=e.target.closest('[data-launch-key]');if(!box||!enter()||saving)return;const key=box.dataset.launchKey;if(box.checked===!!baseline[key])draft.delete(key);else draft.set(key,box.checked);paintDraft();});
 const loadLaunch=()=>panel('launch',launchCard,()=>req('/hq/production-launch'),d=>{productionLaunch=d;baseline={...d.checklist?.state};for(const [k,v]of draft)if(v===!!baseline[k])draft.delete(k);renderProductionLaunch();});
 const loadDeletions=()=>panel('deletions',deletionCard,()=>req('/hq/deletion-requests'),d=>{productionDeletions=d.requests||[];renderProductionDeletions();});
 const loadBackupClinics=()=>panel('backup-clinics',backupCard,()=>req('/hq/clinics?status=all&approval=all'),d=>{const select=$('productionBackupClinic'),current=select.value;select.replaceChildren(new Option('병원 선택',''));for(const c of d.clinics||[])if(c.status!=='suspended')select.add(new Option(c.name+' · '+(c.plan||''),c.id));if([...select.options].some(o=>o.value===current)){select.value=current;if(current)void loadProductionBackups();}});
 loadProductionLaunch=async function(){if(!enter()||saving)return;await Promise.allSettled([loadLaunch(),g.CarestepHqIncidentList.load({reset:true}),loadDeletions(),loadBackupClinics()]);};
 saveProductionChecklist=async function(){if(!enter()||saving||!draft.size)return;const turn=epoch,body=Object.fromEntries(draft);saving=true;paintDraft();
  try{const d=await req('/hq/production-launch',{method:'PUT',body:JSON.stringify(body)});if(!owned()||turn!==epoch)return;productionLaunch=d;baseline={...d.checklist?.state};for(const[k,v]of Object.entries(body))if(draft.get(k)===v)draft.delete(k);renderProductionLaunch();toast('체크리스트를 저장했습니다.');}
  catch(e){if(owned()&&turn===epoch)toast(e.message||'저장하지 못했습니다. 변경 내용은 유지됩니다.');}
  finally{if(owned()&&turn===epoch){saving=false;paintDraft();}}
 };
 // Existing inline listeners captured the previous handler; bind the latest one.
 $('saveProductionChecklist').onclick=()=>saveProductionChecklist();

 const deferredBox=document.createElement('details');deferredBox.id='hqDeferredHospitals';deferredBox.className='hq-deferred';document.querySelector('#dashboard .approval-center').append(deferredBox);
 function renderDeferred(){const merged=new Map();for(const rows of deferred.values())if(Array.isArray(rows))for(const row of rows){const reason=ws.deferredHospital(row);if(reason)merged.set(row.clinicId||row.id,{...row,reason});}
  const pending=['onboarding','success'].some(k=>!deferred.has(k)),failed=[...deferred.values()].some(x=>x===null);
  deferredBox.innerHTML='<summary>중지·종료 병원 '+(pending?'확인 중':failed?'일부 조회 실패':merged.size+'곳')+'</summary><p class="muted">일반 개통·사용 안내 업무에서 분리했습니다. 결제 미납과 보호자 응답은 계속 확인합니다.</p>';
  for(const [id,row]of merged){const line=document.createElement('div');line.className='hq-deferred-row';const name=document.createElement('span');name.textContent=(row.clinicName||row.name||id)+' · '+row.reason;const button=document.createElement('button');button.className='btn small';button.textContent='병원 확인';button.onclick=()=>{const open=()=>{selectedClinic=id;showView('clinics');};if(g.CarestepHqUX.allowLeave(open))open();};line.append(name,button);deferredBox.append(line);}
 }
 // Preserve full portfolio lists, while allowing dashboard actions to open active hospitals only.
 $('hqScope-onboarding').onchange=()=>renderOnboardingPortfolio();
 $('hqScope-customerSuccess').onchange=()=>renderCustomerSuccess();
 const oldOnboarding=renderOnboardingPortfolio;renderOnboardingPortfolio=function(){const saved=onboardingPortfolio;if(saved)onboardingPortfolio={...saved,clinics:filterHospitals(saved.clinics,'onboarding')};try{oldOnboarding();}finally{onboardingPortfolio=saved;}};
 const oldSuccess=renderCustomerSuccess;renderCustomerSuccess=function(){const saved=customerSuccessPortfolio;if(saved)customerSuccessPortfolio={...saved,clinics:filterHospitals(saved.clinics,'customerSuccess')};try{oldSuccess();}finally{customerSuccessPortfolio=saved;}};
 function filterHospitals(rows,view){const scope=$('hqScope-'+view)?.value;return(rows||[]).filter(x=>scope==='active'?!ws.deferredHospital(x):scope==='deferred'?!!ws.deferredHospital(x):true);}
 const originalOpenTarget=openApprovalCenterTarget;openApprovalCenterTarget=function(target){if(['onboarding','customerSuccess'].includes(target))$('hqScope-'+target).value='active';return originalOpenTarget(target);};

 const work=document.createElement('section');work.id='hqMaterialWork';work.className='card';deferredBox.closest('.approval-center').after(work);
 function renderMaterials(){
  const values=[...materials.values()],summary=status=>values.reduce((n,d)=>n+(Number(d?.[status])||0),0);
  const pending=Object.keys(kinds).some(k=>!materials.has(k)||materials.get(k).loading),failed=values.some(d=>d.error),known=values.some(d=>Array.isArray(d.items));
  work.innerHTML='<div class="head"><h2>작성·검토 중인 자료</h2><button class="btn small" data-work-refresh>다시 확인</button></div><div class="hq-work-tabs">'+['writing','review'].map(s=>'<button class="btn '+(materialTab===s?'primary':'')+'" data-work-tab="'+s+'">'+(s==='writing'?'작성 중':'검토 대기')+' '+(known?summary(s):'—')+'</button>').join('')+'</div><p class="hq-work-state" role="status">'+(pending?(known?'최신 정보 확인 중 · 이전 결과 유지':'자료 확인 중…'):failed?'일부 조회 실패 · 확인된 자료 표시':'')+'</p><div class="hq-work-sources"></div><div class="hq-work-empty" aria-label="현재 자료가 없는 분류"></div>';
  work.querySelector('[data-work-refresh]').onclick=()=>loadMaterials(true);
  work.querySelectorAll('[data-work-tab]').forEach(b=>b.onclick=()=>{materialTab=b.dataset.workTab;renderMaterials();});
  const root=work.querySelector('.hq-work-sources'),empty=work.querySelector('.hq-work-empty');
  for(const[kind,label]of Object.entries(kinds)){
   const d=materials.get(kind),items=(d?.items||[]).filter(x=>x.status===materialTab),section=document.createElement('div');section.dataset.workKind=kind;
   if(d&&!d.loading&&!d.error&&!Number(d[materialTab])&&!items.length){
    section.className='hq-work-empty-source';const more=document.createElement('button');more.className='btn small';more.textContent=label+' · 해당 자료 없음';more.title=label+' 전체 목록';more.onclick=()=>showView(kind);section.append(more);empty.append(section);continue;
   }
   section.className='hq-work-source';section.innerHTML='<h3>'+safe(label)+'</h3>';
   if(!d||d.loading){const note=document.createElement('p');note.className='muted';note.setAttribute('role','status');note.textContent=Array.isArray(d?.items)?'최신 정보 확인 중…':'확인 중…';section.append(note);}
   if(d?.error){const p=document.createElement('p');p.className='hq-panel-state';p.textContent='조회 실패 · '+d.error+(Array.isArray(d.items)?' · 이전 결과 유지':'');const b=document.createElement('button');b.className='btn small';b.textContent='다시 조회';b.onclick=()=>loadKind(kind);section.append(p,b);}
   for(const item of items.slice(0,5)){const b=document.createElement('button');b.className='hq-work-item';b.textContent=item.title||'제목 없음';b.title=item.title||'';if(item.updatedAt){const meta=document.createElement('small');meta.className='hq-work-date';meta.textContent=new Date(item.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' 수정';b.append(meta);}b.onclick=()=>openMaterial(kind,item.id);section.append(b);}
   if(Array.isArray(d?.items)){if(!items.length&&!d.loading&&!d.error){const note=document.createElement('p');note.className='muted';note.textContent='이어서 볼 자료는 전체 목록에서 확인하세요.';section.append(note);}const more=document.createElement('button');more.className='btn small';more.textContent='전체 목록';more.onclick=()=>showView(kind);section.append(more);}
   root.append(section);
  }
  root.hidden=!root.childElementCount;empty.hidden=!empty.childElementCount;
 }
 function loadKind(kind){
  if(!enter())return Promise.resolve();if(materialReads.has(kind))return materialReads.get(kind);
  const turn=epoch,version=materialVersion,token=Symbol();panels.set('material-'+kind,token);materials.set(kind,{...materials.get(kind),loading:true,error:''});renderMaterials();
  const valid=()=>owned()&&turn===epoch&&version===materialVersion&&panels.get('material-'+kind)===token;
  const read=(async()=>{
   try{const d=await req('/hq/material-work?kind='+kind);if(valid())materials.set(kind,{...d,items:d.items||[],loading:false});}
   catch(e){if(valid())materials.set(kind,{...materials.get(kind),loading:false,error:e.message||'연결 확인 필요'});}
  })();
  materialReads.set(kind,read);
  return read.finally(()=>{if(materialReads.get(kind)===read)materialReads.delete(kind);if(owned()&&turn===epoch)renderMaterials();});
 }
 async function loadMaterials(force=false){
  if(!enter())return;if(materialPending)return materialPending;if(!force&&materialAt&&Date.now()-materialAt<30000)return;
  const turn=epoch,version=materialVersion,p=Promise.allSettled(Object.keys(kinds).map(loadKind));materialPending=p;await p;
  if(owned()&&turn===epoch&&materialPending===p){materialAt=version===materialVersion&&![...materials.values()].some(d=>d.error)?Date.now():0;materialPending=null;if(version!==materialVersion&&$('dashboard').classList.contains('active'))void loadMaterials(true);}
 }
 function openMaterial(kind,id){const open=()=>{if(!owned())return;if(showView(kind)===false)return;if(kind==='training')g.CarestepTraining.openVersion(id);else if(kind==='content')g.GuardianStudio.open(id);else if(kind==='protocols')g.CarestepHqProtocols.openDocument(id);else g.CarestepConsentLibrary.openDocument(id);};if(g.CarestepHqUX.allowLeave(open))open();}
 const oldOverview=loadOverview;loadOverview=async function(options={}){if(enter())void loadMaterials(!options.reuse);return oldOverview(options);};
 new MutationObserver(()=>{if(!ws.ready())clear();else if($('dashboard').classList.contains('active'))void loadMaterials();}).observe($('loginOverlay'),{attributes:true,attributeFilter:['class']});
 new MutationObserver(()=>{if(ws.ready()&&$('dashboard').classList.contains('active'))void loadMaterials();}).observe($('dashboard'),{attributes:true,attributeFilter:['class']});
 const previousRequest=req;req=async function(url,options={}){const result=await previousRequest(url,options);if(options.method&&!['GET','HEAD'].includes(options.method.toUpperCase())){materialVersion++;materialAt=0;}return result;};
 g.CarestepHqOperations={hasDirty:()=>draft.size>0,isSaving:()=>saving,setDeferred:(key,rows)=>{if(!enter())return;deferred.set(key,rows);renderDeferred();},resetDeferred(){if(!enter())return;deferred.clear();renderDeferred();},failDeferred(key){if(['onboarding','success'].includes(key)){deferred.set(key,null);renderDeferred();}},loadMaterials,clear};
 renderDeferred();renderMaterials();paintDraft();
})(window);
