const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
test('healthcheck entry completion and input reuse',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="clinic-calm"><div id="practiceRoot"><main id="root"></main></div></body></html>'}));await page.goto('http://localhost/');
 for(const f of ['clinic-calm.css','clinic-record-start.css','healthcheck-record.css'])await page.addStyleTag({path:path.resolve(__dirname,'..',f)});
 for(const f of ['clinic-record-start.js','healthcheck-record.js','test/healthcheck-editing-browser.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',f)});
 const seed=async values=>{await page.evaluate(async values=>{const f=await HealthcheckEditingChecks.fixture();Object.assign(f.records['record-1'].body.healthcheckChart,{veterinarian:'가상 수의사',...values});await f.view.openRecord('record-1');},values);};
 const save=async()=>{await page.locator('[data-action=save]').click();await page.waitForFunction(()=>document.querySelector('[data-save-state]').textContent.includes('저장 완료'));};
 const chart=()=>page.evaluate(()=>hcFixture.records['record-1'].body.healthcheckChart);
 const issue=(id,timing,tests)=>({id,title:'가상 관리 '+id,status:'followup',finding:'가상 소견',timing,tests,links:[],confirmed:false});
 const openImport=async()=>{const compact=page.locator('[data-compact-nav]');if(await compact.isVisible())await compact.selectOption('summary');else await page.locator('[data-step=summary]').click();await page.locator('.hc-followup-import>summary').click();};
 const pick=async ids=>{for(const id of ids)await page.locator('[data-followup-import-pick="'+id+'"]').check();await page.locator('[data-followup-import-apply]').click();};
 await t.test('completed narrative and management records do not demand optional prose',async()=>{
  await seed({summary:'가상 종합소견'});await page.locator('[data-step=summary]').click();await page.locator('[data-review]').check();await page.locator('[data-action=complete]').click();await page.waitForFunction(()=>hcFixture.records['record-1'].body.healthcheckChart.clinicalStatus==='complete');
  assert.match(await page.locator('[data-step=summary]').innerText(),/검토 완료/);assert.doesNotMatch(await page.locator('[data-review-jump=plans]').innerText(),/\/4/);
  await page.locator('[data-prose=summary]').fill('수정한 가상 소견');assert.match(await page.locator('[data-step=summary]').innerText(),/수정 후 확인 필요/);
  await seed({managementIssues:[issue('a','2026-12-01','혈액검사')]});await page.locator('[data-step=summary]').click();await page.locator('[data-management-confirm]').check();await page.locator('[data-review]').check();await page.locator('[data-action=complete]').click();await page.waitForFunction(()=>hcFixture.records['record-1'].body.healthcheckChart.clinicalStatus==='complete');assert.match(await page.locator('[data-step=summary]').innerText(),/검토 완료/);
  await page.evaluate(()=>hcFixture.view.openRecord('record-1'));assert.match(await page.locator('[data-step=summary]').innerText(),/검토 완료/);
 });
 await t.test('only explicitly selected empty findings get a normal finding',async()=>{
  const before={skin:'발적\n기존 직접 입력',ears:'미검사',eyes:'결과 대기',oral:'평가 불가'};
  await seed({examSelection:['physical','nutrition','skin','ears','eyes','oral','cardiac','respiratory'],exams:before});await page.locator('.hc-normal-tools>summary').click();
  assert.equal(await page.locator('[data-normal-pick]:checked').count(),0);assert.equal(await page.locator('[data-normal-apply]').isDisabled(),true);
  for(const key of Object.keys(before))assert.equal(await page.locator('[data-normal-pick="'+key+'"]').isDisabled(),true);
  await page.locator('[data-normal-pick=cardiac]').check();await page.locator('[data-normal-apply]').click();await save();const d=await chart();for(const key of Object.keys(before))assert.equal(d.exams[key],before[key]);assert.equal(d.exams.cardiac,'특이 소견 없음');assert.ok(!d.exams.respiratory);assert.equal(d.bcs,null);assert.equal(d.mcs,'');
  await page.evaluate(()=>hcFixture.view.openRecord('record-1'));assert.match(await page.locator('[data-exam-selected=cardiac]').innerText(),/특이 소견 없음/);
 });
 await t.test('selected followup populates date and tests, retains memo, and is idempotent',async()=>{
  await seed({followup:'기존 추가 안내',managementIssues:[issue('a','2026-12-01','혈액검사'),issue('b','2026-12-08','요검사')]});await openImport();await pick(['a']);assert.equal(await page.locator('[data-followup-date]').inputValue(),'2026-12-01');assert.equal(await page.locator('[data-followup-tests]').inputValue(),'혈액검사');
  const text=await page.locator('[data-prose=followup]').inputValue();assert.match(text,/기존 추가 안내/);assert.match(text,/가상 관리 a/);assert.doesNotMatch(text,/가상 관리 b/);await pick(['a']);assert.equal(await page.locator('[data-prose=followup]').inputValue(),text);await save();await page.evaluate(()=>hcFixture.view.openRecord('record-1'));await page.locator('[data-step=summary]').click();assert.equal(await page.locator('[data-followup-date]').inputValue(),'2026-12-01');assert.equal(await page.locator('[data-prose=followup]').inputValue(),text);
 });
 await t.test('multiple dates retain item associations and do not invent a common date',async()=>{
  await seed({managementIssues:[issue('a','2026-12-01','혈액검사'),issue('b','2주 뒤 상태 확인','요검사')]});await openImport();await pick(['a','b']);assert.equal(await page.locator('[data-followup-date]').inputValue(),'');const text=await page.locator('[data-prose=followup]').inputValue();assert.match(text,/\[가상 관리 a\]\n재검 시점: 2026-12-01\n예정 검사: 혈액검사/);assert.match(text,/\[가상 관리 b\]\n재검 시점: 2주 뒤 상태 확인\n예정 검사: 요검사/);
 });
 await t.test('existing date and tests are preserved with no repeated tests',async()=>{
  await seed({followup:'재검 날짜: 2026-12-10\n예정 검사: 혈액검사\n기존 메모',managementIssues:[issue('a','2026-12-01','혈액검사, 요검사')]});await openImport();await pick(['a']);assert.equal(await page.locator('[data-followup-date]').inputValue(),'2026-12-10');assert.equal(await page.locator('[data-followup-tests]').inputValue(),'혈액검사, 요검사');assert.match(await page.locator('[data-prose=followup]').inputValue(),/기존 메모/);
 });
 await t.test('oversized imports leave all current inputs unchanged',async()=>{
  await seed({followup:'기'.repeat(7900),managementIssues:[issue('a','추'.repeat(200),'혈액검사')]});await openImport();await pick(['a']);assert.equal(await page.locator('[data-prose=followup]').inputValue(),'기'.repeat(7900));assert.equal(await page.locator('[data-followup-tests]').inputValue(),'');assert.match(await page.locator('[data-followup-import-status]').innerText(),/8,000/);
 });
 await t.test('readonly mode cannot bulk enter findings or import followup',async()=>{
  await seed({examSelection:['skin'],managementIssues:[issue('a','2026-12-01','혈액검사')]});await page.evaluate(async()=>{hcFixture.editable=false;await hcFixture.view.openRecord('record-1');});await page.locator('.hc-normal-tools>summary').click();assert.equal(await page.locator('[data-normal-pick=skin]').isDisabled(),true);await openImport();assert.equal(await page.locator('[data-followup-import-pick=a]').isDisabled(),true);
 });
 for(const width of [320,390,768,1440])await t.test('new controls remain usable at width '+width,async()=>{
  await page.setViewportSize({width,height:900});await seed({examSelection:['skin','ears','eyes','oral','cardiac','respiratory','abdomen'],managementIssues:[issue('a','2026-12-01','가상 긴 이름의 재검 검사')]});await page.locator('.hc-normal-tools>summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.locator('[data-normal-pick=skin]').check();await page.locator('[data-normal-apply]').click();await openImport();await pick(['a']);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(process.env.HC_REVIEW_DIR)await page.screenshot({path:path.join(process.env.HC_REVIEW_DIR,'updated-'+width+'.png'),fullPage:true});
 });
 assert.deepEqual(errors,[]);
});
