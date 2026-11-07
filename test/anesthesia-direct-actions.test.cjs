const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');let browser;before(async()=>{browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});});after(async()=>browser?.close());
async function fixture(t,{width=1440,closed=false,historyError=false,long=false,medical=true,canRecord=true,configured=false,onePage=false,recordState='recovery'}={}){
 const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<html lang="ko"><meta charset="utf-8"><body style="margin:12px;font-family:sans-serif"><main id="root"></main></body></html>'}));await p.goto('http://localhost/');
 await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});await p.addStyleTag({path:path.resolve(__dirname,'../clinical-care-ui.css')});
 await p.addStyleTag({content:'@font-face{font-family:Pretendard;src:url(data:font/woff2;base64,'+require("node:fs").readFileSync(path.resolve(__dirname,"../pretendard-variable-1.3.9.woff2")).toString("base64")+') format("woff2");font-weight:100 900}body{font-family:Pretendard,sans-serif}'});await p.evaluate(()=>document.fonts.ready);
 for(const f of ['clinical-compact.js','anesthesia-efficiency.js','anesthesia-dashboard.js','anesthesia-record.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',f)});
 await p.evaluate(({closed,historyError,long,medical,canRecord,configured,onePage,recordState})=>{
  const base=Date.parse('2026-10-20T03:25:00Z'),date=m=>new Date(base+m*60000).toISOString();
  const row=(id,m,body)=>({id,revision:m+50,kind:'anesthesia.entry',recorded_at:date(m),body:{recordId:id,observedAt:date(m),recorder:{id:'staff',name:'합성 수행자'},...body}});
  window.fixtureEvents=[row('prior',-5,{type:'marker',marker:'medication',note:'전처치',administration:{name:'합성 전처치',amount:1,unit:'mL',route:'IM'}}),row('start',0,{type:'marker',marker:'anesthesiaStart'}),row('m1',1,{type:'measurement',values:{heartRate:100}}),row('m2',38,{type:'measurement',values:{heartRate:95}}),row('end',long?480:40,{type:'marker',marker:'anesthesiaEnd'})];
  for(let i=0;i<10;i++)window.fixtureEvents.push(row('measure'+i,i*5,{type:'measurement',values:{heartRate:110-i*2,respiratoryRate:24-i%3,meanPressure:75-i%4,spo2:98,etco2:36+i%3,temperature:38.2,systolic:110,diastolic:65}}));
  if(configured){const prep={id:'prep1',name:'합성 약물',product:'합성 제품',strength:10,strengthUnit:'mg/mL',route:'IV'};window.fixtureEvents.push(row('settings',5,{type:'marker',marker:'settings',settings:{agent:'합성 마취제',concentration:1.5,ventilation:'assisted',oxygen:'2 L/min'}}),row('given',6,{type:'marker',marker:'medication',administration:{name:prep.name,amount:.5,unit:'mL',route:'IV',preparation:prep}}));}if(recordState==='prep')window.fixtureEvents=window.fixtureEvents.filter(e=>e.body.marker==='medication');else if(recordState==='live')window.fixtureEvents=window.fixtureEvents.filter(e=>e.body.marker!=='anesthesiaEnd');window.saved=[];window.printed='';window.requested=[];window.failHistory=historyError;
  const item=window.testItem={id:'synthetic',revision:600,status:closed?'closed':'active',patient:{name:'합성 마취 기록'},body:{species:'dog',weight:5,anesthesiaPreparation:configured?[{id:'prep1',name:'합성 약물',product:'합성 제품',strength:10,strengthUnit:'mg/mL',route:'IV'}]:[]}};
  window.open=()=>({document:{open(){},write(s){window.printed=s;},close(){}}});
  AnesthesiaRecord.mount(document.getElementById('root'),{item,onePage,phaseAction:mode=>window.phaseAction=mode,medical,canRecord,view:window.testView={},valid:()=>true,performer:()=> 'staff',members:[{id:'staff',name:'합성 수행자'}],caseHistory:{events:[],hasMoreEvents:true,next:100},
   api:async url=>{window.requested.push(url);if(url==='/workflows')return {items:configured?[{body:{kind:'anesthesia-template',measurementOrder:['systolic','temperature'],reviewMinutes:5}}]:[]};if(url.includes('?before=')){if(window.failHistory)throw Error('연결 실패');return {events:[{id:'plan',kind:'calculation',revision:2,recorded_at:date(-10),body:{calculator:'anesthesia',summary:'Propofol · 합성 계획 1 mL'}}],hasMoreEvents:false};}return {events:window.fixtureEvents,hasMore:false};},presets:async()=>({items:[]}),reload(){},
   modal:(title,html,submit)=>{const d=document.createElement('section');d.className='test-dialog';d.innerHTML='<h2>'+title+'</h2><form>'+html+'<button type="submit">저장</button><p role="status"></p></form>';document.body.append(d);const f=d.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{await submit(f);d.remove();}catch(err){f.querySelector('[role=status]').textContent=err.message;}};return d;},
   save:async(kind,data,revision,recorder,key)=>{if(window.holdSave)await new Promise(resolve=>window.releaseSave=resolve);if(window.failSave)throw Error('Synthetic offline');window.saved.push({kind,data,revision,recorder,key});}});
 },{closed,historyError,long,medical,canRecord,configured,onePage,recordState});await p.locator('.ar-medication').waitFor({state:'attached'});await p.waitForFunction(()=>document.getElementById('root').textContent.includes('Propofol')||document.querySelector('.ar-medication [role=alert]'));return {p,errors};
}

