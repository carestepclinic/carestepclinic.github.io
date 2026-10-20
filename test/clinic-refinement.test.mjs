import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const care=readFileSync(new URL('../clinic-care.js',import.meta.url),'utf8');
const part=(a,b)=>care.slice(care.indexOf(a),care.indexOf(b,care.indexOf(a)));
const context=extra=>vm.createContext({Date,Map,JSON,Number,...extra});
const helper=context();vm.runInContext(part('function homePublicationState(','function refreshOverviewAfterMedication('),helper);
test('current publication counts and lists exclude withdrawn and superseded deliveries from the same history',()=>{
 const rows=[{id:'current',channel:'home',status:'sent',accessRevoked:0},{id:'legacy',channel:'home',status:'sent'},
  {id:'withdrawn',channel:'home',status:'sent',accessRevoked:true},{id:'string',channel:'home',status:'sent',accessRevoked:'1'},
  {id:'replaced',channel:'home',status:'sent',accessRevoked:0,superseded_by:'current'},
  {id:'failed',channel:'home',status:'failed'},{id:'sms',channel:'lms',status:'sent'}];
 const before=JSON.stringify(rows),state=helper.homePublicationState(rows);
 assert.equal(state.history.length,5);assert.deepEqual(Array.from(state.current,d=>d.id),['current','legacy']);assert.equal(JSON.stringify(rows),before);
});
test('a failed history query remains unknown while a successful empty query is zero',()=>{
 assert.equal(helper.homePublicationState(null),null);assert.equal(helper.homePublicationState(undefined),null);
 assert.equal(helper.homePublicationState([]).current.length,0);
});
test('a grouped delivery task keeps its 12 recipients separate from one review item',()=>{
 const c=context({window:{}});vm.runInContext(part('function inboxTasks(','function attentionSummary('),c);
 const rows=c.inboxTasks('delivery',{counts:{failed:12,unconfirmed:3,accepted:40}},'scope');
 assert.equal(rows.length,2);assert.equal(c.inboxCounts(rows).targets,15);assert.equal(c.inboxCountLabel([rows[0]]),'확인 항목 1개 · 대상 12건');
 const individual=c.inboxTasks('consult',{items:[{id:'a',status:'new'},{id:'b',status:'completed'}]},'scope');
 assert.equal(c.inboxCountLabel(individual),'확인 항목 1개 · 대상 1건');
 assert.equal(c.inboxRegionLabel({state:'failed',items:[]}), '조회 실패');
});

