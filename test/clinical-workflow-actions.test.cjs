const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(async()=>browser?.close());
async function fixture(t,width=1440,medical=true){
 const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));await p.route('http://localhost/**',r=>r.fulfill({body:'<!doctype html><html lang="ko"><body></body></html>',contentType:'text/html'}));await p.goto('http://localhost/');await p.unroute('http://localhost/**');await p.route('**/*',r=>r.abort());await p.setContent('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width"><body style="margin:12px"><main id="root"></main></body></html>');
 for(const f of ['clinical-workspace.css','staff-training.css','clinical-knowledge.css','clinical-care-ui.css'])await p.addStyleTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 for(const f of ['clinical-compact.js','clinical-knowledge.js','clinical-workspace.js'])await p.addScriptTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 await p.evaluate(({medical})=>{
  const doc=i=>({id:'protocol'+i,title:'합성 각막 '+String(i).padStart(2,'0'),species:i%2?'dog':'cat',status:'published',version:1,revision:1,body:{title:'합성 각막 '+String(i).padStart(2,'0'),disease:'각막',species:i%2?'dog':'cat',summary:'실제 진료에 사용하지 않는 시험 자료',steps:[{id:'s',stage:'assessment',title:'합성 단계',detail:'합성 단계 내용',calculator:'fluid'}],sources:[],trainingVersionId:''},sources:[],gaps:[],gapResolutions:[]});
  window.docs=Array.from({length:30},(_,i)=>doc(i));window.calls=[];window.moves=[];window.identity='synthetic';window.failCommon=false;
  const stamp=new Date().toISOString();window.wardItem={id:'case1',revision:1,status:'active',kind:'admission',patient:{name:'합성 입원 환자',breed:'합성 품종',birthDate:'2020-01-01',sex:'MN'},body:{species:'dog',weight:5,title:'입원',careTeam:{chiefComplaint:'합성 주호소',veterinarianName:'합성 수의사',technicianName:'합성 테크니션'},tasks:[],orders:[],wardChecks:[],infusions:[],latestMonitoring:{observedAt:stamp,appetite:'normal',energy:'reduced',vomiting:'none',feces:'normal',urine:'unknown'},wardVitals:{temperature:{value:38.5,observedAt:stamp},weightKG:{value:5,observedAt:stamp}}}};
  const adapter={ready:()=>true,identity:()=>identity,medical:()=>medical,can:()=>true,externalTabs:true,patient:()=>null,calculator:(patient,kind)=>moves.push({patient,kind}),request:async(url,o={})=>{
   calls.push({url,method:o.method||'GET',body:o.body?JSON.parse(o.body):null});if(url.endsWith('/knowledge-protocols')){if(failCommon)throw Error('Synthetic offline');return {items:docs};}
   if(url.includes('/knowledge-protocols/'))return {document:docs.find(d=>url.endsWith(d.id))};
   if(url.endsWith('/clinical/protocols'))return {items:docs};
   if(url.endsWith('/clinical/rooms'))return {items:[{id:'room1',name:'강아지 입원실 01',kind:'dog',care_state:'ready',patientCase:wardItem}]};
   if(url.endsWith('/clinical/cases'))return {items:[wardItem],hasMore:false};
   if(url.endsWith('/clinical/cases/case1'))return {item:wardItem,events:[],canRecord:true,canManage:medical};
   if(url.endsWith('/members'))return {members:[{id:'staff',display_name:'합성 수행자'}],userId:'staff'};
   return {items:[],events:[],courses:[],hasMore:false};
  }};window.app=ClinicalWorkspace.mount(document.querySelector('#root'),adapter);
 },{medical});
 t.after(async()=>{await p.evaluate(()=>app.dispose());await p.close();assert.deepEqual(errors,[]);});return p;
}

