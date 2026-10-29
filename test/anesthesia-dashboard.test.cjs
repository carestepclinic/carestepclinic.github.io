const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');let browser;before(async()=>{browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});});after(async()=>browser?.close());
async function fixture(t,{width=1440,closed=false,historyError=false,long=false,medical=true}={}){
 const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<html lang="ko"><meta charset="utf-8"><body style="margin:12px;font-family:sans-serif"><main id="root"></main></body></html>'}));await p.goto('http://localhost/');
 await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});
 for(const f of ['clinical-compact.js','anesthesia-efficiency.js','anesthesia-dashboard.js','anesthesia-record.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',f)});
 await p.evaluate(({closed,historyError,long,medical})=>{
  const base=Date.parse('2026-10-20T03:25:00Z'),date=m=>new Date(base+m*60000).toISOString();
  const row=(id,m,body)=>({id,revision:m+50,kind:'anesthesia.entry',recorded_at:date(m),body:{recordId:id,observedAt:date(m),recorder:{id:'staff',name:'합성 수행자'},...body}});
  window.fixtureEvents=[row('prior',-5,{type:'marker',marker:'medication',note:'전처치',administration:{name:'합성 전처치',amount:1,unit:'mL',route:'IM'}}),row('start',0,{type:'marker',marker:'anesthesiaStart'}),row('m1',1,{type:'measurement',values:{heartRate:100}}),row('m2',38,{type:'measurement',values:{heartRate:95}}),row('end',long?480:40,{type:'marker',marker:'anesthesiaEnd'})];
  for(let i=0;i<10;i++)window.fixtureEvents.push(row('measure'+i,i*5,{type:'measurement',values:{heartRate:110-i*2,respiratoryRate:24-i%3,meanPressure:75-i%4,spo2:98,etco2:36+i%3,temperature:38.2,systolic:110,diastolic:65}}));
  window.saved=[];window.printed='';window.requested=[];window.failHistory=historyError;
  const item={id:'synthetic',revision:600,status:closed?'closed':'active',patient:{name:'합성 마취 기록'},body:{species:'dog',weight:5,anesthesiaPreparation:[]}};
  window.open=()=>({document:{open(){},write(s){window.printed=s;},close(){}}});
  AnesthesiaRecord.mount(document.getElementById('root'),{item,medical,canRecord:medical,view:{},valid:()=>true,performer:()=> 'staff',members:[{id:'staff',name:'합성 수행자'}],caseHistory:{events:[],hasMoreEvents:true,next:100},
   api:async url=>{window.requested.push(url);if(url==='/workflows')return {items:[]};if(url.includes('?before=')){if(window.failHistory)throw Error('연결 실패');return {events:[{id:'plan',kind:'calculation',revision:2,recorded_at:date(-10),body:{calculator:'anesthesia',summary:'Propofol · 합성 계획 1 mL'}}],hasMoreEvents:false};}return {events:window.fixtureEvents,hasMore:false};},presets:async()=>({items:[]}),reload(){},
   modal:(title,html,submit)=>{const d=document.createElement('section');d.className='test-dialog';d.innerHTML='<h2>'+title+'</h2><form>'+html+'<button type="submit">저장</button><p role="status"></p></form>';document.body.append(d);const f=d.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{await submit(f);d.remove();}catch(err){f.querySelector('[role=status]').textContent=err.message;}};return d;},
   save:async(kind,data)=>window.saved.push({kind,data})});
 },{closed,historyError,long,medical});await p.locator('.ar-medication').waitFor({state:'attached'});await p.waitForFunction(()=>document.querySelector('.ar-medication').textContent.includes('Propofol')||document.querySelector('.ar-medication [role=alert]'));return {p,errors};
}
for(const width of [320,390,820,1440])test(`dashboard keeps controls reachable and input draft through tab changes ${width}`,async t=>{
 const {p,errors}=await fixture(t,{width});const dash=p.locator('.ar-dashboard');assert.ok(await dash.isVisible());assert.equal(await p.locator('.ad-entry-tabs button').count(),3);assert.equal(await p.locator('[data-ar=induction]').isVisible(),false);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.locator('[data-ar-overview] [data-series]').count(),5);assert.ok(await p.locator('[data-ae-inline]').isVisible());
 if(width===1440){const chart=await p.locator('.ad-monitor').boundingBox(),entry=await p.locator('.ad-entry').boundingBox();assert.ok(chart.x+chart.width<=entry.x);assert.ok(chart.y<500);}
 await p.locator('[data-ae-inline] [name=heartRate]').fill('123');await p.locator('[data-ar=entry-tab][data-key=medication]').click();assert.ok(await p.locator('[data-ar=induction]').isVisible());assert.equal(await p.locator('[data-ae-inline]').isVisible(),false);
 await p.locator('[data-ar=entry-tab][data-key=procedure]').click();assert.ok(await p.locator('[data-ar=procedure]').isVisible());await p.locator('[data-ar=entry-tab][data-key=measurement]').click();assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'123');assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
 await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-dashboard-'+width+'.png'),fullPage:width<1000});
});
test('legend toggles a series without losing measurement draft; displayed point opens exact record',async t=>{
 const {p,errors}=await fixture(t);await p.locator('[data-ae-inline] [name=heartRate]').fill('124');await p.locator('[data-ad-series=spo2]').uncheck();assert.equal(await p.locator('[data-ar-overview] [data-series=spo2]').count(),0);assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'124');
 await p.locator('[data-ar-overview] [data-series=heartRate] [data-ar-point=measure3]').press('Enter');const d=p.locator('.test-dialog');assert.equal(await d.locator('[name=observedAt]').inputValue(),'2026-10-20T12:40');assert.equal(await d.locator('[name=heartRate]').inputValue(),'104');assert.deepEqual(errors,[]);
});
test('missing start/end controls open editable time entry, never write on click',async t=>{
 const {p,errors}=await fixture(t);await p.locator('[data-timing=surgeryStart] [data-ar=next-event]').click();const quick=p.locator('[data-ae-quick]');assert.ok(await quick.isVisible());assert.match(await quick.innerText(),/수술 시작/);assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
});
test('induction and procedure actions each open the correct form',async t=>{
 const {p,errors}=await fixture(t);await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('[data-ar=induction]').click();assert.equal(await p.locator('.test-dialog [name=note]').inputValue(),'마취 유도');await p.locator('.test-dialog').evaluate(e=>e.remove());await p.locator('[data-ar=entry-tab][data-key=procedure]').click();await p.locator('[data-ar=procedure]').click();assert.equal(await p.locator('.test-dialog [name=marker]').inputValue(),'other');assert.equal(await p.locator('.test-dialog [data-ar-admin]').isVisible(),false);assert.deepEqual(errors,[]);
});
test('closed read-only dashboard exposes no record actions and retains print',async t=>{
 const {p,errors}=await fixture(t,{closed:true,medical:false,width:390});assert.equal(await p.locator('[data-ar=next-event]').count(),0);assert.equal(await p.locator('[data-ar=edit-time]').count(),0);await p.locator('[data-ar=entry-tab][data-key=medication]').click();assert.equal(await p.locator('[data-ar=induction]').count(),0);await p.locator('.ar-print-menu summary').click();await p.locator('[data-ar=print-all]').click();assert.match(await p.evaluate(()=>window.printed),/마취 기록지/);assert.deepEqual(errors,[]);
});


