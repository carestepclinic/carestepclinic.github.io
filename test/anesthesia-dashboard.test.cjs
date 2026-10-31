const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');let browser;before(async()=>{browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});});after(async()=>browser?.close());
async function fixture(t,{width=1440,closed=false,historyError=false,long=false,medical=true,configured=false,onePage=false,pending=false,recordState='recovery'}={}){
 const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<html lang="ko"><meta charset="utf-8"><body style="margin:12px;font-family:sans-serif"><main id="root"></main></body></html>'}));await p.goto('http://localhost/');
 await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});await p.addStyleTag({path:path.resolve(__dirname,'../clinical-care-ui.css')});
 await p.addStyleTag({content:'@font-face{font-family:Pretendard;src:url(data:font/woff2;base64,'+require("node:fs").readFileSync(path.resolve(__dirname,"../pretendard-variable-1.3.9.woff2")).toString("base64")+') format("woff2");font-weight:100 900}body{font-family:Pretendard,sans-serif}'});await p.evaluate(()=>document.fonts.ready);
 for(const f of ['clinical-compact.js','anesthesia-efficiency.js','anesthesia-dashboard.js','anesthesia-record.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',f)});
 await p.evaluate(({closed,historyError,long,medical,configured,onePage,pending,recordState})=>{
  const base=Date.parse('2026-10-20T03:25:00Z'),date=m=>new Date(base+m*60000).toISOString();
  const row=(id,m,body)=>({id,revision:m+50,kind:'anesthesia.entry',recorded_at:date(m),body:{recordId:id,observedAt:date(m),recorder:{id:'staff',name:'합성 수행자'},...body}});
  window.fixtureEvents=[row('prior',-5,{type:'marker',marker:'medication',note:'전처치',administration:{name:'합성 전처치',amount:1,unit:'mL',route:'IM'}}),row('start',0,{type:'marker',marker:'anesthesiaStart'}),row('m1',1,{type:'measurement',values:{heartRate:100}}),row('m2',38,{type:'measurement',values:{heartRate:95}}),row('end',long?480:40,{type:'marker',marker:'anesthesiaEnd'})];
  for(let i=0;i<10;i++)window.fixtureEvents.push(row('measure'+i,i*5,{type:'measurement',values:{heartRate:110-i*2,respiratoryRate:24-i%3,meanPressure:75-i%4,spo2:98,etco2:36+i%3,temperature:38.2,systolic:110,diastolic:65}}));
  if(configured){const prep={id:'prep1',name:'합성 약물',product:'합성 제품',strength:10,strengthUnit:'mg/mL',route:'IV'};window.fixtureEvents.push(row('settings',5,{type:'marker',marker:'settings',settings:{agent:'합성 마취제',concentration:1.5,ventilation:'assisted',oxygen:'2 L/min'}}),row('given',6,{type:'marker',marker:'medication',administration:{name:prep.name,amount:.5,unit:'mL',route:'IV',preparation:prep}}));}if(recordState==='prep')window.fixtureEvents=window.fixtureEvents.filter(e=>e.body.marker==='medication');else if(recordState==='live')window.fixtureEvents=window.fixtureEvents.filter(e=>e.body.marker!=='anesthesiaEnd');window.saved=[];window.printed='';window.requested=[];window.failHistory=historyError;
  const item={id:'synthetic',revision:600,status:closed?'closed':'active',patient:{name:'합성 마취 기록'},body:{species:'dog',weight:5,anesthesiaMedicationPlans:pending?[{id:'pending1',status:'pending',phase:'induction',weight:5,species:'dog',medication:{drug:'합성 대기 약물',amount:.4,route:'IV',doseUnit:'mg',strength:10,strengthUnit:'mg'}}]:[],anesthesiaPreparation:configured?[{id:'prep1',name:'합성 약물',product:'합성 제품',strength:10,strengthUnit:'mg/mL',route:'IV'}]:[]}};
  window.open=()=>({document:{open(){},write(s){window.printed=s;},close(){}}});
  AnesthesiaRecord.mount(document.getElementById('root'),{item,onePage,phaseAction:mode=>window.phaseAction=mode,medical,canRecord:medical,view:{},valid:()=>true,performer:()=> 'staff',members:[{id:'staff',name:'합성 수행자',display_name:'합성 수행자'}],caseHistory:{events:[],hasMoreEvents:true,next:100},
   api:async url=>{window.requested.push(url);if(url==='/workflows')return {items:configured?[{body:{kind:'anesthesia-template',measurementOrder:['systolic','temperature'],reviewMinutes:5}}]:[]};if(url.includes('?before=')){if(window.failHistory)throw Error('연결 실패');return {events:[{id:'plan',kind:'calculation',revision:2,recorded_at:date(-10),body:{calculator:'anesthesia',summary:'Propofol · 합성 계획 1 mL'}}],hasMoreEvents:false};}return {events:window.fixtureEvents,hasMore:false};},presets:async()=>({items:[]}),reload(){},
   modal:(title,html,submit)=>{const d=document.createElement('section');d.className='test-dialog';d.innerHTML='<h2>'+title+'</h2><form>'+html+'<button type="submit">저장</button><p role="status"></p></form>';document.body.append(d);const f=d.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{await submit(f);d.remove();}catch(err){f.querySelector('[role=status]').textContent=err.message;}};return d;},
   save:async(kind,data)=>{if(window.holdSave)await new Promise(resolve=>window.releaseSave=resolve);if(window.failSave)throw Error('Synthetic offline');window.saved.push({kind,data});}});
 },{closed,historyError,long,medical,configured,onePage,pending,recordState});await p.locator('.ar-medication').waitFor({state:'attached'});await p.waitForFunction(()=>document.getElementById('root').textContent.includes('Propofol')||document.querySelector('.ar-medication [role=alert]'));return {p,errors};
}
for(const width of [320,390,820,1440])test(`dashboard keeps controls reachable and input draft through tab changes ${width}`,async t=>{
 const {p,errors}=await fixture(t,{width});const dash=p.locator('.ar-dashboard');assert.ok(await dash.isVisible());assert.equal(await p.locator('.ad-entry-tabs button').count(),3);assert.equal(await p.locator('[data-ar=induction]').isVisible(),false);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.locator('[data-ar-overview]').count(),1);assert.ok(await p.locator('[data-ae-inline]').isVisible());
 if(width===1440){const chart=await p.locator('.ad-monitor').boundingBox(),entry=await p.locator('.ad-entry').boundingBox();assert.ok(entry.x+entry.width<=chart.x);assert.ok(chart.y<500);}
 await p.locator('[data-ae-inline] [name=heartRate]').fill('123');await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('.ar-drug-actions>summary').click();assert.ok(await p.locator('[data-ar=induction]').isVisible());assert.equal(await p.locator('[data-ae-inline]').isVisible(),false);
 await p.locator('[data-ar=entry-tab][data-key=procedure]').click();assert.ok(await p.locator('[data-ar=procedure]').isVisible());await p.locator('[data-ar=entry-tab][data-key=measurement]').click();assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'123');assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
 await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-dashboard-'+width+'.png'),fullPage:width<1000});
});
test('legend toggles a series without losing measurement draft; displayed point opens exact record',async t=>{
 const {p,errors}=await fixture(t);await p.locator('[data-ae-inline] [name=heartRate]').fill('124');await p.locator('.ad-view-settings').evaluate(e=>e.open=true);await p.locator('[data-ad-series=spo2]').uncheck();assert.equal(await p.locator('[data-ar-overview] [data-series=spo2]').isVisible(),false);assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'124');
 await p.locator('[data-ar-overview] [data-series=heartRate] [data-ar-point=measure3]').press('Enter');const d=p.locator('.test-dialog');assert.equal(await d.locator('[name=observedAt]').inputValue(),'2026-10-20T12:40');assert.equal(await d.locator('[name=heartRate]').inputValue(),'104');assert.deepEqual(errors,[]);
});
test('missing start/end controls open editable time entry, never write on click',async t=>{
 const {p,errors}=await fixture(t);await p.locator('.ad-time-edit>summary').click();await p.locator('.ad-time-edit [data-ar=next-event][data-key=surgeryStart]').click();const quick=p.locator('[data-ae-quick]');assert.ok(await quick.isVisible());assert.match(await quick.innerText(),/수술 시작/);assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
});
test('induction and procedure actions each open the correct form',async t=>{
 const {p,errors}=await fixture(t);await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('.ar-drug-actions>summary').click();await p.locator('[data-ar=induction]').click();assert.equal(await p.locator('.test-dialog [name=note]').inputValue(),'마취 유도');await p.locator('.test-dialog').evaluate(e=>e.remove());await p.locator('[data-ar=entry-tab][data-key=procedure]').click();await p.locator('[data-ar=procedure]').click();assert.equal(await p.locator('.test-dialog [name=marker]').inputValue(),'other');assert.equal(await p.locator('.test-dialog [data-ar-admin]').isVisible(),false);assert.deepEqual(errors,[]);
});
test('closed read-only dashboard exposes no record actions and retains print',async t=>{
 const {p,errors}=await fixture(t,{closed:true,medical:false,width:390});assert.equal(await p.locator('[data-ar=next-event]').count(),0);assert.equal(await p.locator('[data-ar=edit-time]').count(),0);await p.locator('[data-ar=entry-tab][data-key=medication]').click();assert.equal(await p.locator('[data-ar=induction]').count(),0);await p.locator('.ar-print-menu summary').click();await p.locator('[data-ar=print-all]').click();assert.match(await p.evaluate(()=>window.printed),/마취 기록지/);assert.deepEqual(errors,[]);
});