async function medications(p){await p.evaluate(()=>{const at=new Date();at.setMinutes(0,0,0);const date=at.toISOString();wardItem.body.tasks=['합성 A','합성 B','합성 C'].map((title,i)=>({id:'t'+i,title,category:'injection',status:'planned',plannedAt:date,seriesId:'series'+i,medication:{drug:title,dose:2,doseUnit:'mg',strength:10,strengthUnit:'mg',amount:.2,amountUnit:'mL',route:'IV'}}));wardItem.body.tasks.push({...wardItem.body.tasks[0],id:'next',plannedAt:new Date(at.getTime()+3600000).toISOString()});});}
for(const width of [390,1440])test('ward actions reachable without nested detail menus '+width,async t=>{
 const p=await fixture(t,width);await medications(p);await p.evaluate(()=>app.open('ward'));
 assert.match(await p.locator('.cl-board-count').innerText(),/입원 중 1 \/ 전체 1실 · 빈방 0실/);assert.equal(await p.locator('.cl-work-more .cl-board-count').count(),0);
 assert.match(await p.locator('.cc-pending-total').innerText(),/남은 처치 2회 · 약물 3종/);
 await p.evaluate(()=>app.openPatient('case1'));await p.locator('[data-cl-action=ward-calendar-task]').first().click();
 const hub=p.locator('.cl-task-hub');await hub.waitFor();assert.equal(await hub.locator('.cl-task-hub-item').count(),3);
 for(const name of ['투약 완료','보류·미실시','지시 수정','복사','이동'])assert.equal(await hub.getByRole('button',{name,exact:true}).first().isVisible(),true);
 assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
 assert.ok(await hub.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.screenshot({path:path.resolve(root,'../care-task-hub-'+width+'.png'),fullPage:true});
 await hub.getByRole('button',{name:'보류·미실시',exact:true}).first().click();assert.equal(await p.locator('dialog [name=status]').inputValue(),'held');
 assert.equal(await p.locator('dialog').count(),1);assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
 await p.locator('dialog [name=note]').fill('합성 보류');await p.locator('dialog [type=submit]').click();await p.waitForFunction(()=>calls.some(x=>x.method==='POST'));
 const write=await p.evaluate(()=>calls.find(x=>x.method==='POST').body);assert.equal(write.kind,'task.record');assert.equal(write.data.taskId,'t0');assert.equal(write.data.status,'held');
});
test('task hub copy/move retains existing schedule validation and does not write on opening',async t=>{
 const p=await fixture(t);await medications(p);await p.evaluate(()=>app.open('ward'));await p.evaluate(()=>app.openPatient('case1'));await p.locator('[data-cl-action=ward-calendar-task]').first().click();await p.locator('[data-cl-action=hub-move]').first().click();await p.locator('dialog [name=scheduleMode]').waitFor();assert.equal(await p.locator('dialog [name=scheduleMode]').inputValue(),'move');assert.equal(await p.locator('[data-schedule-pick]').count(),1);assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
});
test('cancellation label distinguishes one schedule from all remaining schedules',async t=>{
 const p=await fixture(t);await medications(p);await p.evaluate(()=>app.open('ward'));await p.evaluate(()=>app.openPatient('case1'));await p.locator('[data-cl-action=ward-calendar-task]').first().click();await p.locator('.cl-task-delete>summary').first().click();await p.locator('[data-cl-action=ward-med-delete]').first().click();assert.equal(await p.locator('dialog [type=submit]').innerText(),'예정 처치 취소');await p.locator('dialog [name=amendScope]').selectOption('remaining');assert.equal(await p.locator('dialog [type=submit]').innerText(),'남은 일정 중단');assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
});
test('observation unknown and observed absent remain distinguishable',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('ward'));await p.locator('.cl-room-details').evaluate(e=>e.open=true);assert.match(await p.locator('[data-monitor=urine]').innerText(),/미관찰/);assert.match(await p.locator('[data-monitor=vomiting]').innerText(),/관찰되지 않음/);assert.notEqual(await p.locator('[data-monitor=urine]').getAttribute('class'),await p.locator('[data-monitor=vomiting]').getAttribute('class'));
});
test('nonmedical task hub keeps performance actions but not order editing or transfer',async t=>{
 const p=await fixture(t,390,false);await medications(p);await p.evaluate(()=>app.open('ward'));await p.evaluate(()=>app.openPatient('case1'));await p.locator('[data-cl-action=ward-calendar-task]').first().click();assert.equal(await p.locator('.cl-task-hub [data-cl-action=task]').count(),6);assert.equal(await p.locator('.cl-task-hub [data-cl-action=ward-med-edit],.cl-task-hub [data-cl-action=hub-copy],.cl-task-hub [data-cl-action=hub-move],.cl-task-hub [data-cl-action=ward-med-delete]').count(),0);
});
test('read only record exposes no performance or transfer actions',async t=>{
 const p=await fixture(t,390,false);await medications(p);await p.evaluate(()=>{wardItem.status='closed';return app.open('ward');});await p.evaluate(()=>app.openPatient('case1'));await p.locator('[data-cl-action=ward-calendar-task]').first().click();assert.equal(await p.locator('.cl-task-hub .cl-task-quick-actions button').count(),0);assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
});
test('group counts do not count each injection as a separate visit',()=>{
 const C=require('../clinical-workspace.js'),at='2026-10-31T03:00:00Z',mk=(id,status='planned',time=at)=>({id,title:id,category:'injection',status,plannedAt:time,medication:{drug:id}}),tasks=[mk('A'),mk('B'),mk('C'),mk('A','planned','2026-10-31T04:00:00Z'),mk('skip','done'),{...mk('prn'),medication:{prn:true}}];
 const before=JSON.stringify(tasks),n=C.wardWorkEpisodes(tasks,Date.parse('2026-10-31T03:30Z'));assert.equal(n.total,2);assert.equal(n.late,1);assert.equal(n.drugKinds,3);assert.equal(C.wardPendingLabel(tasks),'남은 처치 2회 · 약물 3종');assert.equal(JSON.stringify(tasks),before);
});
