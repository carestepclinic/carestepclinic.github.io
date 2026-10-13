/* R61 integrated Clinic controls. All server actions require existing session. */
(()=>{'use strict';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const api=(path,body,opt={})=>saasRequest('/saas/r61'+path,body===undefined?opt:{...opt,method:'POST',body:JSON.stringify(body)});
 const selection=()=>window.crmWorkspaceSelection?.()||window.crmCurrentPatient?.()||{};
 window.r61TaskStillActive=async x=>{
  await loadFollowupScheduleBoard(false);
  const item=workFirstBuckets().all.find(r=>String(r.id)===x.taskId&&r.patientId===x.patientId&&r.guardianId===x.guardianId);
  return !!item&&(!x.type||item.sourceType===x.type)&&!['resolved','completed','canceled','deleted'].includes(item.action?.status||item.operationalStatus||item.status);
 };
 function dialog(title){const d=el('dialog'),h=el('h2',title),body=el('div'),close=el('button','닫기');d.append(h,body,close);close.onclick=()=>d.close();d.addEventListener('close',()=>d.remove());document.body.append(d);d.style.cssText='max-width:720px;width:90%;max-height:85vh;overflow:auto;padding:24px;border-radius:14px';d.showModal();return {d,body};}
 function button(parent,label,action){const b=el('button',label);b.type='button';b.className='btn btn-secondary';parent.append(b);b.onclick=async()=>{b.disabled=true;try{await action();}catch{alert('처리하지 못했습니다. 권한·선택 대상과 저장 상태를 확인해주세요. 자동 재시도하지 않습니다.');}finally{b.disabled=false;}};return b;}
 const materialScopeKeys=['clinicId','userId','sessionId','patientId','guardianId','materialId','materialRevision','channel'];
 const materialReceiptKeys=['deliveryId','clinicId','patientId','guardianId','materialId','materialRevision','channel','status','createdAt'];
 const materialId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(x);
 const materialCanon=v=>JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])));
 const materialHash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
 function materialScope(mid,revision){
  const s=selection();if(typeof saasMode==='undefined'||saasMode!=='auth'||typeof saasToken!=='string'||!saasToken||typeof saasMe==='undefined'||typeof saasSessionMeta==='undefined')throw Error('MATERIAL_LOGIN_REQUIRED');
  const q={clinicId:saasMe?.clinic?.id,userId:saasMe?.user?.id,sessionId:saasSessionMeta?.id,patientId:s.patientId,guardianId:s.guardianId,materialId:mid,materialRevision:revision,channel:'home'};
  for(const k of ['clinicId','userId','sessionId','patientId','guardianId','materialId'])if(!materialId(q[k]))throw Error('MATERIAL_SCOPE_MISSING');
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('MATERIAL_REVISION_INVALID');return q;
 }
 function materialSame(a,b){if(!a||!b||materialScopeKeys.some(k=>a[k]!==b[k]))throw Error('MATERIAL_SCOPE_CHANGED');}
 async function materialVerify(d,p){
  if(d?.ok!==true||d.previewId!==p.previewId||!materialId(d.deliveryId)||!d.receipt||Object.keys(d.receipt).sort().join(',')!==[...materialReceiptKeys].sort().join(','))throw Error('MATERIAL_RECEIPT_UNCONFIRMED');
  materialSame(d.scope,p.scope);for(const k of ['clinicId','patientId','guardianId','materialId','materialRevision','channel'])if(d.receipt[k]!==p.scope[k])throw Error('MATERIAL_RECEIPT_SCOPE');
  if(d.receipt.deliveryId!==d.deliveryId||d.receipt.status!=='sent'||typeof d.receipt.createdAt!=='string'||!Number.isFinite(Date.parse(d.receipt.createdAt))||d.receiptSHA256!==await materialHash(materialCanon(d.receipt)))throw Error('MATERIAL_RECEIPT_UNCONFIRMED');return d;
 }
 async function materials(){
  const selected=selection();if(!materialId(selected.patientId)||!materialId(selected.guardianId)){alert('환자 작업공간에서 연결된 환자·보호자를 먼저 선택해주세요.');return;}
  const {body}=dialog('보호자에게 보내기 · CARESTEP Home'),info=el('p'),select=el('select'),preview=el('pre');preview.style.whiteSpace='pre-wrap';body.append(info,select,preview);
  let p=null,busy=false,enabled=false,uncertain=null;const base=materialScope('scope-check',1);
  const cfg=await api('/config');materialSame(materialScope('scope-check',1),base);enabled=cfg?.ok===true&&cfg.flags?.guardian_material_delivery===true;
  info.textContent=enabled?'CARESTEP Home 자료함에만 게시합니다. 문자·알림톡·푸시·외부 링크 안내는 보내지 않습니다.':'보호자 자료 송부 준비 중 · 기능 OFF';
  const current=()=>{const m=list.materials.find(x=>x.id===select.value);if(!m)throw Error('MATERIAL_NOT_SELECTED');return materialScope(m.id,m.revision);};
  const key=q=>'carestep_r107_material_attempt:'+JSON.stringify(materialScopeKeys.map(k=>q[k]));
  const readAttempt=q=>{const raw=sessionStorage.getItem(key(q));if(!raw)return null;const x=JSON.parse(raw);if(!['pending','unconfirmed','sent'].includes(x.state)||!materialId(x.previewId))throw Error('MATERIAL_ATTEMPT_INVALID');return x;};
  const pendingKey='carestep_r107_material_unconfirmed';
  const readPending=()=>{const raw=sessionStorage.getItem(pendingKey);if(!raw)return null;const x=JSON.parse(raw);if(!['pending','unconfirmed'].includes(x.state)||!materialId(x.previewId)||!x.scope||materialScopeKeys.some(k=>!Object.hasOwn(x.scope,k)))throw Error('MATERIAL_ATTEMPT_INVALID');return x;};
  const reserve=(q,value)=>{const raw=JSON.stringify(value);sessionStorage.setItem(key(q),raw);if(sessionStorage.getItem(key(q))!==raw)throw Error('MATERIAL_RESERVATION_UNCONFIRMED');if(value.state==='sent'){const pending=readPending();if(pending&&pending.previewId!==value.previewId)throw Error('MATERIAL_PENDING_SCOPE');sessionStorage.removeItem(pendingKey);if(sessionStorage.getItem(pendingKey)!==null)throw Error('MATERIAL_RESERVATION_UNCONFIRMED');}else{const pending=JSON.stringify({...value,scope:q});sessionStorage.setItem(pendingKey,pending);if(sessionStorage.getItem(pendingKey)!==pending)throw Error('MATERIAL_RESERVATION_UNCONFIRMED');}};
  const send=el('button','보호자에게 보내기'),make=el('button','미리보기'),recover=el('button','기존 송부 결과 확인'),historyButton=el('button','발송·열람 이력');for(const b of [make,send,recover,historyButton]){b.type='button';b.className='btn btn-secondary';body.append(b);}send.disabled=make.disabled=!enabled;
  const list=enabled?await api('/materials?patientId='+encodeURIComponent(base.patientId)):{materials:[]};materialSame(materialScope('scope-check',1),base);
  if(!Array.isArray(list.materials))throw Error('MATERIAL_LIST_UNCONFIRMED');for(const m of list.materials){if(!materialId(m.id)||!Number.isSafeInteger(m.revision)||m.revision<1)throw Error('MATERIAL_LIST_INVALID');const o=el('option',m.title);o.value=m.id;select.append(o);}
  function controls(){send.disabled=!enabled||busy||!!uncertain||!p;make.disabled=!enabled||busy||!!uncertain;select.disabled=busy||!!uncertain;recover.disabled=busy||!uncertain;}
  function restore(){p=null;uncertain=readPending();if(uncertain&&list.materials.some(m=>m.id===uncertain.scope.materialId))select.value=uncertain.scope.materialId;if(!uncertain&&list.materials.length){const saved=readAttempt(current());if(saved&&saved.state!=='sent')uncertain={...saved,scope:current()};}if(uncertain)preview.textContent='송부 결과 미확정입니다. 원래 환자·자료의 기존 결과만 확인하세요. 새 미리보기·재송부는 차단됩니다.';controls();}
  select.onchange=()=>{if(busy||uncertain)return;restore();};restore();
  make.onclick=async()=>{if(busy||uncertain||!enabled)return;busy=true;controls();try{const pending=readPending();if(pending){uncertain=pending;throw Error('MATERIAL_ATTEMPT_UNCONFIRMED');}const q=current();const d=await api('/preview',{patientId:q.patientId,materialId:q.materialId,channel:'home',scope:q});materialSame(current(),q);if(d?.ok!==true||!materialId(d.previewId)||d.homeOnly!==true)throw Error('MATERIAL_PREVIEW_INVALID');materialSame(d.scope,q);p=d;preview.textContent=d.patientName+' / 보호자 '+d.guardianName+'\n자료: '+d.title+'\nCARESTEP Home 게시\n\n'+d.text+(d.duplicateWarning?'\n기존 송부가 있습니다. 다시 게시하려면 명시적 중복 확인이 필요합니다.':'');}catch{p=null;alert('선택 대상과 미리보기를 확인하지 못했습니다. 송부하지 않습니다.');}finally{busy=false;controls();}};
  send.onclick=async()=>{if(busy||uncertain||!enabled||!p)return;busy=true;controls();let reserved=false;const fixed=p;try{const pending=readPending();if(pending){uncertain=pending;throw Error('MATERIAL_ATTEMPT_UNCONFIRMED');}materialSame(current(),fixed.scope);const warning=fixed.duplicateWarning?'\n기존 송부가 있습니다. 같은 자료를 다시 게시하는 것을 승인합니까?':'';if(!confirm('환자: '+fixed.patientName+'\n보호자: '+fixed.guardianName+'\n자료: '+fixed.title+'\n채널: CARESTEP Home 게시'+warning))return;materialSame(current(),fixed.scope);const old=readAttempt(fixed.scope);if(old&&old.state!=='sent')throw Error('MATERIAL_ATTEMPT_UNCONFIRMED');reserve(fixed.scope,{state:'pending',previewId:fixed.previewId});reserved=true;uncertain={state:'pending',previewId:fixed.previewId,scope:fixed.scope};
   const d=await api('/deliver',{previewId:fixed.previewId,confirmed:true,duplicateAcknowledged:fixed.duplicateWarning===true,channel:'home',scope:fixed.scope},{redirect:'error'});materialSame(current(),fixed.scope);await materialVerify(d,fixed);materialSame(current(),fixed.scope);reserve(fixed.scope,{state:'sent',previewId:fixed.previewId,deliveryId:d.deliveryId});uncertain=null;p=null;preview.textContent='전송 완료 · CARESTEP Home 게시\nDelivery ID: '+d.deliveryId;
  }catch{p=null;if(reserved){try{reserve(fixed.scope,{state:'unconfirmed',previewId:fixed.previewId});}catch{}uncertain={state:'unconfirmed',previewId:fixed.previewId,scope:fixed.scope};preview.textContent='송부 결과 미확정 · 재송부 금지. 기존 결과 확인만 진행해주세요.';}else alert('환자·보호자·병원·로그인 상태가 바뀌었거나 저장 증거를 준비하지 못했습니다. 송부하지 않습니다.');}finally{busy=false;controls();}};
  recover.onclick=async()=>{if(busy||!uncertain)return;busy=true;controls();try{const q=current(),saved=readAttempt(q);if(!saved||saved.state==='sent')throw Error('MATERIAL_NO_PENDING_ATTEMPT');materialSame(q,uncertain.scope||q);const expected={previewId:saved.previewId,scope:q};const d=await api('/delivery-receipt?previewId='+encodeURIComponent(saved.previewId),undefined,{redirect:'error'});materialSame(current(),q);await materialVerify(d,expected);materialSame(current(),q);reserve(q,{state:'sent',previewId:saved.previewId,deliveryId:d.deliveryId});uncertain=null;p=null;preview.textContent='전송 완료 · 기존 CARESTEP Home 게시 확인\nDelivery ID: '+d.deliveryId;}catch{preview.textContent='기존 송부 결과를 확정하지 못했습니다. 재송부하지 말고 별도 판정을 요청해주세요.';}finally{busy=false;controls();}};
  historyButton.onclick=async()=>{if(busy)return;try{const q=current();const d=await api('/deliveries?patientId='+encodeURIComponent(q.patientId));materialSame(current(),q);if(d?.ok!==true||!Array.isArray(d.deliveries))throw Error('HISTORY');preview.textContent=d.deliveries.map(x=>[x.deliveryId||x.id,x.created_at,x.channel,x.status,x.viewed_at?'열람 확인':'열람 미확인'].join(' · ')).join('\n')||'발송 이력이 없습니다.';}catch{alert('송부 이력을 확인하지 못했습니다.');}};
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
  if(cfg.flags.followup_auto_completion===true)button(body,'실제 후속관리 단계 확인',()=>window.r83OpenRequiredStages());
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

 // R113 PDF controller has no file-picker or arbitrary upload input.
 function pdfController({scope,request,storage}){
  let busy=false,pending=storage.getItem('carestep_r113_pdf_pending')!==null,generated=null,asset=null,sent=false;
  const fixedScope=()=>{const s=scope(),q=materialScopeKeys.reduce((o,k)=>(o[k]=s?.[k],o),{});for(const k of ['clinicId','userId','sessionId','patientId','guardianId','materialId'])if(!materialId(q[k]))throw Error('PDF_SCOPE_MISSING');if(!Number.isSafeInteger(q.materialRevision)||q.materialRevision<1||q.channel!=='home')throw Error('PDF_SCOPE_INVALID');return q;};
  const match=q=>{materialSame(fixedScope(),q);};
  const verify=async(d,q,status)=>{
   const r=d?.receipt;if(d?.ok!==true||!r||r.status!==status||!materialId(r.assetId)||r.channel!=='home'||r.mimeType!==undefined&&r.mimeType!=='application/pdf'||r.sha256!==generated.hash||r.byteSize!==generated.blob.size||r.clinicId!==q.clinicId||r.patientId!==q.patientId||r.guardianId!==q.guardianId||r.materialId!==q.materialId||r.materialRevision!==q.materialRevision||d.receiptSHA256!==await materialHash(materialCanon(r)))throw Error('PDF_RECEIPT_UNCONFIRMED');
   if(status==='ready'&&(d.assetId!==r.assetId||r.mimeType!=='application/pdf'||!Number.isSafeInteger(r.byteSize)||r.byteSize<1||r.byteSize>10485760||!/^([a-f0-9]{64})$/.test(r.sha256)))throw Error('PDF_ASSET_RECEIPT');
   if(status==='sent'&&(!materialId(d.deliveryId)||r.deliveryId!==d.deliveryId||r.assetId!==asset.assetId||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))))throw Error('PDF_DELIVERY_RECEIPT');return d;
  };
  const reserve=x=>{const raw=JSON.stringify(x);storage.setItem('carestep_r113_pdf_pending',raw);if(storage.getItem('carestep_r113_pdf_pending')!==raw)throw Error('PDF_RESERVATION_UNCONFIRMED');pending=true;};
  const clear=()=>{storage.removeItem('carestep_r113_pdf_pending');if(storage.getItem('carestep_r113_pdf_pending')!==null)throw Error('PDF_RESERVATION_UNCONFIRMED');pending=false;};
  const readAsset=async(id,q)=>{
   if(!materialId(id))throw Error('PDF_ASSET_ID_INVALID');
   const d=await request('/saas/r113/pdf-assets/'+encodeURIComponent(id),{method:'GET',redirect:'error'});match(q);
   if(d?.assetId!==id)throw Error('PDF_ASSET_ID_MISMATCH');
   if(!generated)generated={q,hash:d?.receipt?.sha256,blob:{size:d?.receipt?.byteSize}};
   const ready=await verify(d,q,'ready');match(q);asset=ready;
   if(d.delivery===null&&d.deliveryReceipt===null)return {asset:ready,delivery:null};
   if(d.delivery?.status!=='attached'||!materialId(d.delivery.delivery_id)||d.deliveryReceipt?.deliveryId!==d.delivery.delivery_id)throw Error('PDF_DELIVERY_UNCONFIRMED');
   const delivery=await verify(d.deliveryReceipt,q,'sent');match(q);return {asset:ready,delivery};
  };
  return {
   state:()=>({busy,pending,sent,assetId:asset?.assetId||null}),
   load:async id=>{if(busy||pending||sent)throw Error('PDF_ATTEMPT_LOCKED');busy=true;try{const q=fixedScope();generated=null;asset=null;const result=await readAsset(id,q);match(q);if(result.delivery){sent=true;return result.delivery;}return result.asset;}finally{busy=false;}},
   prepare:async(makeBlob,kind)=>{if(busy||pending||sent)throw Error('PDF_ATTEMPT_LOCKED');busy=true;try{const q=fixedScope(),blob=await makeBlob();match(q);if(!(blob instanceof Blob)||blob.type!=='application/pdf'||!blob.size||blob.size>10485760||new TextDecoder().decode(await blob.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('PDF_GENERATION_INVALID');generated={blob,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join(''),q,kind};return blob;}finally{busy=false;}},
   upload:async confirmed=>{if(busy||pending||sent||!generated)return null;if(confirmed!==true)throw Error('PDF_HOME_CONFIRMATION_REQUIRED');busy=true;try{match(generated.q);const attempt=crypto.randomUUID();reserve({kind:'upload',attempt,scopeDigest:await materialHash(materialCanon(generated.q)),pdfSHA256:generated.hash,byteSize:generated.blob.size});const form=new FormData();form.append('metadata',JSON.stringify({scope:generated.q,idempotencyKey:attempt,generatedBy:generated.kind}));form.append('pdf',generated.blob,'carestep-material.pdf');const d=await request('/saas/r113/pdf-assets',{method:'POST',body:form,redirect:'error'});match(generated.q);asset=await verify(d,generated.q,'ready');match(generated.q);clear();return asset;}finally{busy=false;}},
   attach:async confirmed=>{if(busy||pending||sent||!asset)return null;if(confirmed!==true)throw Error('PDF_HOME_CONFIRMATION_REQUIRED');busy=true;try{
    const q=generated.q;match(q);const cfg=await request('/saas/r113/pdf-config',{method:'GET',redirect:'error'});match(q);if(cfg?.ok!==true||cfg.pdfEnabled!==true||cfg.guardianMaterialEnabled!==true)throw Error('PDF_FEATURE_OFF');
    const before=await readAsset(asset.assetId,q);match(q);if(before.delivery){sent=true;return before.delivery;}
    const attempt=crypto.randomUUID();reserve({kind:'attach',assetId:asset.assetId,attempt,scopeDigest:await materialHash(materialCanon(q)),pdfSHA256:generated.hash,byteSize:generated.blob.size});
    const d=await request('/saas/r113/pdf-assets/'+encodeURIComponent(asset.assetId)+'/attach',{method:'POST',body:JSON.stringify({scope:q,idempotencyKey:attempt,channel:'home',confirmed:true}),headers:{'Content-Type':'application/json'},redirect:'error'});match(q);const result=await verify(d,q,'sent');match(q);
    const after=await readAsset(asset.assetId,q);match(q);if(!after.delivery||after.delivery.deliveryId!==result.deliveryId||after.delivery.receiptSHA256!==result.receiptSHA256||materialCanon(after.delivery.receipt)!==materialCanon(result.receipt))throw Error('PDF_DELIVERY_UNCONFIRMED');
    clear();sent=true;return result;
   }finally{busy=false;}},
   recover:async()=>{if(busy||!pending)return null;busy=true;try{const saved=JSON.parse(storage.getItem('carestep_r113_pdf_pending'));if(!['upload','attach'].includes(saved.kind))throw Error('PDF_MANUAL_ADJUDICATION_REQUIRED');const q=fixedScope();if(await materialHash(materialCanon(q))!==saved.scopeDigest)throw Error('PDF_SCOPE_CHANGED');generated={q,hash:saved.pdfSHA256,blob:{size:saved.byteSize}};const path=saved.kind==='upload'?'/saas/r113/pdf-assets?idempotencyKey='+encodeURIComponent(saved.attempt):'/saas/r113/pdf-assets/'+encodeURIComponent(saved.assetId);const d=await request(path,{method:'GET',redirect:'error'});match(q);asset=await verify(d,q,'ready');if(saved.kind==='attach'){if(d.delivery===null&&d.deliveryReceipt===null)return asset;if(d.delivery?.status!=='attached'||d.delivery.delivery_id!==d.deliveryReceipt?.deliveryId)throw Error('PDF_DELIVERY_UNCONFIRMED');const result=await verify(d.deliveryReceipt,q,'sent');match(q);clear();sent=true;return result;}clear();return asset;}finally{busy=false;}},
   revoke:async confirmed=>{if(busy||pending||!asset||confirmed!==true)return null;busy=true;try{match(generated.q);reserve({kind:'revoke',assetId:asset.assetId});const d=await request('/saas/r113/pdf-assets/'+encodeURIComponent(asset.assetId),{method:'DELETE',redirect:'error'});match(generated.q);if(d?.ok!==true||d.assetId!==asset.assetId||d.accessRevoked!==true||!['deleted','delete_pending'].includes(d.status))throw Error('PDF_REVOKE_UNCONFIRMED');clear();asset=null;sent=true;return d;}finally{busy=false;}}
  };
 }
 async function pdfRequest(path,opt={}){
  if(opt.redirect!=='error')throw Error('PDF_REDIRECT_GUARD');const endpoint=saasEndpoint()+path;
  if(typeof saasMode==='undefined'||saasMode!=='auth'||!saasToken)throw Error('PDF_LOGIN_REQUIRED');
  const response=await fetch(endpoint,{...opt,headers:{...(opt.headers||{}),Authorization:'Bearer '+saasToken},cache:'no-store'});
  if(response.redirected||response.url!==endpoint||!response.ok)throw Error('PDF_RESPONSE_UNCONFIRMED');const d=await response.json();if(d.ok!==true)throw Error('PDF_RESPONSE_UNCONFIRMED');return d;
 }
 async function privatePDF(){
  const {body,d}=dialog('PDF 원본 · 비공개 CARESTEP Home'),info=el('p');body.append(info);
  const cfg=await pdfRequest('/saas/r113/pdf-config',{method:'GET',redirect:'error'});
  if(cfg.pdfEnabled!==true||cfg.guardianMaterialEnabled!==true){info.textContent='PDF 첨부 준비 중 · 기능 OFF. 기존 텍스트 자료 송부는 그대로 이용할 수 있습니다.';return;}
  const q0=materialScope('scope-check',1),list=await pdfRequest('/saas/r61/materials?patientId='+encodeURIComponent(q0.patientId),{method:'GET',redirect:'error'});materialSame(q0,materialScope('scope-check',1));
  const pick=el('select'),kind=el('select'),viewer=el('iframe');for(const m of list.materials||[]){if(!['advanced','medication'].includes(m.kind))continue;const o=el('option',m.title);o.value=m.id;pick.append(o);}for(const [v,n] of [['advanced','고급자료'],['medication','복약지도']]){const o=el('option',n);o.value=v;kind.append(o);}body.append(pick,kind,viewer);
  const current=()=>{const m=list.materials.find(x=>x.id===pick.value);if(!m)throw Error('PDF_MATERIAL_MISSING');return materialScope(m.id,m.revision);};
  const control=pdfController({scope:current,request:pdfRequest,storage:sessionStorage});let blobURL=null;
  d.addEventListener('close',()=>{if(blobURL)URL.revokeObjectURL(blobURL);});
  const existingAsset=el('input');existingAsset.placeholder='기존 PDF Asset ID';existingAsset.setAttribute('aria-label','기존 PDF Asset ID');body.append(existingAsset);
  button(body,'기존 PDF 저장 결과 확인',async()=>{const result=await control.load(existingAsset.value.trim());info.textContent=result.deliveryId?'전송 완료 · 기존 receipt 확인 · Delivery ID: '+result.deliveryId:'PDF 저장 receipt 확인 · 송부 가능 · Asset ID: '+result.assetId;});
  button(body,'앱 PDF 생성·미리보기',async()=>{if(blobURL)URL.revokeObjectURL(blobURL);const blob=await control.prepare(async()=>{if(typeof html2pdf==='undefined')throw Error('PDF_GENERATOR_UNAVAILABLE');const m=list.materials.find(x=>x.id===pick.value);if(m?.kind!==kind.value)throw Error('PDF_GENERATOR_MATERIAL_MISMATCH');const desc=documentOutputDescriptor(kind.value==='medication'?'meds':'pdf');desc.render();if(document.getElementById('pdfDocument')?.dataset.r61Patient!==current().patientId)throw Error('PDF_PATIENT_CHANGED');return exportPdfElement('carestep-material.pdf',{save:false,silent:true});},kind.value);blobURL=URL.createObjectURL(blob);viewer.src=blobURL;info.textContent='앱에서 생성한 PDF 원본을 확인하세요. 아직 서버에 저장하지 않았습니다.';});
  button(body,'Home 송부 확인 후 PDF 저장',async()=>{if(!confirm('현재 선택 환자·연결 보호자에게 이 자료를 CARESTEP Home으로 게시하기 위해 PDF 원본을 비공개 저장합니까?'))return;info.textContent='PDF 저장 중 · 응답 미확정이면 재전송하지 않습니다.';let a;try{a=await control.upload(true);}catch(e){info.textContent='PDF 저장 결과 미확정 · 새 저장/송부 금지. 기존 결과 조회 또는 별도 판정이 필요합니다.';throw e;}if(a)info.textContent='PDF 저장 receipt 확인 · Asset ID: '+a.assetId;});
  button(body,'보호자에게 PDF 보내기 · Home',async()=>{if(!confirm('현재 선택 환자·연결 보호자·자료 제목과 PDF 미리보기를 확인했습니다. Home에 게시합니까? 외부 메시지는 보내지 않습니다.'))return;info.textContent='Home 게시 중 · 성공 receipt 확인 전에는 전송 완료가 아닙니다.';let result;try{result=await control.attach(true);}catch(e){info.textContent='Home 게시 결과 미확정 · 재송부 금지. 기존 receipt만 조회하세요.';throw e;}if(result)info.textContent='전송 완료 · Delivery ID: '+result.deliveryId;});
  button(body,'해당 PDF 송부 철회',async()=>{const result=await control.revoke(confirm('PDF 접근을 철회합니까? 기존 텍스트·후속관리 기록은 보존합니다.'));if(result)info.textContent='접근 철회 완료 · '+result.status;});
  button(body,'미확정 저장·송부 결과 조회',async()=>{const result=await control.recover();if(result)info.textContent=result.deliveryId?'전송 완료 · 기존 receipt 확인':control.state().pending?'PDF 저장 확인 · 이전 송부 결과는 미확정이므로 재송부하지 않습니다.':'PDF 저장 receipt 확인 · 송부 가능';});
 }
 window.r113PDFController=pdfController;

 function mount(){
  if(document.getElementById('r61-controls'))return;
  const bar=el('section');bar.id='r61-controls';bar.style.cssText='padding:12px;display:flex;gap:8px;flex-wrap:wrap';bar.setAttribute('aria-label','후속 기능');
  button(bar,'PDF 원본 · Home',privatePDF);button(bar,'보호자 자료 보내기',materials);button(bar,'보호자 공개 자료 관리',approveMaterial);button(bar,'후속 기능 설정',settings);button(bar,'예방관리 발송 예정 미리보기',preventivePreview);
  (document.querySelector('main')||document.body).append(bar);
  window.r61RenderTimeline=async(mount,patientId)=>{const rev=String(patientId);mount.dataset.r61Patient=rev;const panel=el('section');panel.setAttribute('aria-label','자료 발송 및 열람 이력');panel.append(el('h4','자료 발송·열람 이력'));mount.append(panel);try{const d=await api('/deliveries?patientId='+encodeURIComponent(patientId));if(!panel.isConnected||mount.dataset.r61Patient!==rev)return;for(const x of d.deliveries)panel.append(el('p',[x.created_at,x.kind,x.channel,x.status,x.viewed_at?'열람 확인':'열람 미확인'].join(' · ')));if(!d.deliveries.length)panel.append(el('p','발송 이력이 없습니다.'));}catch{if(panel.isConnected)panel.append(el('p','발송 이력을 확인하지 못했습니다.'));}};
  window.r61OpenMaterials=materials;window.r61ApproveMaterial=approveMaterial;
  const observer=new MutationObserver(()=>{for(const panel of document.querySelectorAll('.patient-workspace-head'))if(!panel.querySelector('[data-r61-material]')){const b=button(panel,'보호자 자료 · 발송 및 열람 이력',materials);b.dataset.r61Material='1';}});observer.observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
