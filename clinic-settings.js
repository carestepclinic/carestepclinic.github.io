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
 function groups(catalog){const m=new Map();for(const [k,label] of catalog.filter(x=>x[0]!=='clinical.scope')){const group=permissionGroup(k);if(!m.has(group))m.set(group,[]);m.get(group).push([k,label]);}return m;}
 function decoratePermissions(root=document){
  for(const card of root.querySelectorAll('[data-member-id]')){
   const grid=card.querySelector('.member-permission-grid');if(!grid||grid.dataset.grouped)continue;grid.dataset.grouped='true';
   const sections=new Map();for(const input of [...grid.querySelectorAll('[data-permission-key]')]){const name=permissionGroup(input.dataset.permissionKey);if(!sections.has(name)){const section=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=name;section.append(legend);sections.set(name,section);grid.append(section);}sections.get(name).append(input.closest('label'));}
   const preview=document.createElement('div');preview.className='cs-permission-preview';preview.setAttribute('aria-live','polite');grid.before(preview);
   const update=()=>{const mode=card.querySelector('[data-permission-mode]')?.value,role=card.querySelector('[data-member-role]')?.value,keys=mode==='custom'?clinicExpandPermissions([...card.querySelectorAll('[data-permission-key]:checked')].map(x=>x.dataset.permissionKey)):clinicPermissionKeys({mode},role);const rows=C.modules.filter(x=>keys.includes('clinical.'+x[0]+'.read'));preview.innerHTML='<strong>저장 후 사용할 진료 화면</strong><p>'+ (rows.map(([id,label])=>esc(label)+' · '+(keys.includes('clinical.'+id+'.edit')?'작성 가능':'조회만')).join(' / ')||'진료 화면 접근 없음')+'</p><small>승인·삭제는 아래 개별 권한을 따릅니다. 저장 전까지 실제 권한은 바뀌지 않습니다.</small>';};
   card.addEventListener('change',()=>queueMicrotask(update));update();
  }
 }
 function guide(){
  const box=document.querySelector('.permission-guide-groups');if(!box||typeof CLINIC_PERMISSIONS==='undefined')return;
  box.innerHTML=[...groups(CLINIC_PERMISSIONS)].map(([name,items])=>'<section class="permission-guide-group"><h4>'+esc(name)+'</h4><ul>'+items.map(x=>'<li>'+esc(x[1])+'</li>').join('')+'</ul></section>').join('');
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
  const structure=[['병원 기본정보',['clinic']],['직원·권한',['team']],['진료 기본설정',['protocol','calc','ward','records','protocols']],['자료·교육',['library','training','sop']],['HOME·자동화·연동',['home','visibility','messaging','calendar','emr','partner']],['요금제·구독',['billing']]];
  const added={calc:['약품·함량·조제 기준','practice','calc'],ward:['입원실·처치 서식','practice','ward'],records:['기록지·마취 설정','practice','surgery'],protocols:['진료 프로토콜','practice','protocols'],library:['보호자 안내자료','library'],training:['교육자료·배정','training'],sop:['우리 병원 SOP','training','sop'],visibility:['동기화 기록 HOME 공개','settings']};
  for(const [title,actions] of structure){const section=document.createElement('section');section.className='cs-settings-section';const h=document.createElement('h4');h.textContent=title;section.append(h);for(const id of actions){const existing=cards.get(id);if(existing){existing.className='cs-setting-link';existing.querySelector('em')?.remove();existing.querySelector('.settings-category-icon')?.remove();section.append(existing);}else{const [label,view,tab]=added[id],b=document.createElement('button');b.type='button';b.className='cs-setting-link';b.textContent=label;b.onclick=()=>{if(id==='visibility'){if(g.r61OpenHomeSettings)g.r61OpenHomeSettings();else toast('HOME 공개 설정을 불러오고 있습니다. 잠시 후 다시 눌러주세요.');return;}go(view,tab==='sop'?{trainingSection:'sop'}:{practiceTab:tab});};section.append(b);}}old.append(section);}
  const security=cards.get('security');if(security){const details=document.createElement('details');details.className='cs-settings-advanced';details.innerHTML='<summary>보안·운영 점검</summary>';security.className='cs-setting-link';details.append(security);old.parentElement.append(details);}
 }
 function recommended(e){const b=e.target.closest('[data-recommended-plan]');if(!b)return;const card=b.closest('[data-plan]');if(card.dataset.editing==='false'){card.querySelector('.hq-editor-toolbar button')?.click();}const v=C.recommended(b.dataset.recommendedPlan);for(const [key,on] of Object.entries(v)){const input=card.querySelector('[data-feature="'+key+'"]');if(input){input.checked=on;input.dispatchEvent(new Event('change',{bubbles:true}));}}let notice=card.querySelector('[data-cs-preview]');if(!notice){notice=document.createElement('p');notice.dataset.csPreview='';notice.className='cs-permission-preview';b.after(notice);}notice.textContent='권장 구성을 불러왔습니다. 아직 저장되지 않았습니다. 저장하면 신규·변경 계약에 적용되며 기존 진료 기능은 유지됩니다.';}
 if(typeof bindMemberPermissions==='function'){const old=bindMemberPermissions;g.bindMemberPermissions=function(root){old(root);decoratePermissions(root);};}
 if(typeof renderBillingContractComparison==='function'){const old=renderBillingContractComparison;g.renderBillingContractComparison=function(){old();capabilitySummary();};}
 g.ClinicSettings={access,decoratePermissions,refresh:()=>{settings();guide();capabilitySummary();}};
 document.addEventListener('click',recommended);settings();guide();capabilitySummary();decoratePermissions();
})(window);