for(const width of [390,1440])test('one click records current time without second form '+width,async t=>{
 const {p,errors}=await fixture(t,{width,onePage:true,recordState:'prep'});
 const before=Date.now();await p.locator('.ar-stage-action [data-ar=next-event]').click();
 await p.waitForFunction(()=>saved.length===1);const r=await p.evaluate(()=>saved[0]);
 assert.equal(r.data.marker,'anesthesiaStart');assert.ok(Date.parse(r.data.observedAt)>=before);assert.equal(r.recorder,'staff');
 assert.equal(await p.locator('[data-ae-quick],.test-dialog').count(),0);
 assert.match(await p.locator('.ar-direct-status').innerText(),/기록 완료/);
 await p.locator('.ar-stage-action [data-ar=next-event]').click();await p.waitForFunction(()=>saved.length===2);
 assert.equal(await p.evaluate(()=>saved[1].data.marker),'intubation');
 await p.locator('.ar-stage-action [data-ar=next-event]').click();await p.waitForFunction(()=>saved.length===3);
 assert.equal(await p.evaluate(()=>saved[2].data.marker),'surgeryStart');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-direct-'+width+'.png'),fullPage:false});
});
test('double click submits only once and retry retains original time and request key',async t=>{
 const {p}=await fixture(t,{recordState:'prep',onePage:true});
 await p.evaluate(()=>{holdSave=true;const b=document.querySelector('.ar-stage-action [data-ar=next-event]');b.click();b.click();});
 await p.waitForFunction(()=>!!window.releaseSave);assert.equal(await p.evaluate(()=>saved.length),0);
 await p.evaluate(()=>{holdSave=false;releaseSave();});await p.waitForFunction(()=>saved.length===1);
 await p.evaluate(()=>failSave=true);await p.locator('.ar-stage-action [data-ar=next-event]').click();
 await p.waitForFunction(()=>document.querySelector('.ar-direct-status').textContent.includes('실패'));
 const request=await p.evaluate(()=>testView.directRequests.intubation);
 await p.evaluate(()=>failSave=false);await p.locator('.ar-stage-action [data-ar=next-event]').click();await p.waitForFunction(()=>saved.length===2);
 const r=await p.evaluate(()=>saved[1]);assert.equal(r.key,request.key);assert.equal(r.data.observedAt,request.data.observedAt);
});
test('staff on mobile can save only tube; broad settings stay hidden',async t=>{
 const {p,errors}=await fixture(t,{width:390,medical:false,canRecord:true,onePage:true,recordState:'live'});
 assert.equal(await p.locator('[data-ar=sheet]').count(),0);
 const f=p.locator('[data-ar-tube]');await f.locator('[name=tube]').fill('4.5 cuffed');await f.locator('[type=submit]').click();
 await p.waitForFunction(()=>saved.length===1);assert.deepEqual(await p.evaluate(()=>saved[0].data),{tube:'4.5 cuffed'});
 assert.equal(await p.evaluate(()=>saved[0].kind),'anesthesia.sheet');assert.deepEqual(errors,[]);
});
test('read-only and closed users cannot submit tube or new event',async t=>{
 for(const options of [{medical:false,canRecord:false},{closed:true}]){const {p}=await fixture(t,{...options,onePage:true});assert.equal(await p.locator('[data-ar-tube],.ar-stage-action [data-ar]').count(),0);}
});
async function alarmFixture(t,mode='suspended'){
 const {p}=await fixture(t,{recordState:'prep',onePage:true});
 await p.evaluate(mode=>{
  window.tones=0;window.resumes=0;window.vibrations=[];window.audioMode=mode;
  window.AudioContext=class{
   constructor(){this.state='suspended';this.currentTime=0;this.destination={};window.testAudio=this;}
   async resume(){resumes++;if(audioMode==='blocked')throw Error('blocked');this.state='running';}
   createOscillator(){return {connect(){},frequency:{value:0},start(){tones++;},stop(){},disconnect(){}};}
   createGain(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}};}
  };
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{vibrations.push(pattern);return true;}});
  const root=document.getElementById('root');root.innerHTML='<section data-ar-reminder><span data-reminder-text></span><button data-reminder-ack></button><button data-reminder-sound></button><small data-reminder-note></small></section>';
  window.alarmState={key:'synthetic-alarm',bucket:0,next:Date.now()+300000};window.alarmView={};
  window.alarmController=AnesthesiaRecord.createReminder({root,valid:()=>root.isConnected,state:()=>alarmState,view:alarmView});
 },mode);assert.equal(await p.locator('.cs-reminder-settings').evaluate(e=>e.open),false);await p.locator('.cs-reminder-settings>summary').click();assert.ok(await p.locator('[data-reminder-sound]').isVisible());return p;
}
test('sound tests immediately, resumes suspended audio each interval and does not repeat a bucket',async t=>{
 const p=await alarmFixture(t);await p.locator('[data-reminder-sound]').click();await p.waitForFunction(()=>tones===3);
 await p.evaluate(()=>{testAudio.state='suspended';alarmState.bucket=1;alarmController.paint();});
 await p.waitForFunction(()=>tones===6);assert.equal(await p.evaluate(()=>resumes),2);
 await p.evaluate(()=>{alarmController.paint();alarmController.paint();});assert.equal(await p.evaluate(()=>tones),6);
 await p.locator('[data-reminder-ack]').click();assert.ok(!await p.locator('[data-reminder-ack]').isVisible());
 await p.evaluate(()=>{alarmState.bucket=2;alarmController.paint();});await p.waitForFunction(()=>tones===9);
 await p.evaluate(()=>{alarmState=null;alarmController.paint();});assert.ok(!await p.locator('[data-ar-reminder]').isVisible());
});
test('blocked audio reports failure, test button recovers without losing vibration',async t=>{
 const p=await alarmFixture(t,'blocked');await p.locator('[data-reminder-sound]').click();
 await p.waitForFunction(()=>document.querySelector('[data-reminder-note]').textContent.includes('중단'));
 assert.equal(await p.evaluate(()=>tones),0);await p.locator('[data-reminder-vibration]').click();assert.equal(await p.evaluate(()=>vibrations.length),1);
 await p.evaluate(()=>audioMode='suspended');await p.locator('[data-reminder-test]').click();await p.waitForFunction(()=>tones===3);
 assert.equal(await p.evaluate(()=>vibrations.length),2);
 await p.evaluate(()=>{alarmState.bucket=1;alarmController.paint();});await p.waitForFunction(()=>tones===6);assert.equal(await p.evaluate(()=>vibrations.length),3);
});
test('vibration-only alert works, unsupported devices are explicit, and hidden intervals catch up once',async t=>{
 const p=await alarmFixture(t);await p.locator('[data-reminder-vibration]').click();
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});alarmState.bucket=3;alarmController.paint();});
 assert.equal(await p.evaluate(()=>vibrations.length),1);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await p.waitForFunction(()=>vibrations.length===2);assert.equal(await p.evaluate(()=>tones),0);
 await p.evaluate(()=>{alarmController.paint();Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined});alarmController.paint();});
 assert.equal(await p.evaluate(()=>vibrations.length),2);assert.equal(await p.locator('[data-reminder-vibration]').innerText(),'진동 미지원');assert.ok(await p.locator('[data-reminder-vibration]').isDisabled());
});
