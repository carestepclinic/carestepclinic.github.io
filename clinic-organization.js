/* Clinic information layout. Existing actions and permissions remain authoritative. */
(function(global){
 'use strict';
 const $=id=>document.getElementById(id),tabs=new Map();
 let workspace=null,timelineOpen=null;
 function ageLabel(birth,today=new Date(Date.now()+32400000).toISOString().slice(0,10)){
  const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const day=String(birth||'').slice(0,10);if(!valid(day)||!valid(today)||day>today)return '나이 미입력';
  const [y,m,d]=day.split('-').map(Number),[ty,tm,td]=today.split('-').map(Number),months=(ty-y)*12+tm-m-(td<d?1:0);
  if(months<1)return '1개월 미만';if(months<12)return months+'개월';
  return Math.floor(months/12)+'살'+(months%12?' '+months%12+'개월':'');
 }
 function recentTemplates(all,ids,limit=5){const seen=new Set();return (ids||[]).flatMap(id=>{const t=all.find(t=>t.id===id);if(!t||seen.has(id))return [];seen.add(id);return [t];}).slice(0,limit);}
 function taskPreview(regions,filter='all',expanded=false,limit=5){
  const selected=Object.entries(regions).filter(([key])=>filter==='all'||key===filter),total=selected.reduce((n,[,r])=>n+r.items.length,0);
  const counts=new Map(selected.map(([key])=>[key,0]));let remaining=expanded?total:Math.min(total,limit);
  while(remaining>0){for(const [key,r] of selected){if(!remaining)break;const n=counts.get(key);if(n<r.items.length){counts.set(key,n+1);remaining--;}}}
  return {total,visible:expanded?total:Math.min(total,limit),regions:selected.map(([key,r])=>[key,{...r,items:r.items.slice(0,counts.get(key))}])};
 }
 function clinicalRows(rows,attention){
  const ids=new Set(attention?.state==='ready'?(attention.items||[]).map(x=>String(x.id||'')).filter(Boolean):[]);
  return (rows||[]).filter(x=>!(x.sourceType==='home'&&x.responseCode==='concern'&&ids.has(String(x.id||''))));
 }
 function noticeLabel(notice){
  if(!notice||typeof notice!=='object')return '결과 확인 불가 · 자료 게시만 확인됐으며 알림 수신은 별도입니다.';
  if(notice.skipped)return '시도하지 않음 · 알림 조건 미충족';
  const count=k=>Number.isSafeInteger(notice[k])&&notice[k]>=0?notice[k]:null;
  const accepted=count('accepted'),failed=count('failed'),pending=count('unconfirmed');
  if(accepted===null||failed===null)return '결과 확인 불가 · 푸시 처리 결과를 확인하지 못했습니다.';
  if(accepted===0&&failed===0&&!(pending>0))return notice.attempted===0?'시도하지 않음 · 발송 대상 없음':'접수·실패 기록 0건 · 시도 여부 확인 필요';
  return ['접수 '+accepted+'건','실패 '+failed+'건',pending?'결과 미확정 '+pending+'건':'','기기 수신·보호자 열람은 별도'].filter(Boolean).join(' · ');
 }
 function updateTodayCounts(){
  const attention=global.carestepAttentionSummary?.(),clinical=global.carestepClinicalSummary?.();
  for(const [key,label,value] of [['attention','상담·승인·발송 확인',attention],['clinical','진료·예방·후속관리',clinical]]){
   const button=$('clinicToday-tab-'+key);if(!button)continue;
   const suffix=!value||value.state==='loading'?'확인 중':value.state==='failed'?'조회 실패':value.state==='unavailable'?'이용 불가':key==='attention'?'이 탭 '+value.total+'항목 · 대상 '+(value.targets??value.total)+'건':'이 탭 개별 업무 '+value.total+'건';
   const text=label+' · '+suffix;if(button.textContent!==text)button.textContent=text;
  }
 }
 function createTabs(root,entries,{prefix,selected,onChange=()=>{}}){
  const nav=document.createElement('div');nav.className='clinic-section-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label',root.getAttribute('aria-label')||'업무 구역');
  const buttons=entries.map(([key,label,panel])=>{const b=document.createElement('button');b.type='button';b.id=prefix+'-tab-'+key;b.textContent=label;b.setAttribute('role','tab');panel.id=panel.id||prefix+'-panel-'+key;b.setAttribute('aria-controls',panel.id);panel.classList.add('clinic-section-panel');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);nav.append(b);return b;});
  let active='';
  const select=(key,focus=false)=>{const index=entries.findIndex(x=>x[0]===key);if(index<0)return false;active=key;entries.forEach(([k,,panel],i)=>{const yes=k===key;panel.hidden=!yes;buttons[i].setAttribute('aria-selected',String(yes));buttons[i].tabIndex=yes?0:-1;});onChange(key);if(focus)buttons[index].focus();return true;};
  buttons.forEach((b,i)=>{b.addEventListener('click',()=>select(entries[i][0]));b.addEventListener('keydown',e=>{const key=e.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;e.preventDefault();const n=key==='Home'?0:key==='End'?buttons.length-1:(i+(key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;select(entries[n][0],true);});});
  root.append(nav,...entries.map(x=>x[2]));select(entries.some(x=>x[0]===selected)?selected:entries[0][0]);return {select,get active(){return active;}};
 }
 function organizeWorkspace(mount,context){
  const root=mount?.querySelector('.patient-workspace'),detail=$('patientCrmDetail');if(!root||!detail||root.dataset.organized)return;
  root.dataset.organized='true';root.dataset.patientId=context.patientId;
  const key=JSON.stringify([context.scope,context.guardianId,context.patientId]),changed=workspace?.key!==key,panels={};
  for(const k of ['summary','records','materials','home']){panels[k]=document.createElement('section');panels[k].className='clinic-workspace-'+k;}
  const move=(selector,target,base=root)=>{const n=base.querySelector(selector);if(n)panels[target].append(n);};
  move('.patient-workspace-alert','summary');move('.patient-workspace-kpis','summary');move('.patient-workspace-grid','summary');
  move('.patient-workspace-fast-record','records');move('#crmPatientTimelineMount','records',detail);
  
  move('.care-workspace-guide','materials');
  const actions=document.createElement('div');actions.className='clinic-workspace-actions';
  for(const key of ['material','medication','preview','publish','history']){const n=root.querySelector('[data-workspace-'+key+']');if(n)actions.append(n);}
  panels.materials.append(actions);
  move('[data-workspace-followup]','summary');move('.clinic-home-visibility','home');move('[data-workspace-family]','home');move('.r61-family-count','home');
  root.querySelector('.patient-workspace-quick')?.remove();
  for(const n of [...detail.children])if(n.matches('.patient-detail-head,.guardian-summary')||n.querySelector('.guardian-patient-grid,[data-crm-delete-guardian]'))panels.home.append(n);
  const returnList=document.createElement('button');returnList.type='button';returnList.className='btn btn-secondary';returnList.textContent='환자 목록으로';returnList.onclick=()=>{$('patientCrmSearch')?.focus({preventScroll:true});$('patientCrmSearch')?.scrollIntoView({block:'center'});};root.querySelector('.patient-workspace-head-actions')?.prepend(returnList);
  root.setAttribute('aria-label','선택 환자 작업공간');
  const state={root,key,patientId:context.patientId,control:null,recordsLoaded:false};workspace=state;
  const control=createTabs(root,[['summary','요약',panels.summary],['records','건강기록',panels.records],['materials','자료·복약',panels.materials],['home','HOME·보호자',panels.home]],{prefix:'clinicWorkspace',selected:tabs.get(key),onChange:tab=>{tabs.delete(key);tabs.set(key,tab);if(tabs.size>20)tabs.delete(tabs.keys().next().value);if(tab==='records'&&!state.recordsLoaded&&context.patient&&context.guardian){state.recordsLoaded=true;const timeline=panels.records.querySelector('#crmPatientTimelineMount');if(timeline){const loading=document.createElement('p');loading.className='care-loading';loading.setAttribute('role','status');loading.textContent='선택한 환자의 건강기록을 불러오는 중입니다.';timeline.replaceChildren(loading);}(timelineOpen||global.crmTimelineOpen)?.(context.patient,context.guardian);}}});
  state.control=control;
  if(changed&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(root.isConnected&&workspace===state&&document.querySelector('.view.active-view')?.id==='patients')root.scrollIntoView({block:'start',behavior:'smooth'});});
 }
 function showWorkspaceTab(tab,patientId){if(!workspace?.root.isConnected||(patientId&&workspace.patientId!==patientId))return false;return workspace.control?.select(tab)||false;}
 function mountDashboard(){
  const host=$('workFirstDashboard'),box=$('clinicCareInbox');if(!host||!box||$('clinicHomePrimary'))return;
  const grid=document.createElement('div');grid.id='clinicHomePrimary';host.querySelector('.work-first-head').after(grid);const queue=document.createElement('section');queue.id='clinicTodayQueue';queue.setAttribute('aria-label','오늘 업무 목록');
  const clinical=document.createElement('section');clinical.id='clinicClinicalTasks';
  const existing=host.querySelector('.care-work-more');
  if(existing){for(const n of [...existing.children])if(n.tagName!=='SUMMARY')clinical.append(n);existing.remove();}
  for(const id of ['workFirstBacklog','workFirstCleanupStatus']){const n=$(id);if(n)clinical.append(n);}
  const attention=document.createElement('section');attention.append(box);
  createTabs(queue,[['attention','상담·승인·발송 확인',attention],['clinical','진료·예방·후속관리',clinical]],{prefix:'clinicToday',selected:'attention'});
  const toolbar=document.createElement('div');toolbar.className='clinic-today-toolbar';const nav=queue.querySelector('[role="tablist"]');nav.before(toolbar);toolbar.append(nav);const refresh=$('refreshWorkFirst');if(refresh)toolbar.append(refresh);host.querySelector('.work-first-head')?.remove();
  grid.append(queue);updateTodayCounts();
  const explorer=document.createElement('details');explorer.id='clinicTaskExplorer';explorer.className='clinic-task-explorer';explorer.innerHTML='<summary>상담·일정 상세 보기</summary>';
  const body=document.createElement('div');body.setAttribute('aria-label','상담과 일정 목록');explorer.append(body);
  const consult=$('careConsultInbox'),schedule=$('followupScheduleBoard');if(!consult||!schedule)return;
  schedule.open=true;schedule.classList.add('clinic-schedule-list');
  $('dashboard').append(explorer);
  const controls=createTabs(body,[['consult','상담 목록',consult],['schedule','전체 일정',schedule]],{prefix:'clinicTasks',selected:'consult'});
  const scheduleShortcut=$('workFirstOpenSchedule');if(scheduleShortcut)scheduleShortcut.remove();
  const links=document.createElement('div');links.className='clinic-home-list-links';
  for(const [kind,label] of [['consult','상담 전체 보기'],['schedule','전체 일정 보기']]){const b=document.createElement('button');b.type='button';b.className='btn btn-secondary';b.textContent=label;b.onclick=()=>open(kind);links.append(b);}host.append(links);
  function open(kind){if(typeof go==='function')go('dashboard');explorer.open=true;controls.select(kind);explorer.scrollIntoView({block:'start',behavior:'smooth'});body.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});}
  global.carestepOpenClinicList=open;

 }
 function mountDashboardManagement(){
  const dashboard=$('dashboard');if(!dashboard||$('clinicDashboardManagement'))return;
  const menu=document.createElement('details');menu.id='clinicDashboardManagement';menu.className='clinic-dashboard-management';
  menu.innerHTML='<summary>관리 메뉴</summary><div class="clinic-dashboard-management-body"></div>';dashboard.append(menu);
  const body=menu.lastElementChild;
  function arrange(){
   for(const id of ['clinicHomeDirectoryOpen1','clinicHomeAccessDashboard']){const el=$(id);if(el&&el.parentElement!==body)body.append(el);}
   const banner=$('subscriptionBanner');if(banner){const warning=banner.classList.contains('blocked')||banner.classList.contains('warn');if(warning){if(banner.parentElement!==dashboard)dashboard.insertBefore(banner,menu);}else if(banner.parentElement!==body)body.prepend(banner);}
   if(dashboard.lastElementChild!==menu)dashboard.append(menu);
  }
  new MutationObserver(arrange).observe(dashboard,{childList:true});
  const banner=$('subscriptionBanner');if(banner)new MutationObserver(arrange).observe(banner,{attributes:true,attributeFilter:['class']});arrange();
 }
 function syncNav(){
  const group=$('clinicMaterialNav');if(group){const children=[...group.querySelectorAll('.nav-item')];group.hidden=!children.some(n=>!n.classList.contains('saas-hidden')&&!n.classList.contains('role-ui-hidden'));if(children.some(n=>n.classList.contains('active')))group.open=true;}
 }

 function mountHospitalManagement(){
  const views=['onboarding','settings','account','voice','pilot'].map($).filter(Boolean);
  for(const root of views)root.classList.add('clinic-management-view');
  function fold(root,start,id,title,note){
   if(!root||!start||$(id))return;
   const details=document.createElement('details'),summary=document.createElement('summary'),hint=document.createElement('p');
   details.id=id;details.className='clinic-management-details';summary.textContent=title;hint.className='clinic-management-note';hint.textContent=note;
   const siblings=[...root.children],index=siblings.indexOf(start);if(index<0)return;
   root.insertBefore(details,start);details.append(summary,hint,...siblings.slice(index));
  }
  const pilot=$('pilot'),legacy=pilot?.querySelector('.legacy-pilot-title');
  fold(pilot,legacy,'clinicLocalAnalytics','이 브라우저의 시범 사용 통계',
   '현재 기기에 저장된 사용 기록입니다. 위의 병원 전체 월간 리포트와 집계 범위가 다르며, 다른 기기의 기록은 합산되지 않습니다.');
  const key=$('voiceAdminKey'),admin=key?.closest('.voice-panel');
  fold(admin?.parentElement,admin,'clinicVoiceAdministration','CARESTEP 운영자 요청 관리',
   '접수된 요청을 검토하는 운영자 전용 영역입니다. 병원에서 문의를 보낼 때는 위의 요청 양식을 사용하세요.');
  for(const [id,title] of [['saasCurrentPassword','현재 비밀번호'],['saasNewPassword','새 비밀번호'],['saasNewPasswordConfirm','새 비밀번호 확인']]){
   const input=$(id);if(!input||input.closest('label'))continue;
   const label=document.createElement('label');label.className='clinic-management-field';label.htmlFor=id;label.append(document.createTextNode(title));input.before(label);label.append(input);
  }
  function saveScope(id,inputs,copy,successEvent){
   const button=$(id);if(!button||$(id+'Scope'))return;
   const note=document.createElement('p');note.id=id+'Scope';note.className='clinic-save-scope';note.setAttribute('role','status');note.textContent=copy;button.parentElement.before(note);
   const clean=()=>{note.dataset.dirty='false';note.textContent=copy;};
   for(const input of inputs)input.addEventListener('input',()=>{note.dataset.dirty='true';note.textContent='저장하지 않은 변경사항이 있습니다. '+copy;});
   if(successEvent)window.addEventListener(successEvent,clean);
   else button.addEventListener('click',()=>{if($('hospitalName')?.value.trim())clean();});
  }
  saveScope('saveHospital',['hospitalName','directorName','hospitalPhone','hospitalAddress','hospitalWebsite'].map($).filter(Boolean),'병원정보 저장은 병원 기본정보에 적용됩니다. 접종·사상충 일정 규칙은 별도로 저장하세요.');
  saveScope('saveClinicalProtocol',[...document.querySelectorAll('[data-protocol-path]')],'일정 규칙 저장은 접종·사상충 간격에만 적용됩니다. 병원 기본정보는 별도로 저장하세요.','carestep:clinical-protocol-updated');
  const voiceTabs=$('voiceTabs');
  if(voiceTabs&&!voiceTabs.dataset.managementKeys){
   voiceTabs.dataset.managementKeys='1';voiceTabs.setAttribute('role','group');voiceTabs.setAttribute('aria-label','요청 종류');
   const sync=()=>voiceTabs.querySelectorAll('[data-voice-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));
   new MutationObserver(sync).observe(voiceTabs,{subtree:true,attributes:true,attributeFilter:['class']});sync();
  }
 }

 function mount(){
  mountDashboard();mountDashboardManagement();syncNav();mountHospitalManagement();
  const bar=$('r61-controls'),settings=$('settings');if(bar&&settings){settings.insertBefore(bar,$('emrSyncCenter'));bar.setAttribute('aria-label','발송·공개·연동 관리');}
  document.querySelector('.nav-list')&&new MutationObserver(syncNav).observe(document.querySelector('.nav-list'),{subtree:true,attributes:true,attributeFilter:['class']});
  const original=global.crmTimelineOpen;timelineOpen=original;
  if(typeof original==='function')global.crmTimelineOpen=async function(patient,guardian){
   if(!patient)return;
   if(!workspace?.root.isConnected||workspace.patientId!==patient.id){if(!guardian?.id||!await global.crmOpenPatientRecord?.(guardian.id,patient.id))return;}
   const loaded=workspace?.recordsLoaded;if(showWorkspaceTab('records',patient.id)&&loaded)return original(patient,guardian);
  };
 }
 global.ClinicOrganization={clinicalRows,noticeLabel,updateTodayCounts,ageLabel,recentTemplates,taskPreview,createTabs,mountHospitalManagement,organizeWorkspace,showWorkspaceTab,mountDashboard,syncNav};
 if(typeof module!=='undefined')module.exports=global.ClinicOrganization;
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();}
})(typeof window==='undefined'?globalThis:window);
