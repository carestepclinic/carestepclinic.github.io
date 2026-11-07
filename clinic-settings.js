(function(g){
 'use strict';
 const C=g.ClinicCapabilities;if(!C)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const moduleOf=tab=>({surgery:'anesthesia',ward:'ward',protocols:'protocols',dental:'dental',neuro:'neuro',ophthalmic:'ophthalmic',chronic:'chronic'})[tab];
 function access(tab,action='read'){
  if(typeof saasMode==='undefined'||saasMode!=='auth'||!saasMe)return {allowed:true,label:'체험 화면'};
  const id=moduleOf(tab),feature=C.features.find(x=>x.id===(id|| (tab==='calc'?'calculator':tab)));
  const keys=clinicPermissionKeys(saasMe.permissions,saasMe.role),key=id?'clinical.'+id+'.'+action:tab==='calc'?'materials.read':tab==='trainingRead'?'training.read':tab==='trainingManage'?'training.manage':null;
  if(key&&!keys.includes(key))return {allowed:false,code:'permission',label:'직원 권한 없음',detail:'원장에게 직원·권한 설정을 요청해주세요.'};
  const e=saasEntitlements();
  if(feature&&(e?.accessBlocked||e?.plan?.features?.[feature.key]===false))return {allowed:action==='read'&&!!id,code:'plan',label:action==='read'&&id?'기존 기록 조회 가능':'구독 기능 확인 필요',detail:'요금제·구독에서 현재 계약을 확인해주세요.'};
  return {allowed:true,code:'allowed',label:action==='read'?'조회 가능':'작성 가능'};
 }
 const permissionGroup=key=>key.startsWith('clinical.')?(C.modules.find(x=>key.startsWith('clinical.'+x[0]+'.'))?.[1]||'진료 승인·공통 설정'):({patients:'환자·보호자',records:'진료·건강 기록',materials:'보호자 자료',followup:'후속관리·상담',messages:'문자·발송',training:'직원 교육',operations:'병원 업무',stats:'통계',settings:'병원·연동',billing:'요금제·구독',team:'직원 관리'})[key.split('.')[0]]||'기타';
 const permissionHelp={
 'materials.read':'처방·처치 계산, 자료·복약 일정 조회에 사용합니다. 병원 약품·서식 저장은 진료 공통 설정 권한을 따릅니다.',
 'records.read':'진료·건강 기록과 방문 전 문진을 조회합니다.',
 'records.edit':'진료·건강 기록 작성과 방문 전 문진 확인·환자 연결에 사용합니다. 각 기록지는 해당 기록지 권한도 필요합니다.',
 'operations.read':'나에게 배정된 체크리스트 조회·완료·보류·인계가 가능합니다.',
 'operations.manage':'병원 전체 업무 조회, 업무 배정, 서식·반복 업무 설정이 가능합니다.',
 'clinical.settings':'병원 약품 함량·분말 조제 기준·진료 계산 서식을 저장합니다.'
 };
 function groups(catalog){const m=new Map();for(const [k,label] of catalog.filter(x=>x[0]!=='clinical.scope')){const group=permissionGroup(k);if(!m.has(group))m.set(group,[]);m.get(group).push([k,label]);}return m;}
 function decoratePermissions(root=document){
  for(const card of root.querySelectorAll('[data-member-id]')){
   const grid=card.querySelector('.member-permission-grid');if(!grid||grid.dataset.grouped)continue;grid.dataset.grouped='true';
   const sections=new Map();for(const input of [...grid.querySelectorAll('[data-permission-key]')]){const name=permissionGroup(input.dataset.permissionKey);if(!sections.has(name)){const section=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=name;section.append(legend);sections.set(name,section);grid.append(section);}const label=input.closest('label');if(permissionHelp[input.dataset.permissionKey]){const help=document.createElement('small');help.className='cs-permission-help';help.textContent=permissionHelp[input.dataset.permissionKey];label.append(help);}sections.get(name).append(label);}
   const preview=document.createElement('div');preview.className='cs-permission-preview';preview.setAttribute('aria-live','polite');grid.before(preview);
   const update=()=>{const mode=card.querySelector('[data-permission-mode]')?.value,role=card.querySelector('[data-member-role]')?.value,keys=mode==='custom'?clinicExpandPermissions([...card.querySelectorAll('[data-permission-key]:checked')].map(x=>x.dataset.permissionKey)):clinicPermissionKeys({mode},role);const rows=C.modules.filter(x=>keys.includes('clinical.'+x[0]+'.read'));preview.innerHTML='<strong>저장 후 사용할 화면</strong><p>'+ (rows.map(([id,label])=>esc(label)+' · '+(keys.includes('clinical.'+id+'.edit')?'작성 가능':'조회만')).join(' / ')||'진료 화면 접근 없음')+'</p><p>'+[['materials.read','처방·처치 계산'],['records.read','방문 전 문진'],['training.read','직원 교육'],['operations.read','업무 체크리스트']].filter(([key])=>keys.includes(key)).map(([,label])=>esc(label)).join(' / ')+'</p><small>물품관리는 모든 직원이 사용할 수 있습니다. 승인·삭제는 아래 개별 권한을 따릅니다. 저장 전까지 실제 권한은 바뀌지 않습니다.</small>';};
   card.addEventListener('change',()=>{if(!grid.dataset.quick)queueMicrotask(update);});update();
  }
 }
 function guide(){
  const box=document.querySelector('.permission-guide-groups');if(!box||typeof CLINIC_PERMISSIONS==='undefined')return;
  box.innerHTML=[...groups(CLINIC_PERMISSIONS)].map(([name,items])=>'<section class="permission-guide-group"><h4>'+esc(name)+'</h4><ul>'+items.map(x=>'<li>'+esc(x[1])+(permissionHelp[x[0]]?'<small class="cs-permission-help">'+esc(permissionHelp[x[0]])+'</small>':'')+'</li>').join('')+'</ul></section>').join('');
  document.querySelectorAll('.permission-guide-count').forEach(x=>x.textContent=CLINIC_PERMISSIONS.filter(x=>x[0]!=='clinical.scope').length+'개');
 }
 function capabilitySummary(){
  const box=document.getElementById('billingContractComparison');if(!box||typeof saasMe==='undefined'||!saasMe)return;
  box.querySelector('[data-cs-contract]')?.remove();const panel=document.createElement('section');panel.dataset.csContract='';panel.className='cs-contract';
  panel.innerHTML='<h4>현재 계약의 진료·교육 기능</h4><div class="cs-capabilities">'+C.features.map(x=>{const e=saasEntitlements(),included=e?.plan?.features?.[x.key]!==false,tab=x.id==='anesthesia'?'surgery':x.id==='calculator'?'calc':x.id,permission=access(tab,'edit');return '<div><b>'+esc(x.label)+'</b><span>'+(!e?'계약 조회 필요':e.accessBlocked?'구독 상태 확인':!included?'현재 계약 미포함':permission.code==='permission'?'포함 · 내 권한 없음':'포함')+'</span></div>';}).join('')+'</div><details><summary>사용량·별도 비용 기준</summary><p>계산·저장된 자료 열람·재출력에는 AI 호출이 없습니다. 파일 인식·AI 초안·보완은 실행할 때 연결 계정의 사용료가 발생합니다.</p><p>문자·알림톡은 병원 SOLAPI 계정에서 별도 결제하며, HOME 푸시는 구독에 포함됩니다.</p><p>AI 비용의 최종 내역은 연결된 제공사에서 확인합니다. 기존 AI 초안 집계는 파일 인식 등을 포함한 전체 사용량과 다를 수 있습니다.</p></details>';
  box.append(panel);
 }
 function settings(){
  const old=document.querySelector('[data-settings-original]');if(!old||old.dataset.organized)return;old.dataset.organized='true';old.classList.add('cs-settings-grid');
  const cards=new Map([...old.querySelectorAll('[data-settings-action]')].map(b=>[b.dataset.settingsAction,b]));
  const structure=[['병원 기본정보',['clinic']],['직원·권한',['team']],['진료 기본설정',['protocol','calc','ward','records','protocols']],['자료·교육',['library','training','sop']],['HOME·자동화·연동',['home','messaging','emr','partner']],['요금제·구독',['billing']],['보안·데이터',['security']]];
  const added={calc:['약품·함량·조제 기준','practice','calc'],ward:['입원실·처치 서식','practice','ward'],records:['기록지·마취 설정','practice','surgery'],protocols:['진료 프로토콜','practice','protocols'],library:['보호자 안내자료','library'],training:['교육자료·배정','training'],sop:['우리 병원 SOP','training','sop'],visibility:['동기화 기록 HOME 공개','settings']};
  for(const [title,actions] of structure){const section=document.createElement('section');section.className='cs-settings-section';const h=document.createElement('h4');h.textContent=title;section.append(h);for(const id of actions){const existing=cards.get(id);if(existing){existing.className='cs-setting-link';existing.querySelector('em')?.remove();existing.querySelector('.settings-category-icon')?.remove();section.append(existing);}else{const [label,view,tab]=added[id],b=document.createElement('button');b.type='button';b.className='cs-setting-link';b.textContent=label;b.onclick=()=>{if(id==='visibility'){if(g.r61OpenHomeSettings)g.r61OpenHomeSettings();else toast('HOME 공개 설정을 불러오고 있습니다. 잠시 후 다시 눌러주세요.');return;}go(view,tab==='sop'?{trainingSection:'sop'}:{practiceTab:tab});};section.append(b);}}old.append(section);}

 }
 const planUndo=new WeakMap();
 function recommended(e){
  const b=e.target.closest('[data-recommended-plan]');if(!b)return;const card=b.closest('[data-plan]');
  if(card.dataset.editing==='false')card.querySelector('.hq-editor-toolbar button')?.click();
  if(card.dataset.editing==='false')return;
  const fields=[...card.querySelectorAll('[data-feature]')];planUndo.set(card,fields.map(x=>[x,x.checked]));
  const v=C.recommended(b.dataset.recommendedPlan);for(const input of fields)if(Object.hasOwn(v,input.dataset.feature)){input.checked=v[input.dataset.feature];input.dispatchEvent(new Event('change',{bubbles:true}));}
  let notice=card.querySelector('[data-cs-preview]');if(!notice){notice=document.createElement('div');notice.dataset.csPreview='';notice.className='cs-permission-preview';b.after(notice);}
  notice.textContent='권장 구성을 불러왔습니다. 아직 저장되지 않았습니다. ';const undo=document.createElement('button');undo.type='button';undo.className='cs-button';undo.textContent='불러오기 취소';
  undo.onclick=()=>{if(card.dataset.editing==='false')return;for(const [input,value] of planUndo.get(card)||[]){input.checked=value;input.dispatchEvent(new Event('change',{bubbles:true}));}planUndo.delete(card);notice.remove();};notice.append(undo);
  new MutationObserver((_,observer)=>{if(card.dataset.editing==='false'){planUndo.delete(card);notice.remove();observer.disconnect();}}).observe(card,{attributes:true,attributeFilter:['data-editing']});
 }

 if(typeof bindMemberPermissions==='function'){const old=bindMemberPermissions;g.bindMemberPermissions=function(root){old(root);decoratePermissions(root);};}
 if(typeof renderBillingContractComparison==='function'){const old=renderBillingContractComparison;g.renderBillingContractComparison=function(){old();capabilitySummary();};}
 g.ClinicSettings={access,decoratePermissions,refresh:()=>{settings();guide();capabilitySummary();}};
 document.addEventListener('click',recommended);settings();guide();capabilitySummary();decoratePermissions();
})(window);

