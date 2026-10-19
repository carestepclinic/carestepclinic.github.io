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
  setAttribute(){} addEventListener(){} showModal(){} close(){} remove(){} closest(){return null;}
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
    saasToken:'synthetic-token',saasMode:'auth',saasMe:{clinic:{id:'clinic-a'},user:{id:'user-a'},role:'owner'},saasSessionMeta:{id:'session-a'},
    saasRequest:async(url,opt)=>{calls.push({url,opt});return onRequest(url,opt);},alert:s=>alerts.push(s),confirm:()=>allowConfirm});
  const marker='    function mount() {';assert.ok(source.includes(marker));
  vm.runInContext(source.replace(marker,'    window.testAPI={settings,preventivePreview,preventiveResults,preventiveRecovery,preventiveReadinessPanel,preventiveReview,materialHistory,integrationStatus};\n'+marker),ctx);
  const button=text=>walk(body).find(e=>e.tagName==='BUTTON'&&e.textContent===text);
  const label=text=>walk(body).find(e=>e.tagName==='LABEL'&&e.textContent.includes(text));
  const checkbox=text=>walk(body).find(e=>e.tagName==='LABEL'&&e.textContent.includes(text)&&e.children.some(c=>c.tagName==='INPUT'&&c.type==='checkbox')).children.find(e=>e.tagName==='INPUT');
  return {ctx,body,calls,alerts,button,checkbox,
    setPatient:v=>{patient=v;},setConfirm:v=>{allowConfirm=v;},setRequest:fn=>{onRequest=fn;},
    open:()=>ctx.window.testAPI.settings(),preview:()=>ctx.window.testAPI.preventivePreview(),
    mode:()=>walk(body).find(e=>e.id==='r61PreventiveChannel')};
}

const reviewResult=()=>({ok:true,totalGroups:1,excludedCount:2,page:0,hasMore:false,groups:[{patientId:'patient-a',guardianId:'guardian-a',patientName:'시험환자',guardianName:'시험보호자',type:'heartworm',identity:'heartworm',latestDate:'2026-10-06',excludedRecords:2,records:[{eventId:'event-a',eventDate:'2026-10-06',nextDueDate:'2026-11-03',sourceRef:'synthetic-source',canEdit:true,version:'a'.repeat(64)}]}]});
test('results distinguish job completion and uncertain messages with read-only requests',async()=>{const f=fixture();f.setRequest(async()=>({ok:true,counts:{unconfirmed:10},total:10,cron:{status:'ok',startedAt:'2026-10-15T00:00:00Z',completedAt:'2026-10-15T00:03:00Z'},deliveries:[{category:'unconfirmed',patientName:'시험환자',guardianName:'시험보호자',channel:'lms',reason:'PROVIDER_RESULT_UNCONFIRMED',attemptedAt:'2026-10-15T00:00:00Z',dueDate:'2026-10-15'}]}));await f.ctx.window.testAPI.preventiveResults();assert.match(f.body.textContent,/정상 종료/);assert.match(f.body.textContent,/결과 미확정 10건/);assert.match(f.body.textContent,/09:00/);assert.match(f.body.textContent,/사업자 접수 여부/);assert.ok(f.calls.every(x=>!x.opt.method||x.opt.method==='GET'));});

test('uncertain results show safe diagnosis and next action while staying read-only',async()=>{
 const f=fixture();f.setRequest(async()=>({ok:true,counts:{unconfirmed:1},total:1,deliveries:[{category:'unconfirmed',patientName:'가상환자',guardianName:'가상보호자',reason:'PROVIDER_RESULT_UNCONFIRMED',dueDate:'2026-10-23',diagnostic:{code:'SOLAPI_HTTP_ERROR',stage:'PROVIDER_RESPONSE',httpStatus:401,secret:'do-not-show'}}]}));
 await f.ctx.window.testAPI.preventiveResults();assert.match(f.body.textContent,/인증·권한/);assert.match(f.body.textContent,/HTTP 401/);assert.match(f.body.textContent,/사업자 응답/);assert.doesNotMatch(f.body.textContent,/do-not-show/);assert.ok(f.calls.every(c=>!c.opt.method||c.opt.method==='GET'));
});

