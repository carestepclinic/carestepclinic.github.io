(function(g){
 'use strict';
 let active=false;
 const css=`.cs-privacy{box-sizing:border-box;width:min(900px,calc(100vw - 24px));max-height:92dvh;padding:24px;border:1px solid #cadad7;border-radius:14px;color:#183d49;background:#fff;font-family:inherit;font-size:15px;line-height:1.65}.cs-privacy::backdrop{background:#102f3d80}.cs-privacy h2{margin:0 0 12px;font-size:21px}.cs-privacy h3{font-size:16px;margin:18px 0 8px}.cs-privacy p{white-space:pre-wrap;margin:8px 0}.cs-privacy button{font:inherit;border:1px solid #bbd1ce;border-radius:7px;background:white;padding:9px 14px;color:#15434a;cursor:pointer}.cs-privacy button:disabled{opacity:.5;cursor:default}.cs-privacy button[data-accept]{background:#15766f;color:white}.cs-privacy .actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:20px}.cs-privacy label{display:block;margin:12px 0}.cs-privacy input[type=checkbox]{margin-right:8px;width:18px;height:18px;vertical-align:middle}.cs-privacy pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7f6;padding:14px;max-height:45vh;overflow:auto;font-family:inherit;font-size:14px;line-height:1.6}.cs-privacy canvas{display:block;max-width:100%;height:auto;touch-action:none;border:1px solid #bbc;cursor:crosshair}.cs-privacy iframe{width:100%;height:48vh;border:1px solid #bbc}.cs-privacy details{margin:10px 0}.cs-privacy .coords{display:flex;gap:8px;flex-wrap:wrap}.cs-privacy .coords label{margin:0}.cs-privacy .coords input{width:64px;font:inherit}.cs-privacy [role=status]{color:#8e3326}.cs-privacy :focus-visible{outline:3px solid #158378;outline-offset:2px}@media(max-width:480px){.cs-privacy{padding:16px;font-size:14px}}`;
 function node(tag,text,attrs={}){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
 function cancel(){return Object.assign(Error('전송을 취소했습니다. 입력 내용은 유지됩니다.'),{name:'AbortError'});}
 async function digest(value){const bytes=await g.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function evidenceText(value,depth=0){const labels={species:'동물종',date:'검사일',pendingTests:'결과 대기',patientProfile:'환자 특성',ageMonths:'나이 개월',breed:'품종',sex:'성별',neutered:'중성화',weight:'체중',bcs:'BCS',mcs:'MCS',history:'병력·문진',medications:'복용약',exams:'검사 소견',labs:'검사값',imageFindings:'사진 설명',previousExamination:'이전 검사',comparisonRule:'비교 기준',name:'검사명',group:'분류',value:'결과',unit:'단위',reference:'참고범위',source:'검사 기관·장비',kind:'사진 종류',caption:'설명',physical:'신체 검사',skin:'피부',eyes:'안과',ears:'귀',oral:'구강',cardiac:'심장',respiratory:'호흡',abdominal:'복부',musculoskeletal:'근골격',neurological:'신경',radiography:'방사선',ultrasound:'초음파'};if(value===null)return '없음';if(typeof value!=='object')return String(value);return Object.entries(value).map(([k,v])=>'  '.repeat(depth)+(Array.isArray(value)?String(Number(k)+1):labels[k]||k)+': '+(v&&typeof v==='object'?'\n'+evidenceText(v,depth+1):evidenceText(v))).join('\n');}
 function dialog(title,build,{signal}={}){
  if(active)return Promise.reject(Error('열린 개인정보 확인 화면을 먼저 마쳐주세요.'));
  if(signal?.aborted)return Promise.reject(cancel());active=true;
  if(!document.querySelector('#cs-privacy-style')){const style=node('style',css,{id:'cs-privacy-style'});document.head.append(style);}
  const previous=document.activeElement,d=node('dialog',undefined,{class:'cs-privacy','aria-labelledby':'cs-privacy-title'}),heading=node('h2',title,{id:'cs-privacy-title'});d.append(heading);document.body.append(d);
  return new Promise((resolve,reject)=>{
   const cleanup=[];let done=false;
   const finish=(result,error)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);cleanup.forEach(fn=>fn());d.close();d.remove();active=false;if(previous?.isConnected)previous.focus();error?reject(error):resolve(result);};
   const abort=()=>finish(null,cancel());signal?.addEventListener('abort',abort,{once:true});d.addEventListener('cancel',e=>{e.preventDefault();abort();});
   try{build(d,result=>finish(result),abort,cleanup);d.showModal();heading.tabIndex=-1;heading.focus();}catch(e){finish(null,e);}
  });
 }
 function check(parent,text){const label=node('label'),input=node('input',undefined,{type:'checkbox'});label.append(input,document.createTextNode(text));parent.append(label);return input;}
 function buttons(parent,ok,cancelText='취소'){const bar=node('div',undefined,{class:'actions'}),back=node('button',cancelText,{type:'button'}),go=node('button',ok,{type:'button','data-accept':''});bar.append(back,go);parent.append(bar);return {back,go};}
 function documents(parent,p){
  parent.append(node('p',p.ready?'운영자가 확정한 처리 내역입니다.':'검토 중인 초안입니다. 아직 위탁계약을 체결하거나 개인정보가 포함된 자료의 AI 전송을 승인할 수 없습니다.'));
  if(!p.ready)parent.append(node('p','확인 필요: '+(p.issues||[]).join(', ')));
  if(p.operator?.legalName)parent.append(node('p','운영자: '+p.operator.legalName+' · 개인정보 문의: '+p.operator.privacyContact+' '+p.operator.privacyEmail));
  for(const doc of [p.dpa,p.privacy]){if(!doc?.sections?.length)continue;const details=node('details'),summary=node('summary',doc.title+' · '+doc.version);details.append(summary,node('p','시행일 '+doc.effectiveDate));for(const [h,t] of doc.sections)details.append(node('h3',h),node('p',t));parent.append(details);}
  const details=node('details'),summary=node('summary','외부 업체와 국외 처리 안내');details.append(summary);
  for(const p1 of p.processors||[]){details.append(node('h3',p1.recipient));for(const [key,label] of [['contact','연락처'],['purpose','목적'],['items','항목'],['countries','국가'],['timingMethod','시점·방법'],['retention','보유기간'],['basis','이전 근거'],['refusal','거부 방법·영향']])details.append(node('p',label+': '+p1[key]));}parent.append(details);
  if(p.backupDeletion)parent.append(node('p','백업 보존·삭제: '+p.backupDeletion));
  parent.append(node('p','병원의 위탁계약 확인은 보호자의 국외이전 동의를 대신하지 않습니다. 병원은 해당 처리의 수집·이용 및 이전 근거를 별도로 갖추어야 합니다.'));
 }
 async function openNotice(api,authenticated=false){
  const scope=api.scope(),r=await api.request(authenticated?'/saas/privacy/status':'/saas/privacy/notice',{method:'GET',auth:authenticated}),p=r.publication;
  if(!p)throw Error('개인정보 안내를 불러오지 못했습니다.');
  return dialog('개인정보 처리·위탁 안내',(d,finish,abort)=>{
   documents(d,p);if(r.dpa?.accepted)d.append(node('p','병원 위탁계약 확인 완료 · '+r.dpa.acceptedAt));
   const can=authenticated&&r.canAccept&&p.ready&&!r.dpa?.accepted,agreed=can?check(d,'위탁계약과 재위탁 업체 내역에 동의합니다.'):null,authority=can?check(d,'병원을 대표하여 이 계약을 체결할 권한이 있습니다.'):null;
   const {back,go}=buttons(d,can?'위탁계약 확인 저장':'닫기','닫기');back.onclick=()=>finish(false);
   if(!can){back.hidden=true;go.onclick=()=>finish(false);return;}
   const status=node('p','',{role:'status'});d.append(status);const update=()=>go.disabled=!(agreed.checked&&authority.checked);agreed.onchange=authority.onchange=update;update();
   go.onclick=async()=>{if(api.scope()!==scope){abort();return;}go.disabled=true;try{await api.request('/saas/privacy/dpa',{method:'POST',body:JSON.stringify({dpaAccepted:true,authorizedRepresentative:true,publicationDigest:p.digest})});finish(true);}catch(e){status.textContent=e.message;update();}};
  });
 }
 async function contract(api,opt,body){
  if(!body.termsAccepted||!body.privacyAccepted)throw Object.assign(Error('이용약관 동의와 개인정보 처리방침 확인을 완료해주세요.'),{details:{signupReason:'consent_missing'}});
  const scope=api.scope();let p;try{({publication:p}=await api.request('/saas/privacy/notice',{method:'GET',auth:false}));if(!p)throw Error('개인정보 안내를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');}catch(e){e.signupStage='documents';throw e;}
  if(!p.ready){if(api.scope()!==scope)throw cancel();const {dpaAccepted,authorizedRepresentative,publicationDigest,...application}=body;return {...opt,body:JSON.stringify(application)};}
  await dialog('병원 위탁계약 확인',(d,finish,abort)=>{documents(d,p);const a=check(d,'위탁계약과 재위탁 내역에 동의합니다.'),b=check(d,'병원을 대표하여 위탁계약을 체결할 권한이 있습니다.'),{back,go}=buttons(d,'확인하고 가입 신청');back.onclick=abort;const update=()=>go.disabled=!(a.checked&&b.checked);a.onchange=b.onchange=update;update();go.onclick=()=>finish(true);},opt);
  if(api.scope()!==scope)throw cancel();return {...opt,body:JSON.stringify({...body,dpaAccepted:true,authorizedRepresentative:true,publicationDigest:p.digest})};
 }
 function notice(parent,p){const ai=p.processors.find(x=>x.id==='openai');parent.append(node('p','전송 대상: '+ai.recipient+' · 처리 국가: '+ai.countries),node('p','목적: '+ai.purpose+'\n보유기간: '+ai.retention));const det=node('details');det.append(node('summary','전체 처리·위탁 안내'));documents(det,p);parent.append(det);parent.append(node('p','아래 확인은 이번 자료의 전송 검토 기록이며 보호자의 법적 동의를 대신하지 않습니다. AI를 사용하지 않아도 직접 입력·저장할 수 있습니다.'));
 }
 async function fileReview(data,p,options,pilot=null){
  return dialog('AI에 보낼 파일 확인',(d,finish,abort,cleanup)=>{
   if(pilot){d.append(node('p','건강검진 파일 시범 읽기 · 개인정보 처리 문서는 초안으로 유지됩니다.'),node('p',pilot.restriction),node('p','전송 대상: '+pilot.recipient+' · '+pilot.region),node('p','목적: '+pilot.purpose+'\n보유기간: '+pilot.retention),node('p','이름·연락처·주소·차트번호·바코드·QR코드와 파일 안의 숨은 식별정보를 제거해주세요. 다른 정보와 결합해 개인을 알아볼 수 있는 내용도 제외해야 합니다. 파일 내용은 자동으로 익명화되거나 검증되지 않습니다. 직접 입력·저장도 계속 사용할 수 있습니다.'));}else notice(d,p);let current=data,source=null,objectUrl='',loading=false,sequence=0,fileSequence=0;
   const preview=node('div'),help=node('p'),status=node('p','',{role:'status'}),tools=node('div'),file=node('input',undefined,{type:'file',accept:'application/pdf,image/jpeg,image/png,image/webp'});
   d.append(help,preview,tools,node('p','개인정보를 제거한 파일로 교체'),file,status);
   const reviewed=check(d,pilot?'모든 페이지와 숨은 정보까지 확인했으며, 개인을 알아볼 수 있는 정보가 없는 검사 파일만 OpenAI로 보내는 것을 확인합니다.':'모든 페이지에서 이름·연락처·차트번호·주소·바코드 등 식별정보를 제거한 것을 확인했습니다.'),{back,go}=buttons(d,'이 내용만 전송');back.onclick=abort;
   const update=()=>go.disabled=!reviewed.checked||loading||!current;reviewed.onchange=update;update();
   cleanup.push(()=>{sequence++;fileSequence++;if(objectUrl)URL.revokeObjectURL(objectUrl);source=null;current='';});
   function mask(canvas,rect){const c=canvas.getContext('2d');c.fillStyle='#000';c.fillRect(rect.x,rect.y,rect.w,rect.h);current=canvas.toDataURL('image/png');reviewed.checked=false;update();}
   async function show(value){
    const ticket=++sequence;loading=true;reviewed.checked=false;update();preview.replaceChildren();tools.replaceChildren();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';status.textContent='';
    try{
     if(value.startsWith('data:application/pdf;')){
      const bytes=Uint8Array.from(atob(value.split(',')[1]),x=>x.charCodeAt(0));objectUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const frame=node('iframe',undefined,{title:'전송할 PDF의 모든 페이지 확인',src:objectUrl});preview.append(frame);current=value;help.textContent='PDF는 여기서 개인정보를 지우지 않습니다. 원본 편집 도구의 영구 삭제 기능으로 텍스트·주석·메타데이터까지 제거한 파일을 선택하세요. 검은 도형으로 덮기만 한 PDF는 전송하지 마세요. 미리보기가 보이지 않으면 취소 후 파일을 직접 확인하세요.';
     }else{
      const img=new Image();img.src=value;await img.decode();if(!d.isConnected||ticket!==sequence)return;if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw Error('이미지가 큽니다. 검사 부분만 잘라 다시 선택해주세요.');const canvas=node('canvas',undefined,{'aria-label':'식별정보를 드래그하여 가릴 전송 이미지'});canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);preview.append(canvas);source=img;current=canvas.toDataURL('image/png');help.textContent='식별정보를 드래그하면 검은색으로 지웁니다. 아래 숫자로 가릴 영역을 지정할 수도 있습니다. 사진 메타데이터를 제외하고 화면의 이미지 픽셀만 전송합니다.';
      let start=null;const point=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};};canvas.onpointerdown=e=>{start=point(e);canvas.setPointerCapture(e.pointerId);};canvas.onpointerup=e=>{if(!start)return;const end=point(e);mask(canvas,{x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)});start=null;};canvas.onpointercancel=()=>start=null;
      const coords=node('div',undefined,{class:'coords'}),inputs=[];for(const label of ['왼쪽 %','위쪽 %','너비 %','높이 %']){const l=node('label',label),input=node('input',undefined,{type:'number',min:'0',max:'100',value:inputs.length<2?'0':'20'});l.append(input);coords.append(l);inputs.push(input);}const apply=node('button','영역 가리기',{type:'button'});apply.onclick=()=>{const [x,y,w,h]=inputs.map(i=>Number(i.value));if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>100||y+h>100){status.textContent='가릴 영역을 0~100% 안으로 지정해주세요.';return;}mask(canvas,{x:x*canvas.width/100,y:y*canvas.height/100,w:w*canvas.width/100,h:h*canvas.height/100});status.textContent='선택 영역을 가렸습니다.';};const reset=node('button','가리기 초기화',{type:'button'});reset.onclick=()=>{canvas.getContext('2d').drawImage(source,0,0);current=canvas.toDataURL('image/png');reviewed.checked=false;update();};coords.append(apply,reset);tools.append(coords);
     }
    }catch(e){if(ticket===sequence){status.textContent=e.message||'파일 미리보기를 준비하지 못했습니다.';current='';}}finally{if(ticket===sequence){loading=false;update();}}
   }
   file.onchange=async()=>{const f=file.files[0];if(!f)return;const readTicket=++fileSequence;++sequence;reviewed.checked=false;current='';loading=true;update();if(f.size>3000000||!['application/pdf','image/jpeg','image/png','image/webp'].includes(f.type)){loading=false;status.textContent='3MB 이하 PDF·JPG·PNG·WebP를 선택해주세요.';update();return;}const reader=new FileReader();reader.onload=()=>{if(readTicket===fileSequence&&d.isConnected)void show(reader.result);};reader.onerror=()=>{if(readTicket!==fileSequence||!d.isConnected)return;loading=false;status.textContent='파일을 읽지 못했습니다.';update();};reader.readAsDataURL(f);};
   go.onclick=()=>{if(!current||loading||!reviewed.checked)return;if(current.length>4400000){status.textContent='전송 이미지가 큽니다. 검사 영역만 잘라 파일을 다시 선택해주세요.';return;}finish(current);};void show(data);
  },options);
 }
 async function prepare(path,opt,api){
  if((opt.method||'GET').toUpperCase()!=='POST')return opt;
  if(!['/saas/register'].includes(path)&&!/(?:\/lab-import|\/prescription-image|\/healthcheck-summary)$/.test(path))return opt;
  const {onAIStage,...transport}=opt;opt=transport;const progress=stage=>{if(typeof onAIStage==='function')onAIStage(stage);};
  const body=typeof opt.body==='string'?JSON.parse(opt.body):opt.body||{},scope=api.scope();
  if(path==='/saas/register')return contract(api,opt,body);
  progress('preparing');
  const status=await api.request('/saas/privacy/status',{method:'GET'}),p=status.publication;
  const summaryPilot=!p?.ready&&p&&status.healthcheckSummaryPilot?.active===true&&status.healthcheckSummaryPilot.operation==='healthcheck_summary'&&path==='/saas/practice/clinical/healthcheck-summary'?status.healthcheckSummaryPilot:null;
  if(summaryPilot){
   if(!body.recordId)throw Error('건강검진 기록을 먼저 저장한 뒤 AI 작성을 시작해주세요.');
   const preview=await api.request(path+'/preview',{...opt,body:JSON.stringify(body)});
   if(preview.pilotDigest!==summaryPilot.digest||preview.pilotVersion!==summaryPilot.version||preview.payloadDigest!==await digest(JSON.stringify(preview.evidence)))throw Error('검사 내용 또는 처리 안내가 변경되었습니다. 다시 확인해주세요.');
   progress('reviewing');
   await dialog('AI에 보낼 검사 내용 확인',(d,finish,abort)=>{
    d.append(node('p','건강검진 종합소견·관리계획 시범 작성 · 개인정보 처리 문서는 초안으로 유지됩니다.'),node('p',summaryPilot.restriction),node('p','전송 대상: '+summaryPilot.recipient+' · '+summaryPilot.region),node('p','목적: '+summaryPilot.purpose+'\n보유기간: '+summaryPilot.retention),node('p','현재 검사와 연결한 이전 검사에서 전송할 내용입니다. 알려진 이름·연락처 등은 일부 제외하지만 자동 검사는 완전하지 않습니다. 개인을 알아볼 수 있는 내용이 남아 있으면 취소하고 원문을 수정해주세요. 사진 원본은 보내지 않으며 사진 설명은 아래에 포함될 수 있습니다.'),node('pre',evidenceText(preview.evidence)));
    const reviewed=check(d,'전송할 전체 내용을 확인했고 개인을 알아볼 수 있는 정보가 없습니다. 이 내용만 OpenAI로 보내 초안을 작성합니다.'),{back,go}=buttons(d,'이 내용으로 AI 작성');back.onclick=abort;go.disabled=true;reviewed.onchange=()=>go.disabled=!reviewed.checked;go.onclick=()=>{if(reviewed.checked)finish(true);};
   },opt);
   body.privacyReview={reviewed:true,nonPersonalEvidence:true,pilotVersion:summaryPilot.version,pilotDigest:summaryPilot.digest,recordId:body.recordId,payloadDigest:preview.payloadDigest};
   if(api.scope()!==scope||opt.signal?.aborted)throw cancel();progress('processing');return {...opt,body:JSON.stringify(body)};
  }
  const pilot=!p?.ready&&p&&status.fileReadingPilot?.active===true&&status.fileReadingPilot.operation==='healthcheck_lab_import'&&path==='/saas/practice/clinical/lab-import'&&body.mode==='healthcheck'?status.fileReadingPilot:null;
  if(pilot){
   if(!body.recordId)throw Error('건강검진 기록을 먼저 저장한 뒤 파일을 읽어주세요.');
   progress('reviewing');body.image=await fileReview(body.image,p,opt,pilot);
   body.privacyReview={reviewed:true,nonPersonalFile:true,pilotVersion:pilot.version,pilotDigest:pilot.digest,recordId:body.recordId,payloadDigest:await digest(body.image)};
   if(api.scope()!==scope||opt.signal?.aborted)throw cancel();progress('processing');return {...opt,body:JSON.stringify(body)};
  }
  if(!p?.ready)throw Error('AI 전송 안내의 운영자 확인이 필요합니다. 직접 입력·저장은 계속 사용할 수 있습니다.');
  if(!status.dpa?.accepted)throw Error('병원 대표가 계정 → 개인정보 처리·위탁 안내에서 위탁계약을 먼저 확인해주세요.');
  let payload;
  if(path.endsWith('/healthcheck-summary')){
   const preview=await api.request(path+'/preview',{...opt,body:JSON.stringify(body)});
   if(preview.publicationDigest!==p.digest)throw Error('처리 안내가 변경되었습니다. 다시 확인해주세요.');payload=JSON.stringify(preview.evidence);
   progress('reviewing');await dialog('AI에 보낼 소견 확인',(d,finish,abort)=>{notice(d,p);d.append(node('p','현재 검사와 연결한 이전 검사 중 전송되는 내용입니다. 알려진 식별정보를 일부 제외했지만 자동 검사는 완전하지 않습니다. 식별정보가 남아 있으면 취소하고 원문을 수정해주세요.'),node('pre',evidenceText(preview.evidence)));const check1=check(d,'전송 내용을 검토했고 식별정보가 남아 있지 않습니다.'),{back,go}=buttons(d,'이 내용으로 AI 작성');back.onclick=abort;go.disabled=true;check1.onchange=()=>go.disabled=!check1.checked;go.onclick=()=>finish(true);},opt);
   body.privacyReview={reviewed:true,publicationDigest:p.digest,payloadDigest:preview.payloadDigest};
  }else{progress('reviewing');body.image=await fileReview(body.image,p,opt);payload=body.image;body.privacyReview={reviewed:true,publicationDigest:p.digest,payloadDigest:await digest(payload)};}
  if(api.scope()!==scope||opt.signal?.aborted)throw cancel();progress('processing');return {...opt,body:JSON.stringify(body)};
 }
 g.CarestepPrivacy={prepare,openNotice,fileReview,digest};
})(window);
