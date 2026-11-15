const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
test('healthcheck editing continuity browser scenarios',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="clinic-calm"><div id="practiceRoot"><main id="root"></main></div>'}));await page.goto('http://localhost/');
 for(const file of ['clinic-calm.css','clinic-record-start.css','healthcheck-record.css'])await page.addStyleTag({path:path.resolve(__dirname,'..',file)});
 for(const file of ['clinic-record-start.js','healthcheck-record.js','test/healthcheck-editing-browser.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',file)});
 const results=await page.evaluate(async()=>{const results=[];await HealthcheckEditingChecks.run(r=>results.push(r));return results;});
 assert.ok(results.length>=12);assert.deepEqual(results.filter(r=>!r.ok),[]);assert.deepEqual(errors,[]);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  const result=await page.evaluate(async()=>{const f=await HealthcheckEditingChecks.fixture();f.records['record-1'].body.healthcheckChart.labs=[HealthcheckRecord.row({name:'검사명이 매우 긴 가상 특수 혈액검사 항목',group:'기타 혈액검사',value:'10'})];await f.view.openRecord('record-1');document.querySelector('[data-step=labs]').click();return {overflow:document.documentElement.scrollWidth>innerWidth+1,name:getComputedStyle(document.querySelector('[data-lab-name]')).whiteSpace};});
  assert.equal(result.overflow,false,'lab viewport '+width);assert.notEqual(result.name,'nowrap');
 }
});
