const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
let browser;const {setup,start}=require('./helpers/healthcheck-ui.cjs')(()=>browser);
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(async()=>browser?.close());
for(const width of [390,1440])test('single patient identity, readable active tabs and compact lab controls at '+width,async t=>{
 const {p,errors}=await setup(width);t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});
 await p.addStyleTag({path:path.resolve(__dirname,'../clinic-calm.css')});
 await p.evaluate(()=>{document.body.classList.add('clinic-calm');const shell=document.createElement('div');shell.id='practiceRoot';document.querySelector('#root').before(shell);shell.append(document.querySelector('#root'));const old=document.createElement('section');old.className='cs-patient-header cs-healthcheck-header';old.textContent='나이 미입력';shell.prepend(old);});
 await start(p);
 assert.equal(await p.locator('.cs-healthcheck-header').isVisible(),false);
 assert.match(await p.locator('.hc-patient-identity').innerText(),/가상 보호자.*TEST-1/);
 assert.doesNotMatch(await p.locator('.hc-patient-meta').innerText(),/나이 미입력/);
 assert.equal(await p.evaluate(()=>view.context().birthDate),'2020-01-01');
 await p.locator('[data-step=labs]').click();
 assert.equal(await p.locator('.hc-lab-more').getAttribute('open'),null);
 assert.equal(await p.locator('[data-current-step-state]').isVisible(),false);
 assert.equal(await p.locator('[data-step=labs] [data-step-badge]').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
 await p.locator('[data-action=addrow]').click();
 await p.locator('[data-lab=name]').fill('CREA');await p.locator('[data-lab=name]').blur();
 await p.locator('[data-lab=value]').fill('2.4');await p.locator('[data-lab=value]').blur();
 await p.locator('[data-lab-pick]').check();assert.equal(await p.locator('[data-confirm-picked]').isVisible(),true);
 await p.locator('[data-confirm-picked]').click();assert.equal(await p.locator('[data-lab=confirmed]').isChecked(),true);
 await p.locator('.hc-lab-more>summary').click();assert.equal(await p.locator('[data-previous]').isVisible(),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(process.env.HC_REVIEW_SHOTS){await p.locator('.hc-lab-more>summary').click();await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(process.env.HC_REVIEW_SHOTS,'healthcheck-editor-'+width+'.png'),fullPage:true});}
 await p.locator('[data-action=save]').click();await p.waitForFunction(()=>stored.revision===2);
 assert.equal(await p.evaluate(()=>stored.body.healthcheckChart.labs[0].value),'2.4');
});
test('next action distinguishes unfinished work from final review',async t=>{
 const {p,errors}=await setup();t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});await start(p);
 assert.equal(await p.locator('[data-next-step]').innerText(),'종합소견·관리계획 검토로');
 await p.locator('[data-step=labs]').click();await p.locator('[data-action=addrow]').click();await p.locator('[data-step=exams]').click();
 assert.match(await p.locator('[data-next-step]').innerText(),/^다음 미완료 항목:/);
 await p.locator('[data-next-step]').click();assert.equal(await p.locator('[data-step=labs]').getAttribute('aria-pressed'),'true');
});

test('healthcheck entry persists chosen past notes without copying previous exam results',async t=>{
 const {p,errors}=await setup();t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});
 await p.evaluate(()=>{window.priorSource={id:'prior-case',patient_id:patient.id,body:{species:'cat',category:'healthcheck',healthcheckChart:{date:'2026-01-02',history:'이전 과거력',medications:'이전 약물',exams:{ultrasound:'이전 영상 소견'},labs:[{name:'CREA',value:'1.2',unit:'mg/dL',reference:'0.5-1.8'}]}}};});
 await p.locator('[data-action=new]').click();await p.locator('[data-start-mode=registered]').click();await p.locator('[data-start-search-form] input').fill('가상');await p.locator('[data-start-search-form] button').click();await p.locator('[data-start-pick="0"]').click();
 await p.locator('[data-prior-record]').selectOption('prior-case');await p.locator('[data-prior-pick=history]').check();await p.locator('[data-prior-pick=findings]').check();await p.locator('[data-prior-pick=medications]').check();await p.locator('[data-start-submit]').click();await p.locator('[data-hc-editor]').waitFor();
 const d=await p.evaluate(()=>stored.body.healthcheckChart);assert.match(d.history,/2026-01-02.*건강검진.*prior-case/);assert.match(d.history,/초음파: 이전 영상 소견/);assert.match(d.history,/CREA · 1.2/);assert.match(d.medications,/현재 복용 여부 확인/);assert.deepEqual(d.labs,[]);assert.equal(d.exams.ultrasound,undefined);
});