/* Settings workflow: presentation only; existing save handlers remain authoritative. */
(function(g){
 'use strict';
 const C=g.ClinicCapabilities,S=g.ClinicSettings;if(!C||!S)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='cs-button';b.textContent=label;b.onclick=fn;return b;};
 const identity=()=>typeof saasMe==='undefined'?'':JSON.stringify([saasMe?.clinic?.id,saasMe?.user?.id]);
 const eplan=()=>typeof saasEntitlements==='function'?saasEntitlements():null;
 const featureState=(features,key)=>features?C.features.some(x=>x.key===key)?features[key]!==false:!!features[key]:null;
 let cancelJump=null;
 function reveal(el){for(let p=el?.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el?.scrollIntoView({block:'nearest'});}
 function direct(tab,selector){
  cancelJump?.();const key=identity();let stopped=false,timer,observer,returned=false;
  const finish=()=>{stopped=true;clearTimeout(timer);observer?.disconnect();if(cancelJump===finish)cancelJump=null;};
  go('practice',{practiceTab:tab});
  cancelJump=finish;
  const attempt=()=>{if(stopped)return;if(identity()!==key||!document.querySelector('#practice.active-view')){finish();return;}const el=document.querySelector('#practice '+selector);if(el&&!el.disabled&&!el.hidden){finish();reveal(el);el.click();return;}if(tab==='ward'&&!returned){const back=document.querySelector('#practice [data-cl-action="rooms-back"]');if(back){returned=true;back.click();}}};
  observer=new MutationObserver(attempt);observer.observe(document.getElementById('practice'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});
  timer=setTimeout(()=>{if(!stopped){finish();toast('설정 버튼을 열지 못했습니다. 화면의 조회 상태와 설정 권한을 확인해주세요.');}},12000);attempt();
 }
 const reasonLabels={SENDER_NUMBER_REQUIRED:'발신번호 설정 필요',SOLAPI_CONNECTION_REQUIRED:'SOLAPI 연결 필요',EXTERNAL_POLICY_DISABLED:'외부 발송 허용 꺼짐',LMS_CHANNEL_DISABLED:'LMS 채널 미선택',CLINIC_MESSAGING_DISABLED:'문자 자동발송 꺼짐',MESSAGING_FEATURE_UNAVAILABLE:'문자 이용 권한 확인 필요',HOME_PUSH_UNAVAILABLE:'HOME 푸시 사용 불가',CLINIC_NOT_ACTIVE:'병원 승인 상태 확인 필요',PREVENTIVE_MESSAGING_NOT_READY:'문자 준비 상태 확인 필요',PREVENTIVE_CONSENT_REQUIRED:'보호자 동의 확인 필요',FEATURE_OFF:'자동발송 꺼짐'};
 function automationRows(cfg){const f=cfg?.flags||{},state=k=>f[k]===true?'켜짐':f[k]===false?'꺼짐':'확인 필요';return [['접종·사상충 안내 자동발송',state('preventive_auto_delivery')],['신규 동기화 기록 HOME 공개',state('efriends_home_visible_default')]];}
 let statusRequest=null,statusKey='',statusGeneration=0,statusAt=0;
 async function loadAutomation(force=false){
  const box=document.querySelector('[data-cs-automation]');if(!box)return;const key=identity();
  if(!force&&statusRequest&&statusKey===key)return statusRequest;
  if(!force&&statusKey===key&&statusAt&&Date.now()-statusAt<30000)return;
  const same=statusKey===key,generation=++statusGeneration;statusKey=key;
  const current=()=>key===identity()&&generation===statusGeneration;
  box.setAttribute('aria-busy','true');document.querySelector('[data-cs-auto-summary]')?.setAttribute('aria-busy','true');box.querySelector('[data-cs-status-time]').textContent='갱신 중…';box.querySelector('[data-cs-status-refresh]').disabled=true;
  if(!same||!statusAt){box.querySelector('[data-cs-status-rows]').textContent='자동화 상태 확인 중…';box.querySelector('[data-cs-status-note]').textContent='';const summary=document.querySelector('[data-cs-auto-summary]');if(summary){summary.querySelector('span').textContent='자동화 상태 확인 중…';summary.classList.remove('needs-attention');}}
  statusRequest=(async()=>{try{
   if(typeof saasMode==='undefined'||saasMode!=='auth')throw Error('병원 로그인 후 확인할 수 있습니다.');
   const cfg=await saasRequest('/saas/r61/config');if(!current())return;
   box.querySelector('[data-cs-status-rows]').innerHTML=automationRows(cfg).map(([label,state])=>'<div><b>'+esc(label)+'</b><span class="cs-state '+(state==='켜짐'?'is-on':state==='꺼짐'?'is-off':'')+'">'+state+'</span></div>').join('');
   const note=box.querySelector('[data-cs-status-note]'),reasons=[...new Set(cfg.preventive?.reasons||[])];note.replaceChildren();
   const text=document.createElement('span');text.textContent='접종·사상충은 같은 스위치를 사용합니다. '+(reasons.length?reasons.map(x=>reasonLabels[x]||'발송 조건 확인 필요').join(' · '):'실제 발송은 예정일·수신 허용·채널 상태에 따릅니다.');note.append(text);
   // The status block already has its single settings action.
   const summary=document.querySelector('[data-cs-auto-summary]');if(summary){summary.querySelector('span').textContent=automationRows(cfg).map(x=>x.join(' ')).join(' · ')+(reasons.length?' · '+reasons.map(x=>reasonLabels[x]||'발송 조건 확인 필요').join(' · '):'');summary.classList.toggle('needs-attention',!!reasons.length);}
   statusAt=Date.now();box.querySelector('[data-cs-status-time]').textContent='확인 '+new Date(statusAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }catch(err){if(current()){box.querySelector('[data-cs-status-rows]').textContent='자동화 상태 조회 실패 · '+(err.message||'다시 확인해주세요.');box.querySelector('[data-cs-status-note]').textContent='상태 새로고침으로 다시 확인해주세요.';box.querySelector('[data-cs-status-time]').textContent='확인 필요';statusAt=0;const summary=document.querySelector('[data-cs-auto-summary]');if(summary){summary.querySelector('span').textContent='자동화 상태 확인 필요 · 상태를 다시 조회해주세요.';summary.classList.add('needs-attention');}}}
  finally{if(current()){box.removeAttribute('aria-busy');document.querySelector('[data-cs-auto-summary]')?.removeAttribute('aria-busy');box.querySelector('[data-cs-status-refresh]').disabled=false;statusRequest=null;}}})();return statusRequest;
 }
 let activateSection=()=>{},restoreSection=()=>{},profileKey='',protocolKey='',protocolPending=null,protocolDirty=false;
 function enterSettings(){
  const key=identity();if(profileKey!==key){hydrateSettings();hydrateWorkflowSettings();profileKey=key;protocolKey='';protocolDirty=false;protocolPending=null;}
  restoreSection();void loadAutomation();
 }
 function prepareProtocol(){
  const key=identity();if(protocolKey===key||protocolDirty||protocolPending)return;
  const request=Promise.resolve(loadClinicalProtocol(true)).then(()=>{if(identity()===key&&!document.getElementById('clinicalProtocolStatus')?.classList.contains('error'))protocolKey=key;}).finally(()=>{if(protocolPending===request)protocolPending=null;});protocolPending=request;
 }
 function enhanceHub(){
  const grid=document.querySelector('[data-settings-original]');if(!grid||grid.dataset.workflow)return;grid.dataset.workflow='true';
  const sections=[...grid.querySelectorAll('.cs-settings-section')],shell=document.createElement('div'),nav=document.createElement('nav'),select=document.createElement('select');
  shell.className='cs-settings-shell';nav.className='cs-settings-nav';nav.setAttribute('aria-label','설정 분류');select.className='cs-settings-select';select.setAttribute('aria-label','설정 분류');grid.before(shell);shell.append(nav,grid);
  sections.forEach((section,i)=>{const title=section.querySelector('h4').textContent;section.id='cs-section-'+i;const b=button(title,()=>activate(i));b.setAttribute('aria-controls',section.id);nav.append(b);select.add(new Option(title,String(i)));});nav.before(select);
  const storageKey=()=> 'carestep.settings.section:'+identity();
  function activate(index,remember=true){if(remember&&S.unified&&[1,5,6].includes(Number(index))){S.openSection(Number(index));return;}index=Math.max(0,Math.min(sections.length-1,Number(index)||0));sections.forEach((s,i)=>s.hidden=i!==index);[...nav.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));select.value=String(index);if(remember)try{sessionStorage.setItem(storageKey(),String(index));}catch{}if(index===2&&document.querySelector('#settings.active-view'))prepareProtocol();}
  activateSection=activate;restoreSection=()=>{let index=0;try{index=Number(sessionStorage.getItem(storageKey()))||0;}catch{}activate(index,false);};
  select.onchange=()=>activate(Number(select.value));activate(0,false);
  const added=[...grid.querySelectorAll('button:not([data-settings-action])')];
  const replace=(old,label,fn)=>{const b=added.find(x=>x.textContent===old);if(b){b.textContent=label;b.onclick=fn;}};
  replace('약품·함량·조제 기준','약품·함량 기본값',()=>direct('calc','[data-strength-open]'));
  replace('입원실·처치 서식','입원실 관리',()=>direct('ward','[data-cl-action="room-add"]'));
  replace('기록지·마취 설정','마취 기록 · 환자별 측정·장비 설정',()=>go('practice',{practiceTab:'surgery'}));
  const records=document.createElement('p');records.className='cs-help';records.textContent='환자별 기록 설정은 해당 기록을 연 뒤 변경합니다. 공통 처치 서식은 입원 환자의 투약 지시에서 관리합니다.';sections[2].append(records);
  for(const [tab,label] of [['dental','치과기록'],['neuro','신경검사 기록'],['ophthalmic','안과기록'],['chronic','만성질환 기록']])sections[2].append(button(label+' 열기',()=>go('practice',{practiceTab:tab})));
  const help=document.createElement('p');help.className='cs-help';help.textContent='자료 열람·작성·배정을 위한 업무 바로가기입니다.';sections[3].querySelector('h4').after(help);
  const billing=grid.querySelector('[data-settings-action="billing"] b');if(billing)billing.textContent='요금제·구독';
  const auto=document.createElement('section');auto.className='cs-automation';auto.dataset.csAutomation='';auto.innerHTML='<header><b>자동발송·HOME 공개</b><span data-cs-status-time>확인 전</span></header><div class="cs-status-rows" data-cs-status-rows>설정 화면을 열면 현재 상태를 확인합니다.</div><p class="cs-help" data-cs-status-note></p><div class="cs-actions"></div>';
  const refresh=button('상태 새로고침',()=>loadAutomation(true));refresh.dataset.csStatusRefresh='';auto.querySelector('.cs-actions').append(button('자동발송·HOME 공개 설정',()=>g.r61OpenHomeSettings?.()),refresh);sections[4].querySelector('h4').after(auto);const strip=document.createElement('div');strip.className='cs-automation-summary';strip.dataset.csAutoSummary='';strip.innerHTML='<span>자동화 상태 확인 중…</span>';strip.append(button('상태·설정 보기',()=>activate(4)));shell.before(strip);
  // Keep infrequently used long forms available without extending every category.
  for(const [selector,title] of [['#emrSyncCenter','EMR 동기화 상세'],['.operations-settings-panel','운영·연동 진단'],['.settings-panel','병원 기본정보·접종 일정 편집']]){const panel=document.querySelector('#settings '+selector);if(!panel)continue;const d=document.createElement('details');d.className='cs-settings-legacy';d.innerHTML='<summary>'+title+'</summary>';const children=[...panel.childNodes];panel.append(d);d.append(...children);}
  const profile=document.querySelector('#settings .settings-panel'),protocol=profile?.querySelector('.clinical-protocol');
  if(profile){const wrapper=profile.querySelector(':scope > details.cs-settings-legacy');if(wrapper){wrapper.querySelector(':scope > summary')?.remove();profile.replaceChildren(...wrapper.childNodes);}sections[0].append(profile);profile.classList.add('cs-inline-form');grid.querySelector('[data-settings-action=clinic]').hidden=true;}
  if(protocol){const d=document.createElement('details');d.className='cs-protocol-schedule';d.innerHTML='<summary>접종·사상충 기본 일정</summary><p class="cs-help">접종 간격·추가 접종·사상충 예방 일정을 편집합니다.</p>';sections[2].append(d);d.append(protocol);protocol.classList.add('cs-inline-form');grid.querySelector('[data-settings-action=protocol]').hidden=true;protocol.addEventListener('input',()=>protocolDirty=true);setupScheduleUndo(protocol);}
  const search=document.createElement('input');search.type='search';search.className='cs-settings-search';search.placeholder='설정 찾기 · 자동발송, 직원 권한, 약품 함량';search.setAttribute('aria-label','설정 찾기');
  const results=document.createElement('div');results.className='cs-settings-results';results.hidden=true;results.setAttribute('aria-live','polite');shell.before(search,results);
  const entries=sections.flatMap((section,i)=>[{label:section.querySelector('h4').textContent,index:i},...[...section.querySelectorAll('.cs-setting-link')].filter(b=>!b.hidden).map(b=>({label:b.textContent,index:i,target:b}))]);
  entries.push({label:'접종·사상충 일정 규칙',index:2,focus:()=>{const d=document.querySelector('.cs-protocol-schedule');d.open=true;focusSetting(d.querySelector('[data-protocol-path]'));}},{label:'자동발송 · HOME 공개',index:4,target:auto.querySelector('.cs-actions button')},{label:'직원 삭제·승인 권한',index:1,target:grid.querySelector('[data-settings-action=team]')});
  for(const [id,label,aliases] of [['hospitalName','병원명','병원이름'],['directorName','원장 이름','대표자'],['hospitalPhone','병원 전화번호','연락처 대표전화 전화'],['hospitalAddress','병원 주소','위치'],['hospitalWebsite','병원 홈페이지','웹사이트 URL'],['hospitalLogo','병원 로고','사진 이미지']])entries.push({label,index:0,aliases,focus:()=>focusSetting(document.getElementById(id))});
  entries.push({label:'문자 발신번호',aliases:'전화 SOLAPI 발신 전화번호',index:4,focus:async()=>{const scope=identity();openSettingsCategory('messaging');await loadMessagingSettings(false,true);if(scope!==identity()||!document.querySelector('#followup.active-view'))return;focusSetting(['messagingSenderSelect','messagingSenderNumber'].map(id=>document.getElementById(id)).find(el=>el&&!el.disabled&&el.getClientRects().length));}});
  for(const input of document.querySelectorAll('[data-protocol-path]')){const label=input.closest('tr')?.textContent.trim().replace(/\s+/g,' ');if(label)entries.push({label,index:2,focus:()=>{document.querySelector('.cs-protocol-schedule').open=true;focusSetting(input);}});}
  const searchKey=value=>String(value).toLowerCase().replace(/[\s·・/]+/g,'');
  search.oninput=()=>{const q=searchKey(search.value);results.replaceChildren();results.hidden=!q;if(!q)return;for(const e of entries.filter(e=>searchKey(e.label+' '+(e.aliases||'')).includes(q)).slice(0,10)){results.append(button(e.label,()=>{activate(e.index);search.value='';results.hidden=true;if(e.focus)e.focus();else e.target?.click();}));}if(!results.children.length)results.textContent='일치하는 설정이 없습니다.';};
  search.onkeydown=e=>{if(e.key==='Enter'&&!results.hidden){e.preventDefault();results.querySelector('button')?.click();}};
  document.getElementById('settingsHubTitle').textContent='설정 항목';
 }
 function focusSetting(el){if(!el)return;reveal(el);el.focus({preventScroll:true});el.classList.add('cs-search-target');setTimeout(()=>el.classList.remove('cs-search-target'),2400);}
 function setupScheduleUndo(protocol){
  const reset=document.getElementById('resetClinicalProtocol');if(!reset)return;reset.textContent='기본 일정 불러오기';let before=null,scope='';
  const undo=button('불러오기 취소',()=>{if(!before||scope!==identity())return;for(const [input,value] of before){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}before=null;undo.hidden=true;toast('불러오기 전 일정으로 돌아왔습니다.');});undo.hidden=true;reset.after(undo);
  reset.addEventListener('click',()=>{before=[...protocol.querySelectorAll('[data-protocol-path]')].map(x=>[x,x.value]);scope=identity();undo.hidden=false;protocolDirty=true;queueMicrotask(()=>protocol.querySelector('[data-protocol-path]')?.dispatchEvent(new Event('input',{bubbles:true})));},true);
  g.addEventListener('carestep:clinical-protocol-updated',()=>{before=null;undo.hidden=true;});
 }
 const templates={
  reception:{label:'접수 직원',keys:['patients.edit','materials.read','followup.read','messages.read','training.read','operations.read']},
  assistant:{label:'진료 보조',keys:['patients.read','materials.read','training.read','operations.read',...C.modules.filter(x=>x[0]!=='protocols').map(x=>'clinical.'+x[0]+'.edit'),'clinical.protocols.read']},
  vet:{label:'수의사',keys:[...C.modules.map(x=>'clinical.'+x[0]+'.edit'),'clinical.approve','clinical.settings','patients.edit','records.publish','materials.publish','followup.manage','training.review','training.manage','operations.read']},
  manager:{label:'관리자',keys:['patients.read','materials.read','training.manage','operations.manage','settings.manage','billing.manage','team.manage','stats.read','messages.read']}
 };
 function permissionStatus(keys,feature,entitlements){
  if(!keys)return '권한 없음';if(!entitlements?.plan)return '계약 조회 필요';if(entitlements.accessBlocked)return '구독 상태 확인';if(entitlements.plan.features?.[feature]===false)return '계약 미포함';return '가능';
 }
 function effectiveAccess(keys,id,feature,ent){
  const read=keys.includes('clinical.'+id+'.read'),restricted=ent?.accessBlocked||ent?.plan?.features?.[feature]===false;
  const action=(key,label)=>label+' '+permissionStatus(keys.includes(key),feature,ent);
  return '조회 '+(!read?'권한 없음':!ent?.plan?'계약 조회 필요':restricted?'기존 기록 가능':'가능')+' · '+action('clinical.'+id+'.edit','작성·수정')+' · '+action('clinical.'+id+'.delete','삭제')+(id==='protocols'?' · '+action('clinical.approve','승인'):'');
 }

 function enhancePermissions(root=document){for(const card of root.querySelectorAll('[data-member-id]')){
  const grid=card.querySelector('.member-permission-grid'),mode=card.querySelector('[data-permission-mode]');if(!grid||!mode||grid.dataset.quick)continue;grid.dataset.quick='true';
  const inputs=[...grid.querySelectorAll('[data-permission-key]')],quick=document.createElement('section');quick.className='cs-permission-quick';
  quick.innerHTML='<label>업무별 권한 서식<select data-cs-template><option value="">서식 선택</option>'+Object.entries(templates).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('')+'</select></label><button type="button" class="cs-button" data-cs-template-use>서식 불러오기</button><p class="cs-help">선택한 직원의 역할은 바꾸지 않습니다. 서식을 불러오면 선택 권한이 교체되며, 직원 저장 후 적용됩니다. 삭제 권한은 상세에서 별도로 선택하세요.</p><div class="cs-module-access"></div>';
  grid.before(quick);const details=document.createElement('details');details.className='cs-permission-details';details.innerHTML='<summary>상세 권한 · 삭제·승인·공통 설정</summary>';grid.before(details);details.append(grid);
  const search=document.createElement('input');search.type='search';search.placeholder='권한 검색';search.setAttribute('aria-label','상세 권한 검색');grid.before(search);search.oninput=()=>{const q=search.value.trim().toLowerCase();grid.querySelectorAll('fieldset').forEach(group=>{let count=0;group.querySelectorAll('label').forEach(l=>{l.hidden=!l.textContent.toLowerCase().includes(q);if(!l.hidden)count++;});group.hidden=!count;});};
  const readKeys=()=>inputs.filter(x=>x.checked).map(x=>x.dataset.permissionKey);
  const apply=keys=>{if(mode.disabled)return;mode.value='custom';mode.dispatchEvent(new Event('change',{bubbles:true}));const expanded=clinicExpandPermissions(keys);inputs.forEach(x=>x.checked=expanded.includes(x.dataset.permissionKey));card.dispatchEvent(new Event('change',{bubbles:true}));update();};
  quick.querySelector('[data-cs-template-use]').onclick=()=>{const t=templates[quick.querySelector('select').value];if(t)apply(t.keys);};
  for(const [id,label] of C.modules){const l=document.createElement('label');l.textContent=label;const s=document.createElement('select');s.dataset.csModule=id;s.innerHTML='<option value="none">접근 불가</option><option value="read">조회</option><option value="edit">작성·수정</option>';s.onchange=()=>{const prefix='clinical.'+id+'.';let keys=readKeys().filter(k=>!k.startsWith(prefix));if(s.value!=='none')keys.push(prefix+s.value);if(id==='protocols'&&s.value!=='edit')keys=keys.filter(k=>k!=='clinical.approve');apply(keys);};l.append(s);quick.querySelector('.cs-module-access').append(l);}
  const preview=card.querySelector('.cs-permission-preview'),role=card.querySelector('[data-member-role]');
  const snapshot=()=>({mode:mode.value,role:role?.value,keys:readKeys().sort()});const baseline=snapshot();let undo=null;
  const preset=document.createElement('details');preset.className='cs-permission-presets';preset.innerHTML='<summary>업무 서식 불러오기</summary>';quick.prepend(preset);for(const el of [quick.querySelector(':scope > label'),quick.querySelector('[data-cs-template-use]'),quick.querySelector(':scope > p')])if(el)preset.append(el);
  const undoButton=button('불러오기 취소',()=>{if(!undo)return;const prev=undo;undo=null;mode.value=prev.mode;mode.dispatchEvent(new Event('change',{bubbles:true}));inputs.forEach(x=>x.checked=prev.keys.includes(x.dataset.permissionKey));delta.textContent='불러오기 전 선택으로 돌아왔습니다.';update();});undoButton.hidden=true;preset.append(undoButton);
  const delta=document.createElement('p');delta.className='cs-help';delta.setAttribute('aria-live','polite');preset.append(delta);
  quick.querySelector('[data-cs-template-use]').onclick=()=>{const t=templates[quick.querySelector('select').value];if(!t||mode.disabled)return;undo=snapshot();apply(t.keys);const after=readKeys(),added=after.filter(k=>!undo.keys.includes(k)),removed=undo.keys.filter(k=>!after.includes(k)),label=k=>inputs.find(x=>x.dataset.permissionKey===k)?.closest('label')?.textContent.trim()||k;delta.textContent='추가 '+added.length+'개 · 제외 '+removed.length+'개'+(added.length?' / 추가: '+added.map(label).join(', '):'')+(removed.length?' / 제외: '+removed.map(label).join(', '):'');undoButton.hidden=false;};
  function update(){const changed=JSON.stringify(snapshot())!==JSON.stringify(baseline);undoButton.hidden=!undo;const keys=mode.value==='custom'?clinicExpandPermissions(readKeys()):clinicPermissionKeys({mode:mode.value},card.querySelector('[data-member-role]')?.value),ent=eplan();quick.querySelectorAll('select,button').forEach(x=>x.disabled=mode.disabled);quick.querySelectorAll('[data-cs-module]').forEach(s=>{const prefix='clinical.'+s.dataset.csModule+'.';s.value=keys.includes(prefix+'edit')?'edit':keys.includes(prefix+'read')?'read':'none';const saved=baseline.mode==='custom'?clinicExpandPermissions(baseline.keys):clinicPermissionKeys({mode:baseline.mode},baseline.role);s.closest('label').classList.toggle('cs-permission-changed',s.value!==(saved.includes(prefix+'edit')?'edit':saved.includes(prefix+'read')?'read':'none'));});
   preview.innerHTML='<strong>'+(changed?'변경 중 · 직원 저장 후 적용':'현재 저장된 권한')+'</strong><div class="cs-permission-effective">'+C.modules.map(([id,label,key])=>{const prefix='clinical.'+id+'.',has=keys.includes(prefix+'read');return '<div><b>'+label+'</b><span>'+effectiveAccess(keys,id,key,ent)+'</span></div>';}).join('')+'</div><p>진료 승인 '+(keys.includes('clinical.approve')?'가능':'불가')+' · 병원 약품·서식 설정 '+(keys.includes('clinical.settings')?'가능':'불가')+'</p><small>'+(changed?'변경사항을 적용하려면 직원 저장을 누르세요.':'')+' 계약 미포함 기능의 기존 기록 조회는 유지됩니다.</small>';
  }
  card.addEventListener('change',()=>queueMicrotask(update));
  const effective=document.createElement('details');effective.className='cs-effective-details';effective.innerHTML='<summary>실제 이용 범위 확인</summary>';preview.before(effective);effective.append(preview);
  const state=document.createElement('p');state.className='cs-permission-state';quick.before(state);card.addEventListener('change',()=>queueMicrotask(()=>state.textContent=JSON.stringify(snapshot())!==JSON.stringify(baseline)?'변경 중 · 직원 저장 후 적용':'현재 저장된 권한'));state.textContent='현재 저장된 권한';update();
 }}
 function comparison(current,catalog){
  const rows=C.features.map(x=>({label:x.label,a:featureState(current,x.key),b:featureState(catalog,x.key)}));
  const cell=v=>v===null?'조회 필요':v?'포함':'미포함';const unknown=rows.filter(x=>x.a===null||x.b===null),different=rows.filter(x=>x.a!==null&&x.b!==null&&x.a!==x.b),same=rows.filter(x=>x.a===x.b&&x.a!==null);
  const table=list=>'<div class="cs-comparison"><table><thead><tr><th>진료·교육 기능</th><th>현재 병원 계약</th><th>신규 계약 기준</th></tr></thead><tbody>'+list.map(x=>'<tr'+(x.a!==null&&x.b!==null&&x.a!==x.b?' class="cs-different"':'')+'><th scope="row">'+esc(x.label)+'</th><td>'+cell(x.a)+'</td><td>'+cell(x.b)+'</td></tr>').join('')+'</tbody></table></div>';
  return '<div class="cs-contract-differences"><b>신규 기준과 다른 기능 '+different.length+'개</b>'+(different.length?table(different):unknown.length?'':'<p class="cs-help">현재 계약과 신규 기준의 진료·교육 기능이 같습니다.</p>')+(unknown.length?'<section class="cs-contract-unknown"><b>확인 필요 '+unknown.length+'개</b><p>계약 정보를 불러오지 못해 아직 비교할 수 없습니다.</p><button type="button" class="cs-button" data-cs-contract-retry>계약 정보 다시 조회</button>'+table(unknown)+'</section>':'')+(same.length?'<details><summary>동일한 기능 '+same.length+'개 보기</summary>'+table(same)+'</details>':'')+'<p class="cs-help">계약 변경 전까지 현재 기능·가격·제공량을 유지합니다.</p></div>';
 }
 function enhanceContract(){
  const box=document.querySelector('[data-cs-contract]');if(!box)return;const ent=eplan();
  box.querySelectorAll('.cs-capabilities>div').forEach((el,i)=>{const state=el.querySelector('span');if(state?.textContent==='포함 · 내 권한 없음'){el.append(button('직원 권한 보기',()=>openSettingsCategory('team')));}else if(state?.textContent==='현재 계약 미포함'||state?.textContent==='구독 상태 확인'){el.append(button('계약 확인',()=>openSettingsCategory('billing')));}});
  const parent=box.parentElement;const cap=box.querySelector('.cs-capabilities');if(cap&&!cap.parentElement.matches('details')){const d=document.createElement('details');d.innerHTML='<summary>현재 포함 기능·내 권한 보기</summary>';cap.before(d);d.append(cap);}
  if(typeof billingOverviewState!=='undefined'&&billingOverviewState?.subscription){const d=billingOverviewState,code=d.subscription.planCode,details=parent.querySelector(':scope > details');if(details){details.querySelector('[data-cs-diff]')?.remove();details.querySelector('summary').textContent='신규 요금제와 비교';const diff=document.createElement('div');diff.dataset.csDiff='';diff.innerHTML=comparison(ent?.plan?.features,d.plans?.[code]?.features);details.prepend(diff);details.prepend(details.querySelector('summary'));} }
 }
 function featureGroup(key){if(key==='clinicalCalculator')return '처방·처치 계산';if(key.startsWith('clinical'))return '진료 기록·검사';if(key.startsWith('training'))return '직원 교육';if(['followupAutomation','automatedMessaging','patientJourneyBuilder','preventiveRecall','cloudSync'].includes(key))return '자동화·연동';if(['teamManagement','pilotAnalytics','customerVoice'].includes(key))return '운영 관리';return '보호자 자료·HOME';}
 function groupPlans(){document.querySelectorAll('[data-plan] .feature-grid').forEach(grid=>{if(grid.dataset.csGrouped)return;grid.dataset.csGrouped='true';const groups=new Map();for(const label of [...grid.querySelectorAll('label.feature')]){const input=label.querySelector('[data-feature]');if(!input)continue;const name=featureGroup(input.dataset.feature);if(!groups.has(name)){const f=document.createElement('fieldset');f.innerHTML='<legend>'+name+' <span></span></legend>';groups.set(name,f);grid.append(f);}groups.get(name).append(label);}const count=()=>groups.forEach(f=>{f.querySelector('legend span').textContent=[...f.querySelectorAll('input')].filter(x=>x.checked).length+'/'+f.querySelectorAll('input').length;});grid.addEventListener('change',count);count();});}
 if(typeof bindMemberPermissions==='function'){const old=bindMemberPermissions;g.bindMemberPermissions=function(root){old(root);enhancePermissions(root);};}
 if(typeof renderBillingContractComparison==='function'){const old=renderBillingContractComparison;g.renderBillingContractComparison=function(){old();enhanceContract();};}
 if(typeof renderPlans==='function'){const old=renderPlans;g.renderPlans=function(){old();groupPlans();};}
 if(typeof hqContractSummary==='function'){const old=hqContractSummary;g.hqContractSummary=function(d,catalog){const code=d.subscription?.planCode||d.clinic?.plan,current=catalog?.find(p=>p.planCode===code);return old(d,catalog).replace('공통 기능 변경은 기존 병원에도 반영되며, 계약가격·제공량은 보존됩니다.','진료·교육 기능과 계약가격·제공량은 현재 계약을 기준으로 유지합니다.').replace('</section>',comparison(d.entitlements?.plan?.features,current?.features)+'</section>');};}
 if(typeof settingsScrollTo==='function'){const old=settingsScrollTo;g.settingsScrollTo=function(selector){const el=document.querySelector(selector);const own=el?.querySelector(':scope > details.cs-settings-legacy');if(own)own.open=true;for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;old(selector);};}
 if(typeof go==='function'){const old=go;g.go=function(view,...args){const result=old(view,...args);if(view!=='settings')cancelJump?.();return result;};}
 const refresh=S.refresh;S.refresh=()=>{refresh();enhanceHub();enhancePermissions();enhanceContract();groupPlans();};
 S.enter=enterSettings;S.openSection=(index)=>{go('settings');activateSection(index);};
 if(typeof openSettingsCategory==='function'){const old=openSettingsCategory;g.openSettingsCategory=function(action){if(settingsCanManage()&&(action==='clinic'||action==='protocol')){S.openSection(action==='clinic'?0:2);return;}return old(action);};}
 S.effectiveAccess=effectiveAccess;S.automationRows=automationRows;S.permissionStatus=permissionStatus;S.comparison=comparison;S.templates=templates;S.direct=direct;
 g.addEventListener('carestep:automation-settings-saved',()=>{statusAt=0;if(document.querySelector('#settings.active-view'))void loadAutomation(true);});
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-cs-contract-retry]');if(!b)return;b.disabled=true;b.textContent='조회 중…';try{if(typeof loadBillingOverview==='function')await loadBillingOverview(true);else if(typeof loadClinicDetail==='function'&&typeof selectedClinic!=='undefined'&&selectedClinic)await loadClinicDetail(selectedClinic);}catch{toast('계약 정보를 불러오지 못했습니다. 다시 시도해주세요.');}finally{if(b.isConnected){b.disabled=false;b.textContent='계약 정보 다시 조회';}}});
 enhanceHub();enhancePermissions();enhanceContract();groupPlans();
})(window);

