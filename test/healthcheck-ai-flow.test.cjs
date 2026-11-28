const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
let browser;before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(async()=>browser?.close());
async function setup(t,width){
 const p=await browser.newPage({viewport:{width,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});
 await p.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}):r.abort());await p.goto('http://localhost/');
 for(const name of ['healthcheck-record.css'])await p.addStyleTag({path:path.resolve(__dirname,'..',name)});
 for(const name of ['clinic-record-start.js','healthcheck-record.js','carestep-privacy.js','test/healthcheck-editing-browser.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',name)});
 await p.evaluate(async()=>{
  window.f=await HealthcheckEditingChecks.fixture();const old=f.request;f.view.dispose();window.sent=[];window.hold=false;window.failAI=false;
  f.records['record-1'].body.healthcheckChart.summary='기존 작성 소견';f.records['record-1'].body.healthcheckChart.management='기존 관리계획';
  f.records['record-1'].body.healthcheckChart.labs=[HealthcheckRecord.row({name:'CREA',value:'1.1',unit:'mg/dL',reference:'0.5–1.8',confirmed:true})];
  const common={active:true,version:'synthetic-v1',digest:'synthetic-digest',recipient:'시험 AI',region:'시험 지역',purpose:'시험',retention:'시험',restriction:'개인정보 없는 가상 자료'};
  const api={scope:()=>f.identity,request:async(p,o)=>{
   if(p.endsWith('/privacy/status'))return {publication:{ready:false},fileReadingPilot:{...common,operation:'healthcheck_lab_import'},healthcheckSummaryPilot:{...common,operation:'healthcheck_summary'}};
   if(p.endsWith('/preview')){const evidence={labs:JSON.parse(o.body).chart.labs};return {evidence,pilotDigest:common.digest,pilotVersion:common.version,payloadDigest:await CarestepPrivacy.digest(JSON.stringify(evidence))};}
   throw Error('Unexpected mock request '+p);
  }};
  f.view=HealthcheckRecord.mount(document.getElementById('root'),{identity:()=>f.identity,ready:()=>true,can:()=>true,hospital:()=>({}),request:async(p,o={})=>{
   if(/\/(lab-import|healthcheck-summary)$/.test(p)){
    o=await CarestepPrivacy.prepare('/saas'+p,o,api);sent.push({path:p,body:JSON.parse(o.body),hasCallback:!!o.onAIStage});
    if(hold)await new Promise(resolve=>window.release=resolve);if(failAI)throw Error('가상 AI 처리 실패');
    if(p.endsWith('/lab-import'))return {reportDate:f.records['record-1'].body.healthcheckChart.date,results:[{name:sent.filter(x=>x.path.endsWith('/lab-import')).length===1?'CREA':'ALT',value:'2.4',unit:'mg/dL',reference:'0.5–1.8'}]};
    const r=await old(p,o);r.summary='가상 새 제안 '+sent.filter(x=>x.path.endsWith('/healthcheck-summary')).length;return r;
   }return old(p,o);
  }});await f.view.openRecord('record-1');
 });return p;
}
async function approve(p){await p.locator('.cs-privacy input[type=checkbox]').last().check();await p.locator('.cs-privacy [data-accept]').click();}
async function startAI(p){await p.evaluate(()=>document.querySelector('[data-action=ai]').click());}
for(const width of [390,1440]){
 test('batch cancellation exposes completed results, preserves edits and retries only remaining file '+width,async t=>{
  const p=await setup(t,width);await p.locator('[data-step=labs]').click();await p.locator('[data-action=import]').click();
  await p.locator('[data-lab-file]').setInputFiles(['one','two'].map(name=>({name:name+'.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic '+name)})));
  assert.equal(await p.locator('[data-file-consent]').count(),0);await p.locator('[data-action=read-file]').click();await p.locator('.cs-privacy').waitFor();
  assert.equal(await p.evaluate(()=>sent.length),0);assert.match(await p.locator('[data-file-queue]').innerText(),/전송 확인 대기/);assert.equal(await p.locator('[data-accept]').isDisabled(),true);
  await approve(p);await p.locator('.cs-privacy').waitFor();await p.keyboard.press('Escape');await p.locator('[data-import-key=value]').waitFor();
  assert.equal(await p.locator('[data-import-row]').count(),1);assert.doesNotMatch(await p.locator('[data-file-queue]').innerText(),/읽는 중|확인 대기/);assert.match(await p.locator('[data-hc-status]').innerText(),/완료된 결과/);
  await p.locator('[data-import-key=value]').fill('2.7');await p.locator('[data-import-key=reference]').fill('0.6–1.9');await p.locator('[data-import-pick]').uncheck();
  await p.locator('[data-action=read-file]').click();await p.locator('.cs-privacy').waitFor();await p.keyboard.press('Escape');
  assert.equal(await p.locator('[data-import-key=value]').inputValue(),'2.7');assert.equal(await p.locator('[data-import-pick]').isChecked(),false);
  await p.locator('[data-action=read-file]').click();await p.locator('.cs-privacy').waitFor();await approve(p);await p.waitForFunction(()=>document.querySelectorAll('[data-import-row]').length===2);
  assert.equal(await p.evaluate(()=>sent.length),2);assert.equal(await p.locator('[data-import-key=value]').first().inputValue(),'2.7');assert.equal(await p.locator('[data-import-key=reference]').first().inputValue(),'0.6–1.9');assert.equal(await p.locator('[data-import-pick]').first().isChecked(),false);
  await p.locator('[data-import-all]').check();await p.locator('[data-import-checked]').check();await p.locator('[data-action=apply-import]').click();await p.locator('[data-action=save]').click();
  await p.waitForFunction(()=>f.records['record-1'].revision>1);const d=await p.evaluate(()=>f.records['record-1'].body.healthcheckChart);assert.equal(d.summary,'기존 작성 소견');assert.equal(d.management,'기존 관리계획');assert.equal(d.labs.find(x=>x.name==='CREA').value,'1.1');assert.ok(d.labs.some(x=>x.name==='ALT'));
 });
 test('summary review gates transmission, progress is accurate and regeneration preserves draft on cancel or failure '+width,async t=>{
  const p=await setup(t,width);await p.locator('[data-step=summary]').click();assert.equal(await p.locator('[data-ai-consent]').count(),0);await p.evaluate(()=>hold=true);await startAI(p);await p.locator('.cs-privacy').waitFor();
  assert.equal(await p.evaluate(()=>sent.length),0);assert.match(await p.locator('.hc-progress').innerText(),/전송 내용 확인/);assert.equal(await p.locator('[data-accept]').isDisabled(),true);
  await approve(p);await p.waitForFunction(()=>typeof release==='function');assert.match(await p.locator('.hc-progress').innerText(),/AI 종합소견·관리계획 작성 중/);await p.evaluate(()=>{hold=false;release();});await p.locator('[data-ai-proposed=summary]').waitFor({state:'attached'});
  assert.equal(await p.locator('[data-prose=summary]').inputValue(),'기존 작성 소견');assert.equal(await p.evaluate(()=>sent[0].hasCallback),false);assert.equal(await p.evaluate(()=>sent[0].body.privacyReview.nonPersonalEvidence),true);
  p.once('dialog',d=>d.dismiss());await startAI(p);assert.equal(await p.evaluate(()=>sent.length),1);assert.match(await p.locator('[data-ai-proposed=summary]').textContent(),/가상 새 제안 1/);
  p.once('dialog',d=>d.accept());await startAI(p);await p.locator('.cs-privacy').waitFor();await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('.hc-progress'));assert.match(await p.locator('[data-ai-proposed=summary]').textContent(),/가상 새 제안 1/);assert.equal(await p.evaluate(()=>sent.length),1);
  await p.evaluate(()=>failAI=true);p.once('dialog',d=>d.accept());await startAI(p);await approve(p);await p.waitForFunction(()=>document.querySelector('[data-hc-status]').textContent.includes('가상 AI 처리 실패'));assert.match(await p.locator('[data-ai-proposed=summary]').textContent(),/가상 새 제안 1/);
  await p.evaluate(()=>failAI=false);p.once('dialog',d=>d.accept());await startAI(p);await approve(p);await p.waitForFunction(()=>document.querySelector('[data-ai-proposed=summary]')?.textContent.includes('가상 새 제안 3'));
  assert.equal(await p.locator('[data-prose=summary]').inputValue(),'기존 작성 소견');assert.equal(await p.locator('[data-prose=management]').inputValue(),'기존 관리계획');assert.equal(await p.locator('[data-action=save]').isDisabled(),true);assert.equal(await p.evaluate(()=>f.records['record-1'].body.healthcheckChart.labs[0].value),'1.1');
 });
}
