const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');let browser;const {setup,start}=require('./helpers/healthcheck-ui.cjs')(()=>browser);
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(()=>browser?.close());
async function go(p,key){if(await p.locator('[data-step='+key+']').isVisible())await p.locator('[data-step='+key+']').click();else await p.locator('[data-compact-nav]').selectOption(key);}
async function fixture(width,t){const {p,errors}=await setup(width);t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});await p.addStyleTag({path:path.resolve(__dirname,'../clinic-calm.css')});await p.evaluate(()=>{document.body.classList.add('clinic-calm');const shell=document.createElement('div');shell.id='practiceRoot';document.querySelector('#root').before(shell);shell.append(document.querySelector('#root'));});await start(p);return p;}
for(const width of [390,1440]){
 test('simple lab entry offers file or manual first and preserves existing results, ranges and shared forms '+width,async t=>{
  const p=await fixture(width,t);await p.evaluate(()=>{workflows=[{id:'existing',body:{kind:'healthcheck-template',title:'기존 공통 서식',species:'cat',examSelection:['physical'],labs:[]}}];stored.body.healthcheckChart.labs=[HealthcheckRecord.row({name:'RBC',group:'CBC',value:'7.2',unit:'내 단위',reference:'내 참고범위',confirmed:true})];return view.openRecord('record-1');});
  await p.locator('[data-field=history]').fill('작성 중 문진');await go(p,'urine');
  assert.equal(await p.locator('[data-action=import]').isVisible(),true);assert.equal(await p.locator('[data-manual-open]').isVisible(),true);assert.equal(await p.locator('.hc-manual-entry').isVisible(),false);
  assert.equal(await p.locator('.hc-lab-tools').isVisible(),false);assert.equal(await p.locator('[data-fill-defaults-open]').isVisible(),false);
  await p.locator('[data-manual-open]').click();await p.locator('[data-manual-labs="요검사"]').click();assert.equal(await p.locator('[data-row]').count(),13);assert.equal(await p.locator('.hc-lab-tools').isVisible(),true);
  await p.locator('[data-action=save]').click();await p.waitForFunction(()=>stored.body.healthcheckChart.labs.length===14);
  await p.evaluate(()=>view.openRecord('record-1'));await go(p,'labs');
  assert.equal(await p.locator('[data-lab=value]').inputValue(),'7.2');assert.equal(await p.locator('[data-lab=reference]').inputValue(),'내 참고범위');
  const r=await p.evaluate(()=>({history:stored.body.healthcheckChart.history,workflows,writes:calls.filter(x=>/workflows|lab-import|healthcheck-summary/.test(x.url)&&x.b)}));assert.equal(r.history,'작성 중 문진');assert.equal(r.workflows[0].body.title,'기존 공통 서식');assert.deepEqual(r.writes,[]);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 });
 test('optional prose opens existing content, shortcut opens blank field and save survives folding '+width,async t=>{
  const p=await fixture(width,t);await go(p,'summary');
  assert.equal(await p.locator('[data-prose=summary]').isVisible(),true);
  for(const key of ['overview','management','followup'])assert.equal(await p.locator('[data-prose='+key+']').isVisible(),false);
  await p.locator('[data-prose-jump=management]').click();await p.locator('[data-prose=management]').fill('작성 중 관리 계획');
  await p.locator('[data-optional-field=management]>summary').click();await go(p,'exams');await go(p,'summary');assert.equal(await p.locator('[data-prose=management]').isVisible(),true);
  await p.locator('[data-prose-jump=overview]').click();await p.locator('[data-prose=overview]').fill('중요 소견');
  await p.locator('[data-prose-jump=followup]').click();await p.locator('[data-prose=followup]').fill('재검 추가 설명');
  await p.locator('[data-prose=summary]').fill('종합 소견 유지');await p.locator('[data-action=save]').click();await p.waitForFunction(()=>stored.body.healthcheckChart.summary==='종합 소견 유지');
  await p.evaluate(()=>view.openRecord('record-1'));await go(p,'summary');
  for(const key of ['overview','management','followup']){assert.equal(await p.locator('[data-prose='+key+']').isVisible(),true);assert.notEqual(await p.locator('[data-prose='+key+']').inputValue(),'');}
  assert.equal(await p.locator('.hc-summary-grid>*').first().locator('[data-prose=summary]').count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 });
 test('photo tools hide without images, align with title and preserve photos and selection across tabs '+width,async t=>{
  const p=await fixture(width,t);
  for(const key of ['eyes','oral','radiograph','ultrasound']){await go(p,key);assert.equal(await p.locator('.hc-photo-bulk').isVisible(),false);assert.equal(await p.locator('.hc-imaging-actions [data-step=images]').isVisible(),true);}
  await p.evaluate(()=>{stored.body.healthcheckChart.images=[{id:'photo1',kind:'oral',caption:'기존 사진 설명',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3cAAAAASUVORK5CYII=',includeInPrint:true}];stored.body.healthcheckChart.exams.oral='기존 구강 소견';return view.openRecord('record-1');});
  await go(p,'oral');assert.equal(await p.locator('.hc-photo-bulk').isVisible(),true);await p.locator('[data-photo-all]').check();await go(p,'eyes');
  assert.equal(await p.locator('.hc-photo-bulk').isVisible(),true);assert.match(await p.locator('[data-photo-count]').innerText(),/숨김 1장/);
  await go(p,'oral');assert.equal(await p.locator('[data-photo-pick]').isChecked(),true);assert.equal(await p.locator('[data-exam=oral]').inputValue(),'기존 구강 소견');assert.equal(await p.locator('.hc-photo-caption').innerText(),'기존 사진 설명');
  await p.locator('[data-photo-all]').uncheck();await go(p,'eyes');assert.equal(await p.locator('.hc-photo-bulk').isVisible(),false);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 });
}

for(const width of [390,1440])for(const existing of ['', '직접 작성한 재검 안내'])test('import reveals follow-up memo and preserves chart and shared forms '+width+' '+(existing?'existing':'empty'),async t=>{
 const p=await fixture(width,t);
 await p.evaluate(()=>{const d=stored.body.healthcheckChart;d.summary='보존할 종합소견';d.labs=[HealthcheckRecord.row({name:'CREA',value:'1.4',unit:'mg/dL',reference:'직접 수정 범위',confirmed:true})];d.managementIssues=[{id:'issue-1',title:'재검 관리',status:'followup',finding:'가상 소견',action:'관찰',timing:'2026-12-12',tests:'혈액검사',links:[],confirmed:false}];workflows=[{id:'existing',body:{kind:'healthcheck-template',title:'기존 공통 서식',species:'cat',examSelection:['physical'],labs:[]}}];return view.openRecord('record-1');});
 await p.locator('[data-field=history]').fill('작성 중 문진');await go(p,'summary');
 await p.locator('[data-followup-date]').fill('2026-12-15');await p.locator('[data-followup-tests]').fill('요검사');
 if(existing){await p.locator('[data-prose-jump=followup]').click();await p.locator('[data-prose=followup]').fill(existing);await p.locator('[data-optional-field=followup]>summary').click();}
 assert.equal(await p.locator('[data-prose=followup]').isVisible(),false);
 await p.locator('.hc-followup-import>summary').click();await p.locator('[data-followup-import-pick]').check();await p.locator('[data-followup-import-apply]').click();
 assert.equal(await p.locator('[data-prose=followup]').isVisible(),true);const memo=await p.locator('[data-prose=followup]').inputValue();assert.match(memo,/재검 시점: 2026-12-12/);if(existing)assert.ok(memo.startsWith(existing));
 assert.equal(await p.locator('[data-followup-date]').inputValue(),'2026-12-15');assert.equal(await p.locator('[data-followup-tests]').inputValue(),'요검사, 혈액검사');
 await p.locator('[data-optional-field=followup]>summary').click();await p.locator('[data-followup-import-pick]').check();await p.locator('[data-followup-import-apply]').click();
 assert.equal(await p.locator('[data-prose=followup]').isVisible(),true);assert.equal(await p.locator('[data-prose=followup]').inputValue(),memo);
 await p.locator('[data-action=save]').click();await p.waitForFunction(()=>stored.body.healthcheckChart.followup.includes('[재검 관리]'));
 const saved=await p.evaluate(()=>({d:stored.body.healthcheckChart,workflows,writes:calls.filter(x=>x.url.endsWith('/workflows')&&x.b)}));assert.equal(saved.d.history,'작성 중 문진');assert.equal(saved.d.summary,'보존할 종합소견');assert.equal(saved.d.labs[0].reference,'직접 수정 범위');assert.equal(saved.d.labs[0].value,'1.4');assert.equal(saved.d.labs[0].confirmed,true);assert.equal(saved.workflows[0].body.title,'기존 공통 서식');assert.deepEqual(saved.writes,[]);
 await p.evaluate(()=>view.openRecord('record-1'));await go(p,'summary');assert.equal(await p.locator('[data-prose=followup]').isVisible(),true);assert.equal(await p.locator('[data-prose=followup]').inputValue(),memo);
});