/* One hospital-settings navigation, retaining existing account routes and handlers. */
(function(g){
 'use strict';
 function mount(){
 const S=g.ClinicSettings,root=document.getElementById('settings'),account=document.getElementById('account');
 if(!S||!root||!account)return;
 const tabs={1:'team',5:'billing',6:'security'},indices={team:1,billing:5,security:6};
 const titles=['병원 기본정보','직원·권한','진료 기본설정','자료·교육','HOME·자동화·연동','요금제·구독','보안·데이터'];
 const key=()=> 'carestep.settings.section:'+JSON.stringify([saasMe?.clinic?.id,saasMe?.user?.id]);
 const allowed=i=>tabs[i]?g.ClinicNavigation.accountAllowed(tabs[i]):saasCanView('settings');
 const remember=i=>{try{sessionStorage.setItem(key(),String(i));}catch{}};
 const saved=()=>{try{return Number(sessionStorage.getItem(key()))||0;}catch{return 0;}};
 const resolve=i=>Number.isInteger(i)&&i>=0&&i<titles.length&&allowed(i)?i:titles.findIndex((_,n)=>allowed(n));
 S.unified=true;S.canEnter=()=>titles.some((_,i)=>allowed(i));
 const shell=document.createElement('div'),nav=document.createElement('nav'),select=document.createElement('select'),content=document.createElement('div');
 shell.className='cs-settings-shell cs-account-shell';nav.className='cs-settings-nav';nav.setAttribute('aria-label','설정 분류');select.className='cs-settings-select';select.setAttribute('aria-label','설정 분류');content.className='cs-account-content';
 titles.forEach((title,i)=>{const b=document.createElement('button');b.type='button';b.className='cs-button';b.textContent=title;b.onclick=()=>S.openSection(i);nav.append(b);select.add(new Option(title,String(i)));});
 select.onchange=()=>S.openSection(Number(select.value));shell.append(select,nav,content);account.append(shell);
 for(const pane of [...account.querySelectorAll('[data-account-pane]')])content.append(pane);
 const withdrawal=document.getElementById('personalWithdrawalBox'),deletion=document.getElementById('clinicDeletionBox');
 function fold(node,title,tab){if(!node)return;const details=document.createElement('details');details.className='cs-important-action';const summary=document.createElement('summary');summary.textContent=title;details.append(summary,node);account.querySelector('[data-account-pane="'+tab+'"]').append(details);}
 fold(withdrawal,'개인 계정 탈퇴','my');fold(deletion,'병원 데이터 삭제 요청','security');
 account.querySelector('.legal-safety-note')?.remove();
 document.getElementById('accountImportantActions')?.remove();
 const home=root.querySelector('#cs-section-4');
 for(const id of ['r61-controls','emrSyncCenter']){const el=document.getElementById(id);if(el)home.append(el);}
 const diagnostics=root.querySelector('.operations-settings-panel');if(diagnostics)account.querySelector('[data-account-pane=security]').append(diagnostics);
 root.querySelector('[data-cs-auto-summary]')?.remove();
 // A category is the entry point; do not show another identically named link card.
 for(const tab of ['team','billing','security'])root.querySelector('[data-settings-action="'+tab+'"]')?.setAttribute('hidden','');
 const mainNav=root.querySelector('.cs-settings-nav'),mainSelect=root.querySelector('.cs-settings-select');
 mainNav.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopImmediatePropagation();S.openSection([...mainNav.children].indexOf(b));},true);
 mainSelect.addEventListener('change',e=>{e.stopImmediatePropagation();S.openSection(Number(mainSelect.value));},true);
 function permissions(){for(const [menu,dropdown] of [[mainNav,mainSelect],[nav,select]])titles.forEach((_,i)=>{menu.children[i].hidden=!allowed(i);dropdown.options[i].disabled=!allowed(i);dropdown.options[i].hidden=!allowed(i);});}
 function syncAccount(tab){
  const index=indices[tab],hospital=index!==undefined;shell.classList.toggle('cs-personal-shell',!hospital);account.classList.toggle('cs-unified-account',true);account.classList.toggle('cs-hospital-account',hospital);
  nav.hidden=select.hidden=!hospital;
  if(hospital){const heading=account.querySelector('[data-account-pane="'+tab+'"] .account-pane-head h3');if(heading)heading.textContent=titles[index];remember(index);select.value=String(index);[...nav.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));}
  permissions();
 }
 const setTab=g.setAccountTab;g.setAccountTab=function(tab='my',focus=''){const result=setTab(tab,focus);const active=account.querySelector('[data-account-tab].active')?.dataset.accountTab||'my';syncAccount(active);return result;};
 const oldGo=g.go;g.go=function(view,options={}){
  if(view==='settings'){
   const i=resolve(options.settingsSection===undefined?saved():Number(options.settingsSection));if(i<0)return false;
   remember(i);permissions();
   if(tabs[i])return oldGo('account',{...options,accountTab:tabs[i]});
  }
  return oldGo(view,options);
 };
 S.openSection=i=>g.go('settings',{settingsSection:i});
 const oldCategory=g.openSettingsCategory;g.openSettingsCategory=function(action){const map={clinic:0,team:1,protocol:2,billing:5,security:6,emr:4};if(Object.hasOwn(map,action)){const i=map[action];if(!allowed(i))return;S.openSection(i);if(action==='emr'){loadEmrSyncStatus(false);settingsScrollTo('#emrSyncCenter');}return;}return oldCategory(action);};
 const oldLoad=g.saasLoadAccountTab;g.saasLoadAccountTab=function(tab='my',force=false){const result=oldLoad(tab,force);if(tab==='security'&&saasMode==='auth'&&saasMe?.role==='owner'){
  const scope=clinicReadScope(),valid=()=>scope===clinicReadScope();void g.CarestepAccountReads?.load(tab,{scope:scope+JSON.stringify([saasMe.role,saasMe.permissions]),valid,force,jobs:[{id:'deletion',label:'삭제 요청',run:async()=>{const d=await saasRequest('/saas/clinic/deletion-request',{method:'GET'});if(valid()){clinicDeletionState=d;renderProductionGovernance();}}}]});
 }return result;};
 syncAccount(account.querySelector('[data-account-tab].active')?.dataset.accountTab||'my');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(window);

