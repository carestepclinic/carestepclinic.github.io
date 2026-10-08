/* R61 integrated Clinic controls. All server actions require existing session. */
(()=>{'use strict';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const api=(path,body)=>saasRequest('/saas/r61'+path,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});
 const selection=()=>window.crmWorkspaceSelection?.()||window.crmCurrentPatient?.()||{};
 window.r61TaskStillActive=async x=>{
  await loadFollowupScheduleBoard(false);
  const item=workFirstBuckets().all.find(r=>String(r.id)===x.taskId&&r.patientId===x.patientId&&r.guardianId===x.guardianId);
  return !!item&&(!x.type||item.sourceType===x.type)&&!['resolved','completed','canceled','deleted'].includes(item.action?.status||item.operationalStatus||item.status);
 };
 function dialog(title){const d=el('dialog'),h=el('h2',title),body=el('div'),close=el('button','닫기');d.append(h,body,close);close.onclick=()=>d.close();d.addEventListener('close',()=>d.remove());document.body.append(d);d.style.cssText='max-width:720px;width:90%;max-height:85vh;overflow:auto;padding:24px;border-radius:14px';d.showModal();return {d,body};}
 function button(parent,label,action){const b=el('button',label);b.type='button';b.className='btn btn-secondary';parent.append(b);b.onclick=async()=>{b.disabled=true;try{await action();}catch{alert('처리하지 못했습니다. 권한·선택 대상과 저장 상태를 확인해주세요. 자동 재시도하지 않습니다.');}finally{b.disabled=false;}};return b;}
 async function materials(){
  const s=selection();if(!s.patientId){alert('환자 작업공간에서 환자를 먼저 선택해주세요.');return;}
  const {body}=dialog('보호자 자료 보내기'),list=await api('/materials?patientId='+encodeURIComponent(s.patientId)),select=el('select'),channel=el('select'),preview=el('pre');
  preview.style.whiteSpace='pre-wrap';for(const m of list.materials){const o=el('option',m.title);o.value=m.id;select.append(o);}
  for(const [value,label] of [['home','Carestep Home'],['lms','LMS'],['kakao','알림톡 — 승인된 전용 템플릿 필요'],['mms','MMS — 승인된 이미지 필요']]){const o=el('option',label);o.value=value;channel.append(o);}
  body.append(el('p','환자·보호자를 미리보기에서 확인한 뒤 전송을 확정하세요. 내부 자료는 표시하지 않습니다.'),select,channel,preview);
  let p=null;
  select.onchange=channel.onchange=()=>{p=null;preview.textContent='선택이 바뀌었습니다. 다시 미리보기해주세요.';};
  button(body,'미리보기',async()=>{p=await api('/preview',{patientId:s.patientId,materialId:select.value,channel:channel.value});preview.textContent=p.patientName+' / 보호자 '+p.guardianName+'\n'+'채널: '+p.channel+'\n'+p.title+'\n\n'+p.text+(p.duplicateWarning?'\n\n주의: 이전 발송 기록이 있습니다.':'');});
  button(body,'확인 후 발송',async()=>{if(!p){alert('미리보기를 먼저 확인해주세요.');return;}if(!confirm(p.duplicateWarning?'중복 발송 기록이 있습니다. 같은 보호자에게 다시 보내시겠습니까?':'표시된 환자·보호자와 자료를 확인했으며 발송하시겠습니까?'))return;const d=await api('/deliver',{previewId:p.previewId,confirmed:true,duplicateAcknowledged:!!p.duplicateWarning});preview.textContent='처리 결과: '+d.status;p=null;});
  button(body,'발송·열람 이력',async()=>{const d=await api('/deliveries?patientId='+encodeURIComponent(s.patientId));preview.textContent=d.deliveries.map(x=>[x.created_at,x.kind,x.channel,x.status,x.viewed_at?'열람 확인':'열람 미확인'].join(' · ')).join('\n')||'발송 이력이 없습니다.';});
 }
 async function preventivePreview(){
  const {body}=dialog('예방관리 발송 예정 미리보기'),date=el('input');date.type='date';date.value=new Date(Date.now()+32400000).toISOString().slice(0,10);body.append(date,el('p','조회만 수행합니다. 실제 발송은 하지 않습니다. 외부 채널은 병원 설정·보호자 동의·전송 직전 적격성 확인이 필요합니다.'));
  const rows=el('section');body.append(rows);
  button(body,'예정 대상 조회',async()=>{const d=await api('/preventive/preview?date='+encodeURIComponent(date.value));rows.replaceChildren();for(const x of d.targets){rows.append(el('p',[x.patientName,'보호자 '+x.guardianName,x.dueDate,x.stage,'우선 채널: '+(x.primaryChannel||'Home 사용 불가'),'외부 후보: '+(x.externalCandidates.join(', ')||'차단'),'사유: '+x.reason.join(', '),x.featureEnabled?'기능 ON':'기능 OFF'].join(' · ')));}if(!d.targets.length)rows.append(el('p','해당 날짜의 발송 예정 대상이 없습니다.'));});
 }
 async function settings(){
  const cfg=await api('/config'),{body}=dialog('후속 기능 설정'),inputs={};
  const labels={preventive_auto_delivery:'접종·사상충 자동 발송',followup_auto_completion:'최종확인 후 자동 완료·초기화',guardian_material_delivery:'보호자 자료 즉시 송부',efriends_home_visible_default:'공개 분류된 신규 eFriends 기록 Home 표시'};
  for(const [key,value] of Object.entries(cfg.flags)){const l=el('label'),c=el('input');c.type='checkbox';c.checked=value;inputs[key]=c;l.append(c,document.createTextNode(labels[key]));l.style.display='block';body.append(l);}
  body.append(el('p','단계별 승인 후 기능을 켭니다. 자료 송부와 자동 알림은 별도 운영 승인 전까지 OFF를 유지하세요.'));
  button(body,'예방관리 대상 먼저 확인',preventivePreview);
  const external=el('input');external.type='checkbox';external.checked=cfg.policy.enabled===true;const l=el('label',' 병원 외부 LMS 발송 허용 (보호자별 별도 동의 필요)');l.prepend(external);body.append(l);
  const channels={};for(const [key,label] of [['lms','LMS'],['kakao','알림톡'],['mms','MMS']]){const c=el('input');c.type='checkbox';c.checked=(cfg.policy.channels||['lms']).includes(key);channels[key]=c;const l=el('label',' '+label);l.prepend(c);body.append(l);}
  const bindings={};for(const [key,label] of [['preventive','예방관리 알림톡 템플릿 ID'],['material','보호자 자료 알림톡 템플릿 ID']]){const l=el('label',label),i=el('input');i.value=cfg.policy.templateBindings?.[key]||'';bindings[key]=i;l.append(i);body.append(l);}
  const image=el('input');image.value=cfg.policy.imageId||'';image.placeholder='공개 승인 MMS 이미지 ID';body.append(image,el('p','알림톡은 실제 승인 템플릿과 안내문구 변수 한 개를 서버에서 재확인합니다. MMS 이미지는 환자정보가 없는 보호자 공개용으로 검토해야 합니다.'));
  button(body,'설정 저장',async()=>{await saasRequest('/saas/r61/config',{method:'PUT',body:JSON.stringify({flags:Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.checked])),policy:{...cfg.policy,enabled:external.checked,channels:Object.keys(channels).filter(k=>channels[k].checked),templateBindings:Object.fromEntries(Object.entries(bindings).filter(([k,v])=>v.value.trim()).map(([k,v])=>[k,v.value.trim()])),imageId:image.value.trim(),imagePublicApproved:!!image.value.trim()&&confirm('MMS 이미지가 개인정보 없는 보호자 공개용임을 확인했습니까?')}})});alert('설정을 저장했습니다.');});
  button(body,'선택 보호자의 외부 발송 동의 기록',async()=>{const s=selection();if(!s.patientId)throw Error('PATIENT');if(!confirm('해당 보호자의 예방관리·자료 외부 발송 동의를 실제로 확인했습니까?'))return;for(const purpose of ['preventive','material'])await api('/consent',{patientId:s.patientId,purpose,confirmed:true,explicitConsentRecorded:true});alert('동의 확인 기록을 저장했습니다.');});
  button(body,'선택 보호자의 외부 발송 동의 철회',async()=>{const s=selection();if(!s.patientId)throw Error('PATIENT');for(const purpose of ['preventive','material'])await api('/consent',{patientId:s.patientId,purpose,confirmed:false,explicitConsentRecorded:true});alert('동의 철회를 기록했습니다.');});
  button(body,'기존 비공개 기록 공개 후보 미리보기',async()=>{const s=selection();if(!s.patientId)throw Error('PATIENT');const from=prompt('시작일 YYYY-MM-DD'),to=prompt('종료일 YYYY-MM-DD');if(!from||!to)return;const d=await api('/visibility/preview',{patientId:s.patientId,from,to});const box=el('section'),chosen=new Map();for(const row of d.rows){const line=el('label'),c=el('input');c.type='checkbox';c.disabled=!row.eligible;chosen.set(row.id,c);line.style.display='block';line.append(c,document.createTextNode([row.date,row.type,row.eligible?'구조화된 항목만 공개 검토':'제외',row.reason].join(' · ')));box.append(line);}const approval=el('input');approval.placeholder='별도 운영 승인 식별자';box.append(el('p','최대 8개를 선택합니다. 내부 자유 메모는 공개하지 않습니다. 기능 플래그만으로는 실행되지 않으며 현재 별도 승인 기록은 없습니다.'),approval);const apply=button(box,'별도 승인 범위 확인 후 선택 공개',async()=>{const ids=[...chosen].filter(([id,c])=>c.checked).map(([id])=>id);if(!ids.length||ids.length>8){alert('1개부터 8개까지 선택해주세요.');return;}if(!confirm('선택한 기록의 보호자 공개를 직접 검토했습니까? 내부 메모는 제외됩니다.'))return;const result=await api('/visibility/apply',{previewId:d.previewId,ids,approvalId:approval.value.trim(),confirmed:true,publicReviewConfirmed:true});alert(String(result.changed)+'개 기록을 공개했습니다.');apply.disabled=true;});apply.disabled=true;approval.oninput=()=>{apply.disabled=!approval.value.trim();};body.append(box);});
 }
 async function approveMaterial(){
  const subject=selection();
  const {body}=dialog('보호자 공개 자료 등록·승인'),kind=el('select'),title=el('input'),text=el('textarea');
  const existing=await api('/materials'+(subject.patientId?'?patientId='+encodeURIComponent(subject.patientId):'')),revokeChoice=el('select');for(const m of existing.materials){const o=el('option',m.title);o.value=m.id;revokeChoice.append(o);}body.append(el('p','기존 자료 폐기는 연결된 보호자 링크도 함께 취소합니다. 발송·열람 이력은 보존합니다.'),revokeChoice);button(body,'선택 자료와 링크 폐기',async()=>{if(!revokeChoice.value)return;if(!confirm('선택 자료와 기존 링크를 폐기합니까? 이력은 삭제하지 않습니다.'))return;await api('/materials/revoke',{materialId:revokeChoice.value});revokeChoice.selectedOptions[0]?.remove();alert('자료와 링크를 폐기했습니다.');});
  title.placeholder='자료 제목';text.placeholder='보호자에게 공개할 본문 (직원 메모·Secret·연락처 제외)';text.rows=12;
  for(const [v,n] of [['advanced','고급 보호자 자료'],['medication','복약지도'],['discharge','퇴원 안내'],['disease','질환 안내'],['postoperative','수술 후 관리'],['results','검사 결과 설명'],['guardian','기타 보호자 공개 자료']]){const o=el('option',n);o.value=v;kind.append(o);}
  body.append(kind,title,text,el('p',subject.patientId?'이 자료는 현재 선택한 환자·보호자에게만 사용할 수 있습니다.':'공통 자료 등록입니다. 특정 환자 정보는 포함하지 마세요.'));
  button(body,'현재 보호자 PDF 내용을 승인 초안으로 가져오기',async()=>{if(!subject.patientId)throw Error('PATIENT_REQUIRED');const doc=document.getElementById('pdfDocument');if(!doc||doc.classList.contains('hidden')||!doc.querySelector('.pdf-page')){alert('자료 화면에서 보호자 PDF를 먼저 생성해주세요. 직원 체크리스트는 가져오지 않습니다.');return;}const active=selection();if(active.patientId!==subject.patientId||doc.dataset.r61Patient!==subject.patientId)throw Error('PATIENT_CHANGED');kind.value='advanced';title.value='보호자 안내자료';text.value=doc.innerText;preview.textContent='가져온 내용을 검토하고 현재 환자의 자료인지 확인한 뒤 다시 미리보기해주세요.';});
  const preview=el('pre');preview.style.whiteSpace='pre-wrap';body.append(preview);
  button(body,'공개 내용 미리보기',async()=>{preview.textContent=title.value+'\n\n'+text.value;});
  button(body,'관리자 공개 승인 후 등록',async()=>{if(preview.textContent!==title.value+'\n\n'+text.value){alert('현재 내용을 미리보기해주세요.');return;}if(!confirm('내부 직원용 내용이 없으며 보호자 공개를 승인합니까?'))return;await api('/materials',{patientId:subject.patientId||undefined,kind:kind.value,title:title.value,text:text.value,audience:'guardian',approved:true,finalPublicReview:true});alert('공개 승인 자료로 등록했습니다.');});
 }
 function mount(){
  if(document.getElementById('r61-controls'))return;
  const bar=el('section');bar.id='r61-controls';bar.style.cssText='padding:12px;display:flex;gap:8px;flex-wrap:wrap';bar.setAttribute('aria-label','후속 기능');
  button(bar,'보호자 자료 보내기',materials);button(bar,'보호자 공개 자료 관리',approveMaterial);button(bar,'후속 기능 설정',settings);button(bar,'예방관리 발송 예정 미리보기',preventivePreview);
  (document.querySelector('main')||document.body).append(bar);
  window.r61RenderTimeline=async(mount,patientId)=>{const rev=String(patientId);mount.dataset.r61Patient=rev;const panel=el('section');panel.setAttribute('aria-label','자료 발송 및 열람 이력');panel.append(el('h4','자료 발송·열람 이력'));mount.append(panel);try{const d=await api('/deliveries?patientId='+encodeURIComponent(patientId));if(!panel.isConnected||mount.dataset.r61Patient!==rev)return;for(const x of d.deliveries)panel.append(el('p',[x.created_at,x.kind,x.channel,x.status,x.viewed_at?'열람 확인':'열람 미확인'].join(' · ')));if(!d.deliveries.length)panel.append(el('p','발송 이력이 없습니다.'));}catch{if(panel.isConnected)panel.append(el('p','발송 이력을 확인하지 못했습니다.'));}};
  window.r61OpenMaterials=materials;window.r61ApproveMaterial=approveMaterial;
  const observer=new MutationObserver(()=>{for(const panel of document.querySelectorAll('.patient-workspace-head'))if(!panel.querySelector('[data-r61-material]')){const b=button(panel,'보호자 자료 · 발송 및 열람 이력',materials);b.dataset.r61Material='1';}});observer.observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