test('recovery review only previews, requires cost acknowledgement and sends once on confirmation',async()=>{
 const f=fixture();f.setRequest(async(p,o)=>p.includes('recovery-preview')?{ok:true,previewId:'p',count:1,items:[{patientName:'검수환자',guardianName:'검수보호자',recipientHint:'***0000',dueDate:'2026-10-23',message:'검수문구'}],estimatedCost:{amount:null,note:'병원 계약요금'}}:{ok:true,items:[{category:'accepted'}]});
 await f.ctx.window.testAPI.preventiveRecovery(['d']);assert.equal(f.calls.length,1);assert.match(f.body.textContent,/검수문구/);const b=f.button('1건 복구 발송 확인');await b.onclick();assert.equal(f.calls.length,1);assert.match(f.body.textContent,/비용 안내/);
 walk(f.body).find(x=>x.tagName==='INPUT'&&x.type==='checkbox').checked=true;await b.onclick();assert.equal(f.calls.filter(x=>x.url.endsWith('/recover')).length,1);assert.equal(b.disabled,true);await b.onclick();assert.equal(f.calls.filter(x=>x.url.endsWith('/recover')).length,1);assert.match(f.body.textContent,/사업자 접수 1건/);
});
test('recovery send response loss locks submission and offers result lookup instead of another send',async()=>{
 const f=fixture();f.setRequest(async p=>{if(p.includes('recovery-preview'))return {ok:true,previewId:'p',count:1,items:[{message:'검수문구'}]};throw Error('synthetic loss');});await f.ctx.window.testAPI.preventiveRecovery(['d']);walk(f.body).find(x=>x.tagName==='INPUT'&&x.type==='checkbox').checked=true;const b=f.button('1건 복구 발송 확인');await b.onclick();await b.onclick();assert.equal(f.calls.filter(x=>x.url.endsWith('/recover')).length,1);assert.match(f.body.textContent,/다시 누르지 말고/);assert.ok(f.button('발송 결과 조회'));
});
test('missing diagnosis and unsupported codes are explained without arbitrary response text',async()=>{
 for(const diagnostic of [undefined,{code:'untrusted-secret',stage:'PROVIDER_RESPONSE'},{code:'toString',stage:'constructor'}]){const f=fixture();f.setRequest(async()=>({ok:true,counts:{unconfirmed:1},total:1,deliveries:[{category:'unconfirmed',patientName:'가상환자',diagnostic}]}));await f.ctx.window.testAPI.preventiveResults();assert.match(f.body.textContent,/상세 진단 기록이 없습니다/);assert.doesNotMatch(f.body.textContent,/untrusted-secret|native code/);}
});
test('review exposes patient, guardian and original date before one explicit save',async()=>{const f=fixture();f.setRequest(async(p,o)=>p.includes('correct-date')?{ok:true,eventId:'event-a',nextDueDate:JSON.parse(o.body).nextDueDate}:reviewResult());await f.ctx.window.testAPI.preventiveReview();assert.match(f.body.textContent,/시험환자.*시험보호자/);const input=walk(f.body).find(x=>x.tagName==='INPUT'&&x.type==='date');input.value='2026-11-05';await f.button('이 기록의 예정일 저장').onclick();const posts=f.calls.filter(x=>x.opt.method==='POST');assert.equal(posts.length,1);assert.equal(posts[0].opt.redirect,'error');assert.equal(JSON.parse(posts[0].opt.body).eventId,'event-a');assert.equal(JSON.parse(posts[0].opt.body).nextDueDate,'2026-11-05');});
test('declined date confirmation issues no write',async()=>{const f=fixture({confirm:false});f.setRequest(async()=>reviewResult());await f.ctx.window.testAPI.preventiveReview();walk(f.body).find(x=>x.tagName==='INPUT').value='2026-11-05';await f.button('이 기록의 예정일 저장').onclick();assert.equal(f.calls.length,1);});
test('date response loss locks save and never automatically retries',async()=>{const f=fixture();f.setRequest(async(p)=>{if(p.includes('correct-date'))throw Error('lost response');return reviewResult();});await f.ctx.window.testAPI.preventiveReview();walk(f.body).find(x=>x.tagName==='INPUT').value='2026-11-05';const b=f.button('이 기록의 예정일 저장');await b.onclick();assert.equal(f.calls.filter(x=>x.opt.method==='POST').length,1);assert.equal(b.disabled,true);assert.match(f.body.textContent,/자동 재시도하지 않습니다/);});
test('session change blocks date save before network',async()=>{const f=fixture();f.setRequest(async()=>reviewResult());await f.ctx.window.testAPI.preventiveReview();walk(f.body).find(x=>x.tagName==='INPUT').value='2026-11-05';f.ctx.saasSessionMeta.id='other';await f.button('이 기록의 예정일 저장').onclick();assert.equal(f.calls.length,1);});
test('history shows title, posting status and request timestamps without claiming read completion',async()=>{const f=fixture();f.setRequest(async()=>({ok:true,deliveries:[{kind:'pdf-material',materialKind:'medication',title:'복약체크표',channel:'home',status:'sent',created_at:'2026-10-15T00:00:00Z',lastViewAt:'2026-10-15T01:00:00Z',lastDownloadAt:'2026-10-15T01:01:00Z'}]}));await f.ctx.window.testAPI.materialHistory();assert.match(f.body.textContent,/복약체크표/);assert.match(f.body.textContent,/HOME 게시 완료/);assert.match(f.body.textContent,/실제로 내용을 읽었거나 파일 저장을 마쳤다는 확인은 아닙니다/);assert.equal(f.calls.length,1);});
test('history drops response when selected patient changes',async()=>{const f=fixture();f.setRequest(async()=>{f.setPatient({patientId:'other',guardianId:'other'});return {ok:true,deliveries:[{title:'DO_NOT_SHOW'}]};});await f.ctx.window.testAPI.materialHistory();assert.doesNotMatch(f.body.textContent,/DO_NOT_SHOW/);});
test('integration view distinguishes connected but unselected calendar and no-change sync',async()=>{const f=fixture();f.setRequest(async p=>p.includes('google-calendar')?{ok:true,connected:true,status:'connected',calendarId:''}:p.includes('/r65/')?{ok:true,enabled:true,agentVerified:true}:{ok:true,heartbeat:{status:'idle',last_seen_at:new Date().toISOString(),interval_minutes:15},lastSuccess:{finished_at:'2026-10-15T01:00:00Z',events_created:0,events_updated:0,errors:0}});await f.ctx.window.testAPI.integrationStatus();assert.match(f.body.textContent,/계정 연결됨 · 캘린더 선택 필요/);assert.match(f.body.textContent,/신규 0건 · 수정 0건/);assert.match(f.body.textContent,/15분 자동 동기화 유지/);assert.equal(f.calls.length,3);assert.ok(f.calls.every(x=>!x.opt.method||x.opt.method==='GET'));});
test('integration failure is not displayed as disconnected',async()=>{const f=fixture();f.setRequest(async()=>{throw Error('network');});await f.ctx.window.testAPI.integrationStatus();assert.match(f.body.textContent,/조회하지 못했습니다/);assert.doesNotMatch(f.body.textContent,/계정 연결 필요/);});