for(const width of [390,1440])test('clinical focus: one entry location and optional graph preserve measurement input '+width,async t=>{
 const {p,errors}=await fixture(t,{width}),chart=p.locator('.ad-monitor'),entry=p.locator('.ad-entry');assert.equal(await p.locator('[data-ar=entry-focus]').count(),0);assert.equal(await p.locator('[data-ae-inline]').count(),1);assert.equal(await p.locator('.ad-values').count(),0);assert.ok(await p.locator('.ae-metric>small').first().isVisible());
 assert.equal(await chart.evaluate(e=>e.open),true);await p.locator('[data-ae-inline] [name=heartRate]').fill('117');await chart.locator('summary').first().click();await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('[data-ar=entry-tab][data-key=measurement]').click();assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'117');assert.equal(await chart.evaluate(e=>e.open),false);assert.equal(await p.evaluate(()=>window.saved.length),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(width<=820){const e=await entry.boundingBox(),g=await chart.boundingBox();assert.ok(e.y<g.y);}await p.screenshot({path:path.resolve(__dirname,'../../clinical-focus-anesthesia-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});

for(const width of [320,390,820,1440])test('care simple: phase button and graph labels preserve entry without redraw '+width,async t=>{
 const {p,errors}=await fixture(t,{width});assert.ok(await p.locator('.ar-stage-action').isVisible());assert.equal(await p.locator('.ar-stage-action [data-ar=next-event]').count(),1);assert.match(await p.locator('.ad-time-line').innerText(),/12:25/);assert.match(await p.locator('.ad-time-line').innerText(),/13:05/);
 await p.locator('[data-ae-inline] [name=heartRate]').fill('117');await p.evaluate(()=>window.originalInput=document.querySelector('[data-ae-inline] [name=heartRate]'));await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('[data-ar=entry-tab][data-key=measurement]').click();assert.equal(await p.evaluate(()=>window.originalInput===document.querySelector('[data-ae-inline] [name=heartRate]')),true);assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'117');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(__dirname,'../../care-simple-anesthesia-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});

test('care simple: all four phase labels remain readable at close times',async t=>{
 const p=await browser.newPage({viewport:{width:390,height:500}});t.after(()=>p.close());await p.setContent('<html lang="ko"><body style="font-family:sans-serif;margin:8px"><main></main></body></html>');await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});await p.addStyleTag({path:path.resolve(__dirname,'../clinical-care-ui.css')});for(const file of ['anesthesia-record.js','anesthesia-dashboard.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',file)});
 await p.evaluate(()=>{const start=Date.parse('2026-10-29T03:35:00Z'),events=['anesthesiaStart','surgeryStart','surgeryEnd','anesthesiaEnd'].map((marker,i)=>({type:'marker',marker,observedAt:new Date(start+i*60000).toISOString()}));document.querySelector('main').innerHTML=AnesthesiaDashboard.overviewGraph(events,start,60,undefined,true);});assert.equal(await p.locator('[data-ar-event]').count(),4);const boxes=await p.locator('.ar-phase-label').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].x>=0&&boxes[i].right<=390);for(let j=0;j<i;j++)assert.ok(boxes[i].y>=boxes[j].bottom||boxes[i].x>=boxes[j].right||boxes[i].right<=boxes[j].x);}await p.screenshot({path:path.resolve(__dirname,'../../care-simple-events-mobile.png')});
});

test('simple workflow: independent units share time axis and default extra fields stay available',async t=>{
 const {p,errors}=await fixture(t);assert.equal(await p.locator('[data-ar-overview]').count(),1);assert.equal(await p.locator('[data-ar-overview] [data-series]').count(),5);
 assert.equal(await p.locator('[data-ae-inline]> .cl-form-grid input[type=number]').count(),6);assert.equal(await p.locator('[name=systolic]').isVisible(),false);assert.equal(await p.locator('[name=meanPressure]').isVisible(),true);assert.equal(await p.locator('.ad-settings').isVisible(),true);assert.equal(await p.locator('.ad-settings').evaluate(e=>!!e.closest('details')),false);
 await p.locator('[data-ae-inline] details').filter({hasText:'추가 측정 항목'}).locator('summary').click();await p.locator('[name=systolic]').fill('101');await p.locator('.ad-view-settings').evaluate(e=>e.open=true);await p.locator('[data-ad-series=spo2]').uncheck();assert.equal(await p.locator('[name=systolic]').inputValue(),'101');assert.equal(await p.locator('[name=systolic]').isVisible(),true);assert.equal(await p.locator('.ar-history-archive details details').count(),0);assert.deepEqual(errors,[]);
});

test('simple workflow: hospital template, visible settings and prepared drug last administration',async t=>{
 const {p,errors}=await fixture(t,{configured:true,width:390});await p.waitForFunction(()=>document.querySelector('[data-ae-inline]>.cl-form-grid input')?.name==='systolic');
 assert.equal(await p.locator('[data-ae-inline]>.cl-form-grid input').count(),2);assert.match(await p.locator('.ad-settings').innerText(),/합성 마취제 · 설정 농도 1.5%/);assert.match(await p.locator('.ad-settings').innerText(),/보조환기/);
 await p.locator('.ad-settings [data-ar=adjust-setting][data-key=agent]').click();assert.equal(await p.locator('[data-ae-quick] [name=value]').inputValue(),'');assert.match(await p.locator('[data-ae-quick]').innerText(),/이전: 합성 마취제 1.5%/);assert.equal(await p.evaluate(()=>window.saved.length),0);await p.locator('[data-ae-quick-close]').click();
 await p.locator('[data-ar=entry-tab][data-key=medication]').click();assert.match(await p.locator('[data-ar=prepared-use]').innerText(),/누적 0.5 mL/);assert.match(await p.locator('[data-ar=prepared-use]').innerText(),/최근 2026-10-20 12:31/);await p.locator('[data-ar=prepared-use]').click();assert.equal(await p.locator('[data-ad-panel=medication] [data-ae-quick]').count(),1);assert.equal(await p.locator('[data-ae-quick] [name=value]').inputValue(),'');assert.equal(await p.evaluate(()=>window.saved.length),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
});
for(const width of [320,390,1440])test('restored graph: integrated default, separate plots and table preserve inputs '+width,async t=>{
 const {p,errors}=await fixture(t,{width});assert.ok(await p.locator('[data-ar-overview]').isVisible());await p.locator('[name=heartRate]').fill('121');await p.locator('.ad-view-settings>summary').click();await p.locator('[data-ar=display][data-key=graphs]').click();assert.ok(await p.locator('.ar-detail-graphs').isVisible());assert.equal(await p.locator('[name=heartRate]').inputValue(),'121');await p.locator('[data-ar=display][data-key=table]').click();assert.ok(await p.locator('.ar-table').isVisible());await p.locator('[data-ar=display][data-key=summary]').click();assert.ok(await p.locator('[data-ar-overview]').isVisible());assert.equal(await p.locator('[name=heartRate]').inputValue(),'121');assert.equal(await p.evaluate(()=>window.saved.length),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.screenshot({path:path.resolve(__dirname,'../../restored-graph-'+width+'.png'),fullPage:true});
});

test('focus UI: missing settings are grouped, history remains reachable and current input survives',async t=>{
 const {p,errors}=await fixture(t,{width:390});assert.equal(await p.locator('.ad-missing-settings').evaluate(e=>e.open),false);assert.equal(await p.locator('.ad-settings [data-ar=adjust-setting]').first().isVisible(),false);assert.equal(await p.locator('.ar-record-bar [role=status]').count(),0);
 await p.locator('[name=heartRate]').fill('125');await p.locator('.ad-missing-settings>summary').click();await p.locator('[data-ar=adjust-setting][data-key=agent]').click();assert.ok(await p.locator('[data-ae-quick]').isVisible());await p.locator('[data-ae-quick-close]').click();assert.equal(await p.locator('[name=heartRate]').inputValue(),'125');
 assert.equal(await p.locator('.ar-history-archive').evaluate(e=>e.open),false);await p.locator('.ar-history-archive>summary').click();await p.locator('[data-ar-lazy=audit]').locator('..').locator(':scope>summary').click();assert.ok(await p.locator('.ar-audit p').count()>0);
 await p.locator('.ar-history-archive>summary').click();await p.locator('.ad-missing-settings>summary').click();await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'../../focus-anesthesia-390.png'),fullPage:true});assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
});