/* Confirm the scope of the existing hospital-profile reset before it can run. */
(function(g){
 const S=g.ClinicSettings;if(!S)return;let pending=null;
 const identity=()=>JSON.stringify([typeof saasMode==='undefined'?'':saasMode,typeof saasMe==='undefined'?'':saasMe?.clinic?.id,typeof saasMe==='undefined'?'':saasMe?.user?.id]);
 S.confirmHospitalReset=()=>{
  if(pending)return Promise.resolve(false);
  const key=identity(),previous=document.activeElement,d=document.createElement('dialog');d.className='cs-reset-dialog';d.setAttribute('aria-labelledby','cs-reset-title');
  d.innerHTML='<h2 id="cs-reset-title">병원정보를 초기화할까요?</h2><p>병원명·대표원장·전화번호·주소·홈페이지·로고와 PDF QR 설정을 기본값으로 바꾸고 저장합니다.</p><p>환자·진료 기록, 직원 권한, 약품 함량과 접종 일정은 유지됩니다. 초기화 후 병원정보를 다시 입력해야 합니다.</p><div class="cs-reset-actions"><button type="button" data-reset-cancel autofocus>취소</button><button type="button" data-reset-confirm>병원정보 초기화</button></div>';
  let settle;const result=new Promise(resolve=>settle=resolve);pending=d;
  const finish=ok=>{if(pending!==d)return;pending=null;d.remove();if(previous?.isConnected)previous.focus({preventScroll:true});settle(ok&&identity()===key);};
  d.querySelector('[data-reset-cancel]').onclick=()=>finish(false);d.querySelector('[data-reset-confirm]').onclick=()=>finish(true);d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});d.addEventListener('close',()=>finish(false));document.body.append(d);d.showModal();return result;
 };
})(window);