for(const width of [390,1440])test('clinical focus: one entry location and optional graph preserve measurement input '+width,async t=>{
 const {p,errors}=await fixture(t,{width}),chart=p.locator('.ad-monitor'),entry=p.locator('.ad-entry');assert.equal(await p.locator('[data-ar=entry-focus]').count(),0);assert.equal(await p.locator('[data-ae-inline]').count(),1);assert.ok(await p.locator('.ad-values').isVisible());
 assert.equal(await chart.evaluate(e=>e.open),width>820);await p.locator('[data-ae-inline] [name=heartRate]').fill('117');await chart.locator('summary').first().click();await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('[data-ar=entry-tab][data-key=measurement]').click();assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'117');assert.equal(await chart.evaluate(e=>e.open),width<=820);assert.equal(await p.evaluate(()=>window.saved.length),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(width<=820){const e=await entry.boundingBox(),g=await chart.boundingBox();assert.ok(e.y<g.y);}await p.screenshot({path:path.resolve(__dirname,'../../clinical-focus-anesthesia-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});

for(const width of [320,390,820,1440])test('care simple: phase button and graph labels preserve entry without redraw '+width,async t=>{
 const {p,errors}=await fixture(t,{width});assert.ok(await p.locator('.ar-stage-action').isVisible());assert.equal(await p.locator('.ar-stage-action [data-ar=next-event]').count(),1);assert.match(await p.locator('[data-ar-overview]').textContent(),/마취 시작 12:25/);assert.match(await p.locator('[data-ar-overview]').textContent(),/마취 종료 13:05/);
 await p.locator('[data-ae-inline] [name=heartRate]').fill('117');await p.evaluate(()=>window.originalInput=document.querySelector('[data-ae-inline] [name=heartRate]'));await p.locator('[data-ar=entry-tab][data-key=medication]').click();await p.locator('[data-ar=entry-tab][data-key=measurement]').click();assert.equal(await p.evaluate(()=>window.originalInput===document.querySelector('[data-ae-inline] [name=heartRate]')),true);assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'117');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(__dirname,'../../care-simple-anesthesia-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);
});

test('care simple: all four phase labels remain readable at close times',async t=>{
 const p=await browser.newPage({viewport:{width:390,height:500}});t.after(()=>p.close());await p.setContent('<html lang="ko"><body style="font-family:sans-serif;margin:8px"><main></main></body></html>');await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});for(const file of ['anesthesia-record.js','anesthesia-dashboard.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',file)});
 await p.evaluate(()=>{const start=Date.parse('2026-10-29T03:35:00Z'),events=['anesthesiaStart','surgeryStart','surgeryEnd','anesthesiaEnd'].map((marker,i)=>({type:'marker',marker,observedAt:new Date(start+i*60000).toISOString()}));document.querySelector('main').innerHTML=AnesthesiaDashboard.overviewGraph(events,start,60,undefined,true);});assert.equal(await p.locator('[data-ar-event]').count(),4);const boxes=await p.locator('.ar-phase-label').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].x>=0&&boxes[i].right<=390);for(let j=0;j<i;j++)assert.ok(boxes[i].y>=boxes[j].bottom||boxes[i].x>=boxes[j].right||boxes[i].right<=boxes[j].x);}await p.screenshot({path:path.resolve(__dirname,'../../care-simple-events-mobile.png')});
});
