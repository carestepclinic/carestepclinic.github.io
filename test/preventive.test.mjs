import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../r61-clinic.js',import.meta.url),'utf8');
class Element {
  constructor(tag,text=''){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.text=text;this.value='';this.checked=false;}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this.text='';}
  set textContent(v){this.children=[];this.text=String(v);}
  get textContent(){return this.text+this.children.map(x=>x.textContent).join(' ');}
  setAttribute(){} addEventListener(){} showModal(){} close(){} remove(){}
}
const walk=e=>[e,...e.children.flatMap(walk)];
function fixture({enabled=false,confirm=true,defaultAllowed=false}={}){
  const body=new Element('body'),calls=[],alerts=[];
  let patient={patientId:'patient-a',guardianId:'guardian-a'},allowConfirm=confirm;
  let config={ok:true,flags:{preventive_auto_delivery:enabled,followup_auto_completion:false,guardian_material_delivery:true,efriends_home_visible_default:true},policy:{preventiveDefaultAllowed:defaultAllowed,enabled:true,channels:['lms'],templateBindings:{},imageId:'',imagePublicApproved:false},preventive:{ready:true,reasons:[]}};
  let onRequest=async(url,opt)=>{
    if(url==='/saas/r61/config'){
      if(opt?.method==='PUT'){const b=JSON.parse(opt.body);config={...config,flags:{...config.flags,...b.flags},policy:b.policy};}
      return structuredClone(config);
    }
    if(url.includes('/preventive/preference'))return {ok:true,patientId:patient.patientId,guardianId:patient.guardianId,allowed:opt?.body?JSON.parse(opt.body).preference==='default':defaultAllowed,basis:opt?.body?(JSON.parse(opt.body).preference==='blocked'?'GUARDIAN_OPTED_OUT':'CLINIC_DEFAULT'):(defaultAllowed?'CLINIC_DEFAULT':'PREVENTIVE_CONSENT_REQUIRED')};
    if(url.includes('/preventive/preview'))return {ok:true,mode:'lms',targets:[{patientName:'시험환자',guardianName:'시험보호자',dueDate:'2026-10-20',eligible:false,primaryChannel:null,externalCandidates:[],reason:['PREVENTIVE_CONSENT_REQUIRED'],message:'[시험병원] 시험환자의 예방접종 예정일은 2026-10-20입니다.'}],excludedCount:0};
    return {ok:true};
  };
  const ctx=vm.createContext({document:{body,readyState:'loading',createElement:tag=>new Element(tag),createTextNode:s=>new Element('#text',s),addEventListener(){}},window:{crmWorkspaceSelection:()=>patient},Date,console,
    saasMode:'auth',saasMe:{clinic:{id:'clinic-a'},user:{id:'user-a'}},saasSessionMeta:{id:'session-a'},
    saasRequest:async(url,opt)=>{calls.push({url,opt});return onRequest(url,opt);},alert:s=>alerts.push(s),confirm:()=>allowConfirm});
  const marker='    function mount() {';assert.ok(source.includes(marker));
  vm.runInContext(source.replace(marker,'    window.testAPI={settings,preventivePreview};\n'+marker),ctx);
  const button=text=>walk(body).find(e=>e.tagName==='BUTTON'&&e.textContent===text);
  const label=text=>walk(body).find(e=>e.tagName==='LABEL'&&e.textContent.includes(text));
  const checkbox=text=>walk(body).find(e=>e.tagName==='LABEL'&&e.textContent.includes(text)&&e.children.some(c=>c.tagName==='INPUT'&&c.type==='checkbox')).children.find(e=>e.tagName==='INPUT');
  return {ctx,body,calls,alerts,button,checkbox,
    setPatient:v=>{patient=v;},setConfirm:v=>{allowConfirm=v;},setRequest:fn=>{onRequest=fn;},
    open:()=>ctx.window.testAPI.settings(),preview:()=>ctx.window.testAPI.preventivePreview(),
    mode:()=>walk(body).find(e=>e.id==='r61PreventiveChannel')};
}
test('settings preserves legacy Home mode without activating a flag',async()=>{
  const f=fixture();await f.open();assert.equal(f.mode().value,'home-first');assert.equal(f.calls.length,1);assert.equal(f.calls[0].opt.method,undefined);
});
test('saving LMS preference while OFF changes no unrelated flag and sends no message',async()=>{
  const f=fixture();await f.open();f.mode().value='lms';await f.button('설정 저장').onclick();
  const writes=f.calls.filter(x=>x.opt?.method==='PUT');assert.equal(writes.length,1);const b=JSON.parse(writes[0].opt.body);
  assert.deepEqual(b.flags,{});assert.equal(b.policy.preventiveChannel,'lms');assert.equal(writes[0].opt.redirect,'error');assert.equal(f.calls.length,2);assert.match(f.body.textContent,/자동발송 꺼짐/);
});
test('activation uses only changed preventive flag and requires confirmation',async()=>{
  const f=fixture({confirm:false});await f.open();f.mode().value='lms';f.checkbox('접종·사상충 자동 발송').checked=true;
  await f.button('설정 저장').onclick();assert.equal(f.calls.length,1);
  f.setConfirm(true);await f.button('설정 저장').onclick();const b=JSON.parse(f.calls[1].opt.body);assert.deepEqual(b.flags,{preventive_auto_delivery:true});assert.match(f.body.textContent,/자동발송 켜짐/);
});
test('missing LMS channel blocks activation before PUT',async()=>{
  const f=fixture();await f.open();f.mode().value='lms';f.checkbox('접종·사상충 자동 발송').checked=true;f.checkbox('LMS').checked=false;
  await f.button('설정 저장').onclick();assert.equal(f.calls.length,1);assert.match(f.body.textContent,/모두 선택/);
});
test('changed session blocks config save',async()=>{
  const f=fixture();await f.open();f.ctx.saasSessionMeta.id='session-b';await f.button('설정 저장').onclick();assert.equal(f.calls.length,1);assert.match(f.body.textContent,/확인하지 못했습니다/);
});
test('preventive consent records only selected guardian purpose and requires actual confirmation',async()=>{
  const f=fixture({confirm:false});await f.open();await f.button('선택 보호자의 예방문자 동의 기록').onclick();assert.equal(f.calls.length,1);
  f.setConfirm(true);await f.button('선택 보호자의 예방문자 동의 기록').onclick();assert.equal(f.calls.length,2);
  const req=f.calls[1];assert.equal(req.url,'/saas/r61/consent');assert.equal(req.opt.redirect,'error');assert.deepEqual(JSON.parse(req.opt.body),{patientId:'patient-a',purpose:'preventive',confirmed:true,explicitConsentRecorded:true});
});
test('preview renders actual message and Korean exclusion reason with only GET',async()=>{
  const f=fixture();await f.preview();await f.button('예정 대상 조회').onclick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].opt.method,undefined);assert.equal(f.calls[0].opt.redirect,'error');assert.match(f.body.textContent,/시험환자의 예방접종 예정일/);assert.match(f.body.textContent,/보호자 예방문자 동의 미등록/);assert.doesNotMatch(f.body.textContent,/PREVENTIVE_CONSENT_REQUIRED/);
});
test('preview rejects a session switch during response instead of showing prior clinic patients',async()=>{
  const f=fixture();await f.preview();f.setRequest(async()=>{f.ctx.saasMe.clinic.id='clinic-b';return {ok:true,targets:[{patientName:'OLD_PATIENT'}]};});
  await f.button('예정 대상 조회').onclick();assert.doesNotMatch(f.body.textContent,/OLD_PATIENT/);assert.match(f.body.textContent,/병원이 바뀌었습니다/);
});
test('unclear config response never displays saved success',async()=>{
  const f=fixture();await f.open();f.setRequest(async()=>({ok:false}));await f.button('설정 저장').onclick();assert.match(f.body.textContent,/저장 결과를 확인하지 못했습니다/);assert.doesNotMatch(f.body.textContent,/설정 저장 완료/);
});
test('default preference saves once for existing and future guardians, without consent or send requests',async()=>{
 const f=fixture({confirm:false});await f.open();f.checkbox('기존·신규 보호자 예방문자 기본 허용').checked=true;
 await f.button('설정 저장').onclick();assert.equal(f.calls.length,1);
 f.setConfirm(true);await f.button('설정 저장').onclick();assert.equal(f.calls.length,2);
 const b=JSON.parse(f.calls[1].opt.body);assert.equal(b.policy.preventiveDefaultAllowed,true);assert.deepEqual(b.flags,{});assert.equal(f.calls[1].url,'/saas/r61/config');assert.doesNotMatch(f.calls[1].url,/consent|deliver/);
});
test('previously saved default is shown and preserved on unrelated save',async()=>{
 const f=fixture({defaultAllowed:true});await f.open();assert.equal(f.checkbox('기존·신규 보호자 예방문자 기본 허용').checked,true);
 await f.button('설정 저장').onclick();assert.equal(JSON.parse(f.calls[1].opt.body).policy.preventiveDefaultAllowed,true);
});
test('guardian management queries then blocks or restores only selected guardian, without send',async()=>{
 const f=fixture({defaultAllowed:true});await f.open();await f.button('선택 보호자 예방문자 허용·해제').onclick();assert.match(f.body.textContent,/예방문자 허용 · 병원 기본 허용/);
 await f.button('예방문자 해제').onclick();assert.match(f.body.textContent,/예방문자 제외 · 보호자별 예방문자 해제/);
 await f.button('병원 기본 설정으로 복원').onclick();assert.match(f.body.textContent,/예방문자 허용 · 병원 기본 허용/);
 const writes=f.calls.filter(r=>r.opt?.method==='POST');assert.equal(writes.length,2);
 assert.deepEqual(writes.map(r=>JSON.parse(r.opt.body)),[{patientId:'patient-a',guardianId:'guardian-a',preference:'blocked'},{patientId:'patient-a',guardianId:'guardian-a',preference:'default'}]);
 assert.ok(writes.every(r=>r.url==='/saas/r61/preventive/preference'&&r.opt.redirect==='error'));
});
test('changed patient blocks guardian preference write',async()=>{
 const f=fixture();await f.open();await f.button('선택 보호자 예방문자 허용·해제').onclick();f.setPatient({patientId:'patient-b',guardianId:'guardian-b'});
 await f.button('예방문자 해제').onclick();assert.equal(f.calls.length,2);assert.match(f.body.textContent,/저장 결과를 확인하지 못했습니다/);
});
test('uncertain preference response shows no success; reopening queries current state',async()=>{
 const f=fixture();await f.open();await f.button('선택 보호자 예방문자 허용·해제').onclick();
 f.setRequest(async()=>{throw Error('lost response');});await f.button('예방문자 해제').onclick();assert.equal(f.calls.length,3);assert.match(f.body.textContent,/창을 다시 열어 현재 상태/);assert.doesNotMatch(f.body.textContent,/예방문자 제외 · 보호자별/);
});
test('wrong guardian response does not enable preference management',async()=>{
 const f=fixture();await f.open();f.setRequest(async()=>({ok:true,patientId:'patient-a',guardianId:'guardian-b',allowed:true,basis:'CLINIC_DEFAULT'}));
 await f.button('선택 보호자 예방문자 허용·해제').onclick();assert.equal(f.button('예방문자 해제'),undefined);assert.match(f.body.textContent,/상태를 확인하지 못했습니다/);
});