test('care flow: phase emphasis follows existing records without inventing events',()=>{
 const {recordPhase}=require('../anesthesia-dashboard.js'),item={status:'active',body:{}};
 assert.equal(recordPhase(item,[]),'prep');
 assert.equal(recordPhase(item,[{type:'marker',marker:'medication'}]),'prep');
 assert.equal(recordPhase(item,[{type:'marker',marker:'anesthesiaStart'}]),'live');
 assert.equal(recordPhase(item,[{type:'measurement',values:{heartRate:120}}]),'live');
 assert.equal(recordPhase(item,[{marker:'anesthesiaEnd',voided:true}]),'prep');
 assert.equal(recordPhase(item,[{marker:'anesthesiaEnd'}]),'recovery');
 assert.equal(recordPhase({status:'active',body:{phase:'recovery'}},[]),'recovery');
 assert.equal(recordPhase({status:'closed'},[]),'closed');
});
for(const width of [320,390,1440])test('care flow: recovery actions and compact details preserve active input '+width,async t=>{
 const {p,errors}=await fixture(t,{width,onePage:true});
 assert.equal(await p.locator('.ar-single-page').getAttribute('data-record-phase'),'recovery');
 assert.match(await p.locator('.ad-phase-badge').innerText(),/회복/);
 assert.ok(await p.locator('[data-ad-recovery=recovery]').isVisible());
 await p.locator('[name=heartRate]').fill('118');
 await p.locator('[data-ad-recovery=recovery]').click();assert.equal(await p.evaluate(()=>window.phaseAction),'recovery');
 assert.equal(await p.locator('[name=heartRate]').inputValue(),'118');
 assert.equal(await p.locator('.ad-view-settings').evaluate(e=>e.open),false);
 assert.equal(await p.locator('[data-ar=display][data-key=graphs]').isVisible(),false);
 await p.locator('.ad-view-settings>summary').click();await p.locator('[data-ar=display][data-key=graphs]').click();
 assert.equal(await p.locator('[name=heartRate]').inputValue(),'118');assert.equal(await p.evaluate(()=>window.saved.length),0);
 await p.screenshot({path:path.resolve(__dirname,'../../care-flow-debug-'+width+'.png'),fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).slice(0,15))));
 assert.equal(await p.locator('.ad-entry').evaluate(e=>getComputedStyle(e).maxHeight),'none');
 const size=await p.locator('[data-ar=medication]').evaluate(e=>({font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height}));assert.ok(size.font>=14&&size.height>=(width<=820?44:40),JSON.stringify(size));
 await p.locator('[data-ar=display][data-key=summary]').click();await p.locator('.ad-view-settings>summary').click();await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'../../care-flow-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});
