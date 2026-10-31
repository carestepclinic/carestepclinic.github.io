const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');let browser;before(async()=>{browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});});after(async()=>browser?.close());
async function fixture(t,{width=1440,closed=false,historyError=false,long=false,medical=true,configured=false,onePage=false,recordState='recovery'}={}){
 const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<html lang="ko"><meta charset="utf-8"><body style="margin:12px;font-family:sans-serif"><main id="root"></main></body></html>'}));await p.goto('http://localhost/');
 await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});await p.addStyleTag({path:path.resolve(__dirname,'../clinical-care-ui.css')});
 await p.addStyleTag({content:'@font-face{font-family:Pretendard;src:url(data:font/woff2;base64,'+require("node:fs").readFileSync(path.resolve(__dirname,"../pretendard-variable-1.3.9.woff2")).toString("base64")+') format("woff2");font-weight:100 900}body{font-family:Pretendard,sans-serif}'});await p.evaluate(()=>document.fonts.ready);
 for(const f of ['clinical-compact.js','anesthesia-efficiency.js','anesthesia-dashboard.js','anesthesia-record.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',f)});
 await p.evaluate(({closed,historyError,long,medical,configured,onePage,recordState})=>{
  const base=Date.parse('2026-10-20T03:25:00Z'),date=m=>new Date(base+m*60000).toISOString();
  const row=(id,m,body)=>({id,revision:m+50,kind:'anesthesia.entry',recorded_at:date(m),body:{recordId:id,observedAt:date(m),recorder:{id:'staff',name:'합성 수행자'},...body}});
  window.fixtureEvents=[row('prior',-5,{type:'marker',marker:'medication',note:'전처치',administration:{name:'합성 전처치',amount:1,unit:'mL',route:'IM'}}),row('start',0,{type:'marker',marker:'anesthesiaStart'}),row('m1',1,{type:'measurement',values:{heartRate:100}}),row('m2',38,{type:'measurement',values:{heartRate:95}}),row('end',long?480:40,{type:'marker',marker:'anesthesiaEnd'})];
  for(let i=0;i<10;i++)window.fixtureEvents.push(row('measure'+i,i*5,{type:'measurement',values:{heartRate:110-i*2,respiratoryRate:24-i%3,meanPressure:75-i%4,spo2:98,etco2:36+i%3,temperature:38.2,systolic:110,diastolic:65}}));
  if(configured){const prep={id:'prep1',name:'합성 약물',product:'합성 제품',strength:10,strengthUnit:'mg/mL',route:'IV'};window.fixtureEvents.push(row('settings',5,{type:'marker',marker:'settings',settings:{agent:'합성 마취제',concentration:1.5,ventilation:'assisted',oxygen:'2 L/min'}}),row('given',6,{type:'marker',marker:'medication',administration:{name:prep.name,amount:.5,unit:'mL',route:'IV',preparation:prep}}));}if(recordState==='prep')window.fixtureEvents=window.fixtureEvents.filter(e=>e.body.marker==='medication');else if(recordState==='live')window.fixtureEvents=window.fixtureEvents.filter(e=>e.body.marker!=='anesthesiaEnd');window.saved=[];window.printed='';window.requested=[];window.failHistory=historyError;
  const item={id:'synthetic',revision:600,status:closed?'closed':'active',patient:{name:'합성 마취 기록'},body:{species:'dog',weight:5,anesthesiaPreparation:configured?[{id:'prep1',name:'합성 약물',product:'합성 제품',strength:10,strengthUnit:'mg/mL',route:'IV'}]:[]}};
  window.open=()=>({document:{open(){},write(s){window.printed=s;},close(){}}});
  AnesthesiaRecord.mount(document.getElementById('root'),{item,onePage,phaseAction:mode=>window.phaseAction=mode,medical,canRecord:medical,view:{},valid:()=>true,performer:()=> 'staff',members:[{id:'staff',name:'합성 수행자'}],caseHistory:{events:[],hasMoreEvents:true,next:100},
   api:async url=>{window.requested.push(url);if(url==='/workflows')return {items:configured?[{body:{kind:'anesthesia-template',measurementOrder:['systolic','temperature'],reviewMinutes:5}}]:[]};if(url.includes('?before=')){if(window.failHistory)throw Error('연결 실패');return {events:[{id:'plan',kind:'calculation',revision:2,recorded_at:date(-10),body:{calculator:'anesthesia',summary:'Propofol · 합성 계획 1 mL'}}],hasMoreEvents:false};}return {events:window.fixtureEvents,hasMore:false};},presets:async()=>({items:[]}),reload(){},
   modal:(title,html,submit)=>{const d=document.createElement('section');d.className='test-dialog';d.innerHTML='<h2>'+title+'</h2><form>'+html+'<button type="submit">저장</button><p role="status"></p></form>';document.body.append(d);const f=d.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{await submit(f);d.remove();}catch(err){f.querySelector('[role=status]').textContent=err.message;}};return d;},
   save:async(kind,data)=>{if(window.holdSave)await new Promise(resolve=>window.releaseSave=resolve);if(window.failSave)throw Error('Synthetic offline');window.saved.push({kind,data});}});
 },{closed,historyError,long,medical,configured,onePage,recordState});await p.locator('.ar-medication').waitFor({state:'attached'});await p.waitForFunction(()=>document.getElementById('root').textContent.includes('Propofol')||document.querySelector('.ar-medication [role=alert]'));return {p,errors};
}