test('eFriends request history uses KST and completion counts without duplicate pending row',async()=>{
 const src=readFileSync(new URL('../r65-clinic.js',import.meta.url),'utf8'),root=new Element('main'),calls=[];
 const ctx=vm.createContext({document:{readyState:'loading',hidden:false,addEventListener(){},getElementById(){return null;},querySelector:()=>root,body:root,createElement:tag=>new Element(tag)},window:{},crypto:{randomUUID:()=> 'synthetic-key'},saasMode:'auth',saasMe:{role:'owner',clinic:{id:'clinic-a'},user:{id:'user-a'}},clearTimeout(){},setTimeout(){},saasRequest:async(p,o)=>{calls.push({p,o});return {enabled:true,agentVerified:true,requestCheckSeconds:60,requests:[{id:'pending-a',state:'queued',requestedAt:'2026-10-15T01:00:00Z'},{id:'done-a',state:'completed',requestedAt:'2026-10-15T00:00:00Z',finishedAt:'2026-10-15T00:01:00Z',changedCount:3}]};}});
 vm.runInContext(src,ctx);await ctx.window.R65ManualSync.refresh(true);assert.equal((root.textContent.match(/Agent 대기 중/g)||[]).length,1);assert.match(root.textContent,/반영 3건/);assert.match(root.textContent,/09:01/);assert.equal(calls.length,1);assert.equal(calls[0].o.method,undefined);
});