test('care flow: pending and failed measurement save keeps values and allows one successful retry',async t=>{
 const {p,errors}=await fixture(t,{onePage:true});const f=p.locator('[data-ae-inline]');await f.locator('[name=heartRate]').fill('119');await p.evaluate(()=>{window.holdSave=true;window.failSave=true;});
 const original=await f.locator('[type=submit]').innerText();await f.locator('[type=submit]').click();assert.equal(await f.getAttribute('aria-busy'),'true');assert.equal(await f.locator('[type=submit]').innerText(),'저장 중…');assert.ok(await f.locator('[type=submit]').isDisabled());
 await f.evaluate(e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await p.evaluate(()=>window.releaseSave());await f.locator('[data-ae-state]').filter({hasText:'Synthetic offline'}).waitFor();
 assert.equal(await f.locator('[name=heartRate]').inputValue(),'119');assert.equal(await f.getAttribute('aria-busy'),null);assert.equal(await f.locator('[type=submit]').innerText(),original);assert.equal(await p.evaluate(()=>window.saved.length),0);
 await p.evaluate(()=>{window.holdSave=false;window.failSave=false;});await f.locator('[type=submit]').click();await f.locator('[type=submit]').filter({hasText:'저장 완료'}).waitFor();assert.equal(await p.evaluate(()=>window.saved.length),1);assert.deepEqual(errors,[]);
});

for(const width of [320,390,1440])test('care work: live recording prioritizes graph, keeps every timestamp reachable and preserves drafts '+width,async t=>{
 const {p,errors}=await fixture(t,{width,onePage:true,recordState:'live',configured:true});
 assert.equal(await p.locator('.ar-single-page').getAttribute('data-record-phase'),'live');assert.equal(await p.locator('.ad-patient-setup').evaluate(e=>e.open),false);assert.equal(await p.locator('.ad-medication-history').evaluate(e=>e.open),false);
 assert.ok(await p.locator('[data-ar=premedication]').isVisible());assert.ok(await p.locator('.ar-record-bar [data-ar=sheet]').isVisible());assert.equal(await p.locator('[data-ar=medication]').count(),1);assert.ok(await p.locator('[data-ar=medication]').isVisible());
 p.setDefaultTimeout(4000);await p.locator('[name=systolic]').fill('122');await p.locator('.ad-medication-history>summary').click();assert.ok(await p.locator('[data-ar=induction]').isVisible());await p.locator('.ad-prepared-settings>summary').click();await p.locator('[data-ar=prepared-use]').click();assert.ok(await p.locator('[data-ae-quick]').isVisible());await p.locator('[data-ae-quick-close]').click();assert.equal(await p.locator('[name=systolic]').inputValue(),'122');
 await p.locator('[data-ar=medication]').click();assert.equal(await p.locator('.test-dialog [name=marker]').inputValue(),'medication');assert.equal(await p.evaluate(()=>window.saved.length),0);await p.locator('.test-dialog').evaluate(e=>e.remove());
 await p.locator('.ad-medication-history>summary').click();const timing=await p.locator('.ad-time-line section').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,right:n.getBoundingClientRect().right,y:n.getBoundingClientRect().y,text:n.innerText})));assert.equal(timing.length,5);assert.ok(timing.every(b=>b.x>=0&&b.right<=width));if(width<821)assert.equal(new Set(timing.map(b=>Math.round(b.y))).size,3,JSON.stringify(timing));
 const graph=await p.locator('.ar-dashboard').boundingBox(),history=await p.locator('.ad-medication-history').boundingBox();assert.ok(graph.y<history.y);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'../../care-work-live-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});