class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.isConnected=true;this.text='';this.open=false;}
 append(...nodes){nodes.forEach(n=>{if(n.parentElement)n.remove();n.parentElement=this;this.children.push(n);});}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.isConnected=false;}
 replaceChildren(...nodes){this.children=[];this.text='';this.append(...nodes);}
 set textContent(value){this.text=String(value);this.children=[];}get textContent(){return this.text+this.children.map(n=>n.textContent).join(' ');}
 set innerHTML(value){this.html=value;if(value.includes('<summary>자료·복약 상태')){const summary=new Element('summary');summary.textContent='자료·복약 상태';const prep=new Element('dl');prep.dataset.preparation='';const details=new Element();details.dataset.overviewDetails='';const status=new Element('p');status.dataset.overviewStatus='';this.replaceChildren(summary,prep,details,status);}}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const key=selector.startsWith('[data-')?selector.slice(6,-1).replace(/-([a-z])/g,(_,s)=>s.toUpperCase()):null;const matches=n=>key?Object.hasOwn(n.dataset,key):selector[0]==='.'?n.className===selector.slice(1):n.tagName===selector.toUpperCase();return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 setAttribute(){}
}
function overviewFixture(fail=false){
 const host=new Element(),panel=new Element();panel.className='clinic-workspace-materials';host.append(panel);
 let auth='p1',resolveRead;const pause=new Promise(r=>resolveRead=r);
 const c=context({document:{createElement:tag=>new Element(tag)},selected:()=>({patientId:'p1'}),patientScope:()=>auth,
  window:{crmCurrentPatient:()=>({patientId:'p1'})},medicationDrafts:new Map(),medications:[],today:()=> '2026-10-20',
  api:async path=>{await pause;if(fail&&path.includes('deliveries'))throw Error('offline');return path.includes('deliveries')?{deliveries:[{title:'공개 자료',channel:'home',status:'sent',accessRevoked:0},{title:'철회 자료',channel:'home',status:'sent',accessRevoked:1}]}:path.includes('medications')?{plans:[]}:{events:[]};}});
 vm.runInContext(part("let overviewHost=null,overviewScope='';",'function matchingPrescriptionPlan('),c);
 return {host,panel,c,release:resolveRead,change:()=>auth='p2'};
}
test('the workspace has one stable status title and its current list matches the public count',async()=>{
 const f=overviewFixture(),pending=f.c.homeOverview(f.host);f.release();await pending;
 const box=f.panel.querySelector('[data-home-overview]');assert.ok(box);assert.equal(box.querySelector('summary').textContent,'자료·복약 상태');
 assert.match(box.querySelector('[data-preparation]').textContent,/과거 HOME 게시 이력 2건.*현재 공개 중인 자료 1건/);
 assert.match(box.querySelector('[data-overview-details]').textContent,/공개 자료/);assert.doesNotMatch(box.querySelector('[data-overview-details]').textContent,/철회 자료/);
 assert.equal(box.querySelectorAll('button').length,1);assert.equal(box.querySelector('button').textContent,'상태 새로고침');
});
test('failed publication reads never render zero current publications',async()=>{
 const f=overviewFixture(true),pending=f.c.homeOverview(f.host);f.release();await pending;
 const box=f.panel.querySelector('[data-home-overview]');assert.match(box.querySelector('[data-preparation]').textContent,/현재 공개 중인 자료 조회 실패/);
 assert.equal(box.querySelector('button').textContent,'상태 다시 조회');
});
test('a previous patient response cannot populate the current workspace status',async()=>{
 const f=overviewFixture(),pending=f.c.homeOverview(f.host);f.change();f.release();await pending;
 assert.equal(f.panel.querySelector('[data-preparation]').textContent,'');
});

