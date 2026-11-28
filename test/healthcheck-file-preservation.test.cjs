const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(async()=>browser?.close());
async function setup(t,width=1440){
 const p=await browser.newPage({viewport:{width,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});
 await p.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}):r.abort());await p.goto('http://localhost/');
 await p.addStyleTag({path:path.resolve(__dirname,'../healthcheck-record.css')});
 for(const name of ['clinic-record-start.js','healthcheck-record.js','test/healthcheck-editing-browser.js'])await p.addScriptTag({path:path.resolve(__dirname,'..',name)});
 await p.evaluate(async()=>{window.f=await HealthcheckEditingChecks.fixture();f.records['record-1'].body.healthcheckChart.summary='보존할 작성 소견';f.records['record-1'].body.healthcheckChart.labs=[HealthcheckRecord.row({name:'CREA',value:'1.1',unit:'mg/dL',reference:'0.4–2.0',confirmed:true})];await f.view.openRecord('record-1');});
 await p.locator('[data-step=labs]').click();await p.locator('[data-action=import]').click();return p;
}
const pdf=name=>({name:name+'.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic '+name)});
async function read(p,files=[pdf('source')]){await p.locator('[data-lab-file]').setInputFiles(files);await p.locator('[data-action=read-file]').click();}
for(const width of [390,1440]){
 test('invalid or unreadable replacement and cancelled valid replacement retain edited review '+width,async t=>{
  const p=await setup(t,width);await read(p);await p.locator('[data-import-key=value]').fill('2.7');await p.locator('[data-import-key=reference]').fill('0.6–1.9');await p.locator('[data-import-pick]').uncheck();await p.locator('[data-import-mode]').selectOption('append');
  let dialogs=0;p.on('dialog',async d=>{dialogs++;await d.dismiss();});
  for(const file of [{...pdf('too-large'),buffer:Buffer.alloc(3000001)},{name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic')}]){await p.locator('[data-lab-file]').setInputFiles(file);assert.match(await p.locator('[data-hc-status]').textContent(),/3MB/);assert.equal(await p.locator('[data-import-key=reference]').inputValue(),'0.6–1.9');}
  await p.locator('[data-lab-file]').setInputFiles(Array.from({length:11},(_,i)=>pdf('extra-'+i)));assert.equal(dialogs,0);
  await p.evaluate(()=>{const read=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(file){if(file.name==='broken.pdf')setTimeout(()=>this.onerror(new Event('error')),0);else read.call(this,file);};});
  await p.locator('[data-lab-file]').setInputFiles(pdf('broken'));await p.waitForFunction(()=>document.querySelector('[data-hc-status]').textContent.includes('읽지 못했습니다'));
  await p.locator('[data-lab-file]').setInputFiles(pdf('replacement'));await p.waitForFunction(()=>document.querySelector('[data-lab-file]').value==='');assert.equal(dialogs,1);
  assert.equal(await p.locator('[data-import-key=value]').inputValue(),'2.7');assert.equal(await p.locator('[data-import-key=reference]').inputValue(),'0.6–1.9');assert.equal(await p.locator('[data-import-pick]').isChecked(),false);assert.equal(await p.locator('[data-import-mode]').inputValue(),'append');assert.equal(await p.evaluate(()=>f.calls.filter(c=>c.url.endsWith('/lab-import')).length),1);
 });
 test('different date is retained without re-reading, excluded from current apply and only explicit correction unlocks review '+width,async t=>{
  const p=await setup(t,width);await p.evaluate(()=>{f.importResponses=[{reportDate:f.records['record-1'].body.healthcheckChart.date,results:[{name:'ALT',value:'40',unit:'U/L',reference:'10–100'}]},{reportDate:'2020-01-01',results:[{name:'CREA',value:'9.9',unit:'mg/dL',reference:'0.5–1.8'}]}];});
  await read(p,[pdf('today'),pdf('other-date')]);await p.locator('[data-date-hold]').waitFor();assert.equal(await p.locator('[data-import-row]').count(),1);assert.doesNotMatch(await p.locator('[data-file-queue]').textContent(),/실패/);
  await p.locator('[data-import-key=reference]').fill('12–90');await p.locator('[data-action=read-file]').click();assert.equal(await p.locator('[data-import-key=reference]').inputValue(),'12–90');assert.equal(await p.evaluate(()=>f.calls.filter(c=>c.url.endsWith('/lab-import')).length),2);
  await p.locator('[data-import-checked]').check();await p.locator('[data-action=apply-import]').click();await p.locator('[data-action=save]').click();await p.waitForFunction(()=>f.records['record-1'].revision===2);
  let chart=await p.evaluate(()=>f.records['record-1'].body.healthcheckChart);assert.equal(chart.summary,'보존할 작성 소견');assert.equal(chart.labs.find(r=>r.name==='CREA').value,'1.1');assert.equal(chart.labs.find(r=>r.name==='CREA').reference,'0.4–2.0');assert.equal(chart.labs.find(r=>r.name==='ALT').reference,'12–90');
  await p.locator('[data-action=resume-import]').click();await p.locator('[data-date-hold]>summary').click();assert.match(await p.locator('[data-date-hold]').textContent(),/9.9/);assert.equal(await p.locator('[data-action=apply-import]').count(),0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const date=await p.evaluate(()=>f.records['record-1'].body.healthcheckChart.date);await p.locator('[data-file-date]').fill(date);await p.locator('[data-file-date-save]').click();assert.match(await p.locator('[data-file-date-status]').textContent(),/대조/);assert.equal(await p.locator('[data-action=apply-import]').count(),0);
  await p.locator('[data-file-date-checked]').check();await p.locator('[data-file-date-save]').click();assert.equal(await p.locator('[data-import-row]').count(),1);assert.equal(await p.locator('[data-import-checked]').isChecked(),false);assert.equal(await p.evaluate(()=>f.calls.filter(c=>c.url.endsWith('/lab-import')).length),2);
  await p.locator('[data-action=apply-import]').click();assert.match(await p.locator('[data-hc-status]').textContent(),/원본 대조/);assert.equal(await p.evaluate(()=>f.records['record-1'].body.healthcheckChart.labs.find(r=>r.name==='CREA').value),'1.1');
 });
}
test('changing record date cannot silently apply previously read results and returning restores edited reference',async t=>{
 const p=await setup(t);await read(p);await p.locator('[data-import-key=reference]').fill('0.6–1.9');await p.locator('[data-import-checked]').check();const date=await p.evaluate(()=>f.records['record-1'].body.healthcheckChart.date);
 await p.locator('[data-step=exams]').click();await p.locator('[data-field=date]').fill('2020-01-01');await p.locator('[data-action=resume-import]').click();assert.equal(await p.locator('[data-action=apply-import]').count(),0);await p.locator('[data-date-hold]>summary').click();assert.match(await p.locator('[data-date-hold]').textContent(),/0.6–1.9/);
 await p.locator('[data-step=exams]').click();await p.locator('[data-field=date]').fill(date);await p.locator('[data-action=resume-import]').click();assert.equal(await p.locator('[data-import-key=reference]').inputValue(),'0.6–1.9');assert.equal(await p.locator('[data-import-checked]').isChecked(),false);assert.equal(await p.evaluate(()=>f.calls.filter(c=>c.url.endsWith('/lab-import')).length),1);
});
test('out of order local file preparation cannot replace the newest selection',async t=>{
 const p=await setup(t);await read(p);await p.evaluate(()=>{const read=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(file){if(file.name==='slow.pdf')window.releaseFile=()=>read.call(this,file);else read.call(this,file);};});p.on('dialog',d=>d.accept());
 await p.locator('[data-lab-file]').setInputFiles(pdf('slow'));await p.locator('[data-lab-file]').setInputFiles(pdf('newest'));await p.waitForFunction(()=>document.querySelector('[data-file-queue]').textContent.includes('newest.pdf'));await p.evaluate(()=>releaseFile());await p.evaluate(()=>new Promise(r=>setTimeout(r,100)));assert.doesNotMatch(await p.locator('[data-file-queue]').textContent(),/slow.pdf/);
});