test('care work: preparation keeps premedication and patient details open with no duplicate input actions',async t=>{
 const {p,errors}=await fixture(t,{onePage:true,recordState:'prep'});assert.equal(await p.locator('.ad-patient-setup').evaluate(e=>e.open),true);assert.ok(await p.locator('[data-ar=premedication]').isVisible());assert.ok(await p.locator('[data-ar=induction]').isVisible());assert.equal(await p.locator('[data-ar=sheet]').count(),1);assert.equal(await p.locator('[data-ar=medication]').count(),1);assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
});

for(const width of [390,768,1440])test('care consistency: pending versus completed drugs, one completed list and accessible controls '+width,async t=>{
 const {p,errors}=await fixture(t,{width,onePage:true,pending:true,configured:true,recordState:'live'});
 assert.ok(await p.locator('[data-ar=plan-give]').isVisible());assert.equal(await p.locator('[data-ar=plan-give]').innerText(),'투약 완료');assert.equal(await p.locator('.ad-recent-drugs').count(),0);assert.equal(await p.locator('.ar-medication-list').count(),1);
 assert.equal(await p.locator('.ad-medication-history').evaluate(e=>e.open),false);assert.match(await p.locator('.ad-medication-history>summary').innerText(),/투약 완료/);
 await p.locator('[name=systolic]').fill('123');await p.locator('.ad-medication-history>summary').click();assert.equal(await p.locator('[name=systolic]').inputValue(),'123');assert.equal(await p.locator('.ar-medication-list [data-ar=delete-medication]').count(),2);
 await p.locator('.ad-prepared-settings>summary').click();assert.ok(await p.locator('[data-ar=prepared-use]').isVisible());assert.equal(await p.evaluate(()=>window.saved.length),0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const size=await p.locator('[data-ar=plan-give]').evaluate(e=>({font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height}));assert.ok(size.font>=14&&size.height>=44,JSON.stringify(size));
 await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'../../care-consistency-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});
test('care consistency: pending dose click saves only an explicit administration and blocks double click',async t=>{
 const {p,errors}=await fixture(t,{onePage:true,pending:true,recordState:'live'});await p.evaluate(()=>window.holdSave=true);await p.locator('[data-ar=plan-give]').click();assert.ok(await p.locator('[data-ar=plan-give]').isDisabled());assert.equal(await p.evaluate(()=>window.saved.length),0);await p.evaluate(()=>window.releaseSave());await p.waitForFunction(()=>window.saved.length===1);assert.equal(await p.evaluate(()=>window.saved[0].data.planId),'pending1');assert.deepEqual(errors,[]);
});