test('history withdrawal is explicit, scoped and POST once; no send request',async()=>{const f=fixture();let revoked=false;f.setRequest(async(p,o)=>{if(p.endsWith('/withdraw')){assert.equal(o.redirect,'error');const b=JSON.parse(o.body);assert.equal(b.patientId,'patient-a');assert.equal(b.guardianId,'guardian-a');assert.equal(b.confirmed,true);revoked=true;return {ok:true,deliveryId:b.deliveryId,accessRevoked:true};}return {ok:true,deliveries:[{deliveryId:'delivery-a',kind:'pdf-material',title:'시험자료',status:'sent',channel:'home',accessRevoked:revoked?1:0}]};});await f.ctx.window.testAPI.materialHistory();await f.button('HOME 공개 철회').onclick();assert.equal(f.calls.filter(x=>x.opt.method==='POST').length,1);assert.match(f.body.textContent,/공개 철회됨/);});
test('withdraw response loss locks button until fresh history; decline writes nothing',async()=>{for(const allow of [true,false]){const f=fixture({confirm:allow});f.setRequest(async(p)=>{if(p.endsWith('/withdraw'))throw Error('response loss');return {ok:true,deliveries:[{deliveryId:'delivery-a',kind:'pdf-material',title:'시험자료',status:'sent',channel:'home',accessRevoked:0}]};});await f.ctx.window.testAPI.materialHistory();const b=f.button('HOME 공개 철회');await b.onclick();assert.equal(f.calls.filter(x=>x.opt.method==='POST').length,allow?1:0);if(allow){assert.equal(b.disabled,true);await b.onclick();assert.equal(f.calls.filter(x=>x.opt.method==='POST').length,1);}}});