function registrationFixture(options={}){
 const fields={start:{value:'2026-10-20'},interval:{value:'1'},firstDoseTime:{value:'20:00'},timeRestricted:{checked:false}};
 const med={name:'가상약',dose:'1정',frequency:'하루 2회',times:'08:00, 20:00',duration:3},button={disabled:false},locked={disabled:false};
 const status={textContent:'',classList:{add(){}},setAttribute(){},focus(){}},dialog={dataset:{medStep:'1'}},form={querySelector:()=>button};
 const writes=[],state={valid:true,reads:0},c=context({form,dialog,status,locked,editor:{get:()=>med},field:n=>fields[n],parseMedTimes:s=>s.split(',').map(s=>s.trim()).sort(),
  valid:()=>state.valid,pid:'p1',auth:'scope',currentPlans:[],firstDoseSupported:true,registered:false,
  crypto:{randomUUID:()=> 'request-id'},sessionStorage:{removeItem(){}},draftStorageKey:'draft',medicationDrafts:new Map(),
  paintComparison(){},paintDraftStatus(){},clearMedicationErrors(){},focusMedicationError(){},refreshOverviewAfterMedication(){},
  confirm:()=>{throw Error('A second confirmation popup must not appear');},
  setupMedicationSteps:(_d,validate)=>({go:n=>{dialog.dataset.medStep=String(n);if(n===3)validate();}})});
 c.refresh=async()=>{state.reads++;if(options.read)await options.read({c,state,fields,med,locked,button});};
 c.api=async(_path,opt)=>{const body=JSON.parse(opt.body);writes.push(body);if(options.send)return options.send(body);return {ok:true,plan:{...body,id:'plan-a',patientId:'p1'}};};
 vm.runInContext(part('function homeMedicationPayload(','function createRegistrationBatch(')+part(' const registrationPayload=',' const batchButton=')+'\nthis.review=()=>steps.go(3);this.isSaving=()=>saving;',c);
 return {c,fields,med,button,locked,status,writes,state,submit:()=>form.onsubmit({preventDefault(){}})};
}
test('one explicit final registration click sends the reviewed dose and complete evening-start course',async()=>{
 const f=registrationFixture();await f.submit();assert.equal(f.writes.length,0);assert.equal(f.c.dialog.dataset.medStep,'3');
 await f.submit();assert.equal(f.writes.length,1);const p=f.writes[0];assert.equal(p.confirmed,true);assert.equal(p.totalDoses,6);assert.equal(p.endDate,'2026-10-23');assert.equal(p.lastDoseTime,'08:00');assert.equal(f.locked.disabled,false);
});
test('changed input after review requires reviewing the updated content before any POST',async()=>{
 const f=registrationFixture();f.c.review();f.med.dose='2정';await f.submit();assert.equal(f.writes.length,0);assert.match(f.status.textContent,/변경된 내용/);
 await f.submit();assert.match(f.writes[0].instructions,/2정/);
});
test('duplicate clicks during the latest read cannot send twice and inputs stay locked',async()=>{
 let release;const pause=new Promise(r=>release=r);const f=registrationFixture({read:async({state,locked})=>{if(state.reads===1){assert.equal(locked.disabled,true);await pause;}}});
 f.c.review();const first=f.submit();await f.submit();release();await first;assert.equal(f.writes.length,1);
});
test('a matching plan arriving in the latest read prevents a duplicate registration',async()=>{
 const f=registrationFixture({read:({c})=>{c.currentPlans=[{...c.homeMedicationPayload(c.editor.get(),'2026-10-20',1,'20:00'),active:true}];}});
 f.c.review();await f.submit();assert.equal(f.writes.length,0);assert.match(f.status.textContent,/이미 등록/);assert.equal(f.button.disabled,false);
});
test('patient changes and input changes during the read prevent sending the old review',async()=>{
 for(const change of [({state})=>state.valid=false,({med})=>med.dose='3정']){const f=registrationFixture({read:change});f.c.review();await f.submit();assert.equal(f.writes.length,0);assert.equal(f.button.disabled,false);}
});
test('a failed read unlocks correction while an uncertain POST stays locked against resubmission',async()=>{
 const failed=registrationFixture({read:()=>{throw Error('offline');}});failed.c.review();await failed.submit();assert.equal(failed.writes.length,0);assert.equal(failed.button.disabled,false);
 const unknown=registrationFixture({send:()=>{throw Error('response lost');}});unknown.c.review();await unknown.submit();await unknown.submit();assert.equal(unknown.writes.length,1);assert.equal(unknown.locked.disabled,true);assert.match(unknown.status.textContent,/자동 재등록하지 않습니다/);
});
test('missing server scheduling capability blocks registration even after the final review',async()=>{
 const f=registrationFixture({read:({c})=>c.firstDoseSupported=false});f.c.review();await f.submit();assert.equal(f.writes.length,0);assert.match(f.status.textContent,/첫 복용 시간 기능/);
});
test('batch review uses one registration action without an extra confirmation checkbox or popup',()=>{
 const batch=part(' const batchButton=',' const reload=document.createElement');
 assert.doesNotMatch(batch,/data-batch-confirm|if\(!confirm\(/);assert.match(batch,/care-review-patient/);
 assert.match(batch,/save.disabled=true;paint\(\);try\{await runMedicationBatch/);
 assert.match(batch,/confirmed:true,sourcePatientId:pid/);
});
