import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const timeline=source('patient-timeline.js'),care=source('clinic-care.js'),pdf=source('r61-clinic.js');
function slice(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start);return s.slice(start,end);}
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function timelineFixture(){
 const c=vm.createContext({TYPE_META:{journey:{label:'Journey',icon:'J'}},SOURCE_LABEL:{system:'자동 기록'},esc:escape,dateLabel:String,canDelete:()=>false});
 vm.runInContext(timeline.split('\n').find(s=>s.includes('const STATUS_LABEL='))+slice(timeline,'  function journeyDisplay(','  const HOME_RESPONSE_LABEL='),c);return c;
}
const registered={id:'j1',type:'journey',status:'completed',source:'system',sourceRef:'journey-completed:a:b',title:'검증용 관리 완료',detail:'3단계 후속관리 설정 완료'};
test('registration receipt is distinguished from true completed care without rewriting input records',()=>{
 const c=timelineFixture(),before=JSON.stringify(registered),html=c.eventHtml(registered);
 assert.match(html,/검증용 관리 · 후속관리 계획 등록 완료/);assert.match(html,/>계획 등록 완료</);assert.equal(JSON.stringify(registered),before);
 const actual=c.eventHtml({...registered,sourceRef:'clinical-final:a',detail:'마지막 단계 확인',title:'후속관리 완료'});
 assert.match(actual,/>완료</);assert.doesNotMatch(actual,/계획 등록 완료/);
});
test('legacy registration requires explicit setup evidence and new labels are not doubled',()=>{
 const c=timelineFixture();assert.equal(c.journeyDisplay({...registered,sourceRef:'journey:a:b'}).status,'계획 등록 완료');
 assert.equal(c.journeyDisplay({...registered,sourceRef:'journey:a:b',detail:'관리 수행 완료'}).status,'완료');
 const title='검증용 관리 · 후속관리 계획 등록 완료';
 assert.equal(c.journeyDisplay({...registered,title}).title,title);
 assert.match(c.eventHtml({...registered,title:'<img> 완료'}),/&lt;img&gt;/);
});
test('both cancellation spellings remain canceled even when originating from a registration',()=>{
 const c=timelineFixture();for(const status of ['canceled','cancelled']){
  const html=c.eventHtml({...registered,status,title:'검증용 관리'});
  assert.match(html,/>취소</);assert.doesNotMatch(html,/>완료<|>계획 등록 완료</);
 }
});
test('new plan registration writes setup wording while preserving existing event identity',async()=>{
 const calls=[],c=vm.createContext({window:{crmCurrentPatient:()=>({patientId:'p'})},today:()=> '2026-10-20',state:{patient:null},api:async(path,opt)=>{calls.push({path,opt});return opt?{ok:true}:{events:[]};}});
 vm.runInContext(slice(timeline,'  async function recordJourneyCompleted(','  function bind('),c);
 await c.recordJourneyCompleted({id:'j',name:'검증용 관리',stages:[1,3]},{caseNonce:'case',startedAt:'2026-10-20'});
 const payload=JSON.parse(calls[1].opt.body);assert.equal(payload.sourceRef,'journey-completed:j:case');
 assert.equal(payload.title,'검증용 관리 · 후속관리 계획 등록 완료');assert.match(payload.homeNote,/계획을 등록/);assert.doesNotMatch(payload.homeNote,/관리가 완료/);
});
function homeFixture(){
 let auth='session-a';const state={patient:{id:'p1'},homeFollowups:[],homeFollowupSummary:{},homeFollowupReadState:'idle'},pending=[],renders=[];
 const c=vm.createContext({state,HOME_RESPONSE_LABEL:{concern:'병원 상담 필요'},dateLabel:String,esc:escape,canDelete:()=>false,isDemo:()=>false,timelinePublishScope:()=>auth+'|'+state.patient.id,api:(path,opt)=>new Promise((resolve,reject)=>pending.push({path,opt,resolve,reject})),renderHomeFollowups:()=>renders.push(state.homeFollowupReadState)});
 vm.runInContext(slice(timeline,'  function homeFollowupPanelHtml(){','  function renderHomeFollowups(){'),c);
 return {c,state,pending,renders,auth:v=>auth=v};
}
test('failed or malformed reads never claim zero followups or no consultation',async()=>{
 for(const result of [null,{ok:true},{ok:true,items:[],summary:{}},{ok:true,items:[],summary:{total:null,attention:null}}]){
  const f=homeFixture(),task=f.c.loadHomeFollowups();assert.doesNotMatch(f.c.homeFollowupPanelHtml(),/상담 필요 0|등록된 HOME 후속관리가 없습니다/);
  if(result===null)f.pending[0].reject(Error('offline'));else f.pending[0].resolve(result);await task;
  const html=f.c.homeFollowupPanelHtml();assert.match(html,/불러오지 못했습니다/);assert.match(html,/data-home-followup-retry/);
  assert.doesNotMatch(html,/상담 필요 0|등록된 HOME 후속관리가 없습니다/);
 }
});
test('retry is a patient-scoped read and successful empty state is explicitly different',async()=>{
 const f=homeFixture();let task=f.c.loadHomeFollowups();f.pending[0].reject(Error('offline'));await task;
 task=f.c.loadHomeFollowups();f.pending[1].resolve({ok:true,items:[],summary:{total:0,attention:0}});await task;
 assert.match(f.c.homeFollowupPanelHtml(),/등록된 HOME 후속관리가 없습니다/);assert.match(f.c.homeFollowupPanelHtml(),/상담 필요 0/);
 assert.ok(f.pending.every(x=>x.path==='/saas/patients/p1/home-followups?limit=200'&&x.opt===undefined));
});
test('late responses cannot replace a newer patient, session or refresh',async()=>{
 const f=homeFixture(),first=f.c.loadHomeFollowups();f.state.patient.id='p2';const second=f.c.loadHomeFollowups();
 f.pending[1].resolve({ok:true,items:[{id:'new'}],summary:{total:1,attention:0}});await second;
 f.pending[0].resolve({ok:true,items:[{id:'old'}],summary:{total:1,attention:1}});await first;assert.equal(f.state.homeFollowups[0].id,'new');
 const third=f.c.loadHomeFollowups();f.auth('session-b');f.pending[2].resolve({ok:true,items:[{id:'private'}],summary:{total:1,attention:1}});await third;assert.equal(f.state.homeFollowups.length,0);
 const fourth=f.c.loadHomeFollowups(),fifth=f.c.loadHomeFollowups();f.pending[4].resolve({ok:true,items:[{id:'latest'}],summary:{total:1,attention:0}});await fifth;
 f.pending[3].reject(Error('stale failure'));await fourth;assert.equal(f.state.homeFollowupReadState,'ready');assert.equal(f.state.homeFollowups[0].id,'latest');
});
test('history shortcut changes the selected workspace tab without loading duplicate history',()=>{
 const nodes=[],calls=[],state={patient:{id:'p1'}};
 const c=vm.createContext({state,mount:{append:n=>nodes.push(n)},document:{createElement:()=>({}),querySelector:()=>({focus:()=>calls.push('focus')})},window:{ClinicOrganization:{showWorkspaceTab:(tab,id)=>{calls.push([tab,id]);return true;}}}});
 vm.runInContext(slice(timeline,"    const history=document.createElement('button');",'  }\r\n'),c);
 nodes[0].onclick();assert.deepEqual(calls,[['materials','p1'],'focus']);state.patient.id='p2';nodes[0].onclick();assert.equal(calls.length,2);
 assert.doesNotMatch(slice(timeline,'  function render(){','  const timelinePublishPending='),/r61RenderTimeline/);
});
const phase=vm.createContext({});
vm.runInContext(slice(care,'function medicationPlanPhase(','function setupMedicationSteps('),phase);
const plan={active:true,startDate:'2026-10-20',endDate:'2026-10-23',times:['08:00','20:00'],firstDayTimes:['20:00'],firstDoseTime:'20:00',lastDoseTime:'08:00'};
const at=s=>Date.parse(s+'+09:00');
test('future and same-day evening starts remain scheduled until their first actual dose',()=>{
 for(const now of ['2026-10-19T23:59:59','2026-10-20T08:00:00','2026-10-20T19:59:59']){
  const s=phase.medicationPlanPhase(plan,at(now));assert.equal(s.label,'시작 예정');assert.equal(s.firstAt,'2026-10-20 20:00');assert.equal(s.archived,false);
 }
 assert.equal(phase.medicationPlanPhase(plan,at('2026-10-20T20:00:00')).label,'진행 중');
});
test('last dose determines the archive boundary without implying every dose was administered',()=>{
 assert.equal(phase.medicationPlanPhase(plan,at('2026-10-23T08:00:00')).archived,false);
 const ended=phase.medicationPlanPhase(plan,at('2026-10-23T08:00:01'));assert.equal(ended.label,'기간 종료');assert.equal(ended.archived,true);
 const stopped=phase.medicationPlanPhase({...plan,active:false},at('2026-10-19T12:00:00'));assert.equal(stopped.label,'중단됨');assert.equal(stopped.archived,true);
});
test('current first-day schedule wins over original time and legacy plans retain full end date',()=>{
 const changed=phase.medicationPlanPhase({...plan,firstDayTimes:['19:00']},at('2026-10-20T19:00:00'));assert.equal(changed.label,'진행 중');
 const legacy={...plan,lastDoseTime:undefined,firstDayTimes:undefined,firstDoseTime:undefined};
 assert.equal(phase.medicationPlanPhase(legacy,at('2026-10-23T23:59:58')).archived,false);
 assert.equal(phase.medicationPlanPhase(legacy,at('2026-10-24T00:00:00')).archived,true);
});
async function pdfFixture(pending=true){
 const nodes=[],requests=[],events=[],state={pending,sent:false,hasRecovery:true,status:'READY_UNSENT',assetId:'a',previewed:true};
 const make=(tag,text='')=>{const n={tag,textContent:text,children:[],dataset:{},style:{},append(...children){this.children.push(...children);if(tag==='select'&&!this.value)this.value=children[0]?.value;},addEventListener(){},setAttribute(){},removeAttribute(){},get options(){return this.children;},get selectedOptions(){return this.children.filter(x=>x.value===this.value);}};nodes.push(n);return n;};
 const controller={state:()=>state,recover:async()=>{events.push('recover');state.pending=false;return {ok:true};}};
 const c=vm.createContext({dialog:()=>({body:make('body'),d:make('dialog')}),el:make,pdfRequest:async(path,opt)=>{requests.push({path,opt});return path.endsWith('pdf-config')?{pdfEnabled:true,guardianMaterialEnabled:true}:{materials:[{id:'m',revision:1,kind:'advanced',title:'검증 자료',text:'검증용'}]};},materialScope:(id,revision)=>({patientId:'p',materialId:id,materialRevision:revision}),materialSame(){},materialKinds:[['advanced','고급 자료']],materialKindDisplayLabel:String,materialId:()=>true,pdfController:()=>controller,sessionStorage:{},pdfErrorCode:()=> 'UNEXPECTED'});
 vm.runInContext(slice(pdf,'    async function privatePDF() {','    window.r113PDFController'),c);await c.privatePDF();
 return {nodes,requests,events,state};
}
test('one recovery button replaces duplicate lookups and changes wording after confirmation',async()=>{
 const f=await pdfFixture(),buttons=f.nodes.filter(n=>n.tag==='button'&&/결과 조회/.test(n.textContent));assert.equal(buttons.length,1);
 assert.equal(buttons[0].textContent,'미확정 저장·게시 결과 조회');await buttons[0].onclick();
 assert.deepEqual(f.events,['recover']);assert.equal(buttons[0].textContent,'저장·게시 결과 조회');assert.ok(f.requests.every(x=>x.opt.method==='GET'));
 assert.ok(f.nodes.some(n=>n.textContent==='PDF 저장 완료 · HOME 미게시'));
});
