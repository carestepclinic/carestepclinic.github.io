const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(async()=>browser?.close());
async function fixture(t,{width=1440,resume=false}={}){const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));await p.route('http://localhost/**',r=>r.fulfill({body:'<!doctype html><meta charset="utf-8"><main id="root"></main>',contentType:'text/html'}));await p.goto('http://localhost/');await p.unroute('http://localhost/**');await p.route('**/*',r=>r.abort());for(const f of ['clinical-workspace.css','clinical-care-ui.css'])await p.addStyleTag({content:fs.readFileSync(path.join(root,f),'utf8')});await p.addScriptTag({content:fs.readFileSync(path.join(root,'clinical-workspace.js'),'utf8')});await p.evaluate(({resume})=>{
 window.calls=[];window.gates={};window.release={};window.failed={};window.identity='a';window.gate=key=>gates[key]=new Promise(r=>release[key]=r);
 window.item={id:'cc_test',revision:1,kind:'surgery',status:'active',patient:{name:'합성 환자',breed:'합성 품종'},body:{species:'dog',weight:5,tasks:[],orders:[],wardChecks:[],infusions:[],anesthesiaSheet:{},careTeam:{},patientDemographics:{}}};
 window.item.patient={name:'합성 마취 환자',guardianName:'합성 보호자',chartNumber:'A-101'};window.item.created_at='2026-10-31T16:00:00Z';window.item.body.careTeam={veterinarianName:'합성 수의사'};window.item.body.anesthesiaSheet={operation:'합성 수술'};window.records=[window.item,{...structuredClone(window.item),id:'cc_closed',status:'closed',created_at:'2026-10-20T03:00:00Z',patient:{name:'이전 환자',guardianName:'다른 보호자',chartNumber:'B-202'},body:{...structuredClone(window.item.body),careTeam:{veterinarianName:'다른 수의사'}}}];window.medical=true;window.AnesthesiaRecord={sexLabel:()=>'',ageAt:()=>'',mount:(root,a)=>{root.innerHTML='<h3>'+a.item.patient.name+'</h3><button data-record '+(!a.canRecord?'disabled':'')+'>합성 기록</button>';}};
 if(resume)sessionStorage.setItem('carestep.anesthesia.resume:a',JSON.stringify({id:item.id,at:Date.now(),draft:{}}));
 window.app=ClinicalWorkspace.mount(document.querySelector('#root'),{ready:()=>true,identity:()=>identity,preferencesIdentity:()=>identity,externalTabs:true,medical:()=>window.medical,can:()=>window.medical,patient:()=>null,request:async(url,o={})=>{calls.push(url);if(gates[url])await gates[url];if(failed[url])throw Error('합성 조회 실패');if(url.endsWith('/members'))return {members:[],userId:'staff'};if(url.endsWith('/rooms'))return {canConfigure:true,items:[{id:'r',kind:'dog',name:'합성 입원실',care_state:'ready',patientCase:structuredClone(item)}]};if(o.method==='POST'&&url.endsWith('/cases')){window.createdRequest=JSON.parse(o.body);item.patient={...createdRequest.quickPatient};item.body.quickPatient=createdRequest.quickPatient;return {id:item.id,revision:1};}if(o.method==='POST'&&url.endsWith('/events')){const body=JSON.parse(o.body);window.deletedRequest={url,body};records=records.filter(r=>!url.includes('/'+r.id+'/'));return {ok:true};}if(url.endsWith('/cases/cc_closed'))return {item:structuredClone(records.find(r=>r.id==='cc_closed')),canManage:window.medical};if(url.endsWith('/cases/cc_test'))return {item:structuredClone(item),events:[],canRecord:true,canManage:true};if(url.includes('/cases?deleted=1'))return {items:[{...structuredClone(records[1]),id:'cc_deleted',body:{...structuredClone(records[1].body),deleted:true}}],canManage:true};if(url.includes('/cases'))return {items:structuredClone(records),canManage:true};return {items:[],canManage:true};}});
 },{resume});t.after(async()=>{await p.evaluate(()=>{Object.values(release).forEach(r=>r());app.dispose();});await p.close();assert.deepEqual(errors,[]);});return p;}

