const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {ageAt,sexLabel,patientDemographics,patientSummary,printDocument,printRanges}=require('../anesthesia-record.js');
const item={id:'synthetic',revision:3,created_at:'2026-10-28T01:00:00Z',status:'active',patient:{name:'합성 환자',breed:'합성 품종',birthDate:'2020-02-29',sex:'male',neutered:'yes'},body:{species:'dog',weight:5}};
const rows=[{type:'marker',marker:'anesthesiaStart',observedAt:'2026-10-29T03:35:00Z',recordId:'start'}];
test('age uses calendar dates, handles leap birthdays, newborns and invalid dates',()=>{
 assert.equal(ageAt('2020-02-29','2026-10-29'),'6세 8개월');assert.equal(ageAt('2020-02-29','2021-02-28'),'11개월');assert.equal(ageAt('2020-02-29','2021-03-01'),'1세');
 assert.equal(ageAt('2026-10-29','2026-10-29'),'1개월 미만');for(const b of ['2021-02-29','2026-10-30','invalid','2020-13-01'])assert.equal(ageAt(b,'2026-10-29'),'');
});
test('sex and neutering preserve unknowns instead of assigning intact status',()=>{
 for(const [sex,n,label] of [['male','no','미중성화 수컷'],['female','no','미중성화 암컷'],['male','yes','중성화 수컷'],['female','yes','중성화 암컷'],['male','unknown','수컷 · 중성화 미확인'],['unknown','yes','성별 미확인 · 중성화']])assert.equal(sexLabel({sex,neutered:n}),label);
 assert.equal(sexLabel({}),'미확인');
});
test('patient import, case overrides, corrected start date and explicit clearing remain distinct',()=>{
 const a=patientDemographics(item,rows,Date.parse('2030-01-01'));assert.equal(a.age,'6세 8개월');assert.equal(a.date,'2026-10-29');assert.equal(a.sex,'중성화 수컷');
 assert.equal(patientDemographics(item,[{...rows[0],observedAt:'2026-10-28T14:59:00Z'}]).age,'6세 7개월');
 const changed={...item,body:{...item.body,anesthesiaSheet:{breed:'수정 품종',birthDate:'',age:'약 8세',sex:'미확인'}}};assert.equal(patientDemographics(changed,rows).birthDate,'');assert.equal(patientDemographics(changed,rows).age,'약 8세');assert.equal(patientDemographics(changed,rows).sex,'미확인');
 const legacy={...item,body:{...item.body,anesthesiaSheet:{age:'추정 7세',sex:'기존 성별'}}};assert.equal(patientDemographics(legacy,rows).age,'추정 7세');assert.equal(patientDemographics(legacy,rows).breed,'합성 품종');
 assert.equal(patientDemographics(item,[]).date,'2026-10-28');assert.match(patientSummary(item,rows),/합성 품종 · 6세 8개월 · 중성화 수컷/);
});
test('print header and patient fields use the same surgery-date age and escape imported text',()=>{
 const data={...item,patient:{...item.patient,breed:'<img onerror=x>'}};const html=printDocument({item:data,rows,ranges:printRanges(rows)});
 assert.match(html,/6세 8개월/);assert.match(html,/중성화 수컷/);assert.doesNotMatch(html,/<b>생년월일<\/b>/);assert.match(html,/&lt;img onerror=x&gt;/);assert.doesNotMatch(html,/<img onerror/);
});

const {chromium}=require('playwright');let browser;before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});after(async()=>browser?.close());
for(const width of [390,1440])test('registered patient auto fills calendar and sex selection, saves only on action '+width,async t=>{
 const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setContent('<meta charset="utf-8"><main id="root"></main>');await p.addStyleTag({path:path.resolve(__dirname,'../anesthesia-record.css')});
 await p.addStyleTag({content:'.cl-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}label{display:flex;flex-direction:column}input,select{min-width:0;max-width:100%}body{font-family:Arial,sans-serif}'});
 await p.addScriptTag({path:path.resolve(__dirname,'../anesthesia-record.js')});
 await p.evaluate(({item,rows})=>{
  window.saved=[];window.printed='';window.open=()=>({document:{open(){},write(s){window.printed=s},close(){}}});
  AnesthesiaRecord.mount(document.querySelector('#root'),{item,view:{},medical:true,canRecord:true,valid:()=>true,api:async()=>({events:rows.map((r,i)=>({id:'e'+i,revision:i+2,kind:'anesthesia.entry',body:r})),hasMore:false}),
   save:async(kind,data)=>window.saved.push({kind,data}),modal:(title,html,submit)=>{const d=document.createElement('section');d.className='test-dialog';d.innerHTML='<h2>'+title+'</h2><form>'+html+'<button type="submit">저장</button><p role="alert"></p></form>';document.body.append(d);const f=d.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{await submit(f);d.remove()}catch(err){f.querySelector('[role=alert]').textContent=err.message}};return d;}});
 },{item,rows});await p.locator('.ar-record-bar').waitFor();await p.locator('.ar-summary > summary').click();
 assert.match(await p.locator('.ar-record-bar').innerText(),/합성 품종 · 6세 8개월 · 중성화 수컷/);
 await p.locator('[data-ar=sheet]').click();const d=p.locator('.test-dialog');assert.equal(await d.locator('[name=birthDate]').inputValue(),'2020-02-29');assert.equal(await d.locator('select[name=sex]').inputValue(),'중성화 수컷');assert.equal(await d.locator('[name=age]').getAttribute('readonly'),'');
 await d.locator('[name=birthDate]').fill('2021-10-29');assert.equal(await d.locator('[name=age]').inputValue(),'5세');await d.locator('[name=sex]').selectOption('중성화 암컷');await d.locator('[name=breed]').fill('수정 합성 품종');
 assert.equal(await p.evaluate(()=>saved.length),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(__dirname,'../../anesthesia-patient-'+width+'.png'),fullPage:true});
 await d.locator('button[type=submit]').click();const result=await p.evaluate(()=>saved[0]);assert.equal(result.kind,'anesthesia.sheet');assert.equal(result.data.age,'5세');assert.equal(result.data.birthDate,'2021-10-29');assert.equal(result.data.sex,'중성화 암컷');assert.equal(result.data.breed,'수정 합성 품종');assert.deepEqual(errors,[]);
});