test('same-date refresh retains results, blocks stale actions, and preserves the result filter',async()=>{
 const f=fixture(),data={ok:true,counts:{unconfirmed:1},total:1,deliveries:[{category:'unconfirmed',patientName:'이전 가상환자',guardianName:'보호자'}]};
 f.setRequest(async()=>data);await f.ctx.window.testAPI.preventiveResults();
 const filter=walk(f.body).find(n=>n.tagName==='SELECT'&&n.children.some(x=>x.value==='pending'));filter.value='all';filter.onchange();
 const rows=walk(f.body).find(n=>n.tagName==='SECTION'&&n.children.includes(filter));
 let release;f.setRequest((url)=>url.includes('/preventive/results')?new Promise(r=>release=r):Promise.resolve({ok:true}));
 const pending=f.button('결과 새로고침').onclick();await new Promise(r=>setImmediate(r));
 assert.match(rows.textContent,/이전 가상환자/);assert.equal(rows.inert,true);assert.match(f.body.textContent,/이전 결과/);
 release({...data,deliveries:[{category:'unconfirmed',patientName:'새 가상환자'}]});await pending;
 assert.doesNotMatch(rows.textContent,/이전 가상환자/);assert.match(rows.textContent,/새 가상환자/);assert.equal(rows.inert,false);
 assert.equal(rows.children.find(n=>n.tagName==='SELECT').value,'all');
});
test('failed refresh retains explicitly old results without enabling their actions; changed date clears them',async()=>{
 const f=fixture();f.setRequest(async()=>({ok:true,counts:{unconfirmed:1},total:1,deliveries:[{category:'unconfirmed',patientName:'이전 가상환자'}]}));await f.ctx.window.testAPI.preventiveResults();
 const rows=walk(f.body).find(n=>n.tagName==='SECTION'&&n.children.some(x=>x.tagName==='SELECT'));
 f.setRequest(async()=>{throw Error('offline');});await f.button('결과 새로고침').onclick();assert.match(rows.textContent,/이전 가상환자/);assert.equal(rows.inert,true);assert.match(f.body.textContent,/업데이트 실패.*이전 결과/);
 const date=walk(f.body).find(n=>n.type==='date');date.value='2026-10-01';await f.button('결과 새로고침').onclick();assert.doesNotMatch(rows.textContent,/이전 가상환자/);
});
test('a late result for the previous date cannot overwrite a newer successful read',async()=>{
 const f=fixture();f.setRequest(async()=>({ok:true,counts:{},total:0,deliveries:[]}));await f.ctx.window.testAPI.preventiveResults();
 const pending=[];f.setRequest(url=>url.includes('/preventive/results')?new Promise(r=>pending.push(r)):Promise.resolve({ok:true}));
 const first=f.button('결과 새로고침').onclick();await new Promise(r=>setImmediate(r));walk(f.body).find(n=>n.type==='date').value='2026-10-01';const second=f.button('결과 새로고침').onclick();await new Promise(r=>setImmediate(r));
 pending[1]({ok:true,counts:{},total:1,deliveries:[{category:'unconfirmed',patientName:'새 날짜'}]});await second;pending[0]({ok:true,counts:{},total:1,deliveries:[{category:'unconfirmed',patientName:'오래된 응답'}]});await first;assert.match(f.body.textContent,/새 날짜/);assert.doesNotMatch(f.body.textContent,/오래된 응답/);
});

test('result summary separates channel acceptance and narrows all four attention categories without sending',async()=>{
 const f=fixture(),categories=['accepted','home','failed','blocked','unconfirmed','claimed','canceled'];
 f.setRequest(async()=>({ok:true,counts:{accepted:6,home:3,failed:2,blocked:1,unconfirmed:4,claimed:1,canceled:5},total:22,deliveries:categories.map(category=>({category,patientName:'가상 '+category}))}));
 await f.ctx.window.testAPI.preventiveResults();
 const tiles=walk(f.body).filter(n=>n.className?.startsWith('care-result-metric'));assert.equal(tiles.length,3);
 assert.match(tiles[0].textContent,/확인 필요 8건/);assert.match(tiles[1].textContent,/문자·외부 채널 접수 6건/);assert.match(tiles[2].textContent,/HOME 알림 접수 3건/);
 tiles[0].onclick();const filter=walk(f.body).find(n=>n.tagName==='SELECT'&&n.value==='attention');
 const rows=walk(f.body).find(n=>n.tagName==='SECTION'&&n.children.includes(filter)),list=rows.children[rows.children.indexOf(filter)+1];
 assert.equal(list.children.length,4);assert.doesNotMatch(list.textContent,/가상 accepted|가상 canceled|가상 home/);
 tiles[1].onclick();assert.equal(list.children.length,1);assert.match(list.textContent,/가상 accepted/);
 assert.ok(f.calls.every(x=>!x.opt.method||x.opt.method==='GET'));assert.match(f.body.textContent,/접수는 수신 완료를 뜻하지 않습니다/);
});