for(const width of [390,820,1440,1920])test('anesthesia entry uses full width searchable cards and responsive filters '+width,async t=>{
 const p=await fixture(t,{width});await p.evaluate(()=>app.open('surgery'));
 assert.equal(await p.locator('[data-anesthesia-search] label').count(),5);assert.equal(await p.locator('[data-cl-case]').count(),2);assert.equal(await p.locator('.cl-case-browser').count(),0);assert.equal(await p.locator('.cl-empty').count(),0);assert.equal(await p.locator('.cc-performer').count(),0);assert.ok(await p.locator('[data-cl-action=new]').isVisible());assert.match(await p.locator('[data-cl-case=cc_test]').innerText(),/2026-11-01/);assert.match(await p.locator('[data-cl-case=cc_test]').innerText(),/합성 보호자/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const rect=await p.locator('.cl-anesthesia-list').boundingBox();assert.ok(rect.width>=width-20);if(width>=1440){const boxes=await p.locator('[data-anesthesia-search] input,[data-anesthesia-search] select').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().y));assert.ok(Math.max(...boxes)-Math.min(...boxes)<2);}
 await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-list-'+width+'.png'),fullPage:true});
});
test('search supports patient guardian chart status Korean date and veterinarian without repeated fetching',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));const count=await p.evaluate(()=>calls.filter(x=>x.includes('/cases')).length);
 for(const query of ['A-101','합성 보호자','합성 마취 환자']){await p.locator('[name=query]').fill(query);await p.locator('[data-anesthesia-search] button').click();assert.equal(await p.locator('[data-cl-case]').count(),1);assert.ok(await p.locator('[data-cl-case=cc_test]').isVisible());}
 await p.locator('[name=query]').fill('');await p.locator('[name=status]').selectOption('closed');await p.locator('[data-anesthesia-search] button').click();assert.equal(await p.locator('[data-cl-case]').count(),1);assert.ok(await p.locator('[data-cl-case=cc_closed]').isVisible());
 await p.locator('[name=status]').selectOption('');await p.locator('[name=from]').fill('2026-11-01');await p.locator('[name=to]').fill('2026-11-01');await p.locator('[name=vet]').fill('합성 수의사');await p.locator('[data-anesthesia-search] button').click();assert.equal(await p.locator('[data-cl-case]').count(),1);assert.equal(await p.evaluate(()=>calls.filter(x=>x.includes('/cases')).length),count);
 await p.locator('[name=to]').fill('2026-10-01');await p.locator('[data-anesthesia-search] button').click();assert.ok(await p.locator('[data-anesthesia-filter-error]').isVisible());assert.equal(await p.locator('[data-cl-case]').count(),1);
});
test('record opens and returns to the filtered list without extra requests or loss of filters',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));await p.locator('[name=query]').fill('A-101');await p.locator('[data-anesthesia-search] button').click();await p.locator('[data-cl-case=cc_test]').click();await p.locator('[data-record]').waitFor();assert.equal(await p.locator('[data-anesthesia-search]').count(),0);await p.locator('[data-cl-action=anesthesia-list]').click();assert.equal(await p.locator('[name=query]').inputValue(),'A-101');assert.equal(await p.locator('[data-cl-case]').count(),1);assert.equal(await p.locator('[data-record]').count(),0);
});
test('deleted records remain separately queryable and new record keeps registered patient mode',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));await p.locator('[data-cl-action=new]').click();assert.equal(await p.locator('.cl-dialog h2').innerText(),'새 마취 기록');await p.locator('[data-cl-mode=registered]').click();assert.ok(await p.locator('[data-cl-patient-query]').count()||await p.locator('[data-cl-registered]').isVisible());await p.locator('[data-cl-action=close]').click();if(await p.locator('[data-cl-action=discard]').isVisible())await p.locator('[data-cl-action=discard]').click();await p.locator('[name=status]').selectOption('deleted');await p.locator('[data-anesthesia-search] button').click();await p.locator('[data-cl-case=cc_deleted]').waitFor();assert.equal(await p.locator('[data-cl-case]').count(),1);assert.match(await p.locator('[data-cl-case=cc_deleted]').innerText(),/삭제됨/);
});
test('account change clears filters and staff without creation rights can view records',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));await p.locator('[name=query]').fill('A-101');await p.locator('[data-anesthesia-search] button').click();await p.evaluate(()=>{identity='b';medical=false;return app.open('surgery');});assert.equal(await p.locator('[name=query]').inputValue(),'');assert.equal(await p.locator('[data-cl-action=new]').count(),0);assert.equal(await p.locator('[data-cl-case]').count(),2);
});

for(const accept of [false,true])test('anesthesia list delete confirmation '+accept,async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));
 p.once('dialog',async d=>{assert.match(d.message(),/이전 환자.*2026-10-20/);await (accept?d.accept():d.dismiss());});
 await p.locator('[data-list-delete=cc_closed]').click();
 if(accept)await p.waitForFunction(()=>!!window.deletedRequest);
 await p.waitForFunction(()=>!document.querySelector('[data-list-delete]')?.disabled);
 assert.equal(await p.locator('[data-cl-case=cc_closed]').count(),accept?0:1);
 assert.equal(await p.locator('[data-cl-case=cc_test]').count(),1);
 if(accept)assert.equal(await p.evaluate(()=>deletedRequest.body.kind),'case.delete');
 else assert.equal(await p.evaluate(()=>!!window.deletedRequest),false);
});
test('anesthesia list failed deletion retains record and read-only hides delete',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));
 await p.evaluate(()=>failed['/practice/clinical/cases/cc_closed/events']=true);
 p.once('dialog',d=>d.accept());await p.locator('[data-list-delete=cc_closed]').click();
 await p.getByText(/삭제하지 못했습니다/).waitFor();assert.equal(await p.locator('[data-cl-case]').count(),2);
 await p.evaluate(()=>{medical=false;app.open('surgery');});assert.equal(await p.locator('[data-list-delete]').count(),0);
});

test('anesthesia pending list delete cannot cross hospital identity',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));await p.evaluate(()=>{gate('/practice/clinical/cases/cc_closed');});await p.locator('[data-list-delete=cc_closed]').click();await p.evaluate(()=>{identity='b';release['/practice/clinical/cases/cc_closed']();});await p.waitForFunction(()=>!document.querySelector('[data-list-delete]')?.disabled||identity==='b');assert.equal(await p.evaluate(()=>!!window.deletedRequest),false);
});

test('anesthesia quick input sends optional guardian name with patient and chart',async t=>{
 const p=await fixture(t);await p.evaluate(()=>app.open('surgery'));await p.locator('[data-cl-action=new]').click();const d=p.locator('.cl-dialog');await d.locator('[data-cl-mode=quick]').click();await d.locator('[name=quickName]').fill('빠른 마취환자');await d.locator('[name=chartNumber]').fill('QUICK-101');await d.locator('[name=quickGuardianName]').fill('빠른 보호자');await d.locator('[name=species]').selectOption('dog');await d.locator('[type=submit]').click();await p.waitForFunction(()=>!!window.createdRequest);assert.deepEqual(await p.evaluate(()=>createdRequest.quickPatient),{name:'빠른 마취환자',chartNumber:'QUICK-101',guardianName:'빠른 보호자'});assert.equal(await p.evaluate(()=>createdRequest.patientId),undefined);
});