for(const width of [390,1440])test('four settings are visible and adjacent '+width,async t=>{
 const {p,errors}=await fixture(t,{width,onePage:true,recordState:'live'});
 assert.ok(await p.locator('[data-ar-reminder]').isVisible());assert.ok(await p.locator('[data-ar-reminder]').evaluate(e=>e.getBoundingClientRect().top<innerHeight));
 const box=p.locator('.ad-settings');for(const key of ['agent','ventilation','oxygen'])assert.ok(await box.locator('[data-key='+key+']').isVisible());
 assert.ok(await box.locator('[data-ar=infusion]').isVisible());assert.equal(await box.locator('.ad-missing-settings').count(),0);
 const rects=await box.locator('[data-key=agent],[data-key=ventilation],[data-key=oxygen],[data-ar=infusion]').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
 if(width>900){assert.equal(rects[0].y,rects[1].y);assert.equal(rects[0].y,rects[3].y);}else assert.ok(rects[0].y<=rects[1].y);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-settings-'+width+'.png'),fullPage:false});
});
for(const name of ['Isoflurane','Sevoflurane','custom'])test('inhalant quick entry saves '+name,async t=>{
 const {p,errors}=await fixture(t,{onePage:true,recordState:'live'});
 await p.locator('.ad-settings [data-key=agent]').click();const f=p.locator('[data-ae-quick]');
 await f.locator('[data-agent-choice=agent]').selectOption(name);
 if(name==='custom')await f.locator('[name=agent]').fill('직접 입력 약제');
 await f.locator('[name=value]').fill('1.5');await f.locator('[type=submit]').click();
 await p.waitForFunction(()=>saved.length===1);const saved=await p.evaluate(()=>saved[0]);assert.equal(saved.data.settings.agent,name==='custom'?'직접 입력 약제':name);assert.equal(saved.data.settings.concentration,1.5);assert.deepEqual(errors,[]);
});
test('existing custom inhalant stays editable',async t=>{
 const {p}=await fixture(t,{configured:true,onePage:true});await p.locator('.ad-settings [data-key=agent]').click();
 assert.equal(await p.locator('[data-agent-choice=agent]').inputValue(),'custom');assert.equal(await p.locator('[name=agent]').inputValue(),'합성 마취제');
});
test('fluid action opens fluid recording beside other settings',async t=>{
 const {p}=await fixture(t,{onePage:true});await p.locator('.ad-settings [data-ar=infusion]').click();assert.equal(await p.locator('.test-dialog [name=marker]').inputValue(),'infusion');assert.ok(await p.locator('.test-dialog [name=adminRate]').isVisible());
});
const {reminderState}=require('../anesthesia-record.js');
const initial=Date.parse('2026-10-31T00:00:00Z'),startRow={type:'marker',marker:'anesthesiaStart',recordId:'s',observedAt:new Date(initial).toISOString()},active={status:'active',body:{}};
test('five-minute intervals are anchored to anesthesia start',()=>{
 assert.equal(reminderState([startRow],active,initial+299999).bucket,0);assert.equal(reminderState([startRow],active,initial+300000).bucket,1);assert.equal(reminderState([startRow],active,initial+600000).bucket,2);
 const corrected={...startRow,observedAt:new Date(initial+60000).toISOString()};assert.equal(reminderState([corrected],active,initial+300000).bucket,0);
});
test('reminders stop on anesthesia end, extubation or closed case',()=>{
 for(const marker of ['anesthesiaEnd','extubation'])assert.equal(reminderState([startRow,{type:'marker',marker,observedAt:new Date(initial+1000).toISOString()}],active,initial+600000),null);
 assert.equal(reminderState([startRow],{status:'closed',body:{}},initial+600000),null);assert.equal(reminderState([],active,initial),null);
});
test('reminder acknowledgement, next interval, stop and no chart mutation',async t=>{
 const {p}=await fixture(t,{onePage:true,recordState:'live'});
 await p.evaluate(()=>{document.getElementById('root').remove();const root=document.createElement('div');root.innerHTML='<section data-ar-reminder><span data-reminder-text></span><button data-reminder-ack></button><button data-reminder-sound></button><small data-reminder-note></small></section>';document.body.append(root);window.reminderCurrent={key:'test',bucket:1,next:Date.now()+300000};window.reminderView={};window.reminderController=AnesthesiaRecord.createReminder({root,valid:()=>root.isConnected,state:()=>window.reminderCurrent,view:window.reminderView});});
 assert.match(await p.locator('[data-reminder-text]').innerText(),/5분 경과/);await p.locator('[data-reminder-ack]').click();assert.ok(!await p.locator('[data-reminder-ack]').isVisible());
 await p.evaluate(()=>{reminderCurrent.bucket=2;reminderController.paint();});assert.match(await p.locator('[data-reminder-text]').innerText(),/10분 경과/);
 await p.evaluate(()=>{reminderCurrent=null;reminderController.paint();});assert.ok(!await p.locator('[data-ar-reminder]').isVisible());assert.equal(await p.evaluate(()=>saved.length),0);await p.evaluate(()=>reminderController.stop());
});

test('screen refresh retains sound and replaces the old reminder controller',async t=>{
 const {p}=await fixture(t,{onePage:true,recordState:'live'});
 await p.evaluate(()=>{window.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={};}async resume(){}createOscillator(){return {connect(){},frequency:{value:0},start(){},stop(){}}}createGain(){return {connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}}};});
 await p.locator('[data-reminder-sound]').click();assert.equal(await p.locator('[data-reminder-sound]').getAttribute('aria-pressed'),'true');
 await p.evaluate(()=>{const root=document.getElementById('root');const old=root.anesthesiaReminder;const next=AnesthesiaRecord.createReminder({root,valid:()=>true,state:()=>({key:'replacement',bucket:2,next:Date.now()+300000}),view:{}});old.paint();window.testReminder=next;});
 assert.match(await p.locator('[data-reminder-text]').innerText(),/10분 경과/);assert.equal(await p.locator('[data-reminder-sound]').getAttribute('aria-pressed'),'true');await p.evaluate(()=>testReminder.stop());
});
