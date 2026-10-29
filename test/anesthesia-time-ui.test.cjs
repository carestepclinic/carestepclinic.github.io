const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});});
after(async()=>{await browser?.close();});
async function fixture(t,width=1440,status='active',medical=true){
 const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setContent('<html lang="ko"><head><meta charset="utf-8"></head><body style="margin:12px;font-family:sans-serif"><main id="root"></main></body></html>');
 for(const name of ['anesthesia-record.css'])await p.addStyleTag({path:path.resolve(__dirname,'..',name)});
 for(const name of ['clinical-compact.js','anesthesia-record.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',name)});
 await p.evaluate(({status,medical})=>{
  const event=(id,revision,marker,observedAt)=>({id:'e'+revision,revision,kind:'anesthesia.entry',recorded_at:'2026-10-20T05:00:00Z',body:{recordId:id,type:'marker',marker,observedAt,note:'Synthetic original note',recorder:{id:'staff',name:'합성 수행자'}}});
  window.events=[event('start',2,'surgeryStart','2026-10-20T03:49:00Z'),event('end',3,'surgeryEnd','2026-10-20T03:56:00Z'),event('a',4,'anesthesiaStart','2026-10-20T03:25:00Z'),event('b',5,'anesthesiaEnd','2026-10-20T04:00:00Z')];
  const item={id:'synthetic',revision:5,status,patient:{name:'합성 시간 정정'},body:{species:'dog',weight:5,phase:status==='closed'?'closed':'anesthesia'}};
  window.saved=[];window.failSave=false;window.view={start:Date.parse('2026-10-20T10:00:00Z'),minutes:60};
  const a={item,medical,canRecord:medical,view,valid:()=>true,api:async()=>({events:window.events,hasMore:false}),reload:()=>{},
   modal:(title,html,submit)=>{const d=document.createElement('section');d.className='test-dialog';d.innerHTML='<h2>'+title+'</h2><form>'+html+'<label>수행자<select name="recordedPersonId"><option value="owner">합성 저장자</option><option value="staff">합성 수행자</option></select></label><button type="submit">저장</button><p role="status"></p></form>';document.body.append(d);const f=d.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{await submit(f);d.remove();}catch(err){f.querySelector('[role=status]').textContent=err.message;}};ClinicalCompact.compactForm(d);return d;},
   save:async(kind,data,revision)=>{if(window.failSave)throw Error('최신 내용을 불러온 뒤 확인해주세요.');window.saved.push({kind,data,revision});window.events.push({id:'corrected',kind,revision:6,recorded_at:new Date().toISOString(),body:data});}
  };window.remount=()=>{document.getElementById('root').innerHTML='';AnesthesiaRecord.mount(document.getElementById('root'),a);};window.remount();
 },{status,medical});
 await p.locator('.ar-timing').waitFor();return {p,errors};
}
for(const width of [320,390,1024,1440])for(const status of ['active','closed'])test(`timing correction visible outside selected range, ${status}, ${width}`,async t=>{
 const {p,errors}=await fixture(t,width,status);assert.match(await p.locator('.ar-timing').innerText(),/2026-10-20 12:49/);assert.equal(await p.locator('.ar-event-history [data-ar=edit]').count(),0);
 assert.ok(await p.locator('.ar-timing').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await p.locator('[data-ar=edit-time][data-id=start]').click();const d=p.locator('.test-dialog'),time=d.locator('[name=observedAt]');assert.ok(await time.isVisible());assert.equal(await d.locator('[name=recordedPersonId]').inputValue(),'staff');assert.match(await d.locator('summary').first().innerText(),/합성 수행자/);assert.equal(await d.locator('[name=marker]').isVisible(),false);assert.equal(await d.locator('[name=voided]').isVisible(),false);
 await time.fill('2026-10-20T12:35');await d.locator('[name=reason]').fill('Synthetic late click correction');await d.locator('[name=confirm]').check();await d.getByRole('button',{name:'저장',exact:true}).click();await d.waitFor({state:'detached'});
 const saved=await p.evaluate(()=>window.saved[0]);assert.equal(saved.data.observedAt,'2026-10-20T03:35:00.000Z');assert.equal(saved.data.recordId,'start');assert.equal(saved.data.supersedes,2);assert.equal(saved.data.marker,'surgeryStart');assert.equal(saved.data.note,'Synthetic original note');assert.equal(saved.revision,5);assert.equal(saved.kind,'anesthesia.entry');assert.equal(saved.data.voided,false);
 await p.evaluate(()=>{delete window.view.cache;window.remount();});await p.locator('.ar-timing').waitFor();assert.match(await p.locator('.ar-timing').innerText(),/12:35/);assert.doesNotMatch(await p.locator('.ar-timing').innerText(),/12:49/);assert.equal(await p.evaluate(()=>window.events[0].body.observedAt),'2026-10-20T03:49:00Z');assert.deepEqual(errors,[]);
 if(status==='closed'&&[390,1440].includes(width))await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-time-'+width+'.png'),fullPage:true});
});
test('read-only staff can view times but cannot correct them',async t=>{const {p,errors}=await fixture(t,390,'closed',false);assert.equal(await p.locator('[data-ar=edit-time]').count(),0);assert.match(await p.locator('.ar-timing').innerText(),/12:49/);assert.deepEqual(errors,[]);});
test('empty reason and concurrent-save failure retain correction input',async t=>{
 const {p,errors}=await fixture(t);await p.locator('[data-ar=edit-time][data-id=start]').click();const d=p.locator('.test-dialog');await d.locator('[name=observedAt]').fill('2026-10-20T12:35');await d.locator('[name=reason]').fill('   ');await d.locator('[name=confirm]').check();await d.getByRole('button',{name:'저장'}).click();assert.match(await d.locator('[role=status]').innerText(),/정정 사유/);assert.equal(await p.evaluate(()=>window.saved.length),0);await d.locator('[name=reason]').fill('Synthetic correction');await p.evaluate(()=>window.failSave=true);await d.getByRole('button',{name:'저장'}).click();assert.match(await d.locator('[role=status]').innerText(),/최신/);assert.equal(await d.locator('[name=observedAt]').inputValue(),'2026-10-20T12:35');assert.equal(await p.evaluate(()=>window.saved.length),0);assert.deepEqual(errors,[]);
});
test('historical graph uses selected range and closed-case ordinary corrections still work',async t=>{
 const {p,errors}=await fixture(t,1440,'closed');await p.locator('[data-ar=display][data-key=graphs]').click();await p.locator('[name=arStart]').fill('2026-10-20T12:00');await p.locator('[name=arStart]').press('Tab');await p.locator('[name=arMinutes]').selectOption('60');assert.match(await p.locator('.ar-charts svg').first().textContent(),/12:00/);assert.match(await p.locator('.ar-charts svg').first().textContent(),/13:00/);
 await p.locator('.ar-event-history summary').click();await p.locator('.ar-event-history [data-ar=edit][data-id=start]').click();assert.ok(await p.locator('.test-dialog [name=observedAt]').isVisible());assert.deepEqual(errors,[]);
});
